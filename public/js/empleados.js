import { supabase } from "./supabase-config.js"; // Importamos la configuración

document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);

// 📌 Muestra el formulario cuando se hace clic en "Agregar Empleado"
export function mostrarFormularioEmpleado() {
    const formulario = document.getElementById("form-empleado");
    
    if (formulario.classList.contains("d-none")) {
        formulario.classList.remove("d-none");
        formulario.classList.add("display");
    } else {
        formulario.classList.remove("d-block");
        formulario.classList.add("d-none");
    }
}


// 📌 Función para registrar un nuevo empleado
export async function registrarEmpleado(event) {
    event.preventDefault(); // Evita la recarga de la página

    // Obtener datos del formulario
    const nombre = document.getElementById("empleado-nombre").value.trim();
    const email = document.getElementById("empleado-email").value.trim();
    const telefono = document.getElementById("empleado-telefono").value.trim();
    const genero = document.getElementById("empleado-genero").value;
    const fechaNacimiento = document.getElementById("empleado-fecha").value;
    const puesto = document.getElementById("empleado-puesto").value;

    // Validaciones básicas
    if (!nombre || !email || !telefono || !fechaNacimiento || !puesto) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        // 🔹 Obtener el admin que está registrando al empleado
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session.session) throw new Error("No hay sesión activa.");

        const adminId = session.session.user.id;

        // 🔹 Insertar empleado en Supabase
        const { error } = await supabase.from("usuarios").insert([
            {
                nombre,
                email,
                telefono,
                genero,
                fecha_nacimiento: fechaNacimiento,
                puesto,
                creado_por: adminId,  // Quién lo registró
                fecha_registro: new Date().toISOString()
            }
        ]);

        if (error) throw error;

        alert("✅ Empleado registrado correctamente.");
        document.getElementById("form-empleado").reset(); // Limpiar formulario
        mostrarFormularioEmpleado(); // Ocultar formulario

    } catch (error) {
        console.error("❌ Error al registrar empleado:", error);
        alert(`Error: ${error.message}`);
    }
}
