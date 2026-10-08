// ==========================================
// CART SYSTEM
// ==========================================

// Get cart from localStorage
function getCart() {
    return JSON.parse(localStorage.getItem("bakeryCart")) || [];
}


// Save cart to localStorage
function saveCart(cart) {
    localStorage.setItem("bakeryCart", JSON.stringify(cart));
}


// Add product to cart
function addToCart(productName, price) {

    let cart = getCart();

    // Check whether product already exists
    const existingProduct = cart.find(
        product => product.name === productName
    );

    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        cart.push({
            name: productName,
            price: price,
            quantity: 1
        });
    }

    saveCart(cart);

    updateCartCount();

    alert(productName + " added to cart!");
}


// Update cart number in navigation
function updateCartCount() {

    const cart = getCart();

    let totalItems = 0;

    cart.forEach(product => {
        totalItems += product.quantity;
    });

    const cartCount = document.getElementById("cart-count");

    if (cartCount) {
        cartCount.textContent = totalItems;
    }
}


// Remove a product from cart
function removeFromCart(productName) {

    let cart = getCart();

    cart = cart.filter(
        product => product.name !== productName
    );

    saveCart(cart);

    updateCartCount();

    // Refresh cart page if currently open
    if (typeof displayCart === "function") {
        displayCart();
    }
}


// Change quantity
function changeQuantity(productName, change) {

    let cart = getCart();

    const product = cart.find(
        item => item.name === productName
    );

    if (product) {

        product.quantity += change;

        // Remove product if quantity becomes zero
        if (product.quantity <= 0) {
            cart = cart.filter(
                item => item.name !== productName
            );
        }
    }

    saveCart(cart);

    updateCartCount();

    if (typeof displayCart === "function") {
        displayCart();
    }
}


// Clear entire cart
function clearCart() {

    localStorage.removeItem("bakeryCart");

    updateCartCount();

    if (typeof displayCart === "function") {
        displayCart();
    }
}


// Update cart count when page loads
document.addEventListener("DOMContentLoaded", function () {
    updateCartCount();
});