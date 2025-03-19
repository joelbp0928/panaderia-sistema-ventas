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

        // 🔹 Event listeners después de cargar el DOM
        document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
        document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);

        //console.log("✅ Eventos y configuraciones cargados correctamente.");
    } catch (error) {
        console.error("❌ Error en la inicialización de admin.js:", error);
    }
};
