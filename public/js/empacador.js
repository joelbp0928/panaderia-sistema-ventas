import { cargarPromociones, cargarProductos, cargarConfiguracion } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

window.onload = async function () {
    await verificarSesion(); // Verificar si la sesión está activa
    cargarConfiguracion();
    cargarCategorias(); // Llamamos a la función que carga las categorías


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
            categoryButton.onclick = () => toggleCategory(categoria.id); // Aquí usamos el ID para hacer la acción
            categoryButtonsContainer.appendChild(categoryButton);
        });

    } catch (error) {
        console.error("Error cargando las categorías:", error);
    }
}

async function cargarProductosPorCategoria(categoriaId) {
    try {
        console.log(categoriaId);
        // Obtener productos filtrados por categoría desde Supabase
        const { data, error } = await supabase
            .from("productos") // La tabla de productos
            .select("id, nombre, precio, imagen_url, categoria_id")
            .eq("categoria_id", categoriaId); // Filtrar por la categoría seleccionada

        if (error) throw error;
        console.log(data)
        // Obtener el contenedor donde se mostrarán los productos
        const productList = document.getElementById("product-list");
        productList.innerHTML = ""; // Limpiar el contenido anterior

        // Verificar si hay productos disponibles
        if (data.length === 0) {
            productList.innerHTML = "<p>No hay productos en esta categoría.</p>";
        } else {
            // Mostrar productos en la interfaz
            data.forEach((producto) => {
                const productCard = document.createElement("div");
                productCard.classList.add("product-card", "col-12", "col-md-6", "col-lg-4", "mb-4");

                productCard.innerHTML = `
         <div class="product">
             <img src="${producto.imagen_url}" alt="${producto.nombre}" class="img-fluid" />
             <h3>${producto.nombre}</h3>
             <p>$${producto.precio}</p>
         </div>
     `;
                productList.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error al cargar los productos:", error);
    }
}

// Función para manejar el clic en las categorías
function toggleCategory(categoriaId) {
    cargarProductosPorCategoria(categoriaId);
}

// Llamada a la función para mostrar los productos por categoría cuando se haga clic
document.getElementById("category-buttons").addEventListener("click", function (event) {
    event.preventDefault(); // Evita la recarga de la página
    if (event.target && event.target.matches("button.category-btn")) {
        const categoria = event.target.getAttribute("data-category");
        toggleCategory(categoria);
    }
});

// Función para manejar el clic en "Pedidos"
function showOrders() {
    mostrarToast("Mostrando los pedidos pendientes.");
}