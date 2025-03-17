import { supabase } from "./supabase-config.js"; // Importamos la configuración

// 📌 Escuchar el evento de envío del formulario
document.getElementById("form-empleado").addEventListener("submit", registrarEmpleado);

// 📌 Escuchar el evento de formulario
document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);

// 📌 Muestra u oculta el formulario cuando se hace clic en "Agregar Empleado"
export function mostrarFormularioEmpleado() {
    const formulario = document.getElementById("form-empleado");

    if (formulario.classList.contains("d-none")) {
        formulario.classList.remove("d-none");
        formulario.classList.add("d-block");
    } else {
        formulario.classList.toggle("d-none");
        formulario.classList.toggle("d-block");
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
    const password = "Empleado" + Math.floor(Math.random() * 10000); // 🔹 Contraseña temporal

    // Validaciones básicas
    if (!nombre || !email || !telefono || !fechaNacimiento || !puesto) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        // 🔹 Verificar si el usuario ya existe en la tabla `usuarios`
        const { data: usuarioExistente, error: errorExistente } = await supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .maybeSingle(); // 📌 Evita el error si no hay coincidencias

        if (usuarioExistente) {
            alert("⚠️ El email ya está registrado. Usa otro correo.");
            return;
        }

        // 🔹 Obtener el admin que está registrando al empleado
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session.session) throw new Error("No hay sesión activa.");

        const adminId = session.session.user.id; // 📌 ID del admin que registra al empleado

        // 🔹 Crear el usuario en la autenticación de Supabase
        const { data: authUser, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) throw authError;

        const empleadoId = authUser.user.id; // 📌 Obtener el UID generado en autenticación

        // 🔹 Insertar el nuevo usuario en `usuarios`
        const { error: usuarioError } = await supabase.from("usuarios").insert([
            {
                id: empleadoId, // 📌 UID obtenido de la autenticación
                email,
                nombre,
                telefono,
                fechaNacimiento,
                rol: "empleado",  // Se define explícitamente el rol
                fechaRegistro: new Date().toISOString()
            }
        ]);

        if (usuarioError) throw usuarioError;

        // 🔹 Insertar los datos adicionales en la tabla `empleados`
        const { error: empleadoError } = await supabase
            .from("empleados")
            .insert([
                {
                    id: empleadoId, // 📌 Usamos el mismo UID obtenido antes
                    genero,
                    puesto,
                    creado_por: adminId // 📌 Quién lo registró
                }
            ]);

        if (empleadoError) throw empleadoError;

        alert("✅ Empleado registrado correctamente.");
        document.getElementById("form-empleado").reset(); // Limpiar formulario
        mostrarFormularioEmpleado(); // Ocultar formulario

    } catch (error) {
        console.error("❌ Error al registrar empleado:", error);
        alert(`Error: ${error.message}`);
    }
}

// 📌 Función para cargar empleados en la tabla
export async function cargarEmpleados() {
    try {
        // 🔹 Consulta incluyendo fechaNacimiento y fechaRegistro
        const { data, error } = await supabase
            .from("empleados")
            .select(`
                id, 
                puesto, 
                genero, 
                creado_por,
                usuario:usuario_id (nombre, email, telefono, fechaNacimiento, fechaRegistro),
                admin:creado_por (nombre)
            `);

        if (error) throw error;

        console.log("✅ Empleados cargados:", data);

        // Limpiar la tabla antes de actualizarla
        const tablaEmpleados = document.querySelector("#employees tbody");
        tablaEmpleados.innerHTML = "";

        // Insertar cada empleado en la tabla
        data.forEach((empleado) => {
            if (!empleado.usuario) {
                console.warn(`⚠️ El empleado con ID ${empleado.id} no tiene usuario asociado.`);
                return;
            }

            // 🔹 Convertir fechas al formato dd/mm/aaaa
            const fechaNacimiento = formatearFecha(empleado.usuario.fechaNacimiento);
            const fechaRegistro = formatearFecha(empleado.usuario.fechaRegistro);

            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${empleado.usuario.nombre}</td>
                <td>${fechaNacimiento}</td>
                <td>${empleado.puesto}</td>
                <td>${empleado.usuario.email}</td>
                <td>${empleado.usuario.telefono}</td>
                <td>${empleado.admin ? empleado.admin.nombre : "Desconocido"}</td>
                <td>${fechaRegistro}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarEmpleado('${empleado.id}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarEmpleado('${empleado.id}')">Eliminar</button>
                </td>
            `;
            tablaEmpleados.appendChild(fila);
        });

    } catch (error) {
        console.error("❌ Error al cargar empleados:", error);
    }
}




// 📌 Función para eliminar empleados
export async function eliminarEmpleado(idEmpleado) {
    try {
        if (!confirm("¿Estás seguro de que deseas eliminar este empleado?")) {
            return;
        }

        console.log(`🗑 Eliminando empleado con ID: ${idEmpleado}`);

        // 🔹 Eliminar primero de `empleados`
        let { error: errorEmpleado } = await supabase
            .from("empleados")
            .delete()
            .eq("id", idEmpleado);

        if (errorEmpleado) throw errorEmpleado;

        // 🔹 Luego eliminarlo de `usuarios` (solo si no hay referencias en otras tablas)
        let { error: errorUsuario } = await supabase
            .from("usuarios")
            .delete()
            .eq("id", idEmpleado);

        if (errorUsuario) throw errorUsuario;

        alert("✅ Empleado eliminado correctamente.");
        cargarEmpleados(); // 🔄 Recargar la lista de empleados después de eliminar

    } catch (error) {
        console.error("❌ Error al eliminar empleado:", error);
        alert(`Error: ${error.message}`);
    }
}


function formatearFecha(fechaISO) {
    if (!fechaISO) return "N/A"; // Maneja valores nulos o indefinidos
    const fecha = new Date(fechaISO);
    const dia = fecha.getDate().toString().padStart(2, "0");
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}
