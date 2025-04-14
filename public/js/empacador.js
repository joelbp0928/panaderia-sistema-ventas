import { cargarPromociones, cargarProductos, cargarConfiguracion, configuracionGlobal } from "./config.js";
import { marcarErrorCampo, mostrarToast } from "./manageError.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { guardarPedido } from "./guardarPedido.js";
import { supabase } from "./supabase-config.js";
import { getLocalDateString } from "./dateLocalDate.js";
const beepError = new Audio("../sounds/error-beep.mp3");

let productosSeleccionados = []; // Array para almacenar los productos seleccionados
let selectedProductId = null; // ID del producto seleccionado para editar la cantidad
let editQuantityModal = null; // Variable global para guardar la instancia

window.onload = async function () {
    await verificarSesion(); // Verificar si la sesión está activa
    cargarConfiguracion();
    cargarCategorias(); // Llamamos a la función que carga las categorías
    actualizarTabla();
    //  agregarProducto();
    await actualizarContadorPedidosHoy();

    // 🔹 Asociar el evento de Cerrar Sesión al botón logout-btn
    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
    //   document.getElementById("orders-btn").addEventListener("click", showOrders);
    //  document.getElementById("edit-cuantity-modal-btn").addEventListener("click", showEditQuantityModal);
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
        console.log("Cargando productos de categoría: ", categoriaId);

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
function agregarProducto(id, nombre, precio) {
    // Verificar si el producto ya está en la lista
    const productoExistente = productosSeleccionados.find(p => p.id === id);

    if (productoExistente) {
        // Si el producto ya existe, solo aumentamos la cantidad
        productoExistente.cantidad += 1;
        productoExistente.total = productoExistente.cantidad * productoExistente.precio;
    } else {
        // Si el producto no existe, lo agregamos a la lista
        productosSeleccionados.push({
            id,
            nombre,
            precio,
            cantidad: 1,
            total: precio
        });
    }

    // Actualizar la tabla de productos seleccionados
    actualizarTabla();
}

// Función para actualizar la tabla con los productos seleccionados
function actualizarTabla() {
    const tablaProductos = document.getElementById("product-table").getElementsByTagName('tbody')[0];
    tablaProductos.innerHTML = ''; // Limpiar la tabla antes de agregar nuevos productos

    // Si no hay productos seleccionados, mostrar mensaje
    if (productosSeleccionados.length === 0) {
        tablaProductos.innerHTML = `
        <tr class="empty">
            <td colspan="4">No hay productos seleccionados</td>
        </tr>
    `;
        document.getElementById("delete-btn").style.display = "none"; // Mostrar el botón de eliminar
        // Actualizar el total en la sección de totales
        document.getElementById("total").textContent = "$0.00";
    } else {
        let totalGeneral = 0; // Para calcular el total general

        // Agregar cada producto a la tabla
        productosSeleccionados.forEach(producto => {
            const row = tablaProductos.insertRow();

            // Crear las celdas de la tabla
            const cellNombre = row.insertCell(0);
            const cellCantidad = row.insertCell(1);
            const cellPrecio = row.insertCell(2);
            const cellTotal = row.insertCell(3);

            // Insertar los valores en las celdas
            cellNombre.textContent = producto.nombre;
            cellCantidad.textContent = producto.cantidad;
            cellPrecio.textContent = `$${producto.precio.toFixed(2)}`;
            cellTotal.textContent = `$${producto.total.toFixed(2)}`;

            // Agregar evento para seleccionar la fila
            row.addEventListener('click', () => seleccionarFila(row, producto));

            // Sumar al total general
            totalGeneral += producto.total;
        });

        // Actualizar el total en la sección de totales
        document.getElementById("total").textContent = `$${totalGeneral.toFixed(2)}`;
        actualizarEstadoBotonFinalizar(); // 🟩 actualiza el botón dinámicamente
    }

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
function updateProductQuantity(productId, newQuantity) {
    // Buscar el producto seleccionado en la lista
    const producto = productosSeleccionados.find(p => p.id === productId);

    // Si el producto se encuentra, actualizar la cantidad
    if (producto) {
        producto.cantidad = newQuantity;
        producto.total = producto.cantidad * producto.precio; // Actualizar el total del producto

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

    const pedidoGuardado = await guardarPedido(productosSeleccionados, userId);
    if (!pedidoGuardado) return;

    const codigoTicket = pedidoGuardado.codigo_ticket;

    actualizarContadorPedidosHoy();
    mostrarTicket(codigoTicket); // ✅ se muestra bien con el ticket real
});



// En mostrarTicket()
function mostrarTicket(codigoTicket) {
    const ticketContent = document.getElementById("ticket-content");
    let totalGeneral = 0;
    let totalItems = 0;
    let ticketHTML = `
<div style="max-width: 300px; font-family: monospace; font-size: 16px; text-align: center; color: #000;">
    <img src="${configuracionGlobal.logo_url || ''}" alt="Logo" style="max-width: 80px; margin-bottom: 5px;" />
    <h2 style="margin: 4px 0;">${configuracionGlobal.nombre_empresa || 'Tu Tienda'}</h2>
    <hr style="border-top: 1px dashed #aaa;" />
    
    <p style="margin: 2px 0;"><i class="fa-solid fa-calendar-days"></i> ${new Date().toLocaleString()}</p>
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


    productosSeleccionados.forEach(producto => {
        const total = (producto.precio * producto.cantidad).toFixed(2);
        totalGeneral += parseFloat(total);
        totalItems += producto.cantidad;

        ticketHTML += `
        <tr>
            <td>${producto.nombre}</td>
            <td style="text-align: center;">${producto.cantidad}</td>
            <td style="text-align: right;">$${total}</td>
        </tr>
    `;
    });

    ticketHTML += `
        </tbody>
    </table>

    <hr style="border-top: 2px dashed #aaa;" />

    <p style="margin: 4px 0; font-size: 16px;"><strong><i class="fa-solid fa-boxes-stacked"></i> Productos:</strong> ${totalItems}</p>
    <p style="margin: 4px 0; font-size: 16px;"><strong><i class="fa-solid fa-cash-register"></i> Total:</strong> $${totalGeneral.toFixed(2)}</p>

    <div style="margin-top: 10px;">
        <svg id="barcode"></svg>
    </div>

    <p style="margin-top: 8px;"><i class="fa-solid fa-circle-info"></i> Pendiente de pago</p>
    <p style="margin: 6px 0;">Conserva este ticket para cualquier aclaración.</p>

    <hr style="border-top: 1px dashed #aaa;" />
    <p style="font-style: italic;">Gracias por tu compra <i class="fa-solid fa-heart"></i></p>
</div>
`;

    ticketContent.innerHTML = ticketHTML;

    // Renderizar código de barras
    setTimeout(() => {
        JsBarcode("#barcode", `T-${Date.now()}`, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: false,
        });
    }, 100);

    new bootstrap.Modal(document.getElementById('ticketModal')).show();
}



function actualizarEstadoBotonFinalizar() {
    const botonFinalizar = document.getElementById("finalize-btn");

    if (productosSeleccionados.length === 0) {
        botonFinalizar.disabled = true;
        botonFinalizar.classList.add("btn-outline-danger", "shake");
        botonFinalizar.classList.remove("btn-primary");
    } else {
        botonFinalizar.disabled = false;
        botonFinalizar.classList.remove("btn-outline-danger", "shake");
        botonFinalizar.classList.add("btn-primary");
    }
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
    printWindow.print();

    // Resetear todo al terminar
    productosSeleccionados = [];
    actualizarTabla();
    selectedProductId = null;
    bootstrap.Modal.getInstance(document.getElementById("ticketModal")).hide();
});



async function actualizarContadorPedidosHoy() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) return;

    const userId = sessionData.session.user.id;
    const hoy = getLocalDateString(); // → "2025-04-13"
    const { count, error: countError } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("empleado_id", userId)
        .eq("origen", "empacador")
        .gte("fecha", `${hoy}T00:00:00`)
        .lte("fecha", `${hoy}T23:59:59`);

    if (countError) {
        console.warn("❌ No se pudo contar pedidos:", countError.message);
        return;
    }

    const badge = document.getElementById("contador-pedidos-hoy");
    badge.innerHTML = `<i class="fa-solid fa-truck me-1"></i> Hoy: ${count} pedido${count === 1 ? "" : "s"}`;
    

}

// Función para manejar el clic en "Pedidos"
function showOrders() {
    mostrarToast("Mostrando los pedidos pendientes.");
}

document.getElementById("open-history-btn").addEventListener("click", async () => {
    new bootstrap.Offcanvas(document.getElementById("history-sidebar")).show();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session.user.id;
    // Obtener fecha actual en formato YYYY-MM-DD
    const hoy = getLocalDateString();
    // Establecer valores por defecto en los inputs de fecha
    // document.getElementById("filtro-fecha-desde").value = `${hoy}T00:00:00`;
    // document.getElementById("filtro-fecha-hasta").value = `${hoy}T00:00:00`;

    const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id, fecha, total, codigo_ticket, estado")
        .eq("empleado_id", userId)
        .gte("fecha", `${hoy}T00:00:00`)
        .lte("fecha", `${hoy}T23:59:59`)
        .order("fecha", { ascending: false });

    const badgeResultados = document.getElementById("badge-resultados");
    const cantidadPedidos = document.getElementById("cantidad-pedidos");

    if (!pedidos.length) {
        badgeResultados.style.display = "none";
        lista.innerHTML = `<li class="list-group-item text-muted">No se encontraron pedidos con los filtros.</li>`;
        return;
    }
    // Si hay pedidos, actualiza el badge
    cantidadPedidos.textContent = pedidos.length;
    badgeResultados.style.display = "block";
    setTimeout(() => badgeResultados.classList.add("show"), 50);
    const lista = document.getElementById("lista-historial");
    lista.innerHTML = ""; // Limpiar primero

    if (error) {
        lista.innerHTML = `<li class="list-group-item text-danger">Error al cargar pedidos</li>`;
        return;
    }

    if (!pedidos.length) {
        lista.innerHTML = `<li class="list-group-item text-muted">No hay pedidos registrados.</li>`;
        return;
    }

    pedidos.forEach(pedido => {
        const item = document.createElement("li");
        item.classList.add("list-group-item", "list-group-item-action");
        item.innerHTML = `
        <div>
          <strong><i class="fa-solid fa-ticket"></i> ${pedido.codigo_ticket}</strong><br>
          <small><i class="fa-solid fa-calendar-day"></i> ${new Date(pedido.fecha).toLocaleString()}</small><br>
          <small><i class="fa-solid fa-dollar-sign"></i> $${pedido.total}</small> · 
          <span class="badge bg-${pedido.estado === 'pendiente' ? 'warning' : 'success'}">${pedido.estado}</span>
        </div>
      `;
        item.onclick = () => verDetallePedido(pedido.id);
        lista.appendChild(item);
    });

});

async function verDetallePedido(pedidoId) {
    const { data, error } = await supabase
        .from("pedido_productos")
        .select("cantidad, precio_unitario, productos(nombre)")
        .eq("pedido_id", pedidoId);

    if (error) return mostrarToast("Error al cargar detalles", "error");

    const detalleHTML = data.map(item => `
      <tr>
        <td>${item.productos.nombre}</td>
        <td>${item.cantidad}</td>
        <td>$${item.precio_unitario.toFixed(2)}</td>
        <td>$${(item.cantidad * item.precio_unitario).toFixed(2)}</td>
      </tr>
    `).join("");

    // Mostrar en modal
    document.getElementById("detalle-pedido-body").innerHTML = detalleHTML;
    new bootstrap.Modal(document.getElementById("detallePedidoModal")).show();
}

document.getElementById("btn-aplicar-filtros").addEventListener("click", cargarHistorialPedidos);

async function cargarHistorialPedidos() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session.user.id;

    const desde = document.getElementById("filtro-fecha-desde").value;
    const hasta = document.getElementById("filtro-fecha-hasta").value;
    const estado = document.getElementById("filtro-estado").value;

    let query = supabase
        .from("pedidos")
        .select("id, fecha, total, codigo_ticket, estado")
        .eq("empleado_id", userId)
        .order("fecha", { ascending: false });

    if (desde) query = query.gte("fecha", `${desde}T00:00:00`);
    if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
    if (estado) query = query.eq("estado", estado);

    const { data: pedidos, error } = await query;
    const badgeResultados = document.getElementById("badge-resultados");
    const cantidadPedidos = document.getElementById("cantidad-pedidos");

    if (!pedidos.length) {
        badgeResultados.style.display = "none";
        lista.innerHTML = `<li class="list-group-item text-muted">No se encontraron pedidos con los filtros.</li>`;
        return;
    }

    // Si hay pedidos, actualiza el badge
    cantidadPedidos.textContent = pedidos.length;
    badgeResultados.style.display = "block";
    setTimeout(() => badgeResultados.classList.add("show"), 50);

    const lista = document.getElementById("lista-historial");
    lista.innerHTML = "";

    if (error) {
        lista.innerHTML = `<li class="list-group-item text-danger">Error al cargar pedidos</li>`;
        return;
    }

    if (!pedidos.length) {
        lista.innerHTML = `<li class="list-group-item text-muted">No se encontraron pedidos con los filtros.</li>`;
        return;
    }

    pedidos.forEach(pedido => {
        const item = document.createElement("li");
        item.classList.add("list-group-item", "list-group-item-action", "fade-in");
        item.innerHTML = `
      <div>
        <strong><i class="fa-solid fa-ticket"></i> ${pedido.codigo_ticket}</strong><br>
        <small><i class="fa-solid fa-calendar-day"></i> ${new Date(pedido.fecha).toLocaleString()}</small><br>
        <small><i class="fa-solid fa-dollar-sign"></i> $${pedido.total}</small> · 
        <span class="badge bg-${pedido.estado === 'pendiente' ? 'warning' : 'success'}">${pedido.estado}</span>
      </div>
    `;
        item.onclick = () => verDetallePedido(pedido.id);
        lista.appendChild(item);
    });
}
