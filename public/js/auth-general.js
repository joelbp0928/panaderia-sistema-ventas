// 📦 auth-general.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

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
