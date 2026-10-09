
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { createClient } = require("@supabase/supabase-js");

const {
    PRODUCT_PRICES_PAISE,
    calculateTotalPaise
} = require("./products");

// Check required environment variables.
const requiredEnv = [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET"
];

const missingEnv = requiredEnv.filter(
    key => !process.env[key]
);

if (missingEnv.length > 0) {
    console.error(
        "Missing required environment variables:",
        missingEnv.join(", ")
    );
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Allow the published website and local development servers.
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5500",
    "http://127.0.0.1:5500"
].filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
);

// Health check. Does not reveal private credentials.
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "Sweet Crumbs Payment Backend"
    });
});

// Create an order using trusted server-side prices.
app.post("/api/create-order", async (req, res) => {
    try {
        const { cart, customer = {} } = req.body || {};

        const amountPaise = calculateTotalPaise(cart);

        // Never trust prices supplied by the browser.
        const items = cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price_paise: PRODUCT_PRICES_PAISE[item.name]
        }));

        const safeCustomer = {
            name: typeof customer.name === "string"
                ? customer.name.trim().slice(0, 100)
                : "",
            email: typeof customer.email === "string"
                ? customer.email.trim().slice(0, 254)
                : "",
            phone: typeof customer.phone === "string"
                ? customer.phone.trim().slice(0, 30)
                : ""
        };

        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: "sc_" + crypto.randomUUID().replace(/-/g, ""),
            notes: {
                store: "Sweet Crumbs"
            }
        });

        // Save the order before allowing checkout to proceed.
        const { error: dbError } = await supabase
            .from("orders")
            .insert({
                razorpay_order_id: order.id,
                customer: safeCustomer,
                items,
                amount_paise: amountPaise,
                currency: "INR",
                payment_status: "created"
            });

        if (dbError) {
            console.error("Order database insert failed:", dbError.message);
            return res.status(500).json({
                error: "Could not save the order. Please contact the store before retrying."
            });
        }

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Create-order failed:", error.message);

        res.status(400).json({
            error: error.message || "Could not create order."
        });
    }
});

// Verify checkout signature and confirm captured payment status.
app.post("/api/verify-payment", async (req, res) => {
    try {
        const {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature
        } = req.body || {};

        if (
            typeof orderId !== "string" ||
            typeof paymentId !== "string" ||
            typeof signature !== "string" ||
            !/^[a-f0-9]{64}$/i.test(signature)
        ) {
            return res.status(400).json({
                error: "Invalid payment verification details."
            });
        }

        const { data: savedOrder, error: lookupError } = await supabase
            .from("orders")
            .select("razorpay_order_id, razorpay_payment_id, amount_paise, payment_status")
            .eq("razorpay_order_id", orderId)
            .maybeSingle();

        if (lookupError) {
            console.error("Order lookup failed:", lookupError.message);
            return res.status(500).json({
                error: "Could not verify the order."
            });
        }

        if (!savedOrder) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        if (savedOrder.payment_status === "paid") {
            if (savedOrder.razorpay_payment_id === paymentId) {
                return res.json({
                    verified: true,
                    status: "paid",
                    message: "Payment already verified."
                });
            }

            return res.status(409).json({
                error: "This order has already been paid."
            });
        }

        // Required Razorpay HMAC SHA-256 signature verification.
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest();

        const receivedSignature = Buffer.from(signature, "hex");

        if (
            expectedSignature.length !== receivedSignature.length ||
            !crypto.timingSafeEqual(
                expectedSignature,
                receivedSignature
            )
        ) {
            return res.status(400).json({
                error: "Payment signature verification failed."
            });
        }

        // Also confirm the payment belongs to this order and amount.
        const payment = await razorpay.payments.fetch(paymentId);

        if (
            payment.order_id !== orderId ||
            payment.amount !== Number(savedOrder.amount_paise) ||
            payment.currency !== "INR"
        ) {
            return res.status(400).json({
                error: "Payment details do not match this order."
            });
        }

        if (payment.status !== "captured") {
            return res.status(202).json({
                verified: false,
                status: payment.status,
                message: "Payment is not captured yet. Do not retry payment."
            });
        }

        const { error: updateError } = await supabase
            .from("orders")
            .update({
                razorpay_payment_id: paymentId,
                payment_status: "paid",
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("razorpay_order_id", orderId)
            .eq("payment_status", "created");

        if (updateError) {
            console.error("Payment record update failed:", updateError.message);
            return res.status(500).json({
                error: "Payment received but order update failed. Contact the store; do not pay again."
            });
        }

        res.json({
            verified: true,
            status: "paid",
            message: "Payment verified successfully."
        });
    } catch (error) {
        console.error("Payment verification failed:", error.message);

        res.status(500).json({
            error: "Could not verify payment. Contact the store before retrying."
        });
    }
});

// Central error handler.
app.use((error, req, res, next) => {
    console.error("Request error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "An unexpected server error occurred."
    });
});

app.listen(PORT, () => {
    console.log(`Sweet Crumbs backend running on port ${PORT}`);
});