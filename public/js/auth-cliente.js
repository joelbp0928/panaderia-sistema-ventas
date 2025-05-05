// 📦 auth-cliente.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { setClienteActivo } from './estado.js';

// 🔥 Iniciar sesión cliente
export async function iniciarSesionCliente(event) {
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
            const modalLogin = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            modalLogin?.hide(); // 🔥 Cierra automáticamente el modal de login
            if (error.message.includes("Email not confirmed")) {
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
                return; // No permitir login
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

        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", data.user.id)
            .single();

        if (userError || !userData) {
            mostrarToast("⚠️ Usuario no encontrado en base de datos.", "warning");
            restoreButton();
            return;
        }

        if (userData.rol !== "cliente") {
            mostrarToast("🚫 Acceso solo para clientes.", "error");
            restoreButton();
            return;
        }

        // Guardar nombre en localStorage
        localStorage.setItem("nombre_cliente", userData.nombre);

        mostrarToast(`✅ Bienvenido, ${userData.nombre}!`, "success");

        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error("❌ Error iniciando sesión cliente:", error);
        mostrarToast("❌ Error en el inicio de sesión.", "error");
    } finally {
        restoreButton();
    }

    function restoreButton() {
        loginButton.disabled = false;
        loginButton.innerHTML = originalButtonContent;
    }
}

// 🔥 Verificar si hay sesión cliente
export async function verificarSesionCliente() {
    try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
            console.log("🟠 No hay sesión activa para cliente.");
            setClienteActivo(false);
            return false; // Retorna false cuando no hay sesión
        }

        const userId = sessionData.session.user.id;

        const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("nombre, rol")
            .eq("id", userId)
            .single();

        if (userError || !userData) {
            console.warn("⚠️ Usuario no encontrado en base de datos cliente.");
            setClienteActivo(false);
            return false; // Retorna false cuando no hay sesión
        }

        if (userData.rol !== "cliente") {
            console.warn("🚫 El usuario no es cliente.");
            setClienteActivo(false);
            return false; // Retorna false cuando no hay sesión
        }

        actualizarHeaderCliente(userData.nombre);
        setClienteActivo(true);
        return true; // Retorna true cuando hay cliente verificado

    } catch (error) {
        console.error("❌ Error verificando sesión cliente:", error);
        setClienteActivo(false);
        return false; // Retorna false cuando no hay sesión
    }
}

// 🔥 Cerrar sesión cliente
export async function cerrarSesionCliente() {
    try {
        await supabase.auth.signOut();
        localStorage.removeItem("nombre_cliente");
        mostrarToast("Cerrando sesión...", "warning");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
    } catch (error) {
        console.error("❌ Error cerrando sesión cliente:", error);
        mostrarToast("❌ Error al cerrar sesión.", "error");
    }
}

// 🔥 Actualizar el header dinámicamente
export function actualizarHeaderCliente(nombre) {
    document.getElementById("guest-buttons")?.classList.add("d-none");
    document.getElementById("user-buttons")?.classList.remove("d-none");

    const clientName = document.getElementById("client-name");
    if (clientName) {
        clientName.textContent = `Hola, ${nombre}`;
    }

    // Activar botón de cerrar sesión
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", cerrarSesionCliente);
    }
}
