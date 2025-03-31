import { marcarErrorCampo, limpiarErrorCampo, mostrarToast } from "./manageError.js"; // Importar manejo de errores
import { validarTelefono, validarEdad } from "./validaciones.js"; // 🔹 Importamos la validación del teléfono
import { supabase } from "./supabase-config.js"; // Importamos la configuración
import { formatearFecha } from "./formatearFecha.js";

// Hacer accesibles globalmente las funciones necesarias
window.editarEmpleado = editarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;

// 📌 Asignar eventos al cargar la página
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
    document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);
});

// 📌 Función para mostrar el formulario dentro del modal
export function mostrarFormularioEmpleado() {
    // 📌 Usar la función para limpiar los errores de los campos
    limpiarErrorCampo([
        "empleado-nombre",
        "empleado-email",
        "empleado-telefono",
        "empleado-fecha"
    ]);
    // Abrir el modal
    const modal = new bootstrap.Modal(document.getElementById("empleadoModal"));
    modal.show(); // Mostrar el modal
    // Restablecer el formulario cuando se abre
    document.getElementById("form-empleado").reset();
    // Cambiar el título del modal para agregar un nuevo empleado
    document.getElementById("empleadoModalLabel").textContent = "Agregar Empleado";
}

// 📌 Función para Registrar o Editar empleados
export async function gestionarEmpleado(event) {
    event.preventDefault(); // Evita la recarga de la página
    // Obtener el botón de guardar
    const botonGuardar = document.querySelector("button[type='submit']");
    // Deshabilitar el botón mientras se procesa el registro
    botonGuardar.disabled = true;

    // Obtener datos del formulario
    const idEmpleado = document.getElementById("form-empleado").dataset.empleadoId || null;
    const nombre = document.getElementById("empleado-nombre").value.trim();
    const email = document.getElementById("empleado-email").value.trim();
    const telefono = document.getElementById("empleado-telefono").value.trim();
    const genero = document.getElementById("empleado-genero").value;
    const fechaNacimiento = document.getElementById("empleado-fecha").value;
    const puesto = document.getElementById("empleado-puesto").value;

    // 📌 Usar la función para limpiar los errores de los campos
    limpiarErrorCampo([
        "empleado-nombre",
        "empleado-email",
        "empleado-telefono"
    ]);

    let hayErrores = false;
    // Validaciones básicas
    if (!nombre) {
        marcarErrorCampo("empleado-nombre", "⚠️ El nombre es obligatorio.");
        hayErrores = true;
    }
    if (!email) {
        marcarErrorCampo("empleado-email", "⚠️ El email es obligatorio.");
        hayErrores = true;
    }
    if (!telefono) {
        marcarErrorCampo("empleado-telefono", "⚠️ El teléfono es obligatorio.");
        hayErrores = true;
    }
    if (!fechaNacimiento || !puesto) {
        mostrarToast("⚠️ Todos los campos son obligatorios.");
        return;
    }

    if (hayErrores) {
        // Habilitar el botón de nuevo si hay errores
        botonGuardar.disabled = false;
        return; // ❌ Detener el proceso si hay errores
    }

    try {
        // **🔎 Validar número de teléfono**
        if (!validarTelefono(telefono)) {
            marcarErrorCampo("empleado-telefono", "⚠️ El número debe contener 10 dígitos.");
            mostrarToast("❌ El teléfono debe contener 10 dígitos numéricos.", "error");
            // Habilitar el botón de nuevo si hay errores
            botonGuardar.disabled = false;
            return;
        }

        // 🔹 Verificar si el email ya existe en otro usuario
        const { data: usuarioConEmail } = await supabase
            .from("usuarios")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (usuarioConEmail && (!idEmpleado || usuarioConEmail.id !== idEmpleado)) {
            marcarErrorCampo("empleado-email", "⚠️ Este email ya está en uso.");
            mostrarToast("⚠️ El email ya está registrado.", "error");
            // Habilitar el botón de nuevo si hay errores
            botonGuardar.disabled = false;
            return;
        }

        // 🔹 Verificar si el teléfono ya existe en otro usuario
        const { data: usuarioConTelefono } = await supabase
            .from("usuarios")
            .select("id")
            .eq("telefono", telefono)
            .maybeSingle();

        if (usuarioConTelefono && (!idEmpleado || usuarioConTelefono.id !== idEmpleado)) {
            marcarErrorCampo("empleado-telefono", "⚠️ Este teléfono ya está en uso.");
            mostrarToast("⚠️ El teléfono ya está registrado. ", "error");
            // Habilitar el botón de nuevo si hay errores
            botonGuardar.disabled = false;
            return;
        }

        // 📌 **Validar edad mínima de 16 años**
        if (!validarEdad(fechaNacimiento)) {
            marcarErrorCampo("empleado-fecha", "⚠️ Debes tener al menos 16 años.");
            mostrarToast("Debes ser mayor de 16 años para registrarte.", "error");
            // Habilitar el botón de nuevo si hay errores
            botonGuardar.disabled = false;
            return;
        }

        if (idEmpleado) {
            // ✏️ **Editar empleado existente**
            // console.log(`✏️ Editando empleado con ID: ${idEmpleado}`);

            await actualizarEmpleado(idEmpleado, { nombre, email, telefono, fechaNacimiento, puesto, genero });
            //   mostrarToast("✅ Empleado actualizado correctamente.", "success");

        } else {
            // ➕ **Registrar nuevo empleado**
            console.log("➕ Registrando nuevo empleado...");
            await registrarNuevoEmpleado({ nombre, email, telefono, fechaNacimiento, puesto, genero });
            // mostrarToast("✅ Empleado registrado correctamente.", "success");
        }
        // Cerrar el modal después de guardar
        const modal = bootstrap.Modal.getInstance(document.getElementById("empleadoModal"));
        modal.hide(); // Ocultar el modal después de guardar o actualizar

        // 🔄 Refrescar la lista
        cargarEmpleados();
    } catch (error) {
        console.error("❌ Error al registrar o actualizar empleado:", error);
        mostrarToast("❌ Error al registrar o actualizar empleado.", "error");
    } finally {
        // Habilitar el botón de nuevo después de finalizar el proceso
        botonGuardar.disabled = false;
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
        // Abrir el modal
        const modal = new bootstrap.Modal(document.getElementById("empleadoModal"));
        modal.show(); // Mostrar el modal

    } catch (error) {
        mostrarToast("❌ Error al cargar los datos del empleado.", "error")
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
    mostrarToast("✅ Empleado actualizado correctamente.", "success");
}

// 📌 **Función para registrar un nuevo empleado**
export async function registrarNuevoEmpleado(datos) {
    try {
        // 🔹 **Obtener el admin que está registrando al empleado**
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session.session) throw new Error("No hay sesión activa.");
        const adminId = session.session.user.id;

        // 🔹 **Crear usuario en la autenticación de Supabase**
        const { data: authUser, error: authError } = await supabase.auth.signUp({
            email: datos.email,
            password: "Empleado" + Math.floor(Math.random() * 10000) // 🔐 Contraseña temporal;
        });

        if (authError) throw authError;
        const usuarioId = authUser.user.id;

        // 🔹 **Insertar en `usuarios`**
        const { error: usuarioError } = await supabase.from("usuarios").insert([
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
        if (usuarioError) throw usuarioError;

        // 🔹 **Insertar en `empleados`**
        const { error: empleadoError } = await supabase.from("empleados").insert([
            {
                id: usuarioId,
                usuario_id: usuarioId,
                genero: datos.genero,
                puesto: datos.puesto,
                creado_por: adminId
            }
        ]);
        if (empleadoError) throw empleadoError;

        mostrarToast("✅ Empleado registrado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al registrar empleado:", error);
        mostrarToast("❌ Error al registrar empleado", "error");
    }
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
        //    console.log("✅ Empleados cargados:", data);

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
                    <button class="btn btn-sm btn-danger" onclick="eliminarEmpleado('${empleado.id}', '${empleado.usuario.nombre}')">Eliminar</button>
                </td>
            `;
            tablaEmpleados.appendChild(fila);
        });

    } catch (error) {
        mostrarToast("❌ Error al cargar empleados.", "error")
        console.error("❌ Error al cargar empleados:", error);
    }
}

// 📌 Función para eliminar empleados
export async function eliminarEmpleado(idEmpleado, nombreEmpleado) {
    // Mostrar el modal de confirmación
    const modal = new bootstrap.Modal(document.getElementById('deleteEmpleadoModal'));
    modal.show(); // Mostrar el modal
    // Actualizar el texto del modal con el nombre del empleado
    const modalBody = document.querySelector('#deleteEmpleadoModal .modal-body');
    modalBody.innerHTML = `⚠️ ¿Estás seguro de que deseas eliminar a <strong>${nombreEmpleado}</strong>? Esta acción es irreversible.`;

    // Obtener el botón de "Confirmar eliminación" dentro del modal
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn-empleado");
    // Asignar el evento para eliminar el empleado al hacer clic en "Eliminar"
    confirmDeleteBtn.onclick = async () => {
        try {

            console.log(`🗑 Eliminando empleado con ID: ${idEmpleado}`);

            // 🔹 Llamar al backend de Firebase Functions para eliminar el empleado
            const response = await fetch(`https://us-central1-gestor-panaderia.cloudfunctions.net/api/eliminar-empleado/${idEmpleado}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                mostrarToast("❌ No se pudo eliminar el empleado.", "error")
            } else {
                mostrarToast("✅ Empleado eliminado correctamente.", "success")
                cargarEmpleados(); // 🔄 Recargar la lista de empleados después de eliminar
            }
            // Cerrar el modal después de eliminar
            modal.hide();
        } catch (error) {
            console.error("❌ Error al eliminar empleado:", error);
            mostrarToast("❌ Error al eliminar empleado.", "error")
            modal.hide();
        }
    };
}