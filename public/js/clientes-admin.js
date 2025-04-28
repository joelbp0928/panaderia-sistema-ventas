// 📦 clientes-admin.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

export async function cargarClientes() {
  try {
    const tbody = document.getElementById("clientes-tbody");
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">Cargando clientes...</td>
      </tr>
    `;

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

      tr.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${cliente.email}</td>
        <td>${cliente.telefono}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarCliente('${cliente.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="eliminarCliente('${cliente.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

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
