// PJ Store product data
// Keep this file in sync with app.js when adding or removing products.
window.PJ_STORE_PRODUCTS = [
            {
                        "id": 1,
                        "name": "E Middle Flute",
                        "description": "Handcrafted bamboo flute. Size: 40.64cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1100,
                        "size": "40.64cm",
                        "category": "Middle Flute",
                        "images": [
                                    "https://i.postimg.cc/502FG81g/1771519608780.jpg",
                                    "https://i.postimg.cc/s2wMp1SZ/IMG-20260219-221951301-HDR-2.jpg",
                                    "https://i.postimg.cc/vB45T5jn/IMG-20260219-221943546-HDR-2.jpg"
                        ]
            },
            {
                        "id": 2,
                        "name": "D Middle Flute",
                        "description": "Handcrafted bamboo flute. Size: 45.72cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1300,
                        "size": "45.72cm",
                        "category": "Middle Flute",
                        "images": [
                                    "https://i.postimg.cc/FFqDyHgx/1771520179168.jpg",
                                    "https://i.postimg.cc/SRRX5b02/IMG-20260219-222754339-HDR-2.jpg",
                                    "https://i.postimg.cc/7YCGn4MK/IMG-20260219-222851920-HDR-2.jpg"
                        ]
            },
            {
                        "id": 3,
                        "name": "C# Middle Flute",
                        "description": "Handcrafted bamboo flute. Size: 46.99cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1470,
                        "size": "46.99cm",
                        "category": "Middle Flute",
                        "images": [
                                    "https://i.postimg.cc/XJPcksFZ/1771520546004.jpg",
                                    "https://i.postimg.cc/YSxhCCMh/IMG-20260219-223337971-HDR-2.jpg",
                                    "https://i.postimg.cc/4yj3SKQR/IMG-20260219-223359439-HDR-3.jpg"
                        ]
            },
            {
                        "id": 4,
                        "name": "C Middle Flute",
                        "description": "Handcrafted bamboo flute. Size: 49.53cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1500,
                        "size": "49.53cm",
                        "category": "Middle Flute",
                        "images": [
                                    "https://i.postimg.cc/Px0V5XSc/1771520843131.jpg",
                                    "https://i.postimg.cc/NjGDY2gT/IMG-20260219-223817682-HDR-2.jpg",
                                    "https://i.postimg.cc/L6ffMRYT/IMG-20260219-223823254-HDR-2.jpg"
                        ]
            },
            {
                        "id": 5,
                        "name": "A# Base Flute",
                        "description": "Handcrafted bamboo flute. Size: 54.61cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1600,
                        "size": "54.61cm",
                        "category": "Base Flute",
                        "images": [
                                    "https://i.postimg.cc/3RQD8zXM/1771521406435.jpg",
                                    "https://i.postimg.cc/9Q44Gcby/IMG-20260219-224734484-HDR-2.jpg",
                                    "https://i.postimg.cc/PJ3xw783/IMG-20260219-224743992-HDR-2.jpg"
                        ]
            },
            {
                        "id": 6,
                        "name": "A Base Flute",
                        "description": "Handcrafted bamboo flute. Size: 59.69cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1700,
                        "size": "59.69cm",
                        "category": "Base Flute",
                        "images": [
                                    "https://i.postimg.cc/HsnjgTfK/1771521704557.jpg",
                                    "https://i.postimg.cc/3x1kKwKd/IMG-20260219-225310152-HDR-2.jpg",
                                    "https://i.postimg.cc/9MR0ttyc/IMG-20260219-225316805-HDR-2.jpg"
                        ]
            },
            {
                        "id": 7,
                        "name": "G# Base Flute",
                        "description": "Handcrafted bamboo flute. Size: 62.23cm. Perfect for practice, performance, and soulful tones.",
                        "price": 1850,
                        "size": "62.23cm",
                        "category": "Base Flute",
                        "images": [
                                    "https://i.postimg.cc/hvj4c03r/1771522139146.jpg",
                                    "https://i.postimg.cc/Pxgx6pM3/IMG-20260219-230013992-HDR-2.jpg",
                                    "https://i.postimg.cc/PfDNCyt3/IMG-20260219-230030866-HDR-2.jpg"
                        ]
            },
            {
                        "id": 8,
                        "name": "G Base Flute",
                        "description": "Handcrafted bamboo flute. Size: 67.31CM. Perfect for practice, performance, and soulful tones.",
                        "price": 1800,
                        "size": "67.31CM",
                        "category": "Base Flute",
                        "images": [
                                    "https://i.postimg.cc/T38x4GGF/1771522508719.jpg",
                                    "https://i.postimg.cc/nLpJnkXR/IMG-20260219-234259235-HDR-2.jpg",
                                    "https://i.postimg.cc/7ZKZFQVT/IMG-20260219-234312866-HDR-2.jpg"
                        ]
            }
];

const validPincodes = ["744101", "744102", "744103", "744104", "744105", "110001", "110002", "110003", "400001", "400002", "700001", "560001", "600001", "500001", "380001"];
const FAR_DISTANCE_SPEED_POST_CHARGE = 400;
const NO_PINCODE_MULTIPLIER = 1.6;
const FREE_DELIVERY_THRESHOLD = 2999;

function calculateNoPincodeCharge() {
    return Math.round(FAR_DISTANCE_SPEED_POST_CHARGE * NO_PINCODE_MULTIPLIER);
}

function applyNoPincodeCharge(resultEl) {
    shippingCharge = calculateNoPincodeCharge();
    userLocationDetails = "Location unable to detect (No pincode entered)";
    if (resultEl) {
        resultEl.innerHTML = `Location could not be detected. Delivery charge: <b>₹${shippingCharge}</b> (farthest Speed Post rate from Andaman plus 60% handling factor)`;
        resultEl.className = 'pincode-result error';
    }
    renderProducts();
    updateCartUI();
};

