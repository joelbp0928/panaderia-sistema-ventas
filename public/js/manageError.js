/**
 * 📌 Resalta un campo con error en Bootstrap
 * @param {string} campoID - El ID del campo del formulario
 * @param {string} mensaje - Mensaje de error que se mostrará debajo
 */
export function marcarErrorCampo(campoID, mensaje) {
    const campo = document.getElementById(campoID);
    const errorDiv = document.createElement("div");

    // Agregar clases de Bootstrap para error
    campo.classList.add("is-invalid");

    // Crear mensaje de error debajo del campo si no existe
    errorDiv.classList.add("invalid-feedback");
    errorDiv.innerText = mensaje;

    // Evitar que el mismo error se agregue varias veces
    if (!campo.parentNode.querySelector(".invalid-feedback")) {
        campo.parentNode.appendChild(errorDiv);
    }
}

/**
 * 📌 Limpia los errores de un campo cuando se corrige
 * @param {string} campoID - El ID del campo a limpiar
 */
export function limpiarErrorCampo(campoID) {
    const campo = document.getElementById(campoID);
    campo.classList.remove("is-invalid");

    // Eliminar mensaje de error si existe
    const errorMensaje = campo.parentNode.querySelector(".invalid-feedback");
    if (errorMensaje) {
        errorMensaje.remove();
    }
}

/**
 * 📌 Muestra una alerta flotante con Toastify*/
export function mostrarToast(mensaje, tipo) {
    // Objeto para mapear los tipos de mensaje con sus colores correspondientes
    const colors = {
        success: "linear-gradient(to right,rgb(92, 172, 68),rgb(126, 172, 48))", // Tipo "success" con color verde
        error: "linear-gradient(to right, #fc0808, #f12626d7)",     // Tipo "error" con color rojo
        warning: "linear-gradient(to right, #e27a03, #f1cb4d)", // Tipo "warning" con color naranja
        default: "gray",  // Tipo por defecto con color gris
    };
    // Obtenemos el color del tipo de mensaje o usamos el color por defecto si no coincide
    const color = colors[tipo] || colors.default;
    // Mostramos el mensaje utilizando la librería Toastify
    Toastify({
        text: mensaje,         // Texto del mensaje
        duration: 3500,        // Duración en milisegundos que se muestra el mensaje
        newWindow: true,       // Abre en nueva ventana
        close: true,           // Permite cerrar el mensaje
        gravity: "top",     // Posición del mensaje, en la parte inferior
        position: "right",     // Alineación del mensaje, al centro
        stopOnFocus: true,     // Evita que el mensaje se cierre al poner el cursor encima
        style: {
            background: color, // Utilizamos el color obtenido del objeto "colors" para establecer el fondo del mensaje
        },
        onClick: function () { // Acción a realizar cuando se hace clic en el mensaje
            // Aquí puedes agregar cualquier acción adicional si es necesario
        }
    }).showToast(); // Mostramos el mensaje utilizando la función showToast() de Toastify
}
