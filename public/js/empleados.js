// 📦 MÓDULOS IMPORTADOS
import { marcarErrorCampo, limpiarErrorCampo, mostrarToast, showLoading, hideLoading } from "./manageError.js";
import { validarTelefono, validarEdad } from "./validaciones.js";
import { supabase } from "./supabase-config.js";
import { formatearFecha } from "./formatearFecha.js";
import { showProductForm } from "./productos.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedEmployeeRow = null;
let selectedEmployeeId = null;

// 🌐 EXPOSICIÓN DE FUNCIONES AL SCOPE GLOBAL
window.editarEmpleado = editarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    //   showLoading();
    setupEmployeeRowSelection();
    //   cargarEmpleados().finally(() => hideLoading());

    // Evento para agregar empleado
    document.getElementById("btn-agregar-empleado").addEventListener("click", () => {
        clearEmployeeSelection();
        mostrarFormularioEmpleado();
    });

    // Evento para formulario
    document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);

    // Deseleccionar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tabla-empleados') && !e.target.closest('.employee-actions')) {
            clearEmployeeSelection();
        }
    });
});

// 🧩 FUNCIONES PRINCIPALES

/**
 * 🖼️ Muestra el formulario para agregar/editar empleados
 */
export function mostrarFormularioEmpleado() {
    // 📌 Usar la función para limpiar los errores de los campos
    limpiarErrorCampo([
        "empleado-nombre", "empleado-email",
        "empleado-telefono", "empleado-fecha"
    ]);
    const form = document.getElementById("form-empleado");
    const modal = new bootstrap.Modal(document.getElementById("empleadoModal"));
    form.reset();
    form.dataset.empleadoId = "";
    document.getElementById("empleadoModalLabel").textContent = "Agregar Empleado";
    document.querySelector("#form-empleado button[type='submit']").textContent = "Guardar Empleado";
    modal.show();
}

/**
 * 🛡️ Valida el formulario de empleado
 * @returns {boolean} True si el formulario es válido
 */
function validarFormularioEmpleado() {
    let isValid = true;
    const campos = [
        "empleado-nombre", "empleado-email",
        "empleado-telefono", "empleado-fecha"
    ];

    limpiarErrorCampo(campos);

    // Validación de campos requeridos
    if (!document.getElementById("empleado-nombre").value.trim()) {
        marcarErrorCampo("empleado-nombre", "El nombre es obligatorio");
        isValid = false;
    }

    if (!document.getElementById("empleado-email").value.trim()) {
        marcarErrorCampo("empleado-email", "El email es obligatorio");
        isValid = false;
    }

    const telefono = document.getElementById("empleado-telefono").value.trim();
    if (!telefono || !validarTelefono(telefono)) {
        marcarErrorCampo("empleado-telefono", "Teléfono inválido (10 dígitos)");
        isValid = false;
    }

    const fechaNacimiento = document.getElementById("empleado-fecha").value;
    if (!fechaNacimiento || !validarEdad(fechaNacimiento)) {
        marcarErrorCampo("empleado-fecha", "Debe tener al menos 16 años");
        isValid = false;
    }

    return isValid;
}

//* 🔄 Gestiona el envío del formulario (crear/actualizar)
export async function gestionarEmpleado(event) {
    event.preventDefault();
    const botonGuardar = event.target.querySelector("button[type='submit']");
    botonGuardar.disabled = true;

    if (!validarFormularioEmpleado()) {
        mostrarToast("Corrige los errores en el formulario", "warning");
        botonGuardar.disabled = false;
        return;
    }

    // Obtener datos del formulario
    const idEmpleado = document.getElementById("form-empleado").dataset.empleadoId || null;

    try {
        const email = document.getElementById("empleado-email").value.trim();
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
        const telefono = document.getElementById("empleado-telefono").value.trim();
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
        const nombre = document.getElementById("empleado-nombre").value.trim();
        const genero = document.getElementById("empleado-genero").value;
        const puesto = document.getElementById("empleado-puesto").value;
        const fechaNacimiento = document.getElementById("empleado-fecha").value

        if (idEmpleado) {
            // ✏️ **Editar empleado existente**
            await actualizarEmpleado(idEmpleado, { nombre, email, telefono, fechaNacimiento, puesto, genero });
        } else {
            // ➕ **Registrar nuevo empleado**
            await registrarNuevoEmpleado({ nombre, email, telefono, fechaNacimiento, puesto, genero });
        }
        // Cerrar el modal después de guardar
        const modal = bootstrap.Modal.getInstance(document.getElementById("empleadoModal"));
        modal.hide(); // Ocultar el modal después de guardar o actualizar
        modal.style = "display: inline-block"

        // 🔄 Refrescar la lista
        cargarEmpleados();
        clearEmployeeSelection();

    } catch (error) {
        console.error("❌ Error al registrar o actualizar empleado:", error);
        mostrarToast("❌ Error al registrar o actualizar empleado.", "error");
    } finally {
        // Habilitar el botón de nuevo después de finalizar el proceso
        botonGuardar.disabled = false;
    }
}

//  ✏️ Carga los datos de un empleado para editar
export async function editarEmpleado(idEmpleado) {
    try {
        mostrarFormularioEmpleado()
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

        // Seleccionar fila
        selectEmployeeRow(idEmpleado);

    } catch (error) {
        mostrarToast("❌ Error al cargar los datos del empleado.", "error")
        console.error("❌ Error al cargar los datos del empleado:", error);
    } finally {
        hideLoading();
    }
}

// 🗑️ Elimina un empleado con confirmación
export async function eliminarEmpleado(idEmpleado) {
    // Mostrar el modal de confirmación
    const modal = new bootstrap.Modal(document.getElementById('deleteEmpleadoModal'));
    modal.show(); // Mostrar el modal
    // Actualizar el texto del modal con el nombre del empleado
    const modalBody = document.querySelector('#deleteEmpleadoModal .modal-body');
    modalBody.innerHTML = `⚠️ ¿Estás seguro de que deseas eliminar a este empleado? Esta acción es irreversible.`;

    // Obtener el botón de "Confirmar eliminación" dentro del modal
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn-empleado");
    // Asignar el evento para eliminar el empleado al hacer clic en "Eliminar"
    confirmDeleteBtn.onclick = async () => {
        try {
            showLoading();
            //    console.log(`🗑 Eliminando empleado con ID: ${idEmpleado}`);

            // 🔹 Llamar al backend de Firebase Functions para eliminar el empleado
            const response = await fetch(`https://us-central1-gestor-panaderia.cloudfunctions.net/api/eliminar-empleado/${idEmpleado}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                mostrarToast("❌ No se pudo eliminar el empleado.", "error")
            } else {
                mostrarToast("✅ Empleado eliminado correctamente.", "success")
                await cargarEmpleados();  // 🔄 Recargar la lista de empleados después de eliminar
                clearEmployeeSelection();
            }

        } catch (error) {
            console.error("❌ Error al eliminar empleado:", error);
            mostrarToast("❌ Error al eliminar empleado.", "error")
        } finally {
            hideLoading();
            modal.hide();
        }
    };
}

// 🔄 FUNCIONES DE DATOS

// 📋 Carga la lista de empleados
export async function cargarEmpleados() {
    try {
        showLoading();
        const { data, error } = await supabase
            .from("empleados")
            .select(`
                id, puesto, genero, creado_por,
                usuario:usuario_id (nombre, email, telefono, fechaNacimiento, fechaRegistro),
                admin:creado_por (nombre)
            `);

        if (error) throw error;
        //    console.log("✅ Empleados cargados:", data);

        const tbody = document.querySelector("#tabla-empleados tbody");
        tbody.innerHTML = data.map(empleado => `
            <tr data-id="${empleado.id}">
                <td>${empleado.usuario.nombre}</td>
                <td>${formatearFecha(empleado.usuario.fechaNacimiento)}</td>
                <td>${empleado.puesto}</td>
                <td>${empleado.usuario.email}</td>
                <td>${empleado.usuario.telefono}</td>
                <td>${empleado.admin?.nombre || "Desconocido"}</td>
                <td>${formatearFecha(empleado.usuario.fechaRegistro)}</td>
            </tr>
        `).join('');

    } catch (error) {
        mostrarToast("❌ Error al cargar empleados.", "error")
        console.error("❌ Error al cargar empleados:", error);
    } finally {
        hideLoading();
    }
}

// 🖱️ FUNCIONES DE INTERFAZ

//🖱️ Configura la selección de filas
function setupEmployeeRowSelection() {
    const table = document.getElementById('tabla-empleados');
    if (!table) return;

    table.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;

        const employeeId = row.dataset.id;
        if (selectedEmployeeId === employeeId) {
            clearEmployeeSelection();
        } else {
            selectEmployeeRow(employeeId);
        }
    });
    const deleteBtn = document.getElementById('delete-employee-btn');
    const editBtn = document.getElementById('edit-employee-btn');
    // Evento para el botón de eliminar
    deleteBtn.addEventListener('click', () => {
        if (selectedEmployeeId) {
            eliminarEmpleado(selectedEmployeeId);
            // Limpiar selección después de eliminar
            // clearSelection();

        }
    });

    // Evento para el botón de editar
    editBtn.addEventListener('click', () => {
        if (selectedEmployeeId) {
            editarEmpleado(selectedEmployeeId);
            // Limpiar selección después de eliminar
            //  clearSelection();
        }
    });
}

//🔘 Selecciona una fila de empleado
function selectEmployeeRow(employeeId) {
    clearEmployeeSelection();

    const row = document.querySelector(`#tabla-empleados tr[data-id="${employeeId}"]`);
    if (!row) return;

    row.classList.add('selected-row');
    selectedEmployeeRow = row;
    selectedEmployeeId = employeeId;

    // Mostrar botones de acción si existen
    const deleteBtn = document.getElementById('delete-employee-btn');
    const editBtn = document.getElementById('edit-employee-btn');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (editBtn) editBtn.style.display = 'inline-block';
}

//🧹 Limpia la selección actual
function clearEmployeeSelection() {
    if (selectedEmployeeRow) {
        selectedEmployeeRow.classList.remove('selected-row');
        selectedEmployeeRow = null;
        selectedEmployeeId = null;
    }

    // Ocultar botones de acción
    const deleteBtn = document.getElementById('delete-employee-btn');
    const editBtn = document.getElementById('edit-employee-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
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
