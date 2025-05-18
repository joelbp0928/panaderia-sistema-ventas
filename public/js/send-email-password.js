      import { supabase } from "../js/supabase-config.js";

      document.getElementById("forgot-password-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("recovery-email").value;

        try {
          const { data, error } = await supabase.auth.resetPasswordForEmail(emailInput);

          if (error) {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "No se pudo enviar el enlace: " + error.message,
            });
          } else {
            Swal.fire({
              icon: "success",
              title: "¡Enlace enviado!",
              text: "Revisa tu correo para continuar con el restablecimiento.",
              confirmButtonText: "Aceptar",
            }).then(() => {
              window.location.href = "../index.html";
            });
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error inesperado",
            text: error.message,
          });
        }
      });