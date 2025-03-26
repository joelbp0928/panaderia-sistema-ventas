//import { auth, db } from "./firebase-conf";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { mostrarToast } from "./manageError.js";
import { supabase } from "./supabase-config.js";

//const supabase = createClient(supabaseUrl, supabaseAnonKey);


export function inicializarAutenticacion() {
    // document.getElementById("login-btn").addEventListener("click", mostrarLogin);
    document.getElementById("logout-btn")?.addEventListener("click", cerrarSesion);
}

// 🔹 Mostrar el modal de login
function mostrarLogin() {
    document.getElementById("login-modal").style.display = "block";
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
        window.location.href = "index.html"; // Redirige a la página principal
    }, 3000); // Espera 3 segundos para mostrar el toast antes de redirigir
}
// 📌 Función para iniciar sesión y redirigir según el rol
async function iniciarSesion(event) {
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

        // Guardar los datos en localStorage
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("rol", rol);
        localStorage.setItem("nombre", nombre);


        // 🔹 Mensaje personalizado según el rol
        let redirectUrl = "index.html"; // Default redirect URL
        switch (rol) {
            case "admin":
                mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo al panel de administración.`, "success");
                redirectUrl = './html/admin.html';
                break;
            case "cajero":
                mostrarToast(`✅ Bienvenido, ${nombre}. Accediendo a la página de cajero.`, "success");
                redirectUrl = './html/cajero.html';
                break;
            case "empacador":
                alert(`✅ Bienvenido, ${nombre}. Accediendo a la página de empacadores.`, "success");
                redirectUrl = './html/empacadores.html';
                break;
            default:
                mostrarToast("✅ Bienvenido, ${nombre}. Disfruta de tu experiencia en nuestra tienda.", "success");
        }
        window.location.href = redirectUrl;
    } catch (error) {
      //  mostrarToast("❌ Error en el inicio de sesión", "warning");
        console.error("❌ Error en el inicio de sesión:", error);
    }
}


// 📌 Asociar la función al formulario de inicio de sesión
document.getElementById("login-form").addEventListener("submit", iniciarSesion);


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
document.getElementById("signup-form").addEventListener("submit", registrarUsuario);

// 🔹 Recuperar contraseña
document.getElementById("forgot-password-form")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const emailInput = document.getElementById("recovery-email").value;
    const alertBox = document.getElementById("forgot-password-alert");

    if (emailInput === "") {
        alertBox.classList.remove("d-none", "alert-success");
        alertBox.classList.add("alert-danger");
        alertBox.textContent = "Por favor, ingresa un correo válido.";
    } else {
        alertBox.classList.remove("d-none", "alert-danger");
        alertBox.classList.add("alert-success");
        alertBox.textContent = "Se ha enviado un enlace de recuperación a tu correo.";
    }
});
