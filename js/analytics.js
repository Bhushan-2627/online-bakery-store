// ==========================================
// BAKERY ANALYTICS
// ==========================================

// Get all saved orders
function getOrders() {
    return JSON.parse(localStorage.getItem("bakeryOrders")) || [];
}


// Calculate analytics data
function calculateAnalytics() {

    const orders = getOrders();

    let totalSales = 0;
    let totalOrders = orders.length;

    const customers = new Set();

    const productSales = {};
    const categorySales = {};

    // Categories for bakery products
    const categories = {
        "Chocolate Cake": "Cakes",
        "Strawberry Cake": "Cakes",
        "Vanilla Cupcake": "Cakes",
        "Butter Croissant": "Pastries",
        "Fresh Bread": "Breads",
        "Garlic Bread": "Breads",
        "Chocolate Cookies": "Cookies",
        "Chocolate Donut": "Pastries",
        "Apple Pie": "Pastries"
    };


    // Process every order
    orders.forEach(order => {

        totalSales += Number(order.total) || 0;

        if (order.customerName) {
            customers.add(order.customerName);
        }


        // Process products in each order
        if (Array.isArray(order.items)) {

            order.items.forEach(item => {

                const quantity =
                    Number(item.quantity) || 0;

                const amount =
                    (Number(item.price) || 0) * quantity;


                // Product sales
                if (!productSales[item.name]) {
                    productSales[item.name] = 0;
                }

                productSales[item.name] += quantity;


                // Category sales
                const category =
                    categories[item.name] || "Other";

                if (!categorySales[category]) {
                    categorySales[category] = 0;
                }

                categorySales[category] += amount;

            });

        }

    });


    // Find best-selling product
    let bestSeller = "No orders yet";
    let highestQuantity = 0;

    Object.entries(productSales).forEach(
        ([product, quantity]) => {

            if (quantity > highestQuantity) {

                highestQuantity = quantity;

                bestSeller = product;

            }

        }
    );


    return {
        totalSales,
        totalOrders,
        totalCustomers: customers.size,
        bestSeller,
        productSales,
        categorySales
    };
}