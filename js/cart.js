let cart = JSON.parse(localStorage.getItem('pedido')) || [];

function addToCart(id, opcionIndex = null) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;

    let cartItemId = id;
    let cartItemName = prod.nombre;
    let cartItemPrice = prod.precio;

    if (opcionIndex !== null && prod.opciones && prod.opciones[opcionIndex]) {
        const op = prod.opciones[opcionIndex];
        cartItemId = `${id}-${opcionIndex}`;
        cartItemName = `${prod.nombre} (${op.nombre})`;
        cartItemPrice = op.precio;
    }

    const exists = cart.find(item => String(item.cartItemId || item.id) === String(cartItemId));
    
    if (exists) {
        exists.cantidad++;
    } else {
        cart.push({ ...prod, cartItemId: cartItemId, nombre: cartItemName, precio: cartItemPrice, cantidad: 1 });
    }
    saveAndRefresh();
}

function changeQuantity(cartItemId, delta) {
    const buscaId = String(cartItemId);
    const index = cart.findIndex(i => String(i.cartItemId || i.id) === buscaId);
    
    if (index !== -1) {
        cart[index].cantidad += delta;
        if (cart[index].cantidad <= 0) cart.splice(index, 1);
        saveAndRefresh();
        if (typeof renderCartList === "function") renderCartList();
    } else {
        cart = []; // Limpiamos si hay un error
        saveAndRefresh();
        if (typeof renderCartList === "function") renderCartList();
    }
}

function saveAndRefresh() {
    localStorage.setItem('pedido', JSON.stringify(cart));
    if (typeof updateUI === "function") updateUI(); 
}

function iniciarCheckout() {
    if (typeof toggleCheckout === "function") toggleCheckout(true); 
}

function procesarEnvioWhatsApp() {
    try {
        if (typeof checkStoreStatus === "function" && !checkStoreStatus()) {
            return alert("El local se encuentra cerrado en este momento. Intenta de nuevo más tarde.");
        }
        const nombre = document.getElementById('cust-name').value;
        const direccion = document.getElementById('cust-address').value;
        const pago = document.getElementById('cust-payment').value;

        if (!nombre || !direccion) return alert("Por favor ingresa tu nombre y dirección.");
        finalizarPedido({ nombre, direccion, pago });
    } catch (error) {
        alert("Error técnico: " + error.message);
    }
}

function finalizarPedido(datosCliente) {
    const { nombre, direccion, pago } = datosCliente;
    
    const inputRecibe = document.getElementById('cust-receiver');
    const inputHora = document.getElementById('cust-time');
    const coords = document.getElementById('cust-coords')?.value;
    
    const recibe = inputRecibe && inputRecibe.value ? inputRecibe.value : nombre;
    const horaEnvio = inputHora ? inputHora.value : "Lo Antes Posible";
    
    const nroPedido = "PED-" + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const ahora = new Date();
    const fechaHora = `${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, '0')} ${ahora.getDate()}/${ahora.getMonth()+1}/${ahora.getFullYear()}`;

    const zoneSelect = document.getElementById('delivery-zone');
    const selectedOption = zoneSelect ? zoneSelect.options[zoneSelect.selectedIndex] : null;
    const costoEnvio = selectedOption ? parseInt(selectedOption.getAttribute('data-costo') || 0) : 0;
    const nombreZona = (zoneSelect && zoneSelect.selectedIndex > 0) ? selectedOption.text.split(' (')[0] : "No especificada";

    let mensaje = `*NUEVO PEDIDO - ${TIENDA_CONFIG.nombre}*%0AOrden Nº *${nroPedido}* | ${fechaHora}%0A--------------------------%0A%0A`;
    
    let subtotal = 0;
    cart.forEach(item => {
        const sub = item.precio * item.cantidad;
        subtotal += sub;
        mensaje += `• *${item.cantidad}x ${item.nombre}* | $${sub.toLocaleString()}%0A`;
    });

    mensaje += `%0A*Forma de Entrega*%0A• Método: Delivery%0A• Zona: ${nombreZona}%0A• Recibe: ${recibe}%0A• Dirección: ${direccion}%0A`;
    if (coords) {
        mensaje += `• Ubicación: https://www.google.com/maps?q=${coords}%0A`;
    }
    mensaje += `• Hora de Envío: ${horaEnvio}%0A%0A`;
    mensaje += `*Forma de Pago*%0A• Método: ${pago}%0A• Subtotal: $${subtotal.toLocaleString()}%0A`;
    if(costoEnvio > 0) mensaje += `• Costo Envío: $${costoEnvio.toLocaleString()}%0A`;
    
    const totalFinal = subtotal + costoEnvio;
    mensaje += `*TOTAL DEL PEDIDO: $${totalFinal.toLocaleString()}*%0A--------------------------%0A`;

    window.location.href = `https://wa.me/${TIENDA_CONFIG.telefono}?text=${mensaje}`;
}