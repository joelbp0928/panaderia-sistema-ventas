// 📦 MÓDULOS IMPORTADOS
import { marcarErrorCampo, limpiarErrorCampo, mostrarToast, showLoading, hideLoading } from "./manageError.js";
import { validarTelefono, validarEdad } from "./validaciones.js";
import { supabase } from "./supabase-config.js";
import { formatearFecha } from "./formatearFecha.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedEmployeeRow = null;
let selectedEmployeeId = null;
let empleadoModal; // Instancia única del modal

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
    empleadoModal = new bootstrap.Modal(document.getElementById("empleadoModal"));
    // En DOMContentLoaded, agrega este evento: mejor manejo del modal segun xd xd 
    empleadoModal._element.addEventListener('hidden.bs.modal', () => {
        document.getElementById("form-empleado").reset();
        clearEmployeeSelection();
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
    form.reset();
    form.dataset.empleadoId = "";
    document.getElementById("empleadoModalLabel").textContent = "Agregar Empleado";
    document.querySelector("#form-empleado button[type='submit']").textContent = "Guardar Empleado";
    empleadoModal.show();
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
        empleadoModal.hide(); // ✅ Usa la instancia global

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

const filtrosEmpleados = {
    buscar: document.getElementById("buscarEmpleado"),
    puesto: document.getElementById("filtroPuesto"),
    email: document.getElementById("filtroEmail"),
    telefono: document.getElementById("filtroTelefono"),
    ordenarNombre: document.getElementById("ordenarNombreEmpleado"),
    limpiarBtn: document.getElementById("btn-limpiar-filtros-em"),
};

function actualizarEstadoBotonLimpiarEm() {
    const hayFiltros =
        filtrosEmpleados.buscar.value.trim() !== "" ||
        filtrosEmpleados.puesto.value !== "" ||
        filtrosEmpleados.email.value.trim() !== "" ||
        filtrosEmpleados.telefono.value.trim() !== "" ||
        filtrosEmpleados.ordenarNombre.value !== "az";

    filtrosEmpleados.limpiarBtn.classList.toggle("disabled", !hayFiltros);
    filtrosEmpleados.limpiarBtn.disabled = !hayFiltros;

    actualizarBadgesFiltroEm();
}

// Búsqueda por Nombre
filtrosEmpleados.buscar.addEventListener("input", () => {
    const texto = filtrosEmpleados.buscar.value.toLowerCase();
    document.querySelectorAll("#tabla-empleados tbody tr").forEach((fila) => {
        const nombre = fila.children[0].textContent.toLowerCase();
        fila.style.display = nombre.includes(texto) ? "" : "none";
    });
    actualizarEstadoBotonLimpiarEm();
});

// Filtro por Puesto
filtrosEmpleados.puesto.addEventListener("change", () => {
    const puesto = filtrosEmpleados.puesto.value.toLowerCase();
    document.querySelectorAll("#tabla-empleados tbody tr").forEach((fila) => {
        const puestoEmpleado = fila.children[2].textContent.toLowerCase();
        fila.style.display = !puesto || puestoEmpleado === puesto ? "" : "none";
    });
    actualizarEstadoBotonLimpiarEm();
});


// Filtro por Email
filtrosEmpleados.email.addEventListener("input", () => {
    const email = filtrosEmpleados.email.value.toLowerCase();
    document.querySelectorAll("#tabla-empleados tbody tr").forEach((fila) => {
        const emailEmpleado = fila.children[3].textContent.toLowerCase();
        fila.style.display = emailEmpleado.includes(email) ? "" : "none";
    });
    actualizarEstadoBotonLimpiarEm();
});

// Filtro por Teléfono
filtrosEmpleados.telefono.addEventListener("input", () => {
    const telefono = filtrosEmpleados.telefono.value.toLowerCase();
    document.querySelectorAll("#tabla-empleados tbody tr").forEach((fila) => {
        const telefonoEmpleado = fila.children[4].textContent.toLowerCase();
        fila.style.display = telefonoEmpleado.includes(telefono) ? "" : "none";
    });
    actualizarEstadoBotonLimpiarEm();
});

// Ordenar por Nombre
filtrosEmpleados.ordenarNombre.addEventListener("change", () => {
    const orden = filtrosEmpleados.ordenarNombre.value;
    const tbody = document.getElementById("tabla-empleados-content");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
        const nombreA = a.children[0].textContent.toLowerCase();
        const nombreB = b.children[0].textContent.toLowerCase();
        return orden === "az" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    });

    filas.forEach((fila) => tbody.appendChild(fila));
    actualizarEstadoBotonLimpiarEm();
});

// Limpiar filtros
filtrosEmpleados.limpiarBtn.addEventListener("click", () => {
    if (filtrosEmpleados.limpiarBtn.classList.contains("disabled")) return;

    const original = filtrosEmpleados.limpiarBtn.innerHTML;
    filtrosEmpleados.limpiarBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Limpiando...`;
    filtrosEmpleados.limpiarBtn.disabled = true;

    setTimeout(() => {
        // Limpiar los campos de filtro
        filtrosEmpleados.buscar.value = "";
        filtrosEmpleados.puesto.value = "";
        filtrosEmpleados.email.value = "";
        filtrosEmpleados.telefono.value = "";
        filtrosEmpleados.ordenarNombre.value = "az"; // Reset to A-Z by default

        // Disparar eventos de cambio en cada filtro para que se actualicen los resultados
        filtrosEmpleados.buscar.dispatchEvent(new Event("input"));
        filtrosEmpleados.puesto.dispatchEvent(new Event("change"));
        filtrosEmpleados.email.dispatchEvent(new Event("input"));
        filtrosEmpleados.telefono.dispatchEvent(new Event("input"));
        filtrosEmpleados.ordenarNombre.dispatchEvent(new Event("change"));

        // Reset button state
        filtrosEmpleados.limpiarBtn.innerHTML = original;
        filtrosEmpleados.limpiarBtn.classList.add("disabled");
        filtrosEmpleados.limpiarBtn.disabled = true;
    }, 600);
});

// Mostrar badges de filtros activos
function actualizarBadgesFiltroEm() {
    const contenedor = document.getElementById("filtros-activos-em");
    const badgeNombre = document.getElementById("badge-nombre-empleados");
    const badgePuesto = document.getElementById("badge-puesto-empleados");
    const badgeEmail = document.getElementById("badge-email-empleados");
    const badgeTelefono = document.getElementById("badge-telefono-empleados");
    const badgeOrden = document.getElementById("badge-orden-empleados");

    let hay = false;

    // Nombre
    if (filtrosEmpleados.buscar.value) {
        badgeNombre.querySelector("span").textContent = filtrosEmpleados.buscar.value;
        badgeNombre.classList.remove("d-none");
        hay = true;
    } else {
        badgeNombre.classList.add("d-none");
    }

    // Puesto
    if (filtrosEmpleados.puesto.value) {
        badgePuesto.querySelector("span").textContent = filtrosEmpleados.puesto.value;
        badgePuesto.classList.remove("d-none");
        hay = true;
    } else {
        badgePuesto.classList.add("d-none");
    }

    // Email
    if (filtrosEmpleados.email.value) {
        badgeEmail.querySelector("span").textContent = filtrosEmpleados.email.value;
        badgeEmail.classList.remove("d-none");
        hay = true;
    } else {
        badgeEmail.classList.add("d-none");
    }

    // Teléfono
    if (filtrosEmpleados.telefono.value) {
        badgeTelefono.querySelector("span").textContent = filtrosEmpleados.telefono.value;
        badgeTelefono.classList.remove("d-none");
        hay = true;
    } else {
        badgeTelefono.classList.add("d-none");
    }

    // Orden
    if (filtrosEmpleados.ordenarNombre.value) {
        badgeOrden.querySelector("span").textContent = filtrosEmpleados.ordenarNombre.value === "az" ? "A - Z" : "Z - A";
        badgeOrden.classList.remove("d-none");
        hay = true;
    } else {
        badgeOrden.classList.add("d-none");
    }

    contenedor.classList.toggle("d-none", !hay);
}

// Detectar cambios para actualizar estado
["input", "change"].forEach((ev) => {
    filtrosEmpleados.buscar.addEventListener(ev, actualizarEstadoBotonLimpiarEm);
    filtrosEmpleados.puesto.addEventListener(ev, actualizarEstadoBotonLimpiarEm);
    filtrosEmpleados.email.addEventListener(ev, actualizarEstadoBotonLimpiarEm);
    filtrosEmpleados.telefono.addEventListener(ev, actualizarEstadoBotonLimpiarEm);
    filtrosEmpleados.ordenarNombre.addEventListener(ev, actualizarEstadoBotonLimpiarEm);
});

function animarTablaEmpleados() {
    const tabla = document.getElementById("tabla-empleados-content");
    tabla.classList.add("resaltar-tabla");
    setTimeout(() => tabla.classList.remove("resaltar-tabla"), 1000);
}

