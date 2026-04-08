const products = window.PJ_STORE_PRODUCTS || [];
let cart = [];
let quantities = {};
let currentSlide = 0;
let shippingCharge = calculateNoPincodeCharge();
let userLocationDetails = "Location unable to detect (No pincode entered)";
let currentFilter = "";
let pincodePromptDismissed = localStorage.getItem('pj_pincode_prompt_dismissed') === '1';
let pincodeValidated = localStorage.getItem('pj_pincode_validated') === '1';
const sliderStates = {};

// ================= CUSTOMIZATION STATE =================
let customizationState = {
    pattern: {
        type: null,
        price: 0,
        image: null
    },
    colors: {
        count: 0,
        price: 0,
        selected: []
    }
};

const CUSTOMIZATION_STORAGE_KEY = 'pj_store_customization_state_v2';

function saveCustomizationState() {
    const payload = {
        pattern: customizationState.pattern,
        colors: customizationState.colors,
        fluteName: document.getElementById('fluteNameInput')?.value.trim() || ''
    };

    try {
        localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(payload));
        sessionStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        try {
            sessionStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
            // Ignore storage failures and keep working in-memory.
        }
    }
}

function loadCustomizationState() {
    const raw = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || sessionStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);
        if (data?.pattern) {
            customizationState.pattern = {
                ...customizationState.pattern,
                ...data.pattern
            };
        }
        if (data?.colors) {
            customizationState.colors = {
                ...customizationState.colors,
                ...data.colors,
                selected: Array.isArray(data.colors.selected) ? data.colors.selected : []
            };
        }
        if (typeof data?.fluteName === 'string') {
            const fluteNameInput = document.getElementById('fluteNameInput');
            if (fluteNameInput) fluteNameInput.value = data.fluteName;
        }
        return true;
    } catch (error) {
        return false;
    }
}

function syncCustomizationUI() {
    const fluteNameInput = document.getElementById('fluteNameInput');
    const preview = document.getElementById('uploadedPatternImage');
    const uploadArea = document.getElementById('uploadArea');
    const changeBtn = document.getElementById('changeImageBtn');
    const uploadSection = document.getElementById('imageUploadSection');

    document.querySelectorAll('.pattern-type-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.type === customizationState.pattern.type);
    });

    document.querySelectorAll('.color-count-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.count, 10) === customizationState.colors.count);
    });

if (customizationState.pattern.image && preview && uploadArea && changeBtn && uploadSection) {
        preview.src = customizationState.pattern.image;
        preview.style.display = 'block';
        uploadArea.style.display = 'none';
        changeBtn.style.display = 'inline-block';
        uploadSection.classList.add('has-image');
    }

    if (fluteNameInput && document.activeElement !== fluteNameInput && typeof fluteNameInput.value === 'string') {
        // Keep the restored value visible without fighting the user's typing.
        fluteNameInput.value = fluteNameInput.value || '';
    }
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function classifyPatternByColorCount(colorCount) {
    if (colorCount <= 1) return { type: 'simple', price: 5, label: 'Simple Pattern' };
    if (colorCount === 2) return { type: 'medium', price: 15, label: 'Medium Pattern' };
    if (colorCount <= 4) return { type: 'complex', price: 30, label: 'Complex Pattern' };
    if (colorCount <= 7) return { type: 'premium', price: 40, label: 'Premium Pattern' };
    return { type: 'highest', price: 50, label: 'Highest Pattern' };
}

async function analyzePatternImage(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 90;
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));

const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            const colorMap = new Map();
            const samples = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                if (a < 200) continue;

                // Ignore near-transparent and near-white background noise.
                if (r > 245 && g > 245 && b > 245) continue;

                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;
                const key = rgbToHex(qr, qg, qb);
                colorMap.set(key, (colorMap.get(key) || 0) + 1);
                samples.push({ r, g, b });
            }

            const uniqueColors = Array.from(colorMap.entries())
                .sort((a, b) => b[1] - a[1]);

            const dominantCount = Math.max(1, Math.min(20, uniqueColors.length));
            resolve({
                uniqueCount: dominantCount,
                palette: uniqueColors.slice(0, 8).map(([hex, count]) => ({ hex, count }))
            });
        };
        img.onerror = () => resolve({ uniqueCount: 1, palette: [] });
        img.src = imageSrc;
    });
}

function updatePatternAutoStatus(message, subMessage, isWarning = false) {
    const box = document.getElementById('patternAutoStatus');
    const main = document.getElementById('patternAutoStatusMain');
    const sub = document.getElementById('patternAutoStatusSub');
    if (box) box.classList.toggle('warning', !!isWarning);
    if (main) main.textContent = message;
    if (sub) sub.textContent = subMessage || '';
}

// Available thread colors - Extended list with Golden, Silver and more
const threadColors = [
    { name: 'Red', hex: '#DC2626' },
    { name: 'Black', hex: '#000000' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Golden', hex: '#D4AF37' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Navy Blue', hex: '#1E3A8A' },
    { name: 'Sky Blue', hex: '#0EA5E9' },
    { name: 'Green', hex: '#16A34A' },
    { name: 'Dark Green', hex: '#14532D' },
    { name: 'Light Green', hex: '#4ADE80' },
    { name: 'Purple', hex: '#9333EA' },
    { name: 'Lavender', hex: '#A855F7' },
    { name: 'Orange', hex: '#F97316' },
    { name: 'Pink', hex: '#EC4899' },
    { name: 'Hot Pink', hex: '#FF1493' },
    { name: 'Yellow', hex: '#EAB308' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Off White', hex: '#F5F5DC' },
    { name: 'Brown', hex: '#92400E' },
    { name: 'Chocolate', hex: '#7B3F00' },
    { name: 'Cream', hex: '#FFFDD0' },
    { name: 'Beige', hex: '#F5F5DC' },
    { name: 'Turquoise', hex: '#40E0D0' },
    { name: 'Teal', hex: '#008080' },
    { name: 'Cyan', hex: '#06B6D4' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Violet', hex: '#8B5CF6' },
    { name: 'Indigo', hex: '#4B0082' },
    { name: 'Peach', hex: '#FFDAB9' },
    { name: 'Coral', hex: '#FF7F50' },
    { name: 'Salmon', hex: '#FA8072' },
    { name: 'Lime', hex: '#32CD32' },
    { name: 'Olive', hex: '#808000' },
    { name: 'Khaki', hex: '#F0E68C' },
    { name: 'Plum', hex: '#DDA0DD' },
    { name: 'Orchid', hex: '#DA70D6' },
    { name: 'Slate', hex: '#708090' },
    { name: 'Charcoal', hex: '#36454F' }
];

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calculateShipFromDist(dist) {
    if (dist < 50) return 50;
    if (dist < 800) return 120;
    if (dist < 1500) return 200;
    if (dist < 3000) return 300;
    return 400;
}

function calculateShipFromState(stateName = "") {
    const state = stateName.toLowerCase();
    if (state.includes("andaman")) return 50;
    if (state.includes("assam") || state.includes("west bengal") || state.includes("odisha") || state.includes("bihar")) return 180;
    if (state.includes("delhi") || state.includes("punjab") || state.includes("jammu") || state.includes("haryana") || state.includes("uttar pradesh")) return 350;
    if (state.includes("kerala") || state.includes("tamil") || state.includes("karnataka") || state.includes("andhra")) return 300;
    return 250;
}

function getActiveShippingCharge() {
    return shippingCharge > 0 ? shippingCharge : calculateNoPincodeCharge();
}

function getEffectiveShippingCharge(subtotal = 0, baseShipping = getActiveShippingCharge()) {
    return Number(subtotal) >= FREE_DELIVERY_THRESHOLD ? 0 : baseShipping;
}

function isPincodePromptVisible() {
    return !pincodeValidated && !pincodePromptDismissed;
}

function showPincodePrompt() {
    return isPincodePromptVisible();
}

function hidePincodePrompt() {
    pincodePromptDismissed = true;
    localStorage.setItem('pj_pincode_prompt_dismissed', '1');
    renderProducts();
}

function revealPincodePrompt() {
    pincodePromptDismissed = false;
    localStorage.removeItem('pj_pincode_prompt_dismissed');
}

function markPincodeValidated() {
    pincodeValidated = true;
    localStorage.setItem('pj_pincode_validated', '1');
    revealPincodePrompt();
}

function scrollToPincode(event) {
    if (event) event.stopPropagation();
    const el = document.getElementById('pincodeSection') || document.getElementById('pincodeBox');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const input = document.getElementById('pincodeInput');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 450);
}

function dismissPincodePrompt(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    hidePincodePrompt();
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

function startSlider() {
    updateHeroSlider();
    setInterval(() => {
        const slides = document.querySelectorAll('.slide');
        if (slides.length < 2) return;
        currentSlide = (currentSlide + 1) % slides.length;
        updateHeroSlider();
    }, 4000);
}

function setSlide(index) {
    currentSlide = index;
    updateHeroSlider();
}

function updateHeroSlider() {
    document.querySelectorAll('.slide').forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
    });
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function getFilteredProducts() {
    const q = currentFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const visibleProducts = getFilteredProducts();

    grid.innerHTML = visibleProducts.map((product, index) => {
        const currentQty = quantities[product.id] || 1;
        const deliveryText = `₹${getEffectiveShippingCharge(product.price)}`;
        return `
            <div class="product-card" id="product-${product.id}" style="animation-delay: ${index * 90}ms">
                <div class="product-slider" 
                     data-product-id="${product.id}"
                     ontouchstart="handleProductTouchStart(event, ${product.id})"
                     ontouchend="handleProductTouchEnd(event, ${product.id})"
                     onmousedown="handleProductMouseDown(event, ${product.id})"
                     onmouseup="handleProductMouseUp(event, ${product.id})"
                     onmouseleave="handleProductMouseLeave(event, ${product.id})">
                    <div class="product-track" id="track-${product.id}">
                        ${product.images.map(img => `
                            <img src="${img}" alt="${escapeHtml(product.name)}" onclick="openImageViewer('${img}')">
                        `).join('')}
                    </div>
                    ${product.images.length > 1 ? `
                        <div class="slider-dots-product">
                            ${product.images.map((_, i) => `
                                <button class="dot-product ${i === 0 ? 'active' : ''}" onclick="goToImage(${product.id}, ${i}, event)"></button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="product-info">
                    <div class="product-category">${product.category}</div>
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <p class="product-desc">${escapeHtml(product.description)}</p>

                    ${showPincodePrompt() ? `
                    <div class="delivery-prompt" data-delivery-prompt="true" onclick="scrollToPincode(event)">
                        <button class="delivery-prompt-close" type="button" aria-label="Dismiss delivery message" onclick="dismissPincodePrompt(event)">×</button>
                        <span class="delivery-prompt-main">Please enter your pincode to calculate delivery for your area.</span>
                        <span class="delivery-prompt-sub">Orders of ₹2999 or more qualify for free delivery. If your cart total is below ₹2999, only one delivery charge is applied to the complete order, even when you purchase multiple products. A single flute priced at ₹2999 or more also ships free automatically.</span>
                    </div>` : ''}
                    <div class="product-meta">
                        <div class="product-price">₹${product.price}</div>
                        <div class="product-meta-line">
                            <div class="product-delivery">Delivery: <strong>${deliveryText}</strong></div>
                            <button class="product-share-circle" type="button" aria-label="Share this product" title="Share this product" onclick="shareProduct(${product.id})">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/>
                                    <path d="M12 3v12"/>
                                    <path d="M7.5 7.5L12 3l4.5 4.5"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="product-footer">
                        <div class="qty-selector">
                            <button class="qty-btn" onclick="updateQty(${product.id}, -1)">−</button>
                            <span id="qty-${product.id}">${currentQty}</span>
                            <button class="qty-btn" onclick="updateQty(${product.id}, 1)">+</button>
                        </div>
                    </div>

                    <div class="product-actions">
                        <button class="product-btn alt" onclick="addToBag(${product.id})">Add to Bag</button>
                        <button class="product-btn" onclick="buyNow(${product.id})">Buy Now</button>
                    </div>
                    <!-- Customize Button - Official Theme -->
                    <button class="customize-btn" onclick="openCustomizationPage('${escapeHtml(product.name)}')">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Customize
                    </button>
                </div>
            </div>
        `;
    }).join('');

setupScrollReveal();
    refreshSliderState();
    scrollToProductFromHash();
}

function refreshSliderState() {
    products.forEach(product => {
        if (sliderStates[product.id] === undefined) sliderStates[product.id] = 0;
        updateSlider(product.id);
    });
}

function updateSlider(productId) {
    const track = document.getElementById(`track-${productId}`);
    if (!track) return;
    const idx = sliderStates[productId] || 0;
    track.style.transform = `translateX(-${idx * 100}%)`;
    const dots = track.parentElement.querySelectorAll('.dot-product');
    dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
}

const productTouchState = {};

function handleProductTouchStart(event, productId) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    productTouchState[productId] = { x: touch.clientX, y: touch.clientY, moved: false };
}

function handleProductTouchEnd(event, productId) {
    const start = productTouchState[productId];
    if (!start) return;
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > 35 && absX > absY) {
        if (dx < 0) nextImage(productId, event);
        else prevImage(productId, event);
    }
    delete productTouchState[productId];
}

let mouseSwipeState = {};
function handleProductMouseDown(event, productId) {
    mouseSwipeState[productId] = { x: event.clientX, y: event.clientY, down: true };
}
function handleProductMouseUp(event, productId) {
    const start = mouseSwipeState[productId];
    if (!start || !start.down) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) nextImage(productId, event);
        else prevImage(productId, event);
    }
    delete mouseSwipeState[productId];
}
function handleProductMouseLeave(event, productId) {
    delete mouseSwipeState[productId];
}

function prevImage(productId, e) {
    e.stopPropagation();
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (sliderStates[productId] === undefined) sliderStates[productId] = 0;
    sliderStates[productId] = (sliderStates[productId] - 1 + product.images.length) % product.images.length;
    updateSlider(productId);
}

function nextImage(productId, e) {
    e.stopPropagation();
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (sliderStates[productId] === undefined) sliderStates[productId] = 0;
    sliderStates[productId] = (sliderStates[productId] + 1) % product.images.length;
    updateSlider(productId);
}

function goToImage(productId, index, e) {
    e.stopPropagation();
    sliderStates[productId] = index;
    updateSlider(productId);
}

function updateQty(productId, delta) {
    quantities[productId] = Math.max(1, (quantities[productId] || 1) + delta);
    const el = document.getElementById(`qty-${productId}`);
    if (el) el.textContent = quantities[productId];
}

function addToBag(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const qty = quantities[productId] || 1;
    for (let i = 0; i < qty; i++) {
        cart.push(product);
    }

    showToast(`${product.name} added to bag`);
    quantities[productId] = 1;
    const qtyEl = document.getElementById(`qty-${productId}`);
    if (qtyEl) qtyEl.textContent = 1;
    updateCartUI();
    openCart();
}

function buildOrderMessage(items, shipping, locationText) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const baseShipping = shipping > 0 ? shipping : calculateNoPincodeCharge();
    const activeShipping = getEffectiveShippingCharge(subtotal, baseShipping);
    const total = subtotal + activeShipping;
    let msg = "PJ STORE ORDER\n\n";
    items.forEach((item, idx) => {
        msg += `${idx + 1}. ${item.name} x${item.qty} - ₹${item.price * item.qty}\n`;
    });
    msg += `\nSubtotal: ₹${subtotal}`;
    msg += `\nShipping: ₹${activeShipping}`;
    msg += `\nTotal: ₹${total}`;
    msg += `\nLocation: ${locationText || 'Not specified'}`;
    msg += `\nRule: Free delivery is applied automatically on orders of ₹2999 or more.`;
    if (activeShipping === 0) {
        msg += `\nFree shipping applied automatically.`;
    } else if (activeShipping === calculateNoPincodeCharge()) {
        msg += `\nNo pincode: farthest Speed Post rate from Andaman plus 60% handling factor applied.`;
    }
function buildGroupedCart() {
    return cart.reduce((acc, item) => {
        const found = acc.find(x => x.id === item.id);
        if (found) found.qty += 1;
        else acc.push({ ...item, qty: 1 });
        return acc;
    }, []);
}

function sendWhatsAppMessage(message) {
    const phone = "919476091829";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
}

function buyNow(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const qty = quantities[productId] || 1;
    const items = [{ ...product, qty }];
    const message = buildOrderMessage(items, shippingCharge || 0, userLocationDetails);
    sendWhatsAppMessage(message);
}


function getProductShareUrl(productId) {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}#product-${productId}`;
}

function scrollToProductFromHash() {
    const hash = window.location.hash || '';
    const match = hash.match(/^#product-(\d+)$/);
    if (!match) return;

    const productEl = document.getElementById(`product-${match[1]}`);
    if (!productEl) return;

    setTimeout(() => {
        productEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        productEl.classList.add('visible');
    }, 120);
}

function shareProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const shareUrl = getProductShareUrl(productId);
    const shareText = `Check out ${product.name} on PJ Store: ${shareUrl}`;

    if (navigator.share) {
        navigator.share({
            title: product.name,
            text: shareText,
            url: shareUrl
        }).catch(() => {
            const fallback = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
            window.open(fallback, '_blank', 'noopener,noreferrer');
        });
    } else {
        const fallback = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(fallback, '_blank', 'noopener,noreferrer');
    }
}

function sendCartToWhatsApp() {
    if (!cart.length) {
        showToast("Your bag is empty");
        return;
    }
    const grouped = buildGroupedCart();
    const message = buildOrderMessage(grouped, shippingCharge || 0, userLocationDetails);
    sendWhatsAppMessage(message);
}

function updateCartUI() {
    const count = cart.length;
    const cartCount = document.getElementById('cartCount');
    const cartDrawerCount = document.getElementById('cartDrawerCount');
    if (cartCount) cartCount.textContent = count;
    if (cartDrawerCount) cartDrawerCount.textContent = count;

    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    if (!cartItems || !cartFooter) return;

if (count === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="5" y="8" width="14" height="13" rx="3"/>
                        <path d="M9 8a3 3 0 0 1 6 0"/>
                    </svg>
                </div>
                <h3>Your bag is empty</h3>
                <p>Explore the collection, add flutes to your bag, then place the order on WhatsApp.</p>
                <button class="continue-shopping" onclick="closeCart()">Continue Shopping</button>
            </div>
        `;
        cartFooter.style.display = 'none';
        updateCartSummaryLive();
        return;
    }

    const grouped = buildGroupedCart();
    cartItems.innerHTML = grouped.map(item => `
        <div class="cart-item">
            <div class="cart-item-img">
                <img src="${item.images[0]}" alt="${escapeHtml(item.name)}">
            </div>
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">₹${item.price}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Size: ${item.size}</div>
                <div class="cart-item-actions">
                    <div class="cart-qty">
                        <button onclick="updateCartQty(${item.id}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button onclick="updateCartQty(${item.id}, 1)">+</button>
                    </div>
                    <button class="remove-item" onclick="removeCartItem(${item.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    const groupedAgain = buildGroupedCart();
    const subtotal = groupedAgain.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const shipping = getEffectiveShippingCharge(subtotal);
    const total = subtotal + shipping;
    document.getElementById('cartTotal').textContent = total;
    cartFooter.style.display = 'block';
    updateCartSummaryLive();
}

function updateCartQty(productId, delta) {
    if (delta > 0) {
        const product = products.find(p => p.id === productId);
        if (product) cart.push(product);
    } else {
        const idx = cart.map((item, i) => item.id === productId ? i : -1).filter(i => i !== -1).pop();
        if (idx !== undefined) cart.splice(idx, 1);
    }
    updateCartUI();
}

function removeCartItem(productId) {
    const idx = cart.findIndex(item => item.id === productId);
    if (idx !== -1) cart.splice(idx, 1);
    updateCartUI();
}

function openCart() {
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    updateCartUI();
}

function closeCart() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.body.style.overflow = '';
}

function openInstagramModal() {
    document.getElementById('instagramModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeInstagramModal() {
    document.getElementById('instagramModal').classList.remove('open');
    document.body.style.overflow = '';
}

function openImageViewer(src) {
    document.getElementById('viewerImage').src = src;
    document.getElementById('imageViewer').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeImageViewer() {
    document.getElementById('imageViewer').classList.remove('open');
    document.body.style.overflow = '';
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterProducts(value) {
    currentFilter = value || '';
    renderProducts();
}

function checkPincode() {
    const input = document.getElementById('pincodeInput');
    const result = document.getElementById('pincodeResult');
    const pincode = (input.value || '').trim();

    if (!pincode) {
        applyNoPincodeCharge(result);
        return;
    }

    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        result.textContent = 'Please enter a valid 6-digit pincode.';
        result.className = 'pincode-result error';
        return;
    }

    result.textContent = 'Checking delivery charge...';
    result.className = 'pincode-result';

    fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        .then(res => res.json())
        .then(data => {
            const office = data && data[0] && data[0].PostOffice && data[0].PostOffice[0];
            if (!office) throw new Error('Invalid pincode');

            const charge = calculateShipFromState(office.State);
            shippingCharge = charge;
            userLocationDetails = `${office.District}, ${office.State} (${pincode})`;
            result.innerHTML = `📍 ${office.District} • Shipping: <b>₹${charge}</b> • Free delivery on orders of ₹2999 or more`;
            result.className = 'pincode-result success';
            markPincodeValidated();
            renderProducts();
            updateCartUI();
        })
        .catch(() => {
            applyNoPincodeCharge(result);
        });
}

function detectLocation() {
    const input = document.getElementById('pincodeInput');
    const result = document.getElementById('pincodeResult');

    if (!navigator.geolocation) {
        applyNoPincodeCharge(result);
        return;
    }

    result.textContent = 'Detecting your location...';
    result.className = 'pincode-result';

    navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
            const dist = getDistance(11.62, 92.72, lat, lon);
            const reverse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await reverse.json();
            const state = (data.address && data.address.state) || '';
            const city = (data.address && (data.address.city || data.address.town || data.address.village)) || 'Your City';

            shippingCharge = calculateShipFromDist(dist);
            userLocationDetails = `${city}, ${state}`;
            result.innerHTML = `📍 ${city} • ${Math.round(dist)}km • Shipping: <b>₹${shippingCharge}</b> • Free delivery on orders of ₹2999 or more`;
            result.className = 'pincode-result success';
            if (input) input.value = '744101';
            markPincodeValidated();
            renderProducts();
            updateCartUI();
        } catch (e) {
            applyNoPincodeCharge(result);
        }
    }, () => {
        applyNoPincodeCharge(result);
    });
}

function setupScrollReveal() {
    const elements = document.querySelectorAll('.pincode-box, .product-card, .instagram-banner, .info-section, .location-section, .contact-section, .care-tips-section');
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(el => observer.observe(el));
}

function syncFocusEffects() {
    document.querySelectorAll('.pincode-box input, .collection-search').forEach(inp => {
        let active = false;
        inp.addEventListener('focus', () => {
            if (active) return;
            active = true;
            inp.classList.add('typing-magic');
            setTimeout(() => {
                inp.classList.remove('typing-magic');
                active = false;
            }, 900);
        }, { passive: true });
    });
}

function pulseButtons() {
    document.addEventListener('click', (e) => {
        if (e.target && e.target.innerText && e.target.innerText.includes('Add to Bag')) {
            e.target.style.transform = 'scale(0.96)';
            setTimeout(() => e.target.style.transform = '', 140);
        }
        if (e.target && e.target.innerText && e.target.innerText.includes('Buy Now')) {
            e.target.style.transform = 'scale(0.96)';
            setTimeout(() => e.target.style.transform = '', 140);
        }
    });
}

// ================= AUTOMATIC THEME BASED ON TIME =================
function checkAndApplyTheme() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    // 6:30 AM = 390 minutes, 6:30 PM = 1110 minutes
    const morningStart = 6 * 60 + 30;  // 6:30 AM
    const eveningStart = 18 * 60 + 30; // 6:30 PM
    
    const body = document.body;
    
    if (currentTime >= morningStart && currentTime < eveningStart) {
        // Day time - Light mode
        body.setAttribute('data-theme', 'light');
    } else {
        // Night time - Dark mode
        body.setAttribute('data-theme', 'dark');
    }
}

// ================= CUSTOMIZATION FUNCTIONS =================

// Open Customization Page

function getCustomizationStep() {
    if (customizationState.pattern.type && customizationState.colors.selected.length > 0) return 3;
    if (customizationState.pattern.type) return 2;
    return 1;
}

function updateCustomizationStepper() {
    const step = getCustomizationStep();
    const nodes = document.querySelectorAll('.stepper-node');
    const caption = document.getElementById('stepperCaption');
    const captions = {
        1: 'Choose a pattern first to begin.',
        2: 'Great — now select thread colors that match your style.',
        3: 'Review everything once more before download and WhatsApp sharing.'
    };

    nodes.forEach(node => {
        const nodeStep = parseInt(node.dataset.step, 10);
        node.classList.toggle('active', nodeStep === step);
        node.classList.toggle('done', nodeStep < step);
    });

    if (caption) caption.textContent = captions[step] || captions[1];
}

function buildPreviewSwatches() {
    const colors = customizationState.colors.selected.slice(0, 4);
    if (!colors.length) {
        return `<div class="preview-swatch">
            <div class="preview-swatch-dot" style="background: linear-gradient(135deg, var(--coral), var(--orange));"></div>
            <span>Pattern + Colors Preview</span>
        </div>`;
    }
    return colors.map(color => `
        <div class="preview-swatch">
            <div class="preview-swatch-dot" style="background-color: ${color.hex};"></div>
            <span>${escapeHtml(color.name)}</span>
        </div>
    `).join('');
}

function updateLivePreview() {
    const pane = document.getElementById('livePreviewPane');
    const badge = document.getElementById('previewBadge');
    const fluteName = document.getElementById('fluteNameInput')?.value.trim() || 'Your Flute';
    if (!pane) return;

    const patternLabel = customizationState.pattern.type
        ? (customizationState.pattern.type === 'official'
            ? 'Official Pattern'
            : `${customizationState.pattern.type.charAt(0).toUpperCase()}${customizationState.pattern.type.slice(1)} Pattern`)
        : 'No Pattern Selected';

    const previewBg = customizationState.colors.selected.length
        ? `linear-gradient(135deg, ${customizationState.colors.selected.map(c => c.hex).join(', ')})`
        : 'linear-gradient(135deg, rgba(234,142,160,0.26), rgba(243,154,82,0.26))';

    const previewInner = customizationState.pattern.image
        ? `<img class="preview-pattern-image" src="${customizationState.pattern.image}" alt="Pattern preview">`
        : `
            <div class="preview-placeholder">
                <div class="preview-placeholder-icon">
                    <span class="preview-sparkle sparkle-one">✦</span>
                    <span class="preview-sparkle sparkle-two">✦</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 15.6V8.6c0-1 .8-1.8 1.8-1.8h2.7c.6 0 1.1.3 1.5.8l.9 1.2h4.7c1 0 1.8.8 1.8 1.8v5"></path>
                        <path d="M7.3 7.3V5.9c0-.5.4-.9.9-.9h1.2"></path>
                        <path d="M6.8 14.9h10.4"></path>
                        <path d="M10.6 8.5l1 6"></path>
                        <path d="M15.4 9.8h2.2"></path>
                    </svg>
                </div>
                <div class="preview-placeholder-title">${escapeHtml(patternLabel)}</div>
                <div class="preview-placeholder-subtitle">Select a pattern or upload an image to preview it here</div>
            </div>
        `;

    pane.innerHTML = `
        <div class="preview-stage" style="background: ${previewBg}">
            ${previewInner}
            <div class="preview-flute-name">${escapeHtml(fluteName)}</div>
        </div>
        <div class="preview-swatches">
            ${buildPreviewSwatches()}
        </div>
    `;

    if (badge) {
        badge.textContent = customizationState.colors.selected.length
            ? `${customizationState.colors.selected.length} Color${customizationState.colors.selected.length > 1 ? 's' : ''}`
            : (customizationState.pattern.type ? 'Pattern Set' : 'Preview Ready');
    }
}

function toggleFaq(button) {
    const item = button.closest('.faq-item');
    if (!item) return;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
        if (openItem !== item) openItem.classList.remove('open');
    });
    item.classList.toggle('open', !isOpen);
}

function updateCartSummaryLive() {
    const box = document.getElementById('cartOrderSummary');
    if (!box) return;

    if (!cart.length) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }

    const grouped = buildGroupedCart();
    const itemCount = grouped.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = grouped.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const shipping = getEffectiveShippingCharge(subtotal);
    const total = subtotal + shipping;

    box.style.display = 'grid';
    box.innerHTML = `
        <h4>Real-Time Order Summary</h4>
        <div class="cart-summary-row"><span>Items</span><strong>${itemCount}</strong></div>
        <div class="cart-summary-row"><span>Subtotal</span><strong>₹${subtotal}</strong></div>
        <div class="cart-summary-row"><span>Shipping</span><strong>₹${shipping}</strong></div>
        <div class="cart-summary-row"><span>Total</span><strong>₹${total}</strong></div>
        <div class="cart-summary-row"><span>Location</span><strong>${escapeHtml(userLocationDetails || 'Not specified')}</strong></div>
    `;
}

function openCustomizationPage(fluteName = '') {
    const page = document.getElementById('customizationPage');
    const fluteNameInput = document.getElementById('fluteNameInput');

    if (fluteNameInput) {
        fluteNameInput.value = fluteName || '';
        saveCustomizationState();
    }

    page.classList.add('active');
    document.body.style.overflow = 'hidden';
    syncCustomizationUI();
    updateSelectionSummary();
    updateLivePreview();
    updateCustomizationStepper();
}

// Close Customization Page
function closeCustomizationPage() {
    const page = document.getElementById('customizationPage');
    page.classList.remove('active');
    document.body.style.overflow = '';
}

// Open Pattern Page
function openPatternPage() {
    const page = document.getElementById('patternPage');
    page.classList.add('active');
    syncCustomizationUI();
    if (customizationState.pattern.image) {
        updatePatternAutoStatus('Pattern image already loaded.', 'The category has been assigned from the uploaded image colors.');
    } else {
        updatePatternAutoStatus('Upload a pattern image and the app will count colors automatically.', 'Single color goes to Simple, and up to 7 unique colors will move through the pattern categories.');
    }
    updateCustomizationStepper();
    updateLivePreview();
}

// Close Pattern Page
function closePatternPage() {
    const page = document.getElementById('patternPage');
    page.classList.remove('active');
    updateCustomizationStepper();
    updateLivePreview();
}

// Trigger File Input for Pattern Image
function triggerFileInput(source = 'camera') {
    const fileInput = source === 'file'
        ? document.getElementById('patternFileInput')
        : document.getElementById('patternImageInput');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

// Select Pattern Type
function selectPatternType(element) {
    document.querySelectorAll('.pattern-type-card').forEach(card => {
        card.classList.remove('selected');
    });
    element.classList.add('selected');

    customizationState.pattern.type = element.dataset.type;
    customizationState.pattern.price = parseInt(element.dataset.price);
    updatePatternAutoStatus('Pattern type selected manually.', 'Uploading a pattern image will still auto-detect the color count and update the category.');
    saveCustomizationState();
    updateLivePreview();
    updateCustomizationStepper();
}

// Handle Pattern Image Upload
async function handlePatternImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        customizationState.pattern.image = e.target.result;

        const preview = document.getElementById('uploadedPatternImage');
        const uploadArea = document.getElementById('uploadArea');
        const changeBtn = document.getElementById('changeImageBtn');
        const uploadSection = document.getElementById('imageUploadSection');

        preview.src = e.target.result;
        preview.style.display = 'block';
        uploadArea.style.display = 'none';
        changeBtn.style.display = 'inline-block';
        uploadSection.classList.add('has-image');

        updatePatternAutoStatus('Analyzing uploaded pattern image...', 'The app is counting unique thread colors right now.');

        try {
            const analysis = await analyzePatternImage(e.target.result);
            const detectedCount = analysis.uniqueCount || 1;
            const patternChoice = classifyPatternByColorCount(detectedCount);

            customizationState.pattern.type = patternChoice.type;
            customizationState.pattern.price = patternChoice.price;

            if (detectedCount > 7) {
                updatePatternAutoStatus(
                    `Detected ${detectedCount}+ unique colors — maximum 7 colors are allowed.`,
                    'Please use an image with 7 or fewer visible thread colors for the smoothest selection flow.',
                    true
                );
                showToast('Maximum 7 colors allowed. Please upload a simpler pattern image.');
            } else {
                updatePatternAutoStatus(
                    `Detected ${detectedCount} unique color${detectedCount === 1 ? '' : 's'} — auto set to ${patternChoice.label}.`,
                    'Single color becomes Simple, and more colors automatically move to higher pattern categories.'
                );
                showToast('Image uploaded successfully!');
            }

            saveCustomizationState();
            updateLivePreview();
            updateCustomizationStepper();
            renderPatternSelectionByType(patternChoice.type);
        } catch (error) {
            updatePatternAutoStatus('Could not analyze the image.', 'The preview is ready, but the pattern type was not auto-detected.', true);
            saveCustomizationState();
            updateLivePreview();
            updateCustomizationStepper();
            showToast('Image uploaded, but auto detection failed.');
        }
    };
    reader.readAsDataURL(file);
}

function renderPatternSelectionByType(type) {
    document.querySelectorAll('.pattern-type-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.type === type);
    });
}

// Save Pattern and Return
function savePatternAndReturn() {
    if (!customizationState.pattern.type) {
        showToast('Please select a pattern type');
        return;
    }

    if (customizationState.pattern.type !== 'official' && !customizationState.pattern.image) {
        showToast('Please upload a pattern image');
        return;
    }

    closePatternPage();
    saveCustomizationState();
    updateSelectionSummary();
    updateLivePreview();
    updateCustomizationStepper();
    showToast('Pattern saved!');
}

// Open Color Page
function openColorPage() {
    const page = document.getElementById('colorPage');
    page.classList.add('active');
    renderColorGrid();

    // Show pattern color warning if pattern is selected
    const warning = document.getElementById('patternColorWarning');
    if (customizationState.pattern.type && customizationState.pattern.type !== 'official') {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
    updateCustomizationStepper();
    updateLivePreview();
}

// Close Color Page
function closeColorPage() {
    const page = document.getElementById('colorPage');
    page.classList.remove('active');
    updateCustomizationStepper();
    updateLivePreview();
}

// Render Color Grid
function renderColorGrid(filterText = '') {
    const grid = document.getElementById('colorGrid');
    
    const filteredColors = filterText 
        ? threadColors.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
        : threadColors;
    
    grid.innerHTML = filteredColors.map((color, index) => {
        const originalIndex = threadColors.findIndex(c => c.name === color.name);
        return `
        <div class="color-option ${isColorSelected(color.name) ? 'selected' : ''} ${isColorSelectionFull() && !isColorSelected(color.name) ? 'disabled' : ''}"
             style="background-color: ${color.hex};"
             data-color="${color.name}"
             data-index="${originalIndex}"
             title="${color.name}"
             onclick="toggleColorSelection('${color.name}', '${color.hex}')">
        </div>
    `}).join('');
}

// Filter Colors by Search
function filterColors(searchText) {
    renderColorGrid(searchText);
}

// Check if color is selected
function isColorSelected(colorName) {
    return customizationState.colors.selected.some(c => c.name === colorName);
}

// Check if color selection is full
function isColorSelectionFull() {
    return customizationState.colors.count > 0 && 
           customizationState.colors.selected.length >= customizationState.colors.count;
}

// Select Color Count
function selectColorCount(count) {
    customizationState.colors.count = count;
    customizationState.colors.price = count * 40;

    // Remove excess colors if count reduced
    while (customizationState.colors.selected.length > count) {
        customizationState.colors.selected.pop();
    }

    document.querySelectorAll('.color-count-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.count) === count) {
            btn.classList.add('selected');
        }
    });

    saveCustomizationState();
    renderColorGrid(document.getElementById('colorSearchInput')?.value || '');
    updateSelectedColorsDisplay();
    saveCustomizationState();
    updateLivePreview();
    updateCustomizationStepper();
}

// Toggle Color Selection
function toggleColorSelection(colorName, colorHex) {
    const index = customizationState.colors.selected.findIndex(c => c.name === colorName);

    if (index > -1) {
        // Deselect
        customizationState.colors.selected.splice(index, 1);
    } else {
        // Select
        if (isColorSelectionFull()) {
            showToast(`You can only select ${customizationState.colors.count} colors. Deselect one first.`);
            return;
        }
        if (customizationState.colors.count === 0) {
            showToast('Please select how many colors you want first');
            return;
        }
        customizationState.colors.selected.push({ name: colorName, hex: colorHex });
    }

    renderColorGrid(document.getElementById('colorSearchInput')?.value || '');
    updateSelectedColorsDisplay();
    saveCustomizationState();
    updateLivePreview();
    updateCustomizationStepper();
}

// Remove Selected Color
function removeSelectedColor(colorName) {
    const index = customizationState.colors.selected.findIndex(c => c.name === colorName);
    if (index > -1) {
        customizationState.colors.selected.splice(index, 1);
        renderColorGrid(document.getElementById('colorSearchInput')?.value || '');
        updateSelectedColorsDisplay();
        saveCustomizationState();
        updateLivePreview();
        updateCustomizationStepper();
    }
}

// Update Selected Colors Display
function updateSelectedColorsDisplay() {
    const display = document.getElementById('selectedColorsDisplay');
    const list = document.getElementById('selectedColorsList');
    
    if (customizationState.colors.selected.length === 0) {
        display.style.display = 'none';
        return;
    }
    
    display.style.display = 'flex';
    list.innerHTML = customizationState.colors.selected.map(color => `
        <div class="selected-color-item">
            <div class="selected-color-dot" style="background-color: ${color.hex};"></div>
            <span>${color.name}</span>
            <button class="remove-color-btn" onclick="removeSelectedColor('${color.name}')">×</button>
        </div>
    `).join('');
}

// Save Colors and Return
function saveColorsAndReturn() {
    if (customizationState.colors.count === 0) {
        showToast('Please select how many colors you want');
        return;
    }

    if (customizationState.colors.selected.length === 0) {
        showToast('Please select at least one color');
        return;
    }

    if (customizationState.colors.selected.length !== customizationState.colors.count) {
        showToast(`Please select exactly ${customizationState.colors.count} colors`);
        return;
    }

    closeColorPage();
    updateSelectionSummary();
    updateLivePreview();
    updateCustomizationStepper();
    showToast('Colors saved!');
}

// Update Selection Summary
function updateSelectionSummary() {
    const summary = document.getElementById('selectionSummary');
    const content = document.getElementById('summaryContent');

    let hasSelection = false;
    let html = '';
    const fluteName = document.getElementById('fluteNameInput')?.value.trim();

    if (fluteName) {
        hasSelection = true;
        html += `
            <div class="summary-item">
                <div class="summary-text"><strong>Flute:</strong> ${escapeHtml(fluteName)}</div>
            </div>
        `;
    }

    // Pattern summary
    if (customizationState.pattern.type) {
        hasSelection = true;
        const patternName = customizationState.pattern.type === 'official' ? 'Official Pattern' : 
                           customizationState.pattern.type.charAt(0).toUpperCase() + customizationState.pattern.type.slice(1) + ' Pattern';
        const priceText = customizationState.pattern.price === 0 ? 'FREE' : `₹${customizationState.pattern.price}`;

        html += `
            <div class="summary-item pattern">
                ${customizationState.pattern.image ? `<img src="${customizationState.pattern.image}" alt="Pattern">` : ''}
                <div>
                    <div class="summary-text"><strong>Pattern:</strong> ${patternName}</div>
                </div>
                <div class="summary-price">${priceText}</div>
            </div>
        `;
    }

    // Colors summary
    if (customizationState.colors.selected.length > 0) {
        hasSelection = true;
        html += `
            <div class="summary-item colors">
                <span class="summary-text"><strong>Colors:</strong></span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${customizationState.colors.selected.map(c => `
                        <div class="summary-color-dot" style="background-color: ${c.hex};" title="${c.name}"></div>
                    `).join('')}
                </div>
                <div class="summary-price">₹${customizationState.colors.price}</div>
            </div>
        `;
    }

if (hasSelection) {
        summary.style.display = 'block';
        content.innerHTML = html;
    } else {
        summary.style.display = 'none';
    }
    saveCustomizationState();
    updateLivePreview();
    updateCustomizationStepper();
}

// Open WhatsApp for customization follow-up
function openCustomizationWhatsApp() {
    const fluteName = document.getElementById('fluteNameInput').value.trim() || 'My Flute';
    const parts = [];
    parts.push(`Hello PJ Store, I have downloaded my customization picture for ${fluteName}. Please check it.`);
    if (customizationState.pattern.type) {
        const patternName = customizationState.pattern.type === 'official' ? 'Official Pattern' :
            customizationState.pattern.type.charAt(0).toUpperCase() + customizationState.pattern.type.slice(1) + ' Pattern';
        parts.push(`Pattern: ${patternName}`);
    }
    if (customizationState.colors.selected.length > 0) {
        parts.push(`Colors: ${customizationState.colors.selected.map(c => c.name).join(', ')}`);
    }
    const phone = "919476091829";
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(parts.join('\n'))}`;
    window.open(whatsappUrl, "_blank");
}

function resetCustomizationAfterDownload() {
    customizationState.pattern = {
        type: null,
        price: 0,
        image: null
    };
    customizationState.colors = {
        count: 0,
        price: 0,
        selected: []
    };

    const fluteNameInput = document.getElementById('fluteNameInput');
    const preview = document.getElementById('uploadedPatternImage');
    const uploadArea = document.getElementById('uploadArea');
    const changeBtn = document.getElementById('changeImageBtn');
    const uploadSection = document.getElementById('imageUploadSection');

    if (fluteNameInput) fluteNameInput.value = '';
    if (preview) {
        preview.removeAttribute('src');
        preview.style.display = 'none';
    }
    if (uploadArea) uploadArea.style.display = 'flex';
    if (changeBtn) changeBtn.style.display = 'none';
    if (uploadSection) uploadSection.classList.remove('has-image');

    localStorage.removeItem(CUSTOMIZATION_STORAGE_KEY);
    sessionStorage.removeItem(CUSTOMIZATION_STORAGE_KEY);

    document.querySelectorAll('.pattern-type-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.color-count-btn').forEach(btn => btn.classList.remove('selected'));

    hideDownloadPrompt();
    updateSelectionSummary();
    updateLivePreview();
    updateCustomizationStepper();
}

function hideDownloadPrompt() {
    const prompt = document.getElementById('downloadCompletePrompt');
    if (prompt) prompt.style.display = 'none';
}

function showDownloadPrompt() {
    const prompt = document.getElementById('downloadCompletePrompt');
    if (prompt) prompt.style.display = 'flex';
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function loadImageForCanvas(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function downloadCanvasBlob(canvas, filename) {
    return new Promise((resolve, reject) => {
        if (canvas.toBlob) {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create image blob'));
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                resolve();
            }, 'image/png');
        } else {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                resolve();
            } catch (err) {
                reject(err);
            }
        }
    });
}

async function downloadCustomizationImage() {
    const fluteName = document.getElementById('fluteNameInput').value.trim();
    saveCustomizationState();

    if (!fluteName) {
        showToast('Please enter flute name/model');
        document.getElementById('fluteNameInput').focus();
        return;
    }

    if (!customizationState.pattern.type && customizationState.colors.selected.length === 0) {
        showToast('Please select pattern or color customization');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const margin = 60;
    const contentWidth = width - margin * 2;
    canvas.width = width;

    const selectedCount = customizationState.colors.selected.length;
    const hasPatternImage = !!customizationState.pattern.image;
    const colorsSectionHeight = selectedCount > 0 ? (110 + (selectedCount * 78)) : 100;
    const patternCardHeight = hasPatternImage ? 520 : 240;
    const footerHeight = 90;
    const estimatedHeight = margin + 180 + colorsSectionHeight + patternCardHeight + footerHeight + 40;
    canvas.height = estimatedHeight;

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#fffaf7');
    bg.addColorStop(1, '#faf7f4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ea8ea0';
    ctx.font = '700 72px Arial, sans-serif';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    const phrase = 'PJ STORE';
    for (let y = -canvas.height; y < canvas.height * 1.5; y += 160) {
        for (let x = -canvas.width; x < canvas.width * 1.5; x += 380) {
            ctx.fillText(phrase, x, y);
        }
    }
    ctx.restore();

    const headerY = margin;
    const headerH = 150;
    const headerGrad = ctx.createLinearGradient(margin, headerY, width - margin, headerY + headerH);
    headerGrad.addColorStop(0, '#ea8ea0');
    headerGrad.addColorStop(1, '#f39a52');
    drawRoundedRect(ctx, margin, headerY, contentWidth, headerH, 34);
    ctx.fillStyle = headerGrad;
    ctx.fill();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '700 54px Arial, sans-serif';
    ctx.fillText('PJ STORE', margin + 36, headerY + 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px Arial, sans-serif';
    ctx.fillText('Customization Details', margin + 36, headerY + 112);
    ctx.font = '500 22px Arial, sans-serif';
    ctx.fillText('Picture by PJ Customization', margin + 36, headerY + 140);
    ctx.restore();

    let y = headerY + headerH + 34;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(234,142,160,0.18)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, margin, y, contentWidth, 112, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ea8ea0';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText('Flute Name / Model', margin + 28, y + 38);
    ctx.fillStyle = '#2d2a26';
    ctx.font = '600 34px Arial, sans-serif';
    const fluteLines = wrapCanvasText(ctx, fluteName, contentWidth - 56);
    ctx.fillText(fluteLines[0], margin + 28, y + 78);
    if (fluteLines.length > 1) {
        ctx.fillText(fluteLines[1], margin + 28, y + 112);
    }
    y += 112 + 22;

ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(234,142,160,0.18)';
    drawRoundedRect(ctx, margin, y, contentWidth, colorsSectionHeight, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ea8ea0';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText('Selected Colors', margin + 28, y + 40);

    if (selectedCount === 0) {
        ctx.fillStyle = '#6b625d';
        ctx.font = '500 22px Arial, sans-serif';
        ctx.fillText('No thread colors selected', margin + 28, y + 82);
    } else {
        const firstY = y + 74;
        const lastY = y + 74 + (selectedCount - 1) * 78;
        ctx.beginPath();
        ctx.moveTo(margin + 70, firstY - 16);
        ctx.lineTo(margin + 70, lastY + 16);
        ctx.strokeStyle = 'rgba(234,142,160,0.18)';
        ctx.lineWidth = 2;
        ctx.stroke();

        customizationState.colors.selected.forEach((color, idx) => {
            const rowY = y + 60 + idx * 78;

            ctx.fillStyle = '#2d2a26';
            ctx.font = '700 24px Arial, sans-serif';
            ctx.fillText(`${idx + 1}.`, margin + 28, rowY + 28);

            ctx.beginPath();
            ctx.arc(margin + 70, rowY + 22, 18, 0, Math.PI * 2);
            ctx.fillStyle = color.hex;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.fillStyle = '#2d2a26';
            ctx.font = '600 26px Arial, sans-serif';
            ctx.fillText(color.name, margin + 112, rowY + 30);
        });
    }
    y += colorsSectionHeight + 22;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(234,142,160,0.18)';
    drawRoundedRect(ctx, margin, y, contentWidth, patternCardHeight, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ea8ea0';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText('Pattern Preview', margin + 28, y + 40);

    if (hasPatternImage) {
        try {
            const img = await loadImageForCanvas(customizationState.pattern.image);
            const maxW = contentWidth - 56;
            const maxH = patternCardHeight - 98;
            const ratio = Math.min(maxW / img.width, maxH / img.height);
            const drawW = img.width * ratio;
            const drawH = img.height * ratio;
            const imgX = margin + (contentWidth - drawW) / 2;
            const imgY = y + 60 + (maxH - drawH) / 2;
            drawRoundedRect(ctx, imgX, imgY, drawW, drawH, 18);
            ctx.save();
            ctx.clip();
            ctx.drawImage(img, imgX, imgY, drawW, drawH);
            ctx.restore();
        } catch (error) {
            ctx.fillStyle = '#6b625d';
            ctx.font = '500 22px Arial, sans-serif';
            ctx.fillText('Pattern image could not be loaded', margin + 28, y + 88);
        }
    } else {
        ctx.fillStyle = '#6b625d';
        ctx.font = '500 22px Arial, sans-serif';
        ctx.fillText('Official pattern selected or no uploaded pattern image', margin + 28, y + 88);
    }

    y += patternCardHeight + 34;

    ctx.fillStyle = '#2d2a26';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText('PJ STORE', margin, y + 20);
    ctx.fillStyle = '#6b625d';
    ctx.font = '500 18px Arial, sans-serif';
    ctx.fillText('Download ready for sharing on WhatsApp', margin, y + 52);

    const finalHeight = Math.min(canvas.height, y + 80);
    const exportCanvas = finalHeight !== canvas.height ? document.createElement('canvas') : canvas;
    if (finalHeight !== canvas.height) {
        exportCanvas.width = width;
        exportCanvas.height = finalHeight;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.drawImage(canvas, 0, 0);
    }

    saveCustomizationState();
    await downloadCanvasBlob(
        exportCanvas,
        `PJ_Customization_${fluteName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'flute'}.png`
    );

    resetCustomizationAfterDownload();
    showToast('Picture downloaded successfully. Customization has been reset.');
}
document.addEventListener('DOMContentLoaded', () => {
    // Apply automatic theme based on time
    checkAndApplyTheme();
    
    // Check theme every minute
    setInterval(checkAndApplyTheme, 60000);

    loadCustomizationState();
    
    const result = document.getElementById('pincodeResult');
    if (result && !document.getElementById('pincodeInput')?.value) {
        result.innerHTML = `No pincode entered yet — delivery will default to ₹${calculateNoPincodeCharge()} (farthest Speed Post rate from Andaman + 60%). Free delivery is available on orders of ₹2999 or more.`;
    }
    if (pincodeValidated) {
        revealPincodePrompt();
    }
    renderProducts();
    startSlider();
    scrollToProductFromHash();
    updateCartUI();
    updateCartSummaryLive();
    syncCustomizationUI();
    updateCustomizationStepper();
    updateLivePreview();
    setupScrollReveal();
    syncFocusEffects();
    pulseButtons();
    updateSelectionSummary();

    const fluteNameInput = document.getElementById('fluteNameInput');
    if (fluteNameInput) {
        fluteNameInput.addEventListener('input', () => {
            saveCustomizationState();
            updateSelectionSummary();
            updateLivePreview();
        });
    }

    window.addEventListener('beforeunload', saveCustomizationState);

    const loader = document.getElementById('pageLoader');
    setTimeout(() => {
        if (loader) loader.classList.add('hidden');
    }, 1200);
});

window.addEventListener('scroll', () => {
    document.querySelectorAll('.parallax').forEach(el => {
        const speed = 0.15;
        const offset = window.scrollY * speed;
        el.style.transform = `translateY(${offset}px)`;
    });
});

window.addEventListener('resize', () => {
    renderProducts();
});

window.addEventListener('hashchange', () => {
    scrollToProductFromHash();
});

window.setSlide = setSlide;
window.prevImage = prevImage;
window.nextImage = nextImage;
window.goToImage = goToImage;
window.updateQty = updateQty;
window.addToBag = addToBag;
window.buyNow = buyNow;
window.updateCartQty = updateCartQty;
window.removeCartItem = removeCartItem;
window.openCart = openCart;
window.closeCart = closeCart;
window.openInstagramModal = openInstagramModal;
window.closeInstagramModal = closeInstagramModal;
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.scrollToSection = scrollToSection;
window.filterProducts = filterProducts;
window.checkPincode = checkPincode;
window.detectLocation = detectLocation;
window.scrollToPincode = scrollToPincode;
window.dismissPincodePrompt = dismissPincodePrompt;
window.sendCartToWhatsApp = sendCartToWhatsApp;

// Customization functions
window.openCustomizationPage = openCustomizationPage;
window.closeCustomizationPage = closeCustomizationPage;
window.openPatternPage = openPatternPage;
window.closePatternPage = closePatternPage;
window.triggerFileInput = triggerFileInput;
window.selectPatternType = selectPatternType;
window.handlePatternImageUpload = handlePatternImageUpload;
window.savePatternAndReturn = savePatternAndReturn;
window.openColorPage = openColorPage;
window.closeColorPage = closeColorPage;
window.selectColorCount = selectColorCount;
window.toggleColorSelection = toggleColorSelection;
window.removeSelectedColor = removeSelectedColor;
window.saveColorsAndReturn = saveColorsAndReturn;
window.openCustomizationWhatsApp = openCustomizationWhatsApp;
window.hideDownloadPrompt = hideDownloadPrompt;
window.downloadCustomizationImage = downloadCustomizationImage;
window.filterColors = filterColors;
window.updateCartSummaryLive = updateCartSummaryLive;
window.toggleFaq = toggleFaq;

document.getElementById('uploadFileBtn')?.addEventListener('click',()=>{
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput')?.addEventListener('change',(e)=>{
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = function(ev){
      if(typeof setPatternImage === 'function'){
        setPatternImage(ev.target.result);
      }else{
        const img = document.getElementById('patternPreview');
        if(img){ img.src = ev.target.result; }
      }
    };
    reader.readAsDataURL(file);
  }
});
