import { supabase } from "./supabase-config.js"; // Importamos la configuración

// Hacer accesibles globalmente las funciones necesarias
window.editarEmpleado = editarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;

// 📌 Asignar eventos al cargar la página
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
    document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);
});


export function mostrarFormularioEmpleado() {
    const formulario = document.getElementById("form-empleado");

    // 🔹 Si el formulario está oculto, se muestra; si está visible, se oculta
    if (formulario.classList.contains("d-none")) {
        formulario.classList.remove("d-none"); // Mostrar formulario
    } else {
        formulario.classList.add("d-none"); // Ocultar formulario
        return; // 🔹 Si se oculta, terminamos aquí para evitar reset innecesario
    }

    // 🔹 Restablecer valores y ocultar ID de edición solo si se está mostrando
    formulario.reset();
    formulario.dataset.empleadoId = "";
    document.querySelector("#form-empleado button[type='submit']").innerText = "Guardar Empleado";
}


// 📌 Función para Registrar o Editar empleados
export async function gestionarEmpleado(event) {
    event.preventDefault(); // Evita la recarga de la página

    // Obtener datos del formulario
    const idEmpleado = document.getElementById("form-empleado").dataset.empleadoId || null;
    const nombre = document.getElementById("empleado-nombre").value.trim();
    const email = document.getElementById("empleado-email").value.trim();
    const telefono = document.getElementById("empleado-telefono").value.trim();
    const genero = document.getElementById("empleado-genero").value;
    const fechaNacimiento = document.getElementById("empleado-fecha").value;
    const puesto = document.getElementById("empleado-puesto").value;

    if (!nombre || !email || !telefono || !fechaNacimiento || !puesto) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        let mensajeError = "";

        // 🔹 Verificar si el email ya existe en otro usuario
        const { data: usuarioConEmail, error: errorEmail } = await supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (errorEmail) throw errorEmail;

        if (usuarioConEmail && (!idEmpleado || usuarioConEmail.id !== idEmpleado)) {
            mensajeError += "⚠️ El email ya está registrado. ";
        }

        // 🔹 Verificar si el teléfono ya existe en otro usuario
        const { data: usuarioConTelefono, error: errorTelefono } = await supabase
            .from("usuarios")
            .select("id")
            .eq("telefono", telefono)
            .maybeSingle();

        if (errorTelefono) throw errorTelefono;

        if (usuarioConTelefono && (!idEmpleado || usuarioConTelefono.id !== idEmpleado)) {
            mensajeError += "⚠️ El teléfono ya está registrado. ";
        }

        // Si hay errores, mostrar mensaje y detener el proceso
        if (mensajeError) {
            alert(mensajeError);
            return;
        }

        if (idEmpleado) {
            // ✏️ **Editar empleado existente**
            console.log(`✏️ Editando empleado con ID: ${idEmpleado}`);

            await actualizarEmpleado(idEmpleado, { nombre, email, telefono, fechaNacimiento, puesto, genero });
            alert("✅ Empleado actualizado correctamente.");

        } else {
            // ➕ **Registrar nuevo empleado**
            console.log("➕ Registrando nuevo empleado...");
            await registrarNuevoEmpleado({ nombre, email, telefono, fechaNacimiento, puesto, genero });
            alert("✅ Empleado registrado correctamente.");
        }

        // 🔄 Refrescar la lista y ocultar el formulario
        mostrarFormularioEmpleado();
        cargarEmpleados();

    } catch (error) {
        console.error("❌ Error al registrar o actualizar empleado:", error);
        alert(`Error: ${error.message}`);
    }
}

// 📌 Función para editar un empleado
export async function editarEmpleado(idEmpleado) {
    try {
        // 🔹 Obtener los datos del empleado desde Supabase
        const { data: empleadoData, error: empleadoError } = await supabase
            .from("empleados")
            .select(`
                id, puesto, genero, usuario_id,
                usuario:usuario_id (nombre, email, telefono, fechaNacimiento)
            `)
            .eq("id", idEmpleado)
            .single();  // Obtener solo un registro

        if (empleadoError || !empleadoData) {
            throw new Error("No se pudo cargar los datos del empleado.");
        }

        // 🔹 Llenar el formulario con los datos del empleado
        document.getElementById("empleado-nombre").value = empleadoData.usuario.nombre;
        document.getElementById("empleado-email").value = empleadoData.usuario.email;
        document.getElementById("empleado-telefono").value = empleadoData.usuario.telefono;
        document.getElementById("empleado-genero").value = empleadoData.genero;
        document.getElementById("empleado-fecha").value = empleadoData.usuario.fechaNacimiento;
        document.getElementById("empleado-puesto").value = empleadoData.puesto;

        // 🔹 Guardar el ID del empleado en un atributo del formulario para saber qué usuario se edita
        const formulario = document.getElementById("form-empleado");
        formulario.dataset.empleadoId = idEmpleado;

        // 🔹 Cambiar el botón para indicar que se actualizará un empleado
        document.querySelector("#form-empleado button[type='submit']").innerText = "Actualizar Empleado";

        // 📌 Mostrar el formulario si estaba oculto
        formulario.classList.remove("d-none");

    } catch (error) {
        console.error("❌ Error al cargar los datos del empleado:", error);
    }
}

// 📌 **Función para actualizar un empleado**
async function actualizarEmpleado(idEmpleado, datos) {
    // 🔹 Actualizar en la tabla `usuarios`
    await supabase.from("usuarios").update({
        nombre: datos.nombre,
        email: datos.email,
        telefono: datos.telefono,
        fechaNacimiento: datos.fechaNacimiento
    }).eq("id", idEmpleado);

    // 🔹 Actualizar en la tabla `empleados`
    await supabase.from("empleados").update({
        puesto: datos.puesto,
        genero: datos.genero
    }).eq("id", idEmpleado);
}

// 📌 **Función para registrar un nuevo empleado**
async function registrarNuevoEmpleado(datos) {
    // 🔹 Obtener el admin que está registrando al empleado
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session.session) throw new Error("No hay sesión activa.");
    const adminId = session.session.user.id;

    // 🔹 Crear usuario en la autenticación de Supabase
    const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: datos.email,
        password: "Empleado" + Math.floor(Math.random() * 10000)
    });

    if (authError) throw authError;
    const usuarioId = authUser.user.id;

    // 🔹 Insertar en `usuarios`
    await supabase.from("usuarios").insert([
        {
            id: usuarioId,
            email: datos.email,
            nombre: datos.nombre,
            telefono: datos.telefono,
            fechaNacimiento: datos.fechaNacimiento,
            rol: "empleado",
            fechaRegistro: new Date().toISOString()
        }
    ]);

    // 🔹 Insertar en `empleados`
    await supabase.from("empleados").insert([
        {
            id: usuarioId,
            usuario_id: usuarioId,
            genero: datos.genero,
            puesto: datos.puesto,
            creado_por: adminId
        }
    ]);
}

// 📌 **Función para cargar empleados**
export async function cargarEmpleados() {
    try {
        const { data, error } = await supabase
            .from("empleados")
            .select(`
                id, puesto, genero, creado_por,
                usuario:usuario_id (nombre, email, telefono, fechaNacimiento, fechaRegistro),
                admin:creado_por (nombre)
            `);

        if (error) throw error;
        console.log("✅ Empleados cargados:", data);

        const tablaEmpleados = document.querySelector("#employees tbody");
        tablaEmpleados.innerHTML = "";

        data.forEach((empleado) => {
            if (!empleado.usuario) {
                console.warn(`⚠️ El empleado con ID ${empleado.id} no tiene usuario asociado.`);
                return;
            }

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
        if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar este empleado? Esta acción es irreversible.")) {
            return;
        }

        console.log(`🗑 Eliminando empleado con ID: ${idEmpleado}`);

        // 🔹 Llamar al backend de Firebase Functions para eliminar el empleado
        const response = await fetch(`https://us-central1-gestor-panaderia.cloudfunctions.net/api/eliminar-empleado/${idEmpleado}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error("No se pudo eliminar el empleado.");
        }

        alert("✅ Empleado eliminado correctamente.");
        cargarEmpleados(); // 🔄 Recargar la lista de empleados después de eliminar

    } catch (error) {
        console.error("❌ Error al eliminar empleado:", error);
        alert(`Error: ${error.message}`);
    }
}

// 📌 **Función auxiliar para formatear fechas**
function formatearFecha(fechaISO) {
    if (!fechaISO) return "N/A";
    const fecha = new Date(fechaISO);
    return `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`;
}
