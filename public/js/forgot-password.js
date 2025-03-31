import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

// 📌 Manejamos el formulario de recuperación de contraseña
document
  .getElementById("forgot-password-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault(); // Evitar recarga de la página

    // Obtener el correo electrónico ingresado
    const emailInput = document.getElementById("recovery-email").value.trim();

    // Verificar si el correo está vacío
    if (!emailInput) {
      alert("⚠️ Por favor ingresa tu correo electrónico.");
      return;
    }

    try {
      // Enviar el enlace de restablecimiento de contraseña
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        emailInput
      );

      // Verificar si hubo un error
      if (error) {
        console.error("Error al enviar el enlace de restablecimiento:", error.message);
        mostrarToast("❌ Error al enviar el enlace de restablecimiento: " + error.message, "error");
      } else {
        // console.log("Enlace de restablecimiento enviado con éxito.");
        mostrarToast(
          "✅ Te hemos enviado un enlace para restablecer tu contraseña al correo proporcionado.", "success"
        );
        // Verificar que el modal esté visible y luego ocultarlo
        const modalElement = document.getElementById('forgotPasswordModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide(); // Ocultar el modal
      }
    } catch (error) {
      console.error("Error al procesar la solicitud:", error.message);
      alert("❌ Error al procesar la solicitud: " + error.message);
    }
  });
