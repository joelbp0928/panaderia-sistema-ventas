// Importar otros módulos
import { cargarPromociones, cargarProductos } from "./config.js";
import { inicializarCarrito } from "./cart.js";
import { inicializarAutenticacion } from "./auth.js";

window.onload = function () {
    // Cargar elementos principales de la página
    cargarPromociones();
    cargarProductos();

    // Inicializar otros módulos
    inicializarCarrito();
    inicializarAutenticacion();
}

/*
function cargarConfiguracion() {
    fetch('/api/config/empresa')
        .then(response => response.json())
        .then(data => {
            document.title = data.nombre_empresa; // Cambia el título de la página
            document.querySelector(".logo img").src = data.logo_url; // Cambia el logo dinámicamente
        })
        .catch(error => console.error("Error cargando la configuración:", error));
}
*/

/*document.addEventListener("DOMContentLoaded", function () {
    cargarPromociones();
   // cargarProductos();
});*/

// 🔹 Cargar promociones desde Firebase
/*function cargarPromociones() {
    fetch("https://us-central1-gestor-panaderia.cloudfunctions.net/api/config/promociones")
        .then(response => response.json())
        .then(data => {
            const promoContainer = document.getElementById("promotions");
            promoContainer.innerHTML = "";

            data.forEach(promo => {
                const promoElement = document.createElement("div");
                promoElement.classList.add("promo-slider");
                promoElement.innerHTML = `<img src="${promo.imagen_url}" alt="${promo.nombre}" class="promo-img"/>`;
                promoContainer.appendChild(promoElement);
            });
        })
        .catch(error => console.error("❌ Error cargando promociones:", error));
}*/

// 🔹 Cargar productos dinámicamente
/*function cargarProductos() {
    fetch("https://us-central1-gestor-panaderia.cloudfunctions.net/api/config/productos")
        .then(response => response.json())
        .then(data => {
            const productContainer = document.querySelector(".product-grid");
            productContainer.innerHTML = "";

            data.forEach(producto => {
                const productElement = document.createElement("div");
                productElement.classList.add("product-card");
                productElement.innerHTML = `
                    <img src="${producto.imagen_url}" alt="${producto.nombre}" />
                    <h3>${producto.nombre}</h3>
                    <p>$${producto.precio.toFixed(2)}</p>
                    <button class="add-to-cart-btn" onclick="agregarAlCarrito('${producto.nombre}', ${producto.precio}, '${producto.imagen_url}')">Agregar</button>
                `;
                productContainer.appendChild(productElement);
            });
        })
        .catch(error => console.error("❌ Error cargando productos:", error));
}
*/
// 🔹 Carrito de compras dinámico
/*const cart = document.getElementById("cart");
document.getElementById("cart-btn").addEventListener("click", () => {
    cart.classList.toggle("open");
});*/

//Recuperacion Contraseña
/*document.getElementById("forgot-password-form").addEventListener("submit", function (e) {
    e.preventDefault(); // Evita el envío tradicional del formulario

    const emailInput = document.getElementById("recovery-email").value;
    const alertBox = document.getElementById("forgot-password-alert");

    // Simula la validación (puedes sustituir esto con una petición al servidor)
    if (emailInput === "") {
        alertBox.classList.remove("d-none", "alert-success");
        alertBox.classList.add("alert-danger");
        alertBox.textContent = "Por favor, ingresa un correo válido.";
    } else {
        alertBox.classList.remove("d-none", "alert-danger");
        alertBox.classList.add("alert-success");
        alertBox.textContent = "Se ha enviado un enlace de recuperación a tu correo.";
    }
});*/


// Evento que mueve el foco fuera del modal cuando se cierra
document.addEventListener("hidden.bs.modal", function (event) {
    // Mueve el foco a otro elemento fuera del modal (ejemplo: el botón de inicio de sesión)
    document.getElementById("login-btn")?.focus();
});
