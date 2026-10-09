
const PRODUCT_PRICES_PAISE = {
    "Chocolate Cake": 45000,
    "Strawberry Cake": 50000,
    "Vanilla Cupcake": 8000,
    "Butter Croissant": 12000,
    "Fresh Bread": 6000,
    "Garlic Bread": 15000,
    "Chocolate Cookies": 18000,
    "Chocolate Donut": 10000,
    "Apple Pie": 22000
};

// Calculate the order total using trusted server prices.
function calculateTotalPaise(cart) {
    if (!Array.isArray(cart) || cart.length === 0) {
        throw new Error("Your cart is empty.");
    }

    let total = 0;

    for (const item of cart) {
        const price = PRODUCT_PRICES_PAISE[item?.name];
        const quantity = item?.quantity;

        if (!Number.isSafeInteger(price)) {
            throw new Error("Invalid product: " + item?.name);
        }

        if (
            !Number.isSafeInteger(quantity) ||
            quantity < 1 ||
            quantity > 20
        ) {
            throw new Error("Invalid product quantity.");
        }

        total += price * quantity;
    }

    if (!Number.isSafeInteger(total) || total < 100) {
        throw new Error("Invalid order amount.");
    }

    return total;
}

module.exports = {
    PRODUCT_PRICES_PAISE,
    calculateTotalPaise
};