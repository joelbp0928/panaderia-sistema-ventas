import { supabase } from "./supabase-config.js"; // 🔥 Importamos la configuración
import { mostrarToast } from "./manageError.js";
import { iniciarSesion } from "./auth.js"; // Importamos la función de login desde auth.js
// Verificar si el usuario tiene permisos de admin
export async function verificarAccesoAdmin() {
    try {
        // 🔹 Obtener sesión activa y usuario autenticado
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            mostrarToast("🟠 No hay sesión activa.", "warnign");
            console.log("🟠 No hay sesión activa.");
            return;
        }

        const userId = sessionData.session.user.id;

        // 🔹 Consultar el rol del usuario en la base de datos
        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", userId)
            .single();

        if (userError || !userData) {
            mostrarToast("⚠️ Usuario no encontrado en la base de datos.", "warning");
            throw new Error("⚠️ Usuario no encontrado en la base de datos.");
        }

        // 🔹 Validar si es un administrador
        if (userData.rol !== "admin") {
            mostrarToast("🚫 No tienes permisos para acceder a esta página.", "warning");
            window.location.href = "../index.html";
        }

    } catch (error) {
        console.error("❌ Error en la verificación de acceso:", error.message);
        mostrarToast("⚠️ Debes iniciar sesión como administrador.", "warning");
        window.location.href = "../index.html";
    }
}

// Verificar si hay un usuario autenticado al cargar la página
export async function verificarSesion() {
    try {
        //  console.log("🔍 Verificando sesión activa...");

        // 🔹 Obtener sesión activa
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            mostrarToast("🟠 No hay sesión activa.", "warning");
            console.log("🟠 No hay sesión activa.");
            return;
        }

        const userId = sessionData.session.user.id;

        // 🔹 Consultar el usuario en la base de datos
        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", userId)
            .single();

        if (userError || !userData) {
            mostrarToast("⚠️ Usuario no encontrado en la base de datos.", "warning");
            console.warn("⚠️ Usuario no encontrado en la base de datos.");
            return;
        }

        // Mostrar el nombre del usuario en el encabezado
        const employeeName = document.getElementById('employee-name');
        employeeName.textContent = `Sesión activa: ${userData.nombre}`; // Actualiza el nombre del usuario

        console.log(`✅ Sesión activa: ${userData.nombre} (${userData.rol})`);

        // 🔹 Si el usuario es admin y está en index.html, lo redirige al panel
        if (userData.rol === "admin" && window.location.pathname === "/index.html") {
            window.location.href = "./html/admin.html";
        }

    } catch (error) {
        mostrarToast("❌ Error verificando la sesión.", "error");
        console.error("❌ Error verificando la sesión:", error.message);
    }
}


// 🔹 Cerrar sesión
export async function cerrarSesion() {
    /*   console.log(localStorage);
       // cerrarSesionAuth();
       //console.log(localStorage);
       console.log("cerrar sesion")
       mostrarToast("Cerrando sesion...", "warning")
       localStorage.removeItem("user");  // Elimina los datos del usuario almacenados
       localStorage.removeItem("rol");
       localStorage.removeItem("nombre");
       localStorage.removeItem("_grecaptcha");
       localStorage.removeItem("sb-kicwgxkkayxneguidsxe-auth-token");
       console.log(localStorage);
   */

    let { error } = await supabase.auth.signOut()

    // Redirigir al índice principal después de que el Toast termine
    setTimeout(() => {
        window.location.href = "../index.html"; // Redirige a la página principal
    }, 1000); // Espera 3 segundos para mostrar el toast antes de redirigir
}