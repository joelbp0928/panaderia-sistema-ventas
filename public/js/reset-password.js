import { supabase } from './supabase-config.js';

// Obtener el token de la URL
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('token');  // Obtener el token de la URL

// Verificar si el token existe
if (!accessToken) {
    console.error("No se ha encontrado el token en la URL.");
    alert("No se encontró el token de recuperación");
} else {
    console.log("Token obtenido correctamente:", accessToken);
}

// Manejo del formulario para establecer la nueva contraseña
document.getElementById('reset-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = document.getElementById('new-password').value;

    // Verificar que la contraseña no esté vacía
    if (!newPassword) {
        alert('La contraseña no puede estar vacía.');
        return;
    }

    try {
        // Restablecer la contraseña utilizando el token
        const { data, error } = await supabase.auth.api.updateUserPasswordWithToken(accessToken, newPassword);

        if (error) {
            console.error("Error al restablecer la contraseña:", error.message);
            alert('Error al restablecer la contraseña: ' + error.message);
        } else {
            console.log("Contraseña restablecida con éxito.");
            alert('Contraseña restablecida correctamente.');
            window.location.href = '../index.html';  // Redirigir al login después de la actualización
        }
    } catch (error) {
        console.error('Error al procesar la solicitud:', error.message);
        alert('Error al procesar la solicitud: ' + error.message);
    }
});
