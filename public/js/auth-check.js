import { supabase } from "./supabase-config.js"; // 🔥 Importamos la configuración
import { mostrarToast } from "./manageError.js";
// Verificar si el usuario tiene permisos de admin
export async function verificarAccesoAdmin() {
    try {
      //  console.log("🔍 Verificando acceso del usuario...");

        // 🔹 Obtener sesión activa y usuario autenticado
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) throw new Error("No hay sesión activa.");

        const userId = sessionData.session.user.id;
       // console.log("🟢 Usuario autenticado con ID:", userId);

        // 🔹 Consultar el rol del usuario en la base de datos
        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", userId)
            .single();

        if (userError || !userData) {
            throw new Error("Usuario no encontrado en la base de datos.");
        }

      //  console.log(`✅ Usuario encontrado: ${userData.nombre} (${userData.rol})`);

        // 🔹 Validar si es un administrador
        if (userData.rol !== "admin") {
            alert("🚫 No tienes permisos para acceder a esta página.");
            window.location.href = "../index.html";
        }

    } catch (error) {
        console.error("❌ Error en la verificación de acceso:", error.message);
        alert("⚠️ Debes iniciar sesión como administrador.");
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
            console.log("🟠 No hay sesión activa.");
            return;
        }

        const userId = sessionData.session.user.id;
        console.log("🟢 Usuario autenticado con ID:", userId);

        // 🔹 Consultar el usuario en la base de datos
        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", userId)
            .single();

        if (userError || !userData) {
            console.warn("⚠️ Usuario no encontrado en la base de datos.");
            return;
        }

        console.log(`✅ Sesión activa: ${userData.nombre} (${userData.rol})`);

        // 🔹 Si el usuario es admin y está en index.html, lo redirige al panel
        if (userData.rol === "admin" && window.location.pathname === "/index.html") {
            window.location.href = "./html/admin.html";
        }

    } catch (error) {
        console.error("❌ Error verificando la sesión:", error.message);
    }
}


// 🔹 Cerrar sesión
export function cerrarSesion() {
    console.log("cerrar sesion")
    mostrarToast("Cerrando sesion...", "warning")
    localStorage.removeItem("user");  // Elimina los datos del usuario almacenados
    localStorage.removeItem("rol");
    localStorage.removeItem("nombre");
    
    // Redirigir al índice principal después de que el Toast termine
    setTimeout(() => {
        window.location.href = "../index.html"; // Redirige a la página principal
    }, 1000); // Espera 3 segundos para mostrar el toast antes de redirigir
}