// 📦 auth-general.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

// Por esto:
let nyancat;

// Precarga el audio después de interacción del usuario
document.addEventListener('click', () => {
  if (!nyancat) {
    nyancat = new Audio("./sounds/nycat.mp3");
    nyancat.preload = 'auto';
    nyancat.load();
  }
}, { once: true }); // Solo se ejecuta una vez

export async function iniciarSesionGeneral(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const loginButton = event.target.querySelector("button[type='submit']");
  const originalButtonContent = loginButton.innerHTML;

  if (!email || !password) {
    mostrarToast("⚠️ Debes ingresar correo y contraseña.", "warning");
    return;
  }

  try {
    loginButton.disabled = true;
    loginButton.innerHTML = `<span class='spinner-border spinner-border-sm' role='status'></span> Ingresando...`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {


      if (error.message.includes("Email not confirmed")) {
        const modalLogin = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        modalLogin?.hide(); // 🔥 Cierra automáticamente el modal de login
        // Solución para autoplay bloqueado
        const playSound = async () => {
          try {
            nyancat.volume = 0.2; // Ajusta el volumen
            await nyancat.play();
          } catch (err) {
            console.log("Error al reproducir sonido:", err);
            // Si falla, solicita interacción del usuario
            Swal.fire({
              title: 'Activar sonidos',
              text: 'Haz clic para activar los efectos de sonido',
              confirmButtonText: 'Activar',
              allowOutsideClick: false
            }).then(() => {
              nyancat.play(); // Ahora debería funcionar
            });
          }
        };

        await playSound(); // Intenta reproducir el sonido
        // Usuario no ha confirmado su correo
        await Swal.fire({
          title: '¡Confirma tu correo!',
          html: `Necesitas confirmar tu correo electrónico antes de iniciar sesión. 
                    <br><br> ¿Quieres que reenviemos el correo de verificación a <b>${email}</b>?`,
          icon: 'info',
          confirmButtonColor: '#9a223d',
          confirmButtonText: 'Reenviar correo',
          cancelButtonText: 'Cancelar',
          showCancelButton: true,
          backdrop: `
                      rgba(0,0,0,0.5)
                      url("https://media.tenor.com/2roX3uxz_68AAAAC/cat-party.gif")
                      center center / cover
                      no-repeat
                    `,
          showClass: {
            popup: 'animate__animated animate__fadeInDown'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
          },
          didOpen: () => {
            // Opcional: Reproducir sonido también cuando el modal está completamente abierto
          }
        }).then(async (result) => {
          if (result.isConfirmed) {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email: email
            });
            if (!resendError) {
              mostrarToast("📩 Correo de verificación reenviado", "success");
            }
            mostrarToast("📩 Correo de verificación no enviado, demasiados envios", "warning");
          }
        });
        restoreButton();
        await nyancat.pause();
        return; // No permitir login
      } else if (error.message.includes("Invalid login credentials")) {
        // Verificamos si el correo existe en la base de datos
        const { data: userExists, error: userCheckError } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', email)
          .single();

        if (userCheckError || !userExists) {
          mostrarToast("❌ No existe ningún usuario con este correo electrónico.", "error");
        } else {
          mostrarToast("❌ Contraseña incorrecta.", "error");
        }
      } else {
        mostrarToast(`❌ Error: ${error.message}`, "error");
      }
      return;
    }

    if (error || !data.user) {
      mostrarToast("❌ Correo o contraseña incorrectos.", "error");
      restoreButton();
      return;
    }

    const userId = data.user.id;

    const { data: userData, error: userError } = await supabase
      .from("usuarios")
      .select("nombre, rol")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      mostrarToast("⚠️ Usuario no encontrado.", "warning");
      restoreButton();
      return;
    }

    const { nombre, rol } = userData;

    if (rol === "cliente") {
      localStorage.setItem("nombre_cliente", nombre);
      mostrarToast(`✅ Bienvenido cliente, ${nombre}!`, "success");

      setTimeout(() => {
        window.location.reload();  // Recargar index cliente
      }, 1000);

    } else if (rol === "admin") {
      localStorage.setItem("nombre_admin", nombre);
      mostrarToast(`✅ Bienvenido administrador, ${nombre}!`, "success");

      setTimeout(() => {
        window.location.href = "./html/admin.html";
      }, 1000);

    } else if (rol === "empleado") {
      // Extra info: puesto
      const { data: empleadoData, error: empleadoError } = await supabase
        .from("empleados")
        .select("puesto")
        .eq("usuario_id", userId)
        .single();

      if (empleadoError || !empleadoData) {
        mostrarToast("⚠️ No se encontró el puesto del empleado.", "warning");
        restoreButton();
        return;
      }

      const puesto = empleadoData.puesto;
      mostrarToast(`✅ Bienvenido, ${nombre}!`, "success");

      let redirectUrl = "./html/empleado.html"; // Default

      if (puesto === "cajero") {
        redirectUrl = "./html/cajero.html";
      } else if (puesto === "empacador") {
        redirectUrl = "./html/empacador.html";
      }

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1000);

    } else {
      mostrarToast("🚫 No tienes acceso autorizado.", "error");
    }

  } catch (error) {
    console.error("❌ Error en el inicio de sesión general:", error);
    mostrarToast("❌ Error inesperado al iniciar sesión.", "error");
  } finally {
    restoreButton();
  }

  function restoreButton() {
    loginButton.disabled = false;
    loginButton.innerHTML = originalButtonContent;
  }
}
