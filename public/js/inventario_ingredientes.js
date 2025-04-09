import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let selectedIngredientRow = null;
let selectedIngredientId = null;

// 🌐 Exponer funciones al scope global
window.verHistorialMovimientos = verHistorialMovimientos;

document.addEventListener("DOMContentLoaded", function () {
  // ✅ Ejecutar al cargar
setupIngredientRowSelection();
});

document.getElementById("ingrediente-select").addEventListener("change", async function () {
  const ingredienteId = this.value;

  // 🔍 Obtener medida y precio unitario del catálogo de ingredientes
  const { data: ingrediente, error: errorIngrediente } = await supabase
    .from("ingredientes")
    .select("medida, precio_unitario")
    .eq("id", ingredienteId)
    .single();

  // 🧪 Verificar si se obtuvo correctamente el ingrediente
  if (!ingrediente || errorIngrediente) {
    document.getElementById("unidad-medida-text").textContent = "Sin datos";
    document.getElementById("precio-unitario-text").style.display = "block";
    document.getElementById("precio-unitario-num").textContent = "No registrado";
  } else {
    const medida = ingrediente.medida || "Sin medida";
    const precioUnitario = ingrediente.precio_unitario ?? null;

    document.getElementById("unidad-medida-text").textContent = medida;
    document.getElementById("precio-unitario-text").style.display = "block";
    document.getElementById("precio-unitario-num").textContent =
      precioUnitario !== null
        ? `$${precioUnitario.toFixed(2)} por ${medida}`
        : "No registrado";
  }

  // 📦 Obtener stock actual del inventario
  const { data, error: errorInv } = await supabase
    .from("inventario_ingredientes")
    .select("stock_actual")
    .eq("ingrediente_id", ingredienteId)
    .limit(1);

  const inventario = data?.[0];

  document.getElementById("stock-actual-text").style.display = "block";

  if (!inventario || errorInv) {
    document.getElementById("stock-actual-num").textContent = "Sin registro";
  } else {
    const stock = parseFloat(inventario.stock_actual);
    document.getElementById("stock-actual-num").textContent = `${stock.toFixed(2)} ${ingrediente?.medida || ''}`;
  }
});


// 🧠 Cargar ingredientes en el select del modal
async function cargarSelectIngredientes() {
  const { data, error } = await supabase.from("ingredientes").select("id, nombre, medida").order("nombre");
  const select = document.getElementById("ingrediente-select");
  select.innerHTML = `
  <option value="" disabled selected>Selecciona un ingrediente...</option>
`;
  data.forEach(i => {
    const option = document.createElement("option");
    option.value = i.id;
    option.textContent = i.nombre;
    option.setAttribute("data-medida", i.medida); // 👈 Guardamos medida aquí
    select.appendChild(option);
  });
}

// 📤 Abrir el modal
export function abrirModalEntrada() {
  cargarSelectIngredientes();
  const modal = new bootstrap.Modal(document.getElementById("modalEntradaIngrediente"));
  modal.show();
}

// 💾 Guardar entrada manual
async function guardarEntradaManual(event) {
  event.preventDefault();

  const ingredienteId = document.getElementById("ingrediente-select").value;
  const cantidad = parseFloat(document.getElementById("cantidad-entrada").value);
  const comentario = document.getElementById("comentario-entrada").value.trim();

  if (!ingredienteId || cantidad <= 0) {
    mostrarToast("⚠️ Datos inválidos.", "error");
    return;
  }

  // 1. Buscar inventario actual o crear nuevo si no existe
  const { data: existente } = await supabase.from("inventario_ingredientes")
    .select("id, stock_actual")
    .eq("ingrediente_id", ingredienteId)
    .single();

  let stock = cantidad;
  let inventarioId; // <- Aquí guardamos el ID a usar luego
  if (existente) {
    stock += parseFloat(existente.stock_actual);

    await supabase
      .from("inventario_ingredientes")
      .update({ stock_actual: stock, updated_at: new Date() })
      .eq("id", existente.id);

    inventarioId = existente.id;
  } else {
    const { data: nuevoInv, error: errorInsert } = await supabase
      .from("inventario_ingredientes")
      .insert({
        ingrediente_id: ingredienteId,
        stock_actual: cantidad
      })
      .select() // Necesario para obtener el ID nuevo
      .single();

    if (errorInsert) {
      mostrarToast("❌ No se pudo crear el inventario", "error");
      return;
    }

    inventarioId = nuevoInv.id;
  }

  // 2. Registrar movimiento
  await supabase.from("movimientos_ingredientes").insert({
    inventario_ingrediente_id: inventarioId, // ✅ Siempre definido
    tipo_movimiento: "entrada",
    cantidad,
    stock_resultante: stock,
    descripcion: comentario
  });

  mostrarToast("✅ Entrada registrada exitosamente", "success");
  document.getElementById("form-entrada-ingrediente").reset();
  bootstrap.Modal.getInstance(document.getElementById("modalEntradaIngrediente")).hide();
  cargarInventarioIngredientes(); // recargar vista
}

document.getElementById("form-entrada-ingrediente").addEventListener("submit", guardarEntradaManual);

// 📋 Mostrar tabla de inventario
async function cargarInventarioIngredientes() {
  const { data, error } = await supabase.from("inventario_ingredientes")
    .select("*, ingrediente:ingrediente_id(nombre, medida, precio_total, precio_unitario)")

    .order("updated_at", { ascending: false });

  const tbody = document.getElementById("tabla-ingredientes");
  tbody.innerHTML = "";

  data.forEach(item => {
    const fila = document.createElement("tr");
    fila.dataset.id = item.id; // ✅ Necesario para seleccionar la fila
    let precio_total = item.ingrediente.precio_unitario * item.stock_actual
    fila.innerHTML = `
        <td>${item.ingrediente.nombre}</td>
        <td>${item.stock_actual.toFixed(2)}</td>
        <td>${item.ingrediente.medida || "-"}</td>
        <td>$${precio_total?.toFixed(2) || "0.00"}</td>
        <td>$${item.ingrediente.precio_unitario?.toFixed(2) || "0.00"}</td>
<!--        <<button onclick="verHistorialMovimientos('${item.id}', '${item.ingrediente.nombre}')" class="btn btn-outline-secondary btn-sm">
  <i class="fas fa-history"></i>
</button>
        <td>-</td>-->
      `;

    tbody.appendChild(fila);
  });
}

// Inicializar tabla
cargarInventarioIngredientes();

////
// 📦 GESTIÓN DE INVENTARIO - HISTORIAL DE MOVIMIENTOS ============================

// 📜 Función para abrir el historial de movimientos
// 👁️ Mostrar historial
export function verHistorialMovimientos(inventarioId, nombreIngrediente) {
  supabase
    .from("movimientos_ingredientes")
    .select("tipo_movimiento, cantidad, descripcion, stock_resultante, created_at")
    .eq("inventario_ingrediente_id", inventarioId)
    .order("created_at", { ascending: false })
    .limit(10)
    .then(({ data, error }) => {
      if (error) throw error;

      document.getElementById("titulo-historial").textContent =
        `Últimos movimientos de "${nombreIngrediente}"`;
      const lista = document.getElementById("lista-historial");
      lista.innerHTML = "";

      if (!data || data.length === 0) {
        lista.innerHTML = `<li class="list-group-item text-muted">Sin movimientos registrados</li>`;
      } else {
        data.forEach(mov => {
          const li = document.createElement("li");
          li.className = "list-group-item d-flex justify-content-between align-items-start";
          li.innerHTML = `
            <div>
              <strong class="text-${mov.tipo_movimiento === "entrada" ? "success" : "danger"}">
                ${mov.tipo_movimiento.toUpperCase()}
              </strong>
              <div class="small">${mov.descripcion || "(Sin descripción)"}</div>
            </div>
            <div class="text-end">
              <span>${parseFloat(mov.cantidad).toFixed(2)}</span><br/>
              <small class="text-muted">${new Date(mov.created_at).toLocaleString()}</small>
            </div>`;
          lista.appendChild(li);
        });
      }

      // Mostrar panel y overlay
      document.getElementById("historial-contenedor").classList.add("mostrar");
      document.getElementById("overlay-historial").classList.add("mostrar");
    })
    .catch(err => {
      console.warn("❌ Error al cargar historial:", err);
      mostrarToast("❌ No se pudo cargar el historial", "error");
    });
}
document.getElementById("overlay-historial").addEventListener("click", cerrarHistorial);



// 📋 Añadir botón en la tabla de ingredientes (esto se haría al renderizar cada fila)
// ejemplo: <button onclick="verHistorialMovimientos('${id}', '${nombre}')" class="btn btn-outline-secondary btn-sm"><i class="fas fa-history"></i></button>

// 📦 En tu HTML, crea un contenedor lateral para mostrar el historial (puede estar oculto inicialmente)
// <div id="historial-contenedor" class="border p-3 bg-light rounded"></div>


// 👁️ Mostrar historial lateral
// ❌ Ocultar historial
export function cerrarHistorial() {
  document.getElementById("historial-contenedor").classList.remove("mostrar");
  document.getElementById("overlay-historial").classList.remove("mostrar");
}
// 🖱️ Selección de filas en tabla de ingredientes
function setupIngredientRowSelection() {
  const table = document.getElementById("tabla-ingredientes");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;

    const id = row.dataset.id;
    if (selectedIngredientId === id) {
      clearIngredientSelection();
    } else {
      selectIngredientRow(id);
    }
  });

  // Acciones visibles solo al seleccionar
  const historialBtn = document.getElementById("btn-historial-ingrediente");
  const editarBtn = document.getElementById("btn-editar-ingrediente");

  if (historialBtn) historialBtn.style.display = "none";
  if (editarBtn) editarBtn.style.display = "none";

  historialBtn?.addEventListener("click", () => {
    if (selectedIngredientId) {
      const nombre = document.querySelector(`tr[data-id='${selectedIngredientId}'] td`).textContent;
      verHistorialMovimientos(selectedIngredientId, nombre);
    }
  });
}

// 🔘 Seleccionar fila
function selectIngredientRow(id) {
  clearIngredientSelection();

  const row = document.querySelector(`#tabla-ingredientes tr[data-id='${id}']`);
  if (!row) return;

  row.classList.add("selected-row");
  selectedIngredientRow = row;
  selectedIngredientId = id;

  // Mostrar acciones
  document.getElementById("btn-historial-ingrediente").style.display = "inline-block";
  document.getElementById("btn-editar-ingrediente").style.display = "inline-block";
}

// 🧹 Limpiar selección
function clearIngredientSelection() {
  if (selectedIngredientRow) {
    selectedIngredientRow.classList.remove("selected-row");
    selectedIngredientRow = null;
    selectedIngredientId = null;
  }

  document.getElementById("btn-historial-ingrediente").style.display = "none";
  document.getElementById("btn-editar-ingrediente").style.display = "none";
}
