import { cargarPromociones, cargarProductos, cargarConfiguracion } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let productosSeleccionados = []; // Array para almacenar los productos seleccionados
let productoSeleccionadoParaEliminar = null; // Almacena el producto seleccionado para eliminar

window.onload = async function () {
    await verificarSesion(); // Verificar si la sesión está activa
    cargarConfiguracion();
    cargarCategorias(); // Llamamos a la función que carga las categorías
    actualizarTabla();
    //  agregarProducto();
    // 🔹 Asociar el evento de Cerrar Sesión al botón logout-btn
    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
    document.getElementById("orders-btn").addEventListener("click", showOrders);
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
        productoSeleccionadoParaEliminar = null; // Deseleccionar el producto
        document.getElementById("delete-btn").style.display = "none"; // Mostrar el botón de eliminar
    } else {
        // Si la fila no está seleccionada, marcarla
        const filas = document.querySelectorAll("#product-table tbody tr");
        filas.forEach(fila => fila.classList.remove('selected-row')); // Desmarcar todas las filas
        row.classList.add('selected-row'); // Marcar la fila seleccionada
        productoSeleccionadoParaEliminar = producto; // Guardar el producto seleccionado
        document.getElementById("delete-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
    }
}

// Función para eliminar el producto seleccionado
document.getElementById("delete-btn").addEventListener('click', () => {
    if (productoSeleccionadoParaEliminar) {
        // Eliminar el producto de la lista
        productosSeleccionados = productosSeleccionados.filter(p => p.id !== productoSeleccionadoParaEliminar.id);

        // Actualizar la tabla
        actualizarTabla();
        productoSeleccionadoParaEliminar = null; // Restablecer la selección
    }
});

// Función para manejar el clic en "Pedidos"
function showOrders() {
    mostrarToast("Mostrando los pedidos pendientes.");
}