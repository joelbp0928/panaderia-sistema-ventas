import { cargarConfiguracion, configuracionGlobal } from "./config.js";
import { marcarErrorCampo, mostrarToast } from "./manageError.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { aplicarPromociones, aplicarDescuentosPedido, calcularTotalPedido } from "./aplicarPromocion.js";
import { getLocalDateString } from "./dateLocalDate.js";
import { guardarPedido } from "./guardarPedido.js";
import { supabase } from "./supabase-config.js";

const beepError = new Audio("../sounds/error-beep.mp3");
let productosSeleccionados = []; // Array para almacenar los productos seleccionados
let selectedProductId = null; // ID del producto seleccionado para editar la cantidad
let editQuantityModal = null; // Variable global para guardar la instancia
let cantidadPedidosActual = 0; // Para comparar si aumentó
let realtimeChannel = null;
let pedidoActual = null;
let productosDelPedido = [];

// Colores para los estados de los pedidos
const estadoColores = {
    'pendiente': 'bg-warning',  // Naranja para pendiente
    'preparacion': 'bg-info',  // Azul para en preparación
    'empacado': 'bg-success',  // Verde para empacado
    'cancelado': 'bg-danger',  // Rojo para cancelado
};

// Función para aplicar el color y el texto según el estado
function obtenerColorEstado(estado) {
    return estadoColores[estado] || 'bg-secondary';  // Predeterminado si no está definido
}

// Iniciar la aplicación cuando el DOM esté listo
window.onload = async function () {
    initializeApp()
};

// Función principal de inicialización
async function initializeApp() {
    await verificarSesion();
    cargarConfiguracion();
    cargarCategorias();
    actualizarTabla();

    if ("Notification" in window) {
        Notification.requestPermission().then(p => console.log("Notificación:", p));
    }

    await actualizarContadorPedidosHoy();

    setupEventListeners();
    await inicializarPedidosPendientes();
    setupRealtime();
}

// Configurar event listeners
function setupEventListeners() {
    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
    // Función para manejar el clic en el botón de nuevos pedidos
    document.getElementById('orders-btn').addEventListener('click', async () => {
        await mostrarPedidosPendientes();
    });
}

// Configura el canal de suscripción
function setupRealtime() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel('pedidos_pendientes_empacador')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'pedidos',
                filter: 'estado=eq.pendiente'
            },
            (payload) => {
                //  console.log('Nuevo pedido pendiente detectado:', payload);
                if (payload.new?.origen === 'cliente') {
                    handleNewOrder(payload.new);
                }
            }
        )
        .subscribe((status, err) => {
            // console.log('Estado de suscripción:', status);
            if (err) {
                console.error('Error en la suscripción:', err);
                // Reconectar después de 5 segundos si hay error
                setTimeout(setupRealtime, 5000);
            }
            if (status === 'CHANNEL_ERROR') {
                // Reconectar después de 5 segundos si hay error de canal
                setTimeout(setupRealtime, 5000);
            }
        });
}

const handleNewOrder = (pedido) => {
    // 1. Muestra notificación visual
    showNotification(pedido);

    // 2. Reproduce sonido
    playNotificationSound();

    // 3. Actualiza el contador
    updatePendingOrdersCount();

    // 4. Muestra alerta en la interfaz
    displayOrderAlert(pedido);
};

// Función auxiliar para obtener la cantidad de productos
async function obtenerCantidadProductos(pedidoId) {
    const { data: productos, error } = await supabase
        .from('pedido_productos')
        .select('cantidad')
        .eq('pedido_id', pedidoId);

    if (error) throw error;
    return productos?.reduce((total, item) => total + item.cantidad, 0) || 0;
}

// Función de alerta modificada
async function displayOrderAlert(pedido) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    try {
        const cantidadProductos = await obtenerCantidadProductos(pedido.id);

        const alertId = `alert-${Date.now()}`;
        const alertHTML = `
            <div id="${alertId}" class="alert alert-warning alert-dismissible fade show">
                <strong>Nuevo Pedido</strong>
                <p>Ticket: ${pedido.codigo_ticket}</p>
                <p>Productos: ${cantidadProductos}</p>
                <p>Total: $${pedido.total?.toFixed(2) || '0.00'}</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        container.insertAdjacentHTML('afterbegin', alertHTML);

        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            }
        }, 10000);

    } catch (error) {
        console.error('Error al mostrar alerta:', error);
        // Mostrar versión básica sin cantidad de productos
        const alertId = `alert-${Date.now()}`;
        container.insertAdjacentHTML('afterbegin', `
            <div id="${alertId}" class="alert alert-warning alert-dismissible fade show">
                <strong>Nuevo Pedido</strong>
                <p>Ticket: ${pedido.codigo_ticket}</p>
                <p>Total: $${pedido.total?.toFixed(2) || '0.00'}</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);

        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            }
        }, 10000);
    }
}

const showNotification = async (pedido) => {
    try {
        console.log("Pedido recibido para notificación:", pedido);

        const cantidadProductos = await obtenerCantidadProductos(pedido.id);

        if (Notification.permission === 'granted') {
            new Notification('Nuevo Pedido', {
                body: `Ticket ${pedido.codigo_ticket} - ${cantidadProductos} producto${cantidadProductos !== 1 ? 's' : ''} - Total: $${pedido.total.toFixed(2)}`,
                icon: `${configuracionGlobal.logo_url || ''}`
            });
        }
    } catch (error) {
        console.error("Error al mostrar notificación:", error);
        // Notificación alternativa si falla la consulta
        if (Notification.permission === 'granted') {
            new Notification('Nuevo Pedido', {
                body: `Ticket ${pedido.codigo_ticket} - Total: $${pedido.total.toFixed(2)}`,
                icon: `${configuracionGlobal.logo_url || ''}`
            });
        }
    }
};

const playNotificationSound = () => {
    const audio = new Audio('../sounds/notificacionM.mp3');
    audio.play().catch(e => console.log('Error al reproducir sonido:', e));
};

// Función para actualizar el contador de pedidos pendientes hoy
async function actualizarContadorPedidosHoy() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session.user.id;
    const hoy = getLocalDateString(); // → "2025-04-13"
    const { count, error: countError } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("empleado_id", userId)
        //   .eq("origen", "empacador")
        .gte("fecha", `${hoy}T00:00:00`)
        .lte("fecha", `${hoy}T23:59:59`);

    if (countError) {
        console.warn("❌ No se pudo contar pedidos:", countError.message);
        return;
    }

    const badge = document.getElementById("contador-pedidos-hoy");
    badge.innerHTML = `<i class="fa-solid fa-truck me-1"></i> Hoy: ${count} pedido${count === 1 ? "" : "s"}`;
}

// Mostrar modal para editar cantidad
function showEditQuantityModal(productId, currentQuantity) {
    selectedProductId = productId;
    const quantityInput = document.getElementById("quantity-input");
    quantityInput.value = currentQuantity;
    quantityInput.dataset.fresh = "true"; // Marcar que el input está "fresco" (primer dígito reemplazará)

    // Cierra cualquier modal existente y elimina el backdrop
    if (editQuantityModal) {
        editQuantityModal.hide();
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
    }

    // Crea una nueva instancia del modal
    editQuantityModal = new bootstrap.Modal(document.getElementById("editQuantityModal"));
    editQuantityModal.show();

}

// Función para cargar las categorías desde la base de datos y agregarlas al HTML
async function cargarCategorias() {
    try {
        // Obtener las categorías desde la base de datos
        const { data: categorias, error } = await supabase
            .from("categorias") // Nombre de la tabla de categorías
            .select("id, nombre") // Asegúrate de que "nombre" es el campo correcto en la base de datos

        if (error) throw error;

        // Obtener el contenedor donde se mostrarán los botones de las categorías
        const categoryButtonsContainer = document.getElementById("category-buttons");
        categoryButtonsContainer.innerHTML = ''; // Limpiar el contenedor antes de agregar nuevos botones

        // Iterar sobre las categorías y crear un botón por cada una
        categorias.forEach(categoria => {
            const categoryButton = document.createElement('button');

            categoryButton.classList.add('category-btn');

            categoryButton.textContent = categoria.nombre; // Usamos el nombre de la categoría de la base de datos
            categoryButton.dataset.category = categoria.id;
            categoryButton.onclick = () => cargarProductosPorCategoria(categoria.id); // Aquí usamos el ID para hacer la acción
            categoryButtonsContainer.appendChild(categoryButton);
        });

    } catch (error) {
        console.error("Error cargando las categorías:", error);
    }
}

async function cargarProductosPorCategoria(categoriaId) {
    try {
        // Obtener productos filtrados por categoría desde Supabase
        const { data, error } = await supabase
            .from("productos")
            .select("id, nombre, precio, imagen_url, categoria_id")
            .eq("categoria_id", categoriaId); // Filtrar por la categoría seleccionada

        if (error) throw error;

        // Obtener los contenedores donde se mostrarán los productos y las categorías
        const productList = document.getElementById("products-buttons");
        const categoryButtonsContainer = document.getElementById("category-buttons");
        const productsButtonsContainer = document.getElementById("products-buttons");

        // Limpiar productos y mostrar el contenedor de productos
        productList.innerHTML = "";
        categoryButtonsContainer.style.display = "none"; // Ocultar los botones de categorías

        // ➕ Agregar tarjeta de regreso (siempre visible)
        const backCard = document.createElement("div");
        backCard.classList.add("product-card");
        backCard.style.cursor = "pointer";
        backCard.style.fontSize = "20px"; // Ajustamos el tamaño del texto y el icono
        backCard.innerHTML = `
                <div class="product">
                    <i class="fa-solid fa-rotate-left" style="font-size: 24px;"></i> <!-- Ícono de regresar -->
                </div>
            `;
        backCard.onclick = () => {
            // Limpiar los productos y volver a mostrar las categorías
            productList.innerHTML = "";
            categoryButtonsContainer.style.display = "grid"; // Mostrar categorías
        };

        // Verificar si hay productos disponibles
        if (data.length === 0) {
            productList.innerHTML += "<p>No hay productos en esta categoría.</p>";
            // Agregar el botón de regreso
            productsButtonsContainer.appendChild(backCard);
        } else {
            // Agregar el botón de regreso
            productsButtonsContainer.appendChild(backCard);
            // Mostrar productos en la interfaz
            data.forEach((producto) => {
                const productCard = document.createElement("div");
                productCard.classList.add('fade-slide-in');
                productCard.classList.add("product-card");

                productCard.innerHTML = `
                        <div class="product">
                            <img src="${producto.imagen_url}" alt="${producto.nombre}" class="img-fluid" />
                            <h3>${producto.nombre}</h3>
                            <p>$${producto.precio}</p>
                        </div>
                    `;
                // Agregar el evento de clic a cada producto
                productCard.querySelector('.product').addEventListener('click', () => {
                    agregarProducto(producto.id, producto.nombre, producto.precio); // Llamar a agregarProducto
                });
                productList.appendChild(productCard); // Agregar cada producto
            });
        }
    } catch (error) {
        console.error("Error al cargar los productos:", error);
    }
}

// Función para agregar productos a la tabla de la izquierda
// Función para agregar productos con promociones
async function agregarProducto(id, nombre, precio) {
    // Verificar si el producto ya está en la lista
    const productoExistente = productosSeleccionados.find(p => p.id === id);

    if (productoExistente) {
        // Incrementar cantidad
        productoExistente.cantidad += 1;
    } else {
        // Agregar nuevo producto
        productosSeleccionados.push({
            id,
            nombre,
            precio,
            cantidad: 1,
            descuento: 0,
            promocionAplicada: null,
            total: precio
        });
    }

    // Verificar y aplicar promociones
    await aplicarPromociones(id, productosSeleccionados);

    // Actualizar la tabla
    actualizarTabla();
}

// Función para actualizar la tabla con los productos seleccionados
// Función actualizarTabla modificada para mostrar promociones
function actualizarTabla() {
    const tablaProductos = document.getElementById("product-table").getElementsByTagName('tbody')[0];
    tablaProductos.innerHTML = '';

    if (productosSeleccionados.length === 0) {
        tablaProductos.innerHTML = `<tr class="empty"><td colspan="4">No hay productos seleccionados</td></tr>`;
        document.getElementById("total").textContent = "Total: $0.00";
        return;
    }

    // Calcular totales
    const totalPedido = calcularTotalPedido(productosSeleccionados);
    let totalGeneral = 0;
    let totalDescuentosProductos = 0;

    // Primero calculamos descuentos por producto
    productosSeleccionados.forEach(producto => {
        totalGeneral += producto.total;
        if (producto.descuento > 0) {
            totalDescuentosProductos += producto.descuento;
        }
    });

    // Luego aplicamos descuentos por threshold (pedido)
    // Calcular totales usando la nueva función
    const {
        subtotal,
        descuentoThreshold,
        descuentosProductos,
        promocionThreshold,
        totalConDescuento
    } = aplicarDescuentosPedido(productosSeleccionados);
  //  const totalFinal = totalGeneral - descuentoTotal;

    // Mostrar productos en la tabla
    productosSeleccionados.forEach(producto => {
        const row = tablaProductos.insertRow();

        // Celda de nombre con indicador de promoción
        const cellNombre = row.insertCell(0);
        let nombreHTML = producto.nombre;
        if (producto.promocionAplicada) {
            const icono = producto.promocionAplicada.tipo === 'threshold' ?
                'bogo' : 'fa-tag';
            nombreHTML += ` <i class="fas ${icono} text-success" title="${producto.promocionAplicada.nombre}"></i>`;
        }
        cellNombre.innerHTML = nombreHTML;

        // Otras celdas
        const cellCantidad = row.insertCell(1);
        const cellPrecio = row.insertCell(2);
        const cellTotal = row.insertCell(3);

        cellCantidad.textContent = producto.cantidad;
        cellPrecio.textContent = `$${producto.precio.toFixed(2)}`;

        // Mostrar precio original y con descuento si aplica
        if (producto.descuento > 0) {
            const precioOriginal = (producto.precio * producto.cantidad).toFixed(2);
            cellTotal.innerHTML = `
                <span class="text-muted text-decoration-line-through">$${precioOriginal}</span>
                <br>$${producto.total.toFixed(2)}
            `;
        } else {
            cellTotal.textContent = `$${producto.total.toFixed(2)}`;
        }

        row.addEventListener('click', () => seleccionarFila(row, producto));
    });

 
    // Mostrar total con todos los descuentos
    let htmlTotal = `Total: $${totalConDescuento.toFixed(2)}`;
    
    // Mostrar subtotal
    htmlTotal = `
        <div class="text-muted">
            <small>Subtotal: $${subtotal.toFixed(2)}</small>
        </div>
    ` + htmlTotal;
    
    // Mostrar descuentos por productos si existen
    if (descuentosProductos > 0) {
        htmlTotal += `
            <div class="text-success">
                <small>Descuentos por productos: -$${descuentosProductos.toFixed(2)}</small>
            </div>
        `;
    }
    
    // Mostrar descuento por threshold si aplica
    if (descuentoThreshold > 0) {
        htmlTotal += `
            <div class="text-success">
                <small>Descuento por pedido (${promocionThreshold?.nombre || 'Promoción'}): -$${descuentoThreshold.toFixed(2)}</small>
            </div>
        `;
    }

    document.getElementById("total").innerHTML = htmlTotal;
}

// Función para seleccionar una fila y marcarla para eliminar
function seleccionarFila(row, producto) {
    // Si la fila ya está seleccionada, desmarcarla
    if (row.classList.contains('selected-row')) {
        row.classList.remove('selected-row');
        selectedProductId = null; // Deseleccionar el producto
        document.getElementById("delete-btn").style.display = "none"; // ocultar el botón de eliminar
        document.getElementById("edit-cuantity-modal-btn").style.display = "none"; // ocultar
    } else {
        // Si la fila no está seleccionada, marcarla
        const filas = document.querySelectorAll("#product-table tbody tr");
        filas.forEach(fila => fila.classList.remove('selected-row')); // Desmarcar todas las filas
        row.classList.add('selected-row'); // Marcar la fila seleccionada
        selectedProductId = producto; // Guardar el producto seleccionado
        document.getElementById("delete-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
        document.getElementById("edit-cuantity-modal-btn").style.display = "inline-block"; // Mostrar el botón de eliminar

        // Llamar al modal de editar cantidad y pasar la cantidad del producto seleccionado
        document.getElementById("edit-cuantity-modal-btn").addEventListener("click", function () {
            showEditQuantityModal(producto.id, producto.cantidad);
        });
    }
}

// Manejar los botones del teclado numérico
document.querySelectorAll(".num-btn").forEach(button => {
    button.addEventListener("click", function () {
        const value = this.getAttribute("data-num");
        const quantityInput = document.getElementById("quantity-input");

        // Si es un número, lo agregamos al campo de entrada
        if (value !== "C" && value !== "OK" && value !== "backspace") {
            // Si el campo está vacío o es el primer dígito después de abrir el modal
            if (quantityInput.value === "0" || quantityInput.dataset.fresh === "true") {
                quantityInput.value = value; // Reemplazar el valor
                quantityInput.dataset.fresh = "false"; // Marcar que ya no es "fresco"
            } else {
                quantityInput.value += value; // Concatenar normalmente
            }
        }
        // Limpiar el campo de entrada (borrar todo)
        else if (value === "C") {
            quantityInput.value = ""; // Borrar todo
            quantityInput.dataset.fresh = "true"; // Marcar como fresco al limpiar
        }
        // Retroceder (borrar un solo número)
        else if (value === "backspace") {
            // Borrar el último carácter del campo de entrada
            if (quantityInput.value.length <= 1) {
                quantityInput.value = "0";
                quantityInput.dataset.fresh = "true"; // Marcar como fresco al borrar todo
            } else {
                quantityInput.value = quantityInput.value.slice(0, -1);
            }
        }
        // Confirmar la cantidad
        else if (value === "OK") {
            const newQuantity = parseInt(quantityInput.value); // Obtener el valor ingresado

            // Verificar que la cantidad sea válida
            if (newQuantity > 0) {
                // Actualizar la cantidad en el producto seleccionado
                updateProductQuantity(selectedProductId, newQuantity);
                // Cerrar el modal después de actualizar
                const modal = bootstrap.Modal.getInstance(document.getElementById("editQuantityModal"));
                modal.hide();
                //  document.querySelector('.modal-backdrop').remove(); // Elimina el backdrop manualmente

            } else {
                mostrarToast("La cantidad debe ser mayor que 0.", "warning");
                marcarErrorCampo("quantity-input", "Ingrese cantidad mayor a 0.")

            }
        }
    });
});

// Función para actualizar la cantidad del producto en la lista de productos seleccionados
async function updateProductQuantity(productId, newQuantity) {
    // Buscar el producto seleccionado en la lista
    const producto = productosSeleccionados.find(p => p.id === productId);

    // Si el producto se encuentra, actualizar la cantidad
    if (producto) {
        producto.cantidad = newQuantity;
        //   producto.total = producto.cantidad * producto.precio; // Actualizar el total del producto
        await aplicarPromociones(productId, productosSeleccionados); // Re-aplicar promociones
        // Actualizar la tabla de productos seleccionados
        actualizarTabla();
    } else {
        console.error("Producto no encontrado en la lista.");
    }
}

// Función para eliminar el producto seleccionado
document.getElementById("delete-btn").addEventListener('click', () => {
    if (selectedProductId) {
        // Eliminar el producto de la lista
        productosSeleccionados = productosSeleccionados.filter(p => p.id !== selectedProductId.id);

        // Actualizar la tabla
        actualizarTabla();
        selectedProductId = null; // Restablecer la selección
    }
});

// Función para mostrar el ticket y llenarlo con los detalles de la compra
document.getElementById("finalize-btn").addEventListener("click", async function () {
    if (productosSeleccionados.length === 0) {
        mostrarToast("⚠️ No hay productos seleccionados para generar el ticket", "warning");
        const btn = this;
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 500);
        beepError.play();
        return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session.user.id;

    const pedidoGuardado = await guardarPedido(productosSeleccionados, userId, "empacador");
    if (!pedidoGuardado) return;

    const codigoTicket = pedidoGuardado.codigo_ticket;

    actualizarContadorPedidosHoy();
    mostrarTicket(codigoTicket, false, pedidoGuardado.fecha);
});

// En mostrarTicket()
function mostrarTicket(codigoTicket, esReimpresion = false, fechaDelPedido = null) {
    const ticketContent = document.getElementById("ticket-content");
    
    // Calcular todos los totales necesarios
    const { 
        subtotal, 
        descuentoThreshold, 
        descuentosProductos,
        promocionThreshold,
        totalConDescuento 
    } = aplicarDescuentosPedido(productosSeleccionados);

    // Recolectar nombres de promociones aplicadas
    let promocionesAplicadas = [];
    
    // Primero las promociones por producto
    productosSeleccionados.forEach(producto => {
        if (producto.promocionAplicada && !promocionesAplicadas.includes(producto.promocionAplicada.nombre)) {
            promocionesAplicadas.push(producto.promocionAplicada.nombre);
        }
    });
    
    // Luego la promoción por threshold si aplica
    if (descuentoThreshold > 0 && promocionThreshold && !promocionesAplicadas.includes(promocionThreshold.nombre)) {
        promocionesAplicadas.push(promocionThreshold.nombre);
    }

    // Construir el HTML del ticket
    let ticketHTML = `
    <div style="max-width: 300px; font-family: monospace; font-size: 16px; text-align: center; color: #000;">
        <img src="${configuracionGlobal.logo_url || ''}" alt="Logo" style="max-width: 80px; margin-bottom: 5px;" />
        <h2 style="margin: 4px 0;">${configuracionGlobal.nombre_empresa || 'Tu Tienda'}</h2>
        <hr style="border-top: 1px dashed #aaa;" />
        <p style="margin: 2px 0;"><i class="fa-solid fa-calendar-days"></i> ${new Date(fechaDelPedido || Date.now()).toLocaleString()}</p>
        <p style="margin: 2px 0;"><i class="fa-solid fa-user"></i> ${document.getElementById("employee-name").textContent.replace("Sesión: ", "")}</p>
        <p style="margin: 2px 0;"><i class="fa-solid fa-ticket"></i> ${codigoTicket}</p>
        <hr style="border-top: 1px dashed #aaa;" />
        <table style="width: 100%; font-size: 16px; margin-top: 5px; text-align: left;">
            <thead>
                <tr>
                    <th style="padding-bottom: 3px;">Producto</th>
                    <th style="text-align: center;">Cant</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Agregar cada producto al ticket con su información
    productosSeleccionados.forEach(producto => {
        const precioOriginal = producto.precio * producto.cantidad;
        const totalProducto = producto.total;
        
        // Mostrar icono de promoción si aplica
        let nombreProducto = producto.nombre;
        if (producto.promocionAplicada) {
            const iconClass = producto.promocionAplicada.tipo === 'bogo' ? 
                'fa-badge-percent' : 'fa-tag';
            nombreProducto += ` <i class="fas ${iconClass} text-success"></i>`;
        }

        ticketHTML += ` 
            <tr>
                <td>${nombreProducto}</td>
                <td style="text-align: center;">${producto.cantidad}</td>
                <td style="text-align: right;">$${totalProducto.toFixed(2)}</td>
            </tr>
        `;

        // Mostrar descuento por producto si aplica
        if (producto.descuento > 0) {
            ticketHTML += `
            <tr>
                <td colspan="2" style="text-align: right;">
                    <small class="text-success">${producto.promocionAplicada?.nombre || 'Descuento'}</small>
                </td>
                <td style="text-align: right;">
                    <small class="text-success">
                        <span class="text-muted text-decoration-line-through">$${precioOriginal.toFixed(2)}</span>
                        -$${producto.descuento.toFixed(2)}
                    </small>
                </td>
            </tr>
            `;
        }
    });

    // Línea divisoria antes de los totales
    ticketHTML += `
        <tr><td colspan="3"><hr style="border-top: 1px dashed #aaa; margin: 5px 0;" /></td></tr>
    `;

    // Mostrar subtotal (sin descuentos)
    ticketHTML += `
        <tr>
            <td colspan="2" style="text-align: right;"><strong>Subtotal:</strong></td>
            <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
        </tr>
    `;

    // Mostrar descuentos por productos si existen
    if (descuentosProductos > 0) {
        ticketHTML += `
        <tr>
            <td colspan="2" style="text-align: right;"><small class="text-success">Descuentos por productos:</small></td>
            <td style="text-align: right;"><small class="text-success">-$${descuentosProductos.toFixed(2)}</small></td>
        </tr>
        `;
    }

    // Mostrar descuento por threshold si existe
    if (descuentoThreshold > 0) {
        ticketHTML += `
        <tr>
            <td colspan="2" style="text-align: right;">
                <small class="text-success">${promocionThreshold?.nombre || 'Descuento por pedido'}:</small>
            </td>
            <td style="text-align: right;">
                <small class="text-success">-$${descuentoThreshold.toFixed(2)}</small>
            </td>
        </tr>
        `;
    }

    // Línea divisoria antes del total final
    ticketHTML += `
        <tr><td colspan="3"><hr style="border-top: 1px dashed #aaa; margin: 5px 0;" /></td></tr>
        <tr>
            <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
            <td style="text-align: right;"><strong>$${totalConDescuento.toFixed(2)}</strong></td>
        </tr>
    `;

    // Mostrar resumen de promociones si hay
    if (promocionesAplicadas.length > 0) {
        ticketHTML += `
        <tr><td colspan="3"><hr style="border-top: 1px dashed #aaa; margin: 5px 0;" /></td></tr>
        <tr>
            <td colspan="3" style="text-align: center;">
                <small class="text-success"><strong>Promociones aplicadas:</strong><br>${promocionesAplicadas.join(', ')}</small>
            </td>
        </tr>
        `;
    }

    // Pie del ticket
    ticketHTML += `
            </tbody>
        </table>
        <hr style="border-top: 2px dashed #aaa;" />
        <p style="margin: 4px 0; font-size: 16px;">
            <strong><i class="fa-solid fa-boxes-stacked"></i> Productos:</strong> 
            ${productosSeleccionados.reduce((sum, p) => sum + p.cantidad, 0)}
        </p>
        <div style="margin-top: 10px;">
            <svg id="barcode"></svg>
        </div>
        <p style="margin-top: 8px;">
            <i class="fa-solid fa-circle-info"></i> 
            ${esReimpresion ? 'Pedido reimpreso' : 'Pendiente de pago'}
        </p>
        <p style="margin: 6px 0;">Conserva este ticket para cualquier aclaración.</p>
        <hr style="border-top: 1px dashed #aaa;" />
        <p style="font-style: italic;">Gracias por tu compra <i class="fa-solid fa-heart"></i></p>
    </div>
    `;

    // Insertar el HTML del ticket en el contenedor
    ticketContent.innerHTML = ticketHTML;

    // Renderizar el código de barras
    setTimeout(() => {
        JsBarcode("#barcode", `T-${Date.now()}`, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: false,
        });
    }, 100);

    // Mostrar el modal para imprimir el ticket
    new bootstrap.Modal(document.getElementById('ticketModal')).show();
}

// Función para imprimir el ticket
document.getElementById("print-ticket-btn").addEventListener("click", function () {
    const ticketContent = document.getElementById("ticket-content").innerHTML;
    const printWindow = window.open('', '', 'height=500, width=500');
    printWindow.document.write(`
            <html>
            <head>
                <title>Ticket</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" integrity="sha512-..." crossorigin="anonymous" referrerpolicy="no-referrer" />
                <style>
                body {
        font-family: monospace;
        font-size: 16px; /* AUMENTADO */
        color: #000;
        text-align: center;
        margin: 0;
        padding: 10px;
    }

    table {
        width: 100%;
        font-size: 15px; /* AUMENTADO */
        text-align: left;
        border-collapse: collapse;
    }

    td, th {
        padding: 6px; /* MÁS ESPACIO */
    }

    svg {
        margin-top: 15px;
    }

    h2 {
        font-size: 18px; /* MÁS GRANDE EL TÍTULO */
        margin: 6px 0;
    }

    p {
        margin: 6px 0;
        font-size: 15px;
    }

    hr {
        border: none;
        border-top: 1px dashed #aaa;
        margin: 10px 0;
    }

    @media print {
        body {
        width: 80mm;
        }
    }
                </style>
            </head>
            <body>
            `);
    printWindow.document.write(ticketContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // Agregar un pequeño retraso antes de imprimir
    setTimeout(function () {
        printWindow.print();  // Llamar a la función de impresión después de 500ms (medio segundo)
        printWindow.close();  // Cerrar la ventana de impresión después de imprimir
    }, 500);  // 500 milisegundos de retraso, puedes ajustarlo si es necesario

    // Resetear todo al terminar
    productosSeleccionados = [];
    actualizarTabla();
    selectedProductId = null;
    bootstrap.Modal.getInstance(document.getElementById("ticketModal")).hide();
});

// Función principal que maneja la apertura del historial
document.getElementById("open-history-btn").addEventListener("click", async () => {
    new bootstrap.Offcanvas(document.getElementById("history-sidebar")).show();
    const hoy = getLocalDateString(); // Asumo que esto devuelve 'YYYY-MM-DD'

    // Establecer valores por defecto en los inputs de fecha (SOLO FECHA, sin hora)
    document.getElementById("filtro-fecha-desde").value = hoy;
    document.getElementById("filtro-fecha-hasta").value = hoy;

    // Cargar pedidos del día actual (aquí SÍ usamos fecha+hora para la consulta)
    await cargarPedidos({
        desde: `${hoy}T00:00:00`,
        hasta: `${hoy}T23:59:59`
    });
});

// Manejador del botón de filtros
document.getElementById("btn-aplicar-filtros").addEventListener("click", async () => {
    const desde = document.getElementById("filtro-fecha-desde").value;
    const hasta = document.getElementById("filtro-fecha-hasta").value;

    await cargarPedidos({
        desde: desde ? `${desde}T00:00:00` : null,
        hasta: hasta ? `${hasta}T23:59:59` : null,
        estado: document.getElementById("filtro-estado").value || null
    });
});

// Función modularizada para cargar pedidos
async function cargarPedidos(filtros = {}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session.user.id;

    let query = supabase
        .from("pedidos")
        .select("id, fecha, total, codigo_ticket, estado")
        .eq("empleado_id", userId)
        .order("fecha", { ascending: false });

    // Aplicar filtros si existen
    if (filtros.desde) query = query.gte("fecha", filtros.desde);
    if (filtros.hasta) query = query.lte("fecha", filtros.hasta);
    if (filtros.estado) query = query.eq("estado", filtros.estado);

    const { data: pedidos, error } = await query;

    // Manejo de UI común
    const badgeResultados = document.getElementById("badge-resultados");
    const cantidadPedidos = document.getElementById("cantidad-pedidos");
    const lista = document.getElementById("lista-historial");

    // Limpiar lista
    lista.innerHTML = "";

    // Manejo de errores y casos vacíos
    if (error) {
        lista.innerHTML = `<li class="list-group-item text-danger">Error al cargar pedidos</li>`;
        badgeResultados.style.display = "none";
        return;
    }

    if (!pedidos.length) {
        badgeResultados.style.display = "none";
        lista.innerHTML = `<li class="list-group-item text-muted"><i class="fa-solid fa-magnifying-glass"></i> No se encontraron pedidos</li>`;
        return;
    }

    // Actualizar badge de resultados
    cantidadPedidos.textContent = pedidos.length;
    badgeResultados.style.display = "block";
    setTimeout(() => badgeResultados.classList.add("show"), 50);

    // Renderizar pedidos (función separada para mayor claridad)
    renderizarPedidos(pedidos, lista);
}

// Función para renderizar los pedidos de forma consistente
function renderizarPedidos(pedidos, contenedor) {
    // Agrupar pedidos por fecha
    const pedidosPorDia = {};

    pedidos.forEach(pedido => {
        const fechaPedido = new Date(pedido.fecha);
        const fechaKey = fechaPedido.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (!pedidosPorDia[fechaKey]) {
            pedidosPorDia[fechaKey] = [];
        }
        pedidosPorDia[fechaKey].push(pedido);
    });

    // Crear contenedor de acordeón
    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.id = 'pedidos-accordion';
    contenedor.appendChild(accordion);

    // Renderizar cada grupo de fecha como un ítem del acordeón
    Object.entries(pedidosPorDia).forEach(([fecha, pedidosDelDia], index) => {
        // Crear elemento del acordeón
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';

        // Crear encabezado del acordeón
        const accordionHeader = document.createElement('h2');
        accordionHeader.className = 'accordion-header';
        accordionHeader.id = `heading-${index}`;

        const accordionButton = document.createElement("button");
        accordionButton.className = 'accordion-button collapsed';
        accordionButton.type = 'button';
        accordionButton.dataset.bsToggle = 'collapse';
        accordionButton.dataset.bsTarget = `#collapse-${index}`;
        accordionButton.setAttribute('aria-expanded', 'false');
        accordionButton.setAttribute('aria-controls', `collapse-${index}`);
        accordionButton.innerHTML = `
            <span class="fw-bold">${fecha}</span>
            <span class="badge bg-secondary ms-2">${pedidosDelDia.length} pedidos</span>
        `;

        accordionHeader.appendChild(accordionButton);

        // Crear cuerpo del acordeón
        const accordionCollapse = document.createElement('div');
        accordionCollapse.id = `collapse-${index}`;
        accordionCollapse.className = 'accordion-collapse collapse';
        accordionCollapse.setAttribute('aria-labelledby', `heading-${index}`);
        accordionCollapse.dataset.bsParent = '#pedidos-accordion';

        const accordionBody = document.createElement('div');
        accordionBody.className = 'accordion-body p-0';

        // Renderizar pedidos dentro del cuerpo del acordeón
        pedidosDelDia.forEach(pedido => {
            const item = document.createElement('div');
            item.className = 'list-group-item list-group-item-action border-0 rounded-0';

            const badgeClass = obtenerColorEstado(pedido.estado);  // Usamos la función para el color
            const badgeText = pedido.estado.charAt(0).toUpperCase() + pedido.estado.slice(1);  // Capitalizar el estado

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong><i class="fa-solid fa-ticket"></i> ${pedido.codigo_ticket}</strong>
                        <span class="badge ${badgeClass} ms-2">${badgeText}</span>
                    </div>
                    <small class="text-muted">${new Date(pedido.fecha).toLocaleTimeString()}</small>
                </div>
                <div class="mt-1">
                    <small><i class="fa-solid fa-dollar-sign"></i> ${pedido.total}</small>
                </div>
            `;
            item.onclick = (e) => {
                e.stopPropagation(); // Evitar que se cierre el acordeón
                verDetallePedido(pedido.id);
            };
            accordionBody.appendChild(item);
        });

        accordionCollapse.appendChild(accordionBody);
        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionCollapse);
        accordion.appendChild(accordionItem);
    });

    // Inicializar acordeón de Bootstrap
    new bootstrap.Collapse(document.getElementById('pedidos-accordion'), {
        toggle: false
    });
}

// Función para ver detalles del pedido (modificada para incluir promociones)
async function verDetallePedido(pedidoId) {
    const { data, error } = await supabase
        .from("pedido_productos")
        .select(`
            cantidad, 
            precio_unitario, 
            total,
            descuento,
            productos(nombre),
            promociones(nombre, tipo, porcentaje)
        `)
        .eq("pedido_id", pedidoId);

    if (error) {
        return mostrarToast("Error al cargar detalles", "error");
    }

    const detalleHTML = data.map(item => `
        <tr>
            <td><i class="fa-solid fa-cookie-bite"></i> ${item.productos?.nombre || 'N/D'}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precio_unitario.toFixed(2)}</td>
            <td>$${item.precio_unitario * item.cantidad.toFixed(2)}</td>
        </tr>
        ${item.descuento > 0 ? `
        <tr>
            <td  class="text-success">
                <small>${item.promociones?.nombre || 'Promoción'} 
                ${item.promociones?.tipo === 'percentage' ? `(${item.promociones.porcentaje}%)` : ''}
                </small>
            </td>
            <td class="text-success">...</td>
            <td class="text-success">...</td>
            <td class="text-success text-end"><small>-$${item.descuento.toFixed(2)}</small></td>
        </tr>` : ''}
    `).join("");


    // Mostrar los detalles en el modal
    document.getElementById("detalle-pedido-body").innerHTML = detalleHTML;

    // Obtener la fecha del pedido y el nombre del cliente
    const { data: pedido, error: errorPedido } = await supabase
        .from('pedidos')
        .select(`
      *,
      pedido_productos(
        cantidad,
        precio_unitario,
        productos(nombre)
      ),
      clientes(
        usuario_id,
        usuarios:clientes_usuario_id_fkey(nombre)
      )
    `)
        .eq('id', pedidoId)
        .single();


    if (errorPedido || !pedido) {
        console.error("Error al obtener el pedido:", errorPedido);
        Swal.fire({
            icon: 'warning',
            title: 'Pedido no encontrado',
            text: 'Este pedido no existe o fue eliminado.',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const fecha = new Date(pedido.fecha);
    document.getElementById("codigo-ticket").textContent = pedido.codigo_ticket || "N/D";
    document.getElementById("fecha-pedido").textContent = fecha.toLocaleString();
    document.getElementById("cliente-nombre").textContent = pedido.clientes?.usuarios?.nombre || "N/D";

    // Guardamos para reimpresión
    pedidoActual = pedido;
    productosDelPedido = data.map(item => ({
        nombre: item.productos?.nombre || "N/D",
        cantidad: item.cantidad,
        precio: item.precio_unitario,
        descuento: item.descuento || 0,
        promocionAplicada: item.promociones,
        total: item.total
    }));

    // Mostrar el modal con los detalles
    const detallesModal = new bootstrap.Modal(document.getElementById("detallePedidoModal"));
    detallesModal.show();
}

document.getElementById("btn-reimprimir-ticket").addEventListener("click", () => {
    if (!pedidoActual || !productosDelPedido.length) {
        return mostrarToast("No se puede imprimir el ticket", "error");
    }

    productosSeleccionados = [...productosDelPedido];
    mostrarTicket(pedidoActual.codigo_ticket, true, pedidoActual.fecha);
});


async function inicializarPedidosPendientes() {
    const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id")
        .or('estado.eq.pendiente,estado.eq.preparacion') // Filtra por ambos estados
        .eq("origen", "cliente");

    if (error || !pedidos) return;

    cantidadPedidosActual = pedidos.length;

    if (cantidadPedidosActual > 0) {
        mostrarBotonPedidos(cantidadPedidosActual);
    }
}

function mostrarBotonPedidos(cantidad, notificar = false) {
    const ordersBtn = document.getElementById("orders-btn");
    const badge = document.getElementById("order-notification");

    ordersBtn.classList.remove("d-none");
    ordersBtn.classList.add("pedido-urgente");
    badge.textContent = `¡${cantidad}!`;

    if (notificar && Notification.permission === "granted") {
        const notif = new Notification("🛒 Nuevo pedido recibido", {
            body: `Hay ${cantidad} pedido(s) pendientes.`,
            icon: `${configuracionGlobal.logo_url}`
        });
        notif.onclick = () => window.focus();

        const sonido = new Audio("../sounds/notificacionM.mp3");
        sonido.play();
    }
}

// Función para actualizar el contador de pedidos pendientes hoy (restando)
async function updatePendingOrdersCount(isIncrement = true) {
    const badge = document.getElementById('order-notification');
    if (badge) {
        // Si isIncrement es false, restamos el contador
        if (isIncrement) {
            cantidadPedidosActual++;
        } else {
            cantidadPedidosActual--;
        }

        // Actualizamos el contador en el badge
        badge.textContent = `¡${cantidadPedidosActual}!`;
    }
}

// Función para mostrar los pedidos pendientes en el sidebar
async function mostrarPedidosPendientes() {
    const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id, fecha, total, codigo_ticket, estado, pedido_productos(cantidad)")
        .or('estado.eq.pendiente,estado.eq.preparacion') // Filtra por ambos estados
        .eq("origen", "cliente")
        .order("fecha", { ascending: false });

    if (error || !pedidos) {
        console.error("Error al cargar los pedidos pendientes:", error);
        return;
    }

    const contenedor = document.getElementById("lista-pendientes");
    contenedor.innerHTML = "";

    if (!pedidos.length) {
        document.getElementById("badge-pendientes").style.display = "none";
        contenedor.innerHTML = `<li class="list-group-item text-muted">
        <i class="fa-solid fa-magnifying-glass"></i> No hay pedidos pendientes/en preparación
      </li>`;
        return;
    }

    document.getElementById("cantidad-pendientes").textContent = pedidos.length;
    document.getElementById("badge-pendientes").style.display = "block";

    const pedidosPorDia = {};
    pedidos.forEach(pedido => {
        const fechaKey = new Date(pedido.fecha).toLocaleDateString("es-MX", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        if (!pedidosPorDia[fechaKey]) pedidosPorDia[fechaKey] = [];
        pedidosPorDia[fechaKey].push(pedido);
    });

    const accordion = document.createElement("div");
    accordion.className = "accordion";
    accordion.id = "pendientes-accordion";
    contenedor.appendChild(accordion);

    Object.entries(pedidosPorDia).forEach(([fecha, pedidosDelDia], index) => {
        const item = document.createElement("div");
        item.className = "accordion-item";

        const header = document.createElement("h2");
        header.className = "accordion-header";
        header.id = `pendiente-heading-${index}`;

        const button = document.createElement("button");
        button.className = "accordion-button collapsed";
        button.type = "button";
        button.dataset.bsToggle = "collapse";
        button.dataset.bsTarget = `#pendiente-collapse-${index}`;
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", `pendiente-collapse-${index}`);
        button.innerHTML = `<span class="fw-bold">${fecha}</span>
        <span class="badge bg-warning ms-2">${pedidosDelDia.length} pedidos</span>`;

        header.appendChild(button);
        item.appendChild(header);

        const collapse = document.createElement("div");
        collapse.className = "accordion-collapse collapse";
        collapse.id = `pendiente-collapse-${index}`;
        collapse.setAttribute("aria-labelledby", `pendiente-heading-${index}`);
        collapse.dataset.bsParent = "#pendientes-accordion";

        const body = document.createElement("div");
        body.className = "accordion-body p-0";

        pedidosDelDia.forEach(pedido => {
            const cantidad = pedido.pedido_productos.reduce((t, p) => t + p.cantidad, 0);
            const div = document.createElement("div");
            div.className = "list-group-item list-group-item-action border-0 rounded-0";

            // Determinar el color del badge según el estado
            const badgeClass = obtenerColorEstado(pedido.estado);  // Usamos la función para el color
            const badgeText = pedido.estado.charAt(0).toUpperCase() + pedido.estado.slice(1);  // Capitalizar el estado

            div.innerHTML = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong><i class="fa-solid fa-ticket"></i> ${pedido.codigo_ticket}</strong>
              <span class="badge ${badgeClass} ms-2">${badgeText}</span>
            </div>
            <small class="text-muted">${new Date(pedido.fecha).toLocaleTimeString()}</small>
          </div>
          <div class="mt-1">
            <small><i class="fa-solid fa-cookie-bite"></i> ${cantidad} productos - <i class="fa-solid fa-dollar-sign"></i> ${pedido.total}</small>
          </div>
        `;
            div.onclick = () => mostrarModalDetallesPedido(pedido.id);
            body.appendChild(div);
        });

        collapse.appendChild(body);
        item.appendChild(collapse);
        accordion.appendChild(item);
    });

    // Mostrar el sidebar con los pedidos
    const sidebar = new bootstrap.Offcanvas(document.getElementById('ordersSidebar'));
    sidebar.show();
}

// Función para mostrar el modal con los detalles del pedido pendiente
async function mostrarModalDetallesPedido(pedidoId) {
    try {
        const { data: pedido, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_productos(
                    cantidad,
                    precio_unitario,
                    productos(nombre, imagen_url)
                ),
                clientes:cliente_id(
                    *,
                    usuarios:usuario_id(nombre, telefono)
                ),
                empleados:empleado_id(nombre)
            `)
            .eq('id', pedidoId)
            .single();

        if (error) throw error;
        if (!pedido) throw new Error("Pedido no encontrado");

        // Mostrar información básica
        document.getElementById('cliente-nombreP').textContent =
            pedido.clientes?.usuarios?.nombre || "N/D";
        document.getElementById('fecha-hora').textContent =
            new Date(pedido.fecha).toLocaleString();

        // Configurar el estado del pedido
        const estadoPedidoElem = document.getElementById('estado-pedido-texto');
        const estadoIconoElem = document.getElementById('estado-pedido-icon');
        const cambiarEstadoBtn = document.getElementById('btn-cambiar-estado');

        // Limpiar event listeners previos
        cambiarEstadoBtn.replaceWith(cambiarEstadoBtn.cloneNode(true));
        const nuevoBoton = document.getElementById('btn-cambiar-estado');

        // Configurar el estado actual
        configurarEstadoPedido(pedido.estado, nuevoBoton, estadoPedidoElem, estadoIconoElem);

        // Agregar nuevo event listener
        nuevoBoton.addEventListener('click', async () => {
            await manejarCambioEstado(pedidoId, pedido.estado, estadoPedidoElem, estadoIconoElem, nuevoBoton);
        });

        // Generar tabla de productos
        const tbody = document.getElementById('detalle-pedidoP-body');
        tbody.innerHTML = '';

        let totalProductos = 0;
        let totalPedido = 0;

        (pedido.pedido_productos || []).forEach(item => {
            const subtotal = item.cantidad * (item.precio_unitario || 0);
            totalProductos += item.cantidad;
            totalPedido += subtotal;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        ${item.productos?.imagen_url ?
                    `<img src="${item.productos.imagen_url}" alt="${item.productos.nombre}" 
                            class="me-2 rounded" style="width:40px;height:40px;object-fit:cover;">` :
                    `<i class="fas fa-box me-2"></i>`}
                        ${item.productos?.nombre || 'Producto desconocido'}
                    </div>
                </td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-end">$${(item.precio_unitario || 0).toFixed(2)}</td>
                <td class="text-end">$${subtotal.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });

        // Actualizar totales
        document.getElementById('total-productos').textContent = totalProductos;
        document.getElementById('total-pedido').textContent = `$${totalPedido.toFixed(2)}`;

        // Guardar datos para impresión
        pedidoActual = pedido;
        productosDelPedido = (pedido.pedido_productos || []).map(item => ({
            nombre: item.productos?.nombre || 'N/D',
            cantidad: item.cantidad,
            precio: item.precio_unitario || 0,
            total: item.cantidad * (item.precio_unitario || 0)
        }));

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('detallePedidoModalPendiente'));
        modal.show();

    } catch (error) {
        console.error('Error al cargar pedido:', error);
        mostrarToast('Error al cargar detalles del pedido', 'error');
    }
}

// Función para configurar el estado visual del pedido
function configurarEstadoPedido(estado, boton, textoElem, iconoElem) {
    boton.disabled = false; // Asegurarse que el botón esté habilitado

    // Limpiar clases previas
    boton.classList.remove('pendiente', 'preparacion', 'empacado');
    boton.classList.add(estado); // Añadir la clase correspondiente al estado

    switch (estado) {
        case 'pendiente':
            textoElem.textContent = 'Pendiente';
            textoElem.className = "text-warning";
            iconoElem.className = "fa-solid fa-clock";
            boton.textContent = 'Cambiar a Preparación';
            boton.classList.add('btn-primary');
            break;

        case 'preparacion':
            textoElem.textContent = 'En preparación';
            textoElem.className = "text-primary";
            iconoElem.className = "fa-solid fa-cogs";
            boton.textContent = 'Cambiar a Empacado';
            boton.classList.add('btn-success');
            break;

        case 'empacado':
            textoElem.textContent = 'Empacado';
            textoElem.className = "text-success";
            iconoElem.className = "fa-solid fa-box";
            boton.disabled = true;
            boton.classList.add('btn-secondary');
            break;

        default:
            textoElem.textContent = estado;
            boton.disabled = true;
    }
}

// Función para manejar el cambio de estado
async function manejarCambioEstado(pedidoId, estadoActual, textoElem, iconoElem, boton) {
    let nuevoEstado;

    // Determinar el nuevo estado
    if (estadoActual === 'pendiente') {
        nuevoEstado = 'preparacion';
    } else if (estadoActual === 'preparacion') {
        nuevoEstado = 'empacado';
    } else {
        return;
    }

    // Obtener el empleado_id desde la sesión actual
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        mostrarToast('Error al obtener la sesión del empleado', 'error');
        return;
    }
    const empleadoId = sessionData.session.user.id; // Aquí asumimos que el `user.id` es el `empleado_id`

    // Actualizar el estado del pedido en la base de datos
    const { error } = await supabase
        .from('pedidos')
        .update({
            estado: nuevoEstado,
            empleado_id: empleadoId // Asignar el `empleado_id`
        })
        .eq('id', pedidoId);

    if (error) {
        mostrarToast('Error al actualizar el estado', 'error');
        return;
    }

    // Actualizar la UI
    configurarEstadoPedido(nuevoEstado, boton, textoElem, iconoElem);

    // Actualizar contador si es necesario
    if (nuevoEstado === 'empacado') {
        await updatePendingOrdersCount(false);
    }

    // Cerrar modales si el pedido fue empacado
    const modal = bootstrap.Modal.getInstance(document.getElementById('detallePedidoModalPendiente'));
    modal?.hide();
    const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('ordersSidebar'));
    sidebar?.hide();

    // Mostrar un mensaje de éxito
    mostrarToast(`Estado cambiado a ${nuevoEstado}`, 'success');
}

// Función para cancelar el pedido
async function cancelarPedido(pedidoId) {
    // Mostrar mensaje de confirmación con SweetAlert
    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡Este pedido será cancelado y no podrá ser recuperado!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, cancelar pedido',
        cancelButtonText: 'Cancelar'
    });
    // Si el usuario confirma, proceder con la cancelación
    if (isConfirmed) {
        // Obtener el empleado_id desde la sesión actual
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            mostrarToast('Error al obtener la sesión del empleado', 'error');
            return;
        }
        const empleadoId = sessionData.session.user.id;

        // Actualizar el estado del pedido a "cancelado"
        const { error } = await supabase
            .from('pedidos')
            .update({
                estado: 'cancelado',
                empleado_id: empleadoId // Registrar quien está cancelando el pedido
            })
            .eq('id', pedidoId.id);

        if (error) {
            mostrarToast('Error al cancelar el pedido', 'error');
            return;
        }

        // Actualizar la UI
        const estadoPedidoElem = document.getElementById('estado-pedido-texto');
        const estadoIconoElem = document.getElementById('estado-pedido-icon');
        const cambiarEstadoBtn = document.getElementById('btn-cambiar-estado');

        // Cambiar visualmente el estado
        configurarEstadoPedido('cancelado', cambiarEstadoBtn, estadoPedidoElem, estadoIconoElem);

        // Cerrar modal y sidebar
        const modal = bootstrap.Modal.getInstance(document.getElementById('detallePedidoModalPendiente'));
        modal?.hide();
        const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('ordersSidebar'));
        sidebar?.hide();

        // Mostrar mensaje de éxito
        Swal.fire(
            'Cancelado',
            `El pedido ${pedidoId.codigo_ticket} ha sido cancelado.`,
            'success'
        );
    } else {
        // Si el usuario cancela, no hacer nada
        // console.log("Cancelación del pedido cancelada.");
    }
}

// Agregar event listener al botón de cancelar pedido
document.getElementById('btn-cancelar-pedido').addEventListener('click', async () => {
    const pedidoId = pedidoActual.id;
    await cancelarPedido(pedidoActual);  // Llamar a la función que cancela el pedido
});

// Función para imprimir ticket pendiente
document.getElementById('print-ticket-btnP').addEventListener('click', function () {
    if (!pedidoActual || !productosDelPedido.length) {
        mostrarToast('No hay datos para imprimir', 'error');
        return;
    }

    // Preparar el contenido del ticket
    const fecha = new Date(pedidoActual.fecha);

    const ticketHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket ${pedidoActual.codigo_ticket}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    width: 80mm;  /* Establecer el tamaño para la impresora térmica de 80mm */
                    margin: 0;
                    padding: 10px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 10px;
                }
                .logo {
                    max-width: 60px;
                    max-height: 60px;
                }
                .info {
                    margin: 5px 0;
                    font-size: 14px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 12px;  /* Reducimos el tamaño de la fuente */
                }
                th, td {
                    padding: 3px 0;
                }
                th {
                    text-align: left;
                    border-bottom: 1px dashed #000;
                }
                .total {
                    font-weight: bold;
                    margin-top: 10px;
                }
                .footer {
                    margin-top: 15px;
                    text-align: center;
                    font-size: 12px;
                }
                @media print {
                    body {
                        width: 80mm; /* Para asegurar que se ajuste al ancho de la impresora */
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="${configuracionGlobal?.logo_url || ''}" class="logo" alt="Logo">
                <h2>${configuracionGlobal?.nombre_empresa || 'Tienda'}</h2>
            </div>
            
            <div class="info">
                <strong>Ticket:</strong> ${pedidoActual.codigo_ticket}<br>
                <strong>Fecha:</strong> ${fecha.toLocaleString()}<br>
                <strong>Cliente:</strong> ${pedidoActual.clientes?.usuarios?.nombre || 'N/D'}<br>
                <strong>Estado:</strong> ${pedidoActual.estado}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Validar</th>
                        <th>Producto</th>
                        <th>Cant</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosDelPedido.map(item => `
                        <tr>
                            <td style="text-align: center;">
                                <input type="checkbox" class="product-checkbox">
                            </td>
                            <td>${item.nombre}</td>
                            <td>${item.cantidad}</td>
                            <td>$${item.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="total">
                <strong>Total Productos: </strong> ${productosDelPedido.reduce((sum, item) => sum + item.cantidad, 0)}<br>
                <strong>Total: </strong> $${productosDelPedido.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
            </div>
            
            <div class="footer">
                ${pedidoActual.notas ? `<p>Notas: ${pedidoActual.notas}</p>` : ''}
                <p>Gracias por su compra</p>
            </div>
        </body>
        </html>
    `;

    // Abrir la ventana de impresión y mostrar el contenido
    const printWindow = window.open('', '_blank', 'height=500,width=500');
    printWindow.document.write(ticketHTML);
    printWindow.document.close();  // Cierra el documento para asegurarse de que todo esté cargado

    // Esperar a que el contenido esté completamente cargado antes de imprimir
    printWindow.onload = function () {
        printWindow.print();  // Imprimir el ticket
        printWindow.close();  // Cerrar la ventana después de imprimir
    };

    // Cerrar el modal después de imprimir
    bootstrap.Modal.getInstance(document.getElementById('detallePedidoModalPendiente')).hide();
});