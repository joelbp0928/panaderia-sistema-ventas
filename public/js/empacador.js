import { cargarPromociones, cargarProductos, cargarConfiguracion } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { supabase } from "./supabase-config.js";
import { marcarErrorCampo, mostrarToast } from "./manageError.js";

let productosSeleccionados = []; // Array para almacenar los productos seleccionados
let selectedProductId = null; // ID del producto seleccionado para editar la cantidad
let editQuantityModal = null; // Variable global para guardar la instancia


window.onload = async function () {
    await verificarSesion(); // Verificar si la sesión está activa
    cargarConfiguracion();
    cargarCategorias(); // Llamamos a la función que carga las categorías
    actualizarTabla();
    //  agregarProducto();
    // 🔹 Asociar el evento de Cerrar Sesión al botón logout-btn
    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
    document.getElementById("orders-btn").addEventListener("click", showOrders);
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
        console.log(data);

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
document.getElementById("finalize-btn").addEventListener("click", function () {
    mostrarTicket();
});

function mostrarTicket() {
    const ticketContent = document.getElementById("ticket-content");
    const productosTable = document.getElementById("product-table").getElementsByTagName('tbody')[0];

    let totalGeneral = 0; // Para calcular el total general
    let ticketHTML = `
        <h4>Ticket de Compra</h4>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Empacador:</strong> Panchos </p> <!-- Puedes cambiar esto según cómo manejas al empacador -->
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Agregar productos a la tabla del ticket
    productosSeleccionados.forEach(producto => {
        ticketHTML += `
            <tr>
                <td>${producto.nombre}</td>
                <td>${producto.cantidad}</td>
                <td>$${producto.precio.toFixed(2)}</td>
                <td>$${producto.total.toFixed(2)}</td>
            </tr>
        `;
        totalGeneral += producto.total;
    });

    ticketHTML += `
        </tbody>
    </table>
    <p><strong>Total: </strong>$${totalGeneral.toFixed(2)}</p>
    `;

    ticketContent.innerHTML = ticketHTML; // Inyectamos el contenido del ticket en el modal

    // Mostrar el modal de previsualización
    const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
    modal.show();
}

// Función para imprimir el ticket
document.getElementById("print-ticket-btn").addEventListener("click", function () {
    const ticketContent = document.getElementById("ticket-content").innerHTML;

    const printWindow = window.open('', '', 'height=500, width=500');
    printWindow.document.write('<html><head><title>Ticket de Compra</title>');
    printWindow.document.write('<style>body { font-family: Arial, sans-serif; font-size: 14px; padding: 20px;} table { width: 100%; border-collapse: collapse;} table, th, td { border: 1px solid black;} th, td { padding: 8px; text-align: left;} </style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(ticketContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print(); // Inicia la impresión
});


// Función para manejar el clic en "Pedidos"
function showOrders() {
    mostrarToast("Mostrando los pedidos pendientes.");
}