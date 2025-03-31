import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

export function inicializarAutenticacion() {
    // document.getElementById("login-btn").addEventListener("click", mostrarLogin);
    document.getElementById("logout-btn")?.addEventListener("click", cerrarSesion);
}

// 🔹 Mostrar el modal de login
function mostrarLogin() {
    document.getElementById("login-modal").style.display = "block";
}

// 🔹 Cerrar sesión
export async function cerrarSesionAuth() {
    try {
        await supabase.auth.signOut(); // Cierra la sesión en Supabase
        mostrarToast("✅ Cerrando sesión...", "warning");
        // Redirigir al índice principal después de que el Toast termine
        setTimeout(() => {
            window.location.href = "index.html"; // Redirige a la página principal
        }, 1000); // Espera 1 segundos para mostrar el toast antes de redirigir
    } catch (error) {
        console.error("❌ Error al cerrar sesión:", error.message);
        mostrarToast("❌ Error al cerrar sesión", "error");
    }

}
// 📌 Función para iniciar sesión y redirigir según el rol
export async function iniciarSesion(event) {
    event.preventDefault();

    // Obtener datos del formulario
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
        alert("⚠️ Debes ingresar correo y contraseña.");
        return;
    }

    try {
        // 🔹 Autenticar usuario en Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            mostrarToast("❌ Correo o contraseña incorrectos. Intenta nuevamente.", "error");
        }

        const user = data.user;
        if (!user) {
            throw new Error("No se pudo obtener la información del usuario.");
        }

        // 🔹 Consultar los datos del usuario en la base de datos
        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", user.id)
            .single();

        if (userError) throw new Error("No se encontró el usuario en la base de datos.");

        // Extraer datos del usuario
        const { nombre, rol } = userData;
        console.log("userdata", userData)
        // Guardar los datos en localStorage
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("rol", rol);
        localStorage.setItem("nombre", nombre);


        // Verificar si el usuario es un empleado y buscar su puesto
        let redirectUrl = "index.html"; // Default redirect URL
        if (rol === "empleado") {
            // Consultar la tabla empleados para obtener el puesto
            const { data: empleadoData, error: empleadoError } = await supabase
                .from("empleados")
                .select("puesto")
                .eq("usuario_id", user.id)  // Suponiendo que la tabla empleados tiene una columna 'usuario_id' que se relaciona con la tabla usuarios
                .single();

            if (empleadoError) {
                throw new Error("No se encontró el puesto del empleado.");
            }

            // Redirigir según el puesto del empleado
            const puesto = empleadoData.puesto;
            switch (puesto) {
                case "cajero":
                    mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo a la página de cajero.`, "success");
                    redirectUrl = './html/cajero.html';
                    break;
                case "empacador":
                    mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo a la página de empacadores.`, "success");
                    redirectUrl = './html/empacador.html';
                    break;
                default:
                    mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo a la página de empleados.`, "success");
                    redirectUrl = './html/index.html';
                    break;
            }
        } else {
            // Si el rol no es "empleado", solo redirigir dependiendo del rol
            switch (rol) {
                case "admin":
                    mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo al panel de administración.`, "success");
                    redirectUrl = './html/admin.html';
                    break;
                case "cliente":
                    mostrarToast(`✅ Bienvenido, ${nombre}. Disfruta de tu experiencia en nuestra tienda.`, "success");
                    redirectUrl = './html/index.html';
                    break;
                default:
                    mostrarToast(`✅ Bienvenido, ${nombre}. Disfruta de tu experiencia en nuestra tienda.`, "success");
            }
        }
        // Redirigir al índice principal después de que el Toast termine
        setTimeout(() => {
            window.location.href = redirectUrl;; // Redirige a la página principal
        }, 1000); // Espera 1 segundo para mostrar el toast antes de redirigir
    } catch (error) {
        //  mostrarToast("❌ Error en el inicio de sesión", "warning");
        console.error("❌ Error en el inicio de sesión:", error);
    }
}


// 📌 Función para registrar un usuario nuevo en Supabase
async function registrarUsuario(event) {
    event.preventDefault(); // Evita recargar la página

    // 🔹 Obtener datos del formulario
    const nombre = document.getElementById("signup-name").value.trim();
    const genero = document.getElementById("signup-gender").value;
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const confirmPassword = document.getElementById("signup-password-confirm").value.trim();
    const telefono = document.getElementById("signup-phone").value.trim();
    const direccion = document.getElementById("signup-address").value.trim();
    const fechaNacimiento = document.getElementById("signup-birthdate").value;
    const municipio = document.getElementById("signup-municipio").value.trim();
    const colonia = document.getElementById("signup-colonia").value.trim();
    const codigoPostal = document.getElementById("signup-codigo-postal").value.trim();

    // 🔸 Validar datos
    if (!nombre || !email || !password || !confirmPassword || !telefono || !direccion || !fechaNacimiento || !municipio || !colonia || !codigoPostal) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }
    if (password.length < 6) {
        alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (password !== confirmPassword) {
        alert("⚠️ Las contraseñas no coinciden.");
        return;
    }

    try {
        // 🔹 Registrar usuario en Supabase Authentication
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        // 🔹 Extraer el UID del usuario creado
        const user = data.user;
        if (!user) {
            alert("❌ Error al obtener el usuario después del registro.");
            return;
        }

        // 🔹 Guardar datos adicionales en la tabla "usuarios"
        const { error: insertError } = await supabase.from("usuarios").insert([
            {
                id: user.id,  // UID generado por Supabase Auth
                nombre,
                genero,
                fechaNacimiento: fechaNacimiento,
                municipio,
                colonia,
                codigoPostal: codigoPostal,
                email,
                telefono,
                direccion,
                rol: "cliente",
                fechaRegistro: new Date().toISOString()
            }
        ]);

        if (insertError) throw insertError;

        // ✅ Registro exitoso
        alert("✅ ¡Registro exitoso! Revisa tu correo para confirmar la cuenta.");
        document.getElementById("signupModal").style.display = "none"; // Cierra el modal

    } catch (error) {
        console.error("❌ Error en el registro:", error);
        alert(`Error: ${error.message}`);
    }
}

// 📌 Asociar la función al formulario
//document.getElementById("signup-form").addEventListener("submit", registrarUsuario);
