// 1. Detectar ID del cliente desde la URL
var urlParams = new URLSearchParams(window.location.search);
window.CLIENTE_ID = urlParams.get('id'); 

// 2. Configurar las rutas de Firebase dinámicamente
window.PATH_PRODUCTOS = window.CLIENTE_ID ? `comercios/${window.CLIENTE_ID}/productos` : null;
window.PATH_ZONAS = window.CLIENTE_ID ? `comercios/${window.CLIENTE_ID}/zonas` : null;
window.PATH_CONFIG = window.CLIENTE_ID ? `comercios/${window.CLIENTE_ID}/configuracion` : null;

// 3. Ahora, todas tus llamadas a Firebase deben usar estas variables
// Ejemplo:
// Antes: db.ref('productos')
// Ahora: db.ref(PATH_PRODUCTOS)

function initApp() {
    // 1. PRIMERO REVISAMOS EL HORARIO (Para quitar el "Cargando" de inmediato)
    checkStoreStatus();

    // 2. CARGAMOS EL RESTO PROTEGIDO (Si algo falla aquí, no congelará la web)
    try { 
        const storeName = document.getElementById('store-name');
        if (storeName) storeName.textContent = TIENDA_CONFIG.nombre; 
    } catch(e) {}

    try { 
        const catalog = document.getElementById('catalog-container');
        if (catalog) catalog.innerHTML = ''; 
    } catch(e) {}

    try { renderCategories(); } catch(e) { console.log("Aviso: renderCategories falló"); }
    try { renderProducts(productos); } catch(e) { console.log("Aviso: renderProducts falló"); }
    
    try { setupSearch(); } catch(e) { console.log("Aviso: setupSearch no encontrado (Ignorado)"); }
    
    try { updateUI(); } catch(e) { console.log("Aviso: updateUI no encontrado"); }
}

function renderCartList() {
    const listContainer = document.getElementById('cart-items-list');
    if (!listContainer) return;

    if (cart.length === 0) {
        listContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-500 gap-2 py-8"><i data-lucide="shopping-cart" class="w-10 h-10 opacity-20"></i><p>El carrito está vacío</p></div>`;
        if (typeof actualizarTotalConEnvio === "function") actualizarTotalConEnvio();
        if (window.lucide) lucide.createIcons();
        return;
    }

    listContainer.innerHTML = cart.map(item => {
        const idLimpio = String(item.cartItemId || item.id);
        return `
        <div class="flex justify-between items-center bg-[#111] p-4 rounded-2xl mb-3 border border-white/5">
            <div class="flex-1">
                <h4 class="font-bold text-white text-sm">${item.nombre}</h4>
                <p class="text-xs text-[#ff6b00] font-bold mt-1">$ ${(item.precio * item.cantidad).toLocaleString()}</p>
            </div>
            <div class="flex items-center gap-4 bg-black px-2 py-1.5 rounded-full border border-white/10">
                <button type="button" onclick="changeQuantity('${idLimpio}', -1)" 
                        class="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-[#ff6b00] rounded-full text-white transition-all cursor-pointer">
                    <span class="text-xl font-bold leading-none mb-0.5">−</span>
                </button>
                <span class="font-bold text-sm w-4 text-center text-white">${item.cantidad}</span>
                <button type="button" onclick="changeQuantity('${idLimpio}', 1)" 
                        class="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-[#ff6b00] rounded-full text-white transition-all cursor-pointer">
                    <span class="text-xl font-bold leading-none mb-0.5">+</span>
                </button>
            </div>
        </div>`;
    }).join('');

    if (typeof actualizarTotalConEnvio === "function") actualizarTotalConEnvio();
}

function checkStoreStatus() {
    try {
        const config = window.TIENDA_CONFIG;

        // Fallback de seguridad: si no hay horario definido, asumimos abierto para no bloquear ventas
        if (!config || !config.horario) {
            updateStatusBadge(true);
            return true;
        }

        const ahora = new Date();
        const minActual = (ahora.getHours() * 60) + ahora.getMinutes();

        const estaEnRango = (turno) => {
            if (!turno || !turno.apertura || !turno.cierre) return false;
            if (turno.apertura === "00:00" && turno.cierre === "00:00") return false;

            const [hApe, mApe] = turno.apertura.split(':').map(Number);
            const [hCie, mCie] = turno.cierre.split(':').map(Number);
            const minApe = (hApe * 60) + mApe;
            const minCie = (hCie * 60) + mCie;
            
            if (minApe < minCie) return minActual >= minApe && minActual <= minCie;
            else return minActual >= minApe || minActual <= minCie; 
        };

        const abiertoT1 = config.horario.turno1 ? estaEnRango(config.horario.turno1) : false;
        const abiertoT2 = config.horario.turno2 ? estaEnRango(config.horario.turno2) : false;
        const estaAbierto = abiertoT1 || abiertoT2;

        let proximo = "";
        const t1Ape = config.horario.turno1 ? config.horario.turno1.apertura : "00:00";
        const t2Ape = config.horario.turno2 ? config.horario.turno2.apertura : "00:00";
        
        const t1Activo = t1Ape !== "00:00" && t1Ape !== "";
        const t2Activo = t2Ape !== "00:00" && t2Ape !== "";

        if (t1Activo && !t2Activo) proximo = t1Ape; 
        else if (!t1Activo && t2Activo) proximo = t2Ape; 
        else if (t1Activo && t2Activo) {
            const minApe1 = t1Ape.split(':').reduce((h, m) => h * 60 + +m);
            const minApe2 = t2Ape.split(':').reduce((h, m) => h * 60 + +m);

            // Si la hora actual es menor a la apertura 1 O mayor a la apertura 2, el próximo es el Turno 1
            if (minActual < minApe1 || minActual >= minApe2) {
                proximo = t1Ape;
            } else {
                proximo = t2Ape;
            }
        }

        updateStatusBadge(estaAbierto, proximo);
        return estaAbierto;

    } catch (error) {
        return true;
    }
}

// Bucle mágico que revisa el estado cada 3 segundos
setInterval(checkStoreStatus, 3000);

// 🔥 FUNCIÓN DEL CARTELITO MEJORADA (A prueba de balas) 🔥
function updateStatusBadge(abierto, proximo = "") {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-badge');
    const parent = document.getElementById('store-status-badge');

    if (dot && text && parent) {
        if (abierto) {
            parent.className = "mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-500 bg-emerald-100 text-emerald-600";
            dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
            text.innerText = "Abierto ahora";
        } else {
            parent.className = "mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-500 bg-red-100 text-red-600";
            dot.className = "w-1.5 h-1.5 rounded-full bg-red-500";
            text.innerText = proximo ? `Cerrado - Abre ${proximo} hs` : "Cerrado";
        }
    }
}

function actualizarCategoriasDinamicas() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    // Extraemos categorías reales de los productos (ej: Conductores, Térmicas)
    const uniqueCats = [...new Set(window.productos.map(p => p.categoria?.trim()).filter(c => c))];
    const categories = ['Todos', ...uniqueCats];
    
    container.innerHTML = categories.map(cat => `
        <button onclick="filterByCategory('${cat}')" 
                class="category-btn capitalize whitespace-nowrap px-6 py-2.5 rounded-full bg-[#1a1a1a] text-gray-400 border border-white/10 text-sm font-semibold transition-all active:scale-95">
            ${cat}
        </button>
    `).join('');
}

// Alias para mantener compatibilidad si se llama como renderCategories
window.renderCategories = actualizarCategoriasDinamicas;

function filterByCategory(cat) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('bg-[#ff6b00]', 'text-black', 'border-[#ff6b00]');
        btn.classList.add('bg-[#1a1a1a]', 'text-gray-400', 'border-white/10');
    });

    const eventBtn = event?.currentTarget;
    if (eventBtn) {
        eventBtn.classList.remove('bg-[#1a1a1a]', 'text-gray-400', 'border-white/10');
        eventBtn.classList.add('bg-[#ff6b00]', 'text-black', 'border-[#ff6b00]');
    }

    if (cat === 'Todos') {
        renderProducts(window.productos);
    } else {
        // Comparación robusta e insensible a mayúsculas
        const filtrados = window.productos.filter(p => 
            (p.categoria || "").toLowerCase().trim() === cat.toLowerCase().trim()
        );
        renderProducts(filtrados);
    }
}

function renderProducts(productosToRender) {
    const catalog = document.getElementById('catalog-container');
    if (!catalog) return;

    if (productosToRender.length === 0) {
        catalog.innerHTML = `<div class="p-8 text-center text-slate-500"><i data-lucide="search-x" class="w-12 h-12 mx-auto mb-3 opacity-20"></i><p>No se encontraron productos.</p></div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    catalog.className = "grid grid-cols-1 gap-6 pb-24";

    catalog.innerHTML = productosToRender.map(prod => {
        let opcionesHTML = '';
        let precioDisplay = `$ ${prod.precio.toLocaleString()}`;

        let btnAgregar = `<button type="button" onclick="addToCart('${prod.id}')" class="h-10 px-5 flex items-center justify-center bg-[#ff6b00] text-black rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all uppercase tracking-wide text-xs">Agregar <span class="text-lg leading-none ml-2 mb-0.5">+</span></button>`;

        if (prod.opciones && prod.opciones.length > 0) {
            precioDisplay = `Desde $${prod.opciones[0].precio.toLocaleString()}`;
            opcionesHTML = `
                <select id="opc-${prod.id}" class="mt-3 w-full bg-[#1a1a1a] border border-white/10 text-white text-sm py-2.5 px-3 rounded-xl focus:outline-none focus:border-[#ff6b00] transition-colors appearance-none">
                    ${prod.opciones.map((op, i) => `<option value="${i}">${op.nombre} - $${op.precio.toLocaleString()}</option>`).join('')}
                </select>
            `;
            btnAgregar = `<button type="button" onclick="addToCart('${prod.id}', document.getElementById('opc-${prod.id}').value)" class="h-10 px-5 flex items-center justify-center bg-[#ff6b00] text-black rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all uppercase tracking-wide text-xs">Agregar <span class="text-lg leading-none ml-2 mb-0.5">+</span></button>`;
        }

        return `
        <div class="bg-[#111] rounded-[2rem] overflow-hidden shadow-lg border border-white/5 flex flex-col">
            <div class="relative w-full h-64 bg-black">
                <img src="${prod.imagen || prod.img || 'https://i.ibb.co/v6SXYpXC/favicon-menuya.webp'}" alt="${prod.nombre}" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" loading="lazy" onerror="this.src='https://i.ibb.co/v6SXYpXC/favicon-menuya.webp'">
            </div>
            <div class="p-5 flex flex-col gap-2">
                <div>
                    <h3 class="font-black text-white text-xl leading-tight">${prod.nombre}</h3>
                    <p class="text-sm text-gray-400 mt-1 line-clamp-2">${prod.desc || ''}</p>
                    ${opcionesHTML}
                </div>
                <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                    <span class="font-black text-[#ff6b00] text-2xl tracking-tighter">${precioDisplay}</span>
                    ${btnAgregar}
                </div>
            </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function setupSearch() {
    const searchInput = document.getElementById('product-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtrados = window.productos.filter(p => 
            (p.nombre || "").toLowerCase().includes(term) || 
            (p.desc || "").toLowerCase().includes(term)
        );
        renderProducts(filtrados);
    });
}

function updateUI() {
    const bar = document.getElementById('bottom-cart-bar');
    const countEl = document.getElementById('cart-count');
    const itemsTextEl = document.getElementById('cart-items-text');
    const totalEl = document.getElementById('cart-total');

    if (!bar || !countEl || !totalEl) return;

    const totalArticulos = cart.reduce((acc, item) => acc + item.cantidad, 0);
    const precioTotal = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    if (totalArticulos > 0) {
        bar.classList.remove('translate-y-full', 'opacity-0');
        countEl.textContent = totalArticulos;
        if(itemsTextEl) itemsTextEl.textContent = totalArticulos === 1 ? '1 artículo' : `${totalArticulos} artículos`;
        totalEl.textContent = `$ ${precioTotal.toLocaleString()}`;
    } else {
        bar.classList.add('translate-y-full', 'opacity-0');
    }
}

function toggleCheckout(show) {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        renderCartList();
        
        const zoneSelect = document.getElementById('delivery-zone');
        if (zoneSelect && TIENDA_CONFIG.zonas) {
            zoneSelect.innerHTML = '<option value="" data-costo="0">Seleccionar zona...</option>' + 
                TIENDA_CONFIG.zonas.map((z, i) => `<option value="${i}" data-costo="${z.costo}">${z.nombre} (+$${z.costo})</option>`).join('');
        }
        actualizarTotalConEnvio();
        if (window.lucide) lucide.createIcons();
    } else {
        modal.classList.add('hidden');
    }
}

function actualizarTotalConEnvio() {
    const subtotal = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const zoneSelect = document.getElementById('delivery-zone');
    const costoEnvio = zoneSelect && zoneSelect.selectedIndex > 0 ? 
        parseInt(zoneSelect.options[zoneSelect.selectedIndex].getAttribute('data-costo') || 0) : 0;
    
    const displayTotal = document.getElementById('modal-total-amount');
    if (displayTotal) {
        displayTotal.textContent = `$ ${(subtotal + costoEnvio).toLocaleString()}`;
    }
}

function obtenerUbicacion() {
    const btn = document.getElementById('btn-location');
    const coordsInput = document.getElementById('cust-coords');

    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> OBTENIENDO...';
    if (window.lucide) lucide.createIcons();

navigator.geolocation.getCurrentPosition(
    (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        coordsInput.value = `${lat},${lng}`;
        
        btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-white"></i> UBICACIÓN OBTENIDA';
        btn.classList.replace('bg-orange-500', 'bg-green-600');
        
        if (window.lucide) lucide.createIcons();
    },
    (error) => {
        btn.innerHTML = '<i data-lucide="map-pin" class="w-4 h-4 text-white"></i> ENVIAR MI UBICACIÓN ACTUAL';
        btn.classList.replace('bg-green-600', 'bg-orange-500'); // Asegura que vuelva a ser naranja si falla
        
        if (window.lucide) lucide.createIcons();

        const errorMsg = "No pudimos obtener la ubicación. Revisá que tu GPS esté prendido y hayas dado los permisos, o escribí la dirección a mano.";
        
        if (window.Swal) {
            Swal.fire({
                text: errorMsg,
                icon: 'info',
                confirmButtonColor: '#ff6b00',
                background: '#1a1a1a',
                color: '#fff'
            });
        } else {
            alert(errorMsg);
        }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
);
}