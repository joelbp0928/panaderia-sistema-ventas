// 📦 clientes-admin.js
import { supabase } from "./supabase-config.js";
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js";

let selectedClientId = null;
let selectedClientRow = null;
let modalEditarCliente = null;
let tableClientes = null;

modalEditarCliente = new bootstrap.Modal(document.getElementById("modalEditarCliente"));
tableClientes = document.getElementById('tabla-clientes');
// 🚀 Cargar clientes con toda la información
export async function cargarClientes() {
  try {
    const tbody = document.getElementById("clientes-tbody");

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">Cargando clientes...</td>
      </tr>
    `;

    // Consulta que une usuarios y clientes
    const { data, error } = await supabase
      .from("usuarios")
      .select(`
      id, 
      nombre, 
      email, 
      telefono,
      fechaNacimiento,
      fechaRegistro,
      clientes:clientes!clientes_usuario_id_fkey(
        direccion,
        municipio,
        colonia,
        genero,
        codigoPostal
      )
    `)
      .eq("rol", "cliente")
      .order("nombre", { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">No hay clientes registrados.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";

    data.forEach(cliente => {
      const clienteInfo = cliente.clientes?.[0]; // 👈 accedemos al primer elemento del array

      const direccion = clienteInfo?.direccion || 'No especificada';
      const municipio = clienteInfo?.municipio || 'No especificado';
      const colonia = clienteInfo?.colonia || 'No especificada';
      const genero = clienteInfo?.genero || 'No especificado';
      const codigoPostal = clienteInfo?.codigoPostal || 'No especificado';

      const fechaNac = cliente.fechaNacimiento ?
        new Date(cliente.fechaNacimiento).toLocaleDateString() : 'No especificada';

      const fechaReg = cliente.fechaRegistro ?
        new Date(cliente.fechaRegistro).toLocaleString() : 'No especificada';

      const tr = document.createElement("tr");
      tr.dataset.id = cliente.id;
      tr.setAttribute('data-id', cliente.id); // Doble seguridad

      tr.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${genero}</td>
        <td>${cliente.email}</td>
        <td>${cliente.telefono || 'No especificado'}</td>
        <td>${fechaNac}</td>
        <td>${direccion}</td>
        <td>${municipio}</td>
        <td>${colonia}</td>
        <td>${fechaReg}</td>
      `;

      tbody.appendChild(tr);
    });

    setupClientRowSelection();

  } catch (error) {
    console.error("❌ Error cargando clientes:", error);
    mostrarToast("❌ Error cargando clientes.", "error");
  }
}

// 🛠 Configurar selección de filas (versión mejorada)
function setupClientRowSelection() {
  if (!tableClientes) return;

  // Limpiar listeners anteriores
  tableClientes.replaceWith(tableClientes.cloneNode(true));
  tableClientes = document.getElementById('tabla-clientes');

  // Nuevo listener para selección
  tableClientes.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;

    const clientId = row.dataset.id;
    if (selectedClientId === clientId) {
      clearClientSelection();
    } else {
      selectClientRow(clientId);
    }
  });

  // Configurar botones de acción
  const setupActionButtons = () => {
    const deleteBtn = document.getElementById('delete-client-btn');
    const editBtn = document.getElementById('edit-client-btn');
    
    if (deleteBtn) {
      deleteBtn.onclick = null; // Limpiar handler anterior
      deleteBtn.addEventListener('click', () => {
        if (selectedClientId) eliminarCliente(selectedClientId);
      });
    }
    
    if (editBtn) {
      editBtn.onclick = null; // Limpiar handler anterior
      editBtn.addEventListener('click', () => {
        if (selectedClientId) editarCliente(selectedClientId);
      });
    }
  };

  setupActionButtons();
}

// 🔵 Seleccionar fila de cliente (sin cambios)
function selectClientRow(clientId) {
  clearClientSelection();

  const row = document.querySelector(`#tabla-clientes tr[data-id="${clientId}"]`);
  if (!row) return;

  row.classList.add('selected-row');
  selectedClientRow = row;
  selectedClientId = clientId;

  const acciones = document.getElementById("acciones-clientes");
  if (acciones) {
    acciones.querySelectorAll('button').forEach(btn => {
      btn.style.display = 'inline-block';
    });
  }
}

// 🧹 Limpiar selección
function clearClientSelection() {
  if (selectedClientRow) {
    selectedClientRow.classList.remove('selected-row');
  }
  selectedClientRow = null;
  selectedClientId = null;

  const acciones = document.getElementById("acciones-clientes");
  if (acciones) {
    acciones.querySelectorAll('button').forEach(btn => {
      btn.style.display = 'none';
    });
  }
}

// 🗑 Eliminar cliente
async function eliminarCliente(id) {
  try {
    const confirm = await Swal.fire({
      title: '¿Eliminar Cliente?',
      text: 'Esta acción eliminará completamente al cliente. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#9a223d',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    // 🎯 Mostrar mini loader mientras elimina
    const loadingAlert = Swal.fire({
      title: 'Eliminando...',
      html: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#f8f9fa',
      backdrop: `rgba(0,0,0,0.4)`
    });

    // 🛠 Hacer la eliminación
    const response = await fetch(`https://us-central1-gestor-panaderia.cloudfunctions.net/api/eliminar-cliente/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error eliminando cliente.');
    }

    // ✅ Mostrar éxito
    await Swal.fire({
      icon: 'success',
      title: 'Cliente eliminado',
      text: 'Se eliminó exitosamente.',
      confirmButtonColor: '#9a223d'
    });
    
    // Limpiar selección y recargar
    clearClientSelection();
    cargarClientes(); // 🔄 Recargar tabla de clientes

  } catch (error) {
    console.error("❌ Error eliminando cliente:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.message || 'Error eliminando cliente',
      confirmButtonColor: '#9a223d'
    });
  }
}

// ✏️ Editar cliente
async function editarCliente(id) {
  // Limpiar errores previos
  limpiarErrorCampo([
    'editar-telefono'
  ]);
  try {
    // Obtener datos completos del cliente
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
      id, 
      nombre, 
      email, 
      telefono,
      fechaNacimiento,
      fechaRegistro,
      clientes:clientes!clientes_usuario_id_fkey(
        direccion,
        municipio,
        colonia,
        genero,
        codigoPostal
      )
    `)
      .eq('id', id)
      .single();

    if (error || !data) throw error || new Error('Cliente no encontrado');

    // Acceder a los datos de clientes (que vienen como array)
    const clienteInfo = data.clientes?.[0]; // 👈 Esto es importante!

    // Llenar formulario
    document.getElementById("editar-id-cliente").value = id;
    document.getElementById("editar-nombre").value = data.nombre;
    document.getElementById("editar-email").value = data.email;
    document.getElementById("editar-telefono").value = data.telefono || '';
    document.getElementById("editar-direccion").value = clienteInfo?.direccion || '';
    document.getElementById("editar-municipio").value = clienteInfo?.municipio || '';
    document.getElementById("editar-colonia").value = clienteInfo?.colonia || '';
    document.getElementById("editar-genero").value = clienteInfo?.genero || 'no_especificado';
    document.getElementById("editar-codigo-postal").value = clienteInfo?.codigoPostal || '';
    document.getElementById("editar-fecha-nacimiento").value = data.fechaNacimiento?.split('T')[0] || '';

    // Deshabilitar campo de email
    document.getElementById("editar-email").disabled = true;

    // Mostrar modal
    modalEditarCliente.show();

  } catch (error) {
    console.error("❌ Error al cargar datos del cliente:", error);
    mostrarToast("❌ Error al cargar datos del cliente", "error");
  }
}

// 📝 Guardar cambios del cliente
document.getElementById("form-editar-cliente")?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const id = document.getElementById("editar-id-cliente").value;
  const nombre = document.getElementById("editar-nombre").value.trim();
  const telefono = document.getElementById("editar-telefono").value.trim();
  const direccion = document.getElementById("editar-direccion").value.trim();
  const municipio = document.getElementById("editar-municipio").value.trim();
  const colonia = document.getElementById("editar-colonia").value.trim();
  const genero = document.getElementById("editar-genero").value;
  const codigoPostal = document.getElementById("editar-codigo-postal").value;
  const fechaNacimiento = document.getElementById("editar-fecha-nacimiento").value;

  const spinner = document.getElementById("spinner-editar");
  spinner.classList.remove("d-none");

  try {
    // Validar que el teléfono no esté repetido
    if (telefono) {
      const { data: telefonoExistente, error: telefonoError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('telefono', telefono)
        .neq('id', id);

      if (telefonoError) throw telefonoError;
      if (telefonoExistente.length > 0) {
        marcarErrorCampo("editar-telefono", 'Este número de teléfono ya está registrado por otro usuario')
        throw new Error('Este número de teléfono ya está registrado por otro usuario');
      }
    }

    // Actualizar datos en usuarios
    const { error: usuarioError } = await supabase
      .from('usuarios')
      .update({
        nombre,
        telefono,
        fechaNacimiento: fechaNacimiento || null
      })
      .eq('id', id);

    if (usuarioError) throw usuarioError;

    // Actualizar datos en clientes
    const { error: clienteError } = await supabase
      .from('clientes')
      .update({
        direccion,
        municipio,
        colonia,
        genero,
        codigoPostal: codigoPostal ? parseInt(codigoPostal) : null
      })
      .eq('usuario_id', id);

    if (clienteError) throw clienteError;

    // Cerrar modal y mostrar éxito
    modalEditarCliente.hide();
    mostrarToast('✅ Cliente actualizado correctamente', 'success');
    clearClientSelection();
    cargarClientes();

  } catch (error) {
    console.error("❌ Error al actualizar cliente:", error);
    mostrarToast(`❌ ${error.message}`, 'error');
  } finally {
    spinner.classList.add("d-none");
  }
});

// 📦 filtros-clientes.js
const filtrosClientes = {
  buscar: document.getElementById("filtroClienteNombre"),
  correo: document.getElementById("filtroClienteCorreo"),
  telefono: document.getElementById("filtroClienteTelefono"),
  fecha: document.getElementById("filtroClienteFecha"),
  ordenarNombre: document.getElementById("ordenarNombreCliente"),
  limpiarBtn: document.getElementById("btn-limpiar-filtros-clientes"),
};

function actualizarEstadoBotonLimpiarCl() {
  const hayFiltros =
    filtrosClientes.buscar.value.trim() !== "" ||
    filtrosClientes.correo.value.trim() !== "" ||
    filtrosClientes.telefono.value.trim() !== "" ||
    filtrosClientes.fecha.value !== "" ||
    filtrosClientes.ordenarNombre.value !== "az";

  filtrosClientes.limpiarBtn.classList.toggle("disabled", !hayFiltros);
  filtrosClientes.limpiarBtn.disabled = !hayFiltros;

  actualizarBadgesFiltroCl();
}

// 🔍 Buscar por nombre
filtrosClientes.buscar.addEventListener("input", () => {
  const texto = filtrosClientes.buscar.value.toLowerCase();
  document.querySelectorAll("#clientes-tbody tr").forEach((fila) => {
    const nombre = fila.children[0].textContent.toLowerCase();
    fila.style.display = nombre.includes(texto) ? "" : "none";
  });
  actualizarEstadoBotonLimpiarCl();
});

// 📧 Filtrar por correo
filtrosClientes.correo.addEventListener("input", () => {
  const texto = filtrosClientes.correo.value.toLowerCase();
  document.querySelectorAll("#clientes-tbody tr").forEach((fila) => {
    const correo = fila.children[2].textContent.toLowerCase();
    fila.style.display = correo.includes(texto) ? "" : "none";
  });
  actualizarEstadoBotonLimpiarCl();
});

// 📞 Filtrar por teléfono
filtrosClientes.telefono.addEventListener("input", () => {
  const texto = filtrosClientes.telefono.value.toLowerCase();
  document.querySelectorAll("#clientes-tbody tr").forEach((fila) => {
    const telefono = fila.children[3].textContent.toLowerCase();
    fila.style.display = telefono.includes(texto) ? "" : "none";
  });
  actualizarEstadoBotonLimpiarCl();
});

// 🗓️ Filtrar por fecha de registro
filtrosClientes.fecha.addEventListener("change", () => {
  const filtro = filtrosClientes.fecha.value;
  document.querySelectorAll("#clientes-tbody tr").forEach((fila) => {
    const fecha = fila.children[8].textContent.split(",")[0];
    fila.style.display = fecha === filtro ? "" : "none";
  });
  actualizarEstadoBotonLimpiarCl();
});

// 🔤 Ordenar por nombre
filtrosClientes.ordenarNombre.addEventListener("change", () => {
  const orden = filtrosClientes.ordenarNombre.value;
  const tbody = document.getElementById("clientes-tbody");
  const filas = Array.from(tbody.querySelectorAll("tr"));

  filas.sort((a, b) => {
    const nombreA = a.children[0].textContent.toLowerCase();
    const nombreB = b.children[0].textContent.toLowerCase();
    return orden === "az" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
  });

  filas.forEach((fila) => tbody.appendChild(fila));
  actualizarEstadoBotonLimpiarCl();
});

// 🧼 Limpiar filtros
filtrosClientes.limpiarBtn.addEventListener("click", async () => {
  if (filtrosClientes.limpiarBtn.disabled) return;

  // Mostrar estado de carga
  filtrosClientes.limpiarBtn.disabled = true;
  const originalHtml = filtrosClientes.limpiarBtn.innerHTML;
  filtrosClientes.limpiarBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Limpiando...`;

  try {
    // Limpiar valores
    Object.values(filtrosClientes).forEach(filter => {
      if (filter instanceof HTMLInputElement || filter instanceof HTMLSelectElement) {
        filter.value = "";
        if (filter.id === "ordenarNombreCliente") filter.value = "az";
      }
    });

    // Recargar datos limpios
    clearClientSelection();
    await cargarClientes();

  } finally {
    // Restaurar botón
    filtrosClientes.limpiarBtn.innerHTML = originalHtml;
    filtrosClientes.limpiarBtn.disabled = false;
    actualizarEstadoBotonLimpiarCl();
  }
});
// 🧷 Mostrar badges activos
function actualizarBadgesFiltroCl() {
  const contenedor = document.getElementById("filtros-activos-clientes");
  const badgeNombre = document.getElementById("badge-nombre-clientes");
  const badgeCorreo = document.getElementById("badge-correo-clientes");
  const badgeTelefono = document.getElementById("badge-telefono-clientes");
  const badgeFecha = document.getElementById("badge-fecha-clientes");
  const badgeOrden = document.getElementById("badge-orden-clientes");

  let hay = false;
  animarTablaClientes();

  if (filtrosClientes.buscar.value) {
    badgeNombre.querySelector("span").textContent = filtrosClientes.buscar.value;
    badgeNombre.classList.remove("d-none");
    hay = true;
  } else badgeNombre.classList.add("d-none");

  if (filtrosClientes.correo.value) {
    badgeCorreo.querySelector("span").textContent = filtrosClientes.correo.value;
    badgeCorreo.classList.remove("d-none");
    hay = true;
  } else badgeCorreo.classList.add("d-none");

  if (filtrosClientes.telefono.value) {
    badgeTelefono.querySelector("span").textContent = filtrosClientes.telefono.value;
    badgeTelefono.classList.remove("d-none");
    hay = true;
  } else badgeTelefono.classList.add("d-none");

  if (filtrosClientes.fecha.value) {
    badgeFecha.querySelector("span").textContent = filtrosClientes.fecha.value;
    badgeFecha.classList.remove("d-none");
    hay = true;
  } else badgeFecha.classList.add("d-none");

  if (filtrosClientes.ordenarNombre.value !== "az") {
    badgeOrden.querySelector("span").textContent = "Z - A";
    badgeOrden.classList.remove("d-none");
    hay = true;
  } else badgeOrden.classList.add("d-none");

  contenedor.classList.toggle("d-none", !hay);
}

// 💫 Animación al aplicar filtros
function animarTablaClientes() {
  const tabla = document.getElementById("clientes-tbody");
  tabla.classList.add("resaltar-tabla");
  setTimeout(() => tabla.classList.remove("resaltar-tabla"), 1000);
}
