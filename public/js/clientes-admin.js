// 📦 clientes-admin.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let selectedClientId = null;
let selectedClientRow = null;

export async function cargarClientes() {
  try {
    const tbody = document.getElementById("clientes-tbody");
    const acciones = document.getElementById("acciones-clientes");

    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">Cargando clientes...</td>
      </tr>
    `;
  //  acciones.classList.add("d-none");

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, email, telefono")
      .eq("rol", "cliente")
      .order("nombre", { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">No hay clientes registrados.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = ""; // Limpiar

    data.forEach(cliente => {
      const tr = document.createElement("tr");
      tr.dataset.id = cliente.id; // 👈 Importante para seleccionar

      tr.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${cliente.email}</td>
        <td>${cliente.telefono}</td>
      `;

      tbody.appendChild(tr);
    });
    setupClientRowSelection(); // Configurar selección después de cargar


  } catch (error) {
    console.error("❌ Error cargando clientes:", error);
    mostrarToast("❌ Error cargando clientes.", "error");
  }
}

// Funciones (placeholder)
window.editarCliente = function(id) {
  mostrarToast(`⚡ Función de editar cliente: ${id}`, "info");
}

window.eliminarCliente = function(id) {
  mostrarToast(`⚡ Función de eliminar cliente: ${id}`, "info");
}


// 🖱️ Configurar selección de filas
function setupClientRowSelection() {
  const table = document.getElementById('tabla-clientes');
  if (!table) return;

  table.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;

    const clientId = row.dataset.id;
    if (selectedClientId === clientId) {
      clearClientSelection();
    } else {
      selectClientRow(clientId);
    }
  });

  const deleteBtn = document.getElementById('delete-client-btn');
  const editBtn = document.getElementById('edit-client-btn');

  deleteBtn.addEventListener('click', () => {
    if (selectedClientId) {
      eliminarCliente(selectedClientId);
    }
  });

  editBtn.addEventListener('click', () => {
    if (selectedClientId) {
      editarCliente(selectedClientId);
    }
  });
}

// 🔵 Seleccionar fila de cliente
function selectClientRow(clientId) {
  clearClientSelection();

  const row = document.querySelector(`#tabla-clientes tr[data-id="${clientId}"]`);
  if (!row) return;

  row.classList.add('selected-row');
  selectedClientRow = row;
  selectedClientId = clientId;

  document.getElementById('delete-client-btn').style.display = 'inline-block';
  document.getElementById('edit-client-btn').style.display = 'inline-block';
}

// 🧹 Limpiar selección
function clearClientSelection() {
  if (selectedClientRow) {
    selectedClientRow.classList.remove('selected-row');
  }
  selectedClientRow = null;
  selectedClientId = null;

  document.getElementById('delete-client-btn').style.display = 'none';
  document.getElementById('edit-client-btn').style.display = 'none';
}

// 🔥 Función eliminar cliente
// 🔥 Función eliminar cliente
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


// ⚙️ Función editar cliente (placeholder)
function editarCliente(id) {
  mostrarToast(`⚡ Aquí abriríamos modal para editar cliente: ${id}`, "info");
}