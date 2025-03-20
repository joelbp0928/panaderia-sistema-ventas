import { agregarIngrediente, cargarIngredientes, showIngredientForm } from "./ingredientes.js"; // 📌 Importar lógica de ingredientes
import { verificarAccesoAdmin, verificarSesion } from "./auth-check.js";
import { mostrarFormularioEmpleado, gestionarEmpleado, cargarEmpleados } from "./empleados.js";
import { cargarConfiguracion } from "./admin/configAdmin.js";


window.onload = async function () {
    try {
        // 🔹 Cargar elementos principales de la página
        await verificarAccesoAdmin();
        await verificarSesion();
        await cargarEmpleados();
        await cargarConfiguracion(); // ✅ Cargar la configuración de la tienda
        await cargarIngredientes(); // 🔹 Cargar los ingredientes

        // 🔹 Event listeners después de cargar el DOM
        document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
        document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);
        document.getElementById("ingredient-form").addEventListener("submit", agregarIngrediente);
        document.getElementById("btn-agregar-ingrediente").addEventListener("click", showIngredientForm);

        //console.log("✅ Eventos y configuraciones cargados correctamente.");
    } catch (error) {
        console.error("❌ Error en la inicialización de admin.js:", error);
    }
};
