import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js";
import { supabase } from "./supabase-config.js";
export async function registrarCliente(event) {
    event.preventDefault();

    const signupButton = event.target.querySelector("button[type='submit']");
    const originalButtonContent = signupButton.innerHTML;
    // 📌 Usar la función para limpiar los errores de los campos
    limpiarErrorCampo([
        "signup-email", "signup-phone",
        "signup-password", "signup-password-confirm"
    ]);
    try {
        // 🔄 Poner loading en botón
        signupButton.disabled = true;
        signupButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registrando...
      `;

        // 📋 Datos
        const nombre = document.getElementById("signup-name").value.trim();
        const genero = document.getElementById("signup-gender").value;
        const fechaNacimiento = document.getElementById("signup-birthdate").value;
        const municipio = document.getElementById("signup-municipio").value.trim();
        const colonia = document.getElementById("signup-colonia").value.trim();
        const codigoPostal = document.getElementById("signup-codigo-postal").value.trim();
        const direccion = document.getElementById("signup-address").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const telefono = document.getElementById("signup-phone").value.trim();
        const password = document.getElementById("signup-password").value.trim();
        const confirmPassword = document.getElementById("signup-password-confirm").value.trim();

        // Verificar si email ya existe
        const { data: emailExists, error: emailError } = await supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .maybeSingle();     // Mejor usar maybeSingle para evitar 406 si no existe

        if (emailError) {
            console.error("Error verificando email:", emailError.message);
        }

        if (emailExists) {
            mostrarToast("⚠️ Este correo ya está registrado.", "warning");
            marcarErrorCampo("signup-email", "⚠️ Este correo ya está registrado.")
            restoreButton();
            return;
        }

        // Verificar si teléfono ya existe
        const { data: phoneExists, error: phoneError } = await supabase
            .from("usuarios")
            .select("id")
            .eq("telefono", telefono)
            .maybeSingle();     // Mejor usar maybeSingle

        if (phoneError) {
            console.error("Error verificando telefono:", phoneError.message);
        }

        if (phoneExists) {
            mostrarToast("⚠️ Este número de teléfono ya está registrado.", "warning");
            marcarErrorCampo("signup-phone", "⚠️ Este número de teléfono ya está registrado.")
            restoreButton();
            return;
        }


        // 🧠 Validaciones
        if (!nombre || !email || !password || !confirmPassword || !telefono || !direccion || !fechaNacimiento || !municipio || !colonia || !codigoPostal) {
            mostrarToast("⚠️ Todos los campos son obligatorios.", "warning");
            restoreButton();
            return;
        }
        if (password.length < 6) {
            mostrarToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");
            marcarErrorCampo("signup-password", "⚠️ La contraseña debe tener al menos 6 caracteres.")
            restoreButton();
            return;
        }
        if (password !== confirmPassword) {
            mostrarToast("⚠️ Las contraseñas no coinciden.", "warning");
            marcarErrorCampo("signup-password", "⚠️");
            marcarErrorCampo("signup-password-confirm", "⚠️ Las contraseñas no coinciden.")
            restoreButton();
            return;
        }

        // 🔥 Crear usuario en Supabase Auth
         const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
         if (authError) throw authError;
     
         const user = authData.user;
         if (!user) throw new Error("No se pudo registrar el usuario.");
     
         // 🔹 Insertar en 'usuarios'
         const { error: insertUserError } = await supabase.from("usuarios").insert([
           {
             id: user.id,
             email,
             nombre,
             rol: "cliente",
             telefono,
             fechaNacimiento,
             fechaRegistro: new Date().toISOString()
           }
         ]);
         if (insertUserError) throw insertUserError;
     
         // 🔹 Insertar en 'clientes'
         const { error: insertClienteError } = await supabase.from("clientes").insert([
           {
             id: user.id,              // 🔥 AÑADIMOS esto
             usuario_id: user.id,
             direccion,
             municipio,
             colonia,
             codigoPostal: parseInt(codigoPostal),
             genero
           }
         ]);
         if (insertClienteError) throw insertClienteError;
     
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        // 🎉 Todo OK
        mostrarToast("✅ ¡Registro exitoso! Revisa tu correo para confirmar.", "success");

        // 🧹 Limpiar formulario
        event.target.reset();

        // 🎬 Cerrar modal de forma bonita
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
            modal?.hide();
        }, 1500);

        mostrarModalRegistroExitoso();

    } catch (error) {
        console.error("❌ Error al registrar cliente:", error);
        mostrarToast(`❌ Error al registrar cliente.`, "error");
    } finally {
        restoreButton();
    }

    function restoreButton() {
        signupButton.disabled = false;
        signupButton.innerHTML = originalButtonContent;
    }
}

// Mostrar Modal Bonito después de Registro
function mostrarModalRegistroExitoso() {

    // Si no existe el modal, lo creamos dinámicamente
    if (!document.getElementById('modalRegistroExitoso')) {
        const modalHTML = `
        <div class="modal fade" id="modalRegistroExitoso" tabindex="-1" aria-labelledby="modalRegistroLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content text-center p-4">
              <div class="modal-header border-0">
                <h5 class="modal-title w-100 text-success">
                  <i class="fas fa-check-circle fa-lg me-2"></i> ¡Registro Exitoso!
                </h5>
              </div>
              <div class="modal-body">
                <p class="mb-3">Te enviamos un correo de confirmación 📩</p>
                <div class="spinner-border text-success mb-3" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
                <p>Redirigiendo en <span id="contador">5</span> segundos...</p>
              </div>
            </div>
          </div>
        </div>
      `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Bloquear interacción
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    const modal = new bootstrap.Modal(document.getElementById('modalRegistroExitoso'));
    modal.show();

    const sound = document.getElementById('celebration-sound');
    if (sound) {
        sound.load();  // precarga manual por seguridad
        sound.volume = 0.5;
        sound.play().catch(e => console.error("🔇 Error al reproducir sonido:", e));
    }


    // 🎉 Lanzar confeti
    const duration = 5 * 1000; // 5 segundos
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1055 };

    const intervalConfetti = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
            clearInterval(intervalConfetti);
            return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
            particleCount,
            angle: 60,
            spread: 100,
            origin: { x: 0 },
            colors: ['#bb0000', '#ffffff', '#00bb00'],
            ...defaults
        });
        confetti({
            particleCount,
            angle: 120,
            spread: 100,
            origin: { x: 1 },
            colors: ['#bb0000', '#ffffff', '#00bb00'],
            ...defaults
        });
    }, 250);

    // ⏳ Contador regresivo
    let segundos = 5;
    const contadorSpan = document.getElementById('contador');

    const intervalContador = setInterval(() => {
        segundos--;
        contadorSpan.textContent = segundos;
        if (segundos <= 0) {
            clearInterval(intervalContador);
            document.body.style.overflow = ''; // Desbloquear scroll
            document.body.style.pointerEvents = ''; // Desbloquear clics
            window.location.href = 'index.html'; // Redirigir
        }
    }, 1000);
}