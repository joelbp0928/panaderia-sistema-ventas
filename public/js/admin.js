import { gestionarIngrediente, cargarIngredientes, showIngredientForm, handlePriceChange, setupRealTimePriceUpdate } from "./ingredientes.js";
import { abrirModalEntrada, cerrarHistorial, cargarInventarioIngredientes } from './inventario_ingredientes.js';
import { showProductForm, gestionarProducto, loadIngredients, cargarProductos } from "./productos.js";
import { abrirModalEntradaProducto, cargarInventarioProductos } from "./inventario_productos.js";
import { mostrarFormularioEmpleado, gestionarEmpleado, cargarEmpleados } from "./empleados.js";
import { verificarAccesoAdmin, verificarSesion, cerrarSesion } from "./auth-check.js";
import { cargarPromociones, cargarProductosPromocion } from './promociones.js';
import { eliminarPedidosAntiguosYRestaurarStock } from "./restaurarStock.js";
import { cargarConfiguracion } from "./admin/configAdmin.js";
import { showLoading, hideLoading } from "./manageError.js";
import { cargarCategorias } from './categorias.js';
import { cargarEstadisticas } from './estadisticas.js';
import { cargarClientes } from "./clientes-admin.js";
import { cargarReportePuntoEquilibrio } from "./reportes.js";


window.onload = async function () {
  try {
    // 🔹 Cargar elementos principales de la página
    showLoading();
    eliminarPedidosAntiguosYRestaurarStock(); // ✅ Eliminar pedidos antiguos y restaurar stock
    await cargarConfiguracion(); // ✅ Cargar la configuración de la tienda
    await verificarAccesoAdmin();
    await verificarSesion();
    hideLoading();
    cargarClientes();
    // 🔹 Event listeners después de cargar el DOM
    document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
    document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);
    document.getElementById("ingredient-form").addEventListener("submit", gestionarIngrediente);
    document.getElementById("btn-agregar-ingrediente").addEventListener("click", showIngredientForm);
    document.getElementById("product-form").addEventListener("submit", gestionarProducto);
    document.getElementById("btn-agregar-producto").addEventListener("click", showProductForm);
    document.getElementById("btn-agregar-ingrediente-inventario").addEventListener("click", abrirModalEntrada);
    document.getElementById("btn-cerrar-historial").addEventListener("click", cerrarHistorial);
    document.getElementById("btn-agregar-producto-inventario").addEventListener("click", abrirModalEntradaProducto);


    // 📌 Función para manejar el cambio entre precio unitario y precio total
    document.getElementById("price-unit").addEventListener("change", handlePriceChange);
    document.getElementById("price-total").addEventListener("change", handlePriceChange);

    // 🔹 Asociar el evento de Cerrar Sesión al botón logout-btn
    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);

    //console.log("✅ Eventos y configuraciones cargados correctamente.");
  } catch (error) {
    console.error("❌ Error en la inicialización de admin.js:", error);
  }
};

// Escuchar cambios de pestaña
document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
  tab.addEventListener('shown.bs.tab', function (event) {
    switch (event.target.id) {
      case "clients-tab":
        cargarClientes();
        break;
      case "employees-tab":
        cargarEmpleados();
        break;
      case "ingredients-tab":
        cargarIngredientes();
        handlePriceChange();
        setupRealTimePriceUpdate();
        break;
      case "products-tab":
        loadIngredients(); // 🔹 Cargar los ingredientes para el producto
        cargarProductos();
        break;
      case "categorias-tab":
        cargarCategorias();
        break;
      case "promotion-recommendations":
        cargarPromociones();
        cargarProductosPromocion();
        break;
      case "inventario-tab":
        cargarInventarioIngredientes();
        cargarInventarioProductos();
        break;
      case "sales-stats-tab":
        cargarEstadisticas();
        break;
      case "reportes-tab":
        cargarReportePuntoEquilibrio();
      // otros casos...
    }
  });
});

// Evento que mueve el foco fuera del modal cuando se cierra
document.addEventListener("hidden.bs.modal", function (event) {
  // Mueve el foco a otro elemento fuera del modal (ejemplo: el botón de inicio de sesión)
  document.getElementById("product-form-submit")?.focus();
});

// Ajustar comportamiento en móviles
function adjustForMobile() {
  if (window.innerWidth < 768) {
    // Cerrar modales al hacer clic fuera en móviles
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) {
        if (e.target === this) {
          bootstrap.Modal.getInstance(this).hide();
        }
      });
    });
    
    // Mejorar experiencia en inputs
    document.querySelectorAll('input, select, textarea').forEach(input => {
      input.addEventListener('focus', function() {
        setTimeout(() => {
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    });
  }
}

// Ejecutar al cargar y al redimensionar
window.addEventListener('load', adjustForMobile);
window.addEventListener('resize', adjustForMobile);