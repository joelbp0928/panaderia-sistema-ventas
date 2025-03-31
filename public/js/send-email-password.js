import { supabase } from "./supabase-config.js";
// Obtener el correo del parámetro en la URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
//     console.log("Email:", email);

// Manejar el formulario de restablecimiento de contraseña
document.getElementById("forgot-password-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    // Obtener el correo electrónico ingresado
    const emailInput = document.getElementById("recovery-email").value;

    // Verificar si el correo electrónico ingresado coincide con el que recibimos
/*       if (emailInput !== email) {
      alert(
        "El correo ingresado no coincide con el correo de la invitación."
      );
      return;
    }*/

    try {
      // Enviar el enlace de restablecimiento de contraseña
      const { data, error } =
        await supabase.auth.resetPasswordForEmail(emailInput);
      
      if (error) {
        console.error(
          "Error al enviar el enlace de restablecimiento:",
          error.message
        );
        alert(
          "Error al enviar el enlace de restablecimiento: " +
            error.message
        );
      } else {
        console.log("Enlace de restablecimiento enviado con éxito.");
        alert(
          "Te hemos enviado un enlace para restablecer tu contraseña."
        );
        window.location.href = "../index.html"; // Redirigir al login después de enviar el correo
      }
    } catch (error) {
      console.error("Error al procesar la solicitud:", error.message);
      alert("Error al procesar la solicitud: " + error.message);
    }
  });

  