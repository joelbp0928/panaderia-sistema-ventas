import { verificarAccesoAdmin, verificarSesion } from "./auth-check.js";
import { mostrarFormularioEmpleado } from "./empleados.js";

window.onload = function () {   
    // Cargar elementos principales de la página
    verificarAccesoAdmin();
    verificarSesion();
}

// 🔹 Event listeners después de cargar el DOM
document.addEventListener("DOMContentLoaded", function () {
    // Botón para mostrar formulario de empleados
    document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
    // Evento para registrar un empleado
    document.getElementById("form-empleado").addEventListener("submit", registrarEmpleado);
});