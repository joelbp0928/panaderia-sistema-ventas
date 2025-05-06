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


import "./forgot-password.js";

window.onload = async function () {
    try {
        cargarConfiguracion();

        // Primero verificamos la sesión del cliente
        const clienteVerificado = await verificarSesionCliente();

        // Solo inicializamos el carrito si hay un cliente verificado
        if (clienteVerificado) {
            console.log("Cliente verificado - Inicializando carrito");
            const carritoBtn = document.getElementById("carrito-btn");

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
        } else {
            console.log("No hay cliente verificado - Carrito no disponible");
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


document.getElementById("btnHistorialPedidos").addEventListener("click", async () => {
    const overlay = document.getElementById("sidebarHistorial");
    overlay.classList.remove("d-none");
    document.body.style.overflow = "hidden"; // Evita scroll del fondo
  
    // Cargar pedidos del cliente
    const { data: user } = await supabase.auth.getUser();
    const usuario_id = user?.user?.id;
  console.log(usuario_id)
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("cliente_id", usuario_id)
      .order("fecha", { ascending: false });
  
    const contenedor = document.getElementById("contenidoHistorial");
    if (error || !pedidos || pedidos.length === 0) {
      contenedor.innerHTML = `<p class="text-muted mt-3"><i class="fas fa-ban me-2"></i>Sin pedidos recientes</p>`;
      return;
    }
  
    contenedor.innerHTML = pedidos.map(p => `
      <div class="border-bottom py-2">
        <div><i class="fas fa-receipt me-2"></i><strong>Ticket:</strong> ${p.codigo_ticket}</div>
        <div><i class="fas fa-calendar-alt me-2"></i>${new Date(p.fecha).toLocaleString()}</div>
        <div><i class="fas fa-dollar-sign me-2"></i>Total: $${p.total}</div>
      </div>
    `).join('');
  });
  
  // Cerrar con botón
  document.getElementById("cerrarSidebarHistorial").addEventListener("click", () => {
    document.getElementById("sidebarHistorial").classList.add("d-none");
    document.body.style.overflow = "";
  });
  
  // Cerrar con Esc o clic fuera
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarSidebar();
  });
  
  document.getElementById("sidebarHistorial").addEventListener("click", (e) => {
    if (e.target.id === "sidebarHistorial") cerrarSidebar();
  });
  
  function cerrarSidebar() {
    const sidebar = document.getElementById("sidebarHistorial");
    sidebar.classList.add("d-none");
    document.body.style.overflow = "";
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
