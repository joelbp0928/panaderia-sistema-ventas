// Importar otros módulos
import { cargarProductos, cargarConfiguracion } from "./config.js";
import { verificarSesion } from './auth-check.js'; // Importa la función para verificar la sesión
import { inicializarCarrito, mostrarCarrito, generarResumenPopover } from "./cart.js";
import { iniciarSesion } from "./auth.js";
import { supabase } from "./supabase-config.js";
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js";
import { registrarCliente } from "./registro-cliente.js";
import { iniciarSesionCliente, verificarSesionCliente, cerrarSesionCliente } from "./auth-cliente.js"; // ✅ Nuevo auth-cliente
import { iniciarSesionGeneral } from './auth-general.js';
import { inicializarHistorialPedidos } from "./historialPedidos.js";
import { obtenerSugerencia } from './sugerencias.js';


import "./forgot-password.js";

window.onload = async function () {
    try {
        cargarConfiguracion();

        // Primero verificamos la sesión del cliente
        const clienteVerificado = await verificarSesionCliente();

        // Solo inicializamos el carrito si hay un cliente verificado
        if (clienteVerificado) {
           // console.log("Cliente verificado - Inicializando carrito");
            const carritoBtn = document.getElementById("carrito-btn");
            obtenerSugerencia(); 

            if (carritoBtn) {
                const popover = new bootstrap.Popover(carritoBtn, {
                    trigger: 'hover',
                    placement: 'bottom',
                    html: true,
                    content: "<div id='popover-carrito-content'>Cargando...</div>"
                });

                carritoBtn.addEventListener("shown.bs.popover", async () => {
                    await generarResumenPopover();
                });
            }
            inicializarCarrito();
            inicializarHistorialPedidos();
        } else {
           // console.log("No hay cliente verificado - Carrito no disponible");
        }

        cargarProductos();

        // 📌 Asociar la función al formulario de inicio de sesión
        document.getElementById("login-form").addEventListener("submit", iniciarSesionGeneral);
        document.getElementById('signup-form').addEventListener('submit', registrarCliente);
        document.getElementById('logout-cliente-btn').addEventListener('click', cerrarSesionCliente);
        document.getElementById("carritoSidebar").addEventListener("show.bs.offcanvas", mostrarCarrito);

    } catch (error) {
        console.error("❌ Error en la inicialización de admin.js:", error);
    }

}

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
