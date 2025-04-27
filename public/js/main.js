// Importar otros módulos
import { cargarProductos, cargarConfiguracion } from "./config.js";
import { verificarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { inicializarCarrito } from "./cart.js";
import { iniciarSesion } from "./auth.js";

import "./forgot-password.js";

window.onload = async function () {
    try {
        //    verificarSesion();
        // Cargar elementos principales de la página
        //  cargarPromociones();
        cargarProductos();

        // Inicializar otros módulos
        inicializarCarrito();
        //      inicializarAutenticacion();

        cargarConfiguracion();
        // 📌 Asociar la función al formulario de inicio de sesión
        document.getElementById("login-form").addEventListener("submit", iniciarSesion);

    } catch (error) {
        console.error("❌ Error en la inicialización de admin.js:", error);
    }

}

document.getElementById('signup-form').addEventListener('submit', registrarCliente);
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

export async function registrarCliente(event) {
  event.preventDefault();

  const signupButton = event.target.querySelector("button[type='submit']");
  const originalButtonContent = signupButton.innerHTML;

  try {
    // 🔄 Poner loading en botón
    signupButton.disabled = true;
    signupButton.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registrando...
    `;

    // 📋 Datos
    const nombre = document.getElementById("signup-name").value.trim();
    const genero = document.getElementById("signup-gender").value;
    const fechaNacimiento = document.getElementById("signup-birthdate").value;
    const municipio = document.getElementById("signup-municipio").value.trim();
    const colonia = document.getElementById("signup-colonia").value.trim();
    const codigoPostal = document.getElementById("signup-codigo-postal").value.trim();
    const direccion = document.getElementById("signup-address").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const telefono = document.getElementById("signup-phone").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const confirmPassword = document.getElementById("signup-password-confirm").value.trim();

    // 🧠 Validaciones
    if (!nombre || !email || !password || !confirmPassword || !telefono || !direccion || !fechaNacimiento || !municipio || !colonia || !codigoPostal) {
      mostrarToast("⚠️ Todos los campos son obligatorios.", "warning");
      restoreButton();
      return;
    }
    if (password.length < 6) {
      mostrarToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");
      restoreButton();
      return;
    }
    if (password !== confirmPassword) {
      mostrarToast("⚠️ Las contraseñas no coinciden.", "warning");
      restoreButton();
      return;
    }

    // 🔥 Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const user = authData.user;
    if (!user) throw new Error("No se pudo registrar el usuario.");

    // 🔹 Insertar en 'usuarios'
    const { error: insertUserError } = await supabase.from("usuarios").insert([
      {
        id: user.id,
        email,
        nombre,
        rol: "cliente",
        telefono,
        fechaNacimiento,
        fechaRegistro: new Date().toISOString()
      }
    ]);
    if (insertUserError) throw insertUserError;

    // 🔹 Insertar en 'clientes'
    const { error: insertClienteError } = await supabase.from("clientes").insert([
      {
        usuario_id: user.id,
        direccion,
        municipio,
        colonia,
        codigoPostal: parseInt(codigoPostal),
        genero
      }
    ]);
    if (insertClienteError) throw insertClienteError;

    // 🎉 Todo OK
    mostrarToast("✅ ¡Registro exitoso! Revisa tu correo.", "success");

    // 🧹 Limpiar formulario
    event.target.reset();

    // 🎬 Cerrar modal de forma bonita
    setTimeout(() => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
      modal?.hide();
    }, 1500);

  } catch (error) {
    console.error("❌ Error al registrar cliente:", error);
    mostrarToast(`❌ Error: ${error.message}`, "error");
  } finally {
    restoreButton();
  }

  function restoreButton() {
    signupButton.disabled = false;
    signupButton.innerHTML = originalButtonContent;
  }
}


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
