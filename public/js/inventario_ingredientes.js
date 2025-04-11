import { supabase } from "./supabase-config.js";
import { mostrarToast, showLoading, hideLoading } from "./manageError.js";

let selectedIngredientRow = null;
let selectedIngredientId = null;
let salidaModal;

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

// Mostrar modal de salida con datos del ingrediente seleccionado
export function abrirModalSalida(id, nombre, stockActual, medida) {
  document.getElementById("nombre-ingrediente-salida").textContent = nombre;
  document.getElementById("stock-actual-salida").textContent = `${parseFloat(stockActual).toFixed(2)} ${medida}`;
  document.getElementById("form-salida-ingrediente").dataset.inventarioId = id;
  document.getElementById("medida-retirar").textContent = `${medida}`;
  salidaModal = new bootstrap.Modal(document.getElementById("modalSalidaIngrediente"));
  salidaModal.show();
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

// Manejar envío del formulario de salida
export async function registrarSalidaManual(event) {
  event.preventDefault();
  const btn = formSalida.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

  const cantidad = parseFloat(document.getElementById("cantidad-salida").value);
  const comentario = document.getElementById("comentario-salida").value.trim();
  const inventarioId = document.getElementById("form-salida-ingrediente").dataset.inventarioId;

  if (!inventarioId || isNaN(cantidad) || cantidad <= 0) {
    mostrarToast("⚠️ Datos inválidos para salida", "error");
    return;
  }

  try {
    // Obtener stock actual
    const { data: inventario, error: errorInv } = await supabase
      .from("inventario_ingredientes")
      .select("stock_actual")
      .eq("id", inventarioId)
      .single();

    if (errorInv || !inventario) {
      mostrarToast("❌ Error al consultar inventario", "error");
      return;
    }

    const stockActual = parseFloat(inventario.stock_actual);

    if (cantidad > stockActual) {
      mostrarToast("⚠️ No puedes retirar más de lo disponible", "warning");
      return;
    }

    const nuevoStock = stockActual - cantidad;

    // 1. Actualizar stock
    await supabase
      .from("inventario_ingredientes")
      .update({ stock_actual: nuevoStock, updated_at: new Date() })
      .eq("id", inventarioId);

    // 2. Registrar movimiento
    await supabase.from("movimientos_ingredientes").insert({
      inventario_ingrediente_id: inventarioId,
      tipo_movimiento: "salida",
      cantidad,
      stock_resultante: nuevoStock,
      descripcion: comentario
    });

    mostrarToast("✅ Salida registrada con éxito", "success");
    salidaModal.hide();
    document.getElementById("btn-restar-ingrediente-inventario")?.focus();
    document.getElementById("form-salida-ingrediente").reset();
    cargarInventarioIngredientes();
  } catch (err) {
    console.error("❌ Error registrando salida:", err);
    mostrarToast("❌ Error al registrar la salida", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Registrar Salida';

  }
}

// Asignar evento
const formSalida = document.getElementById("form-salida-ingrediente");
if (formSalida) {
  formSalida.addEventListener("submit", registrarSalidaManual);
}

// 📋 Mostrar tabla de inventario
export async function cargarInventarioIngredientes() {
  console.log("cargando stock ingredientes");
  showLoading();
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

  //renderizarInventarioFiltrado();
  hideLoading();
}

// 📦 GESTIÓN DE INVENTARIO - HISTORIAL DE MOVIMIENTOS ============================
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
      // 🧮 Contar entradas y salidas
      let totalEntradas = 0;
      let totalSalidas = 0;

      data.forEach(mov => {
        if (mov.tipo_movimiento === "entrada") totalEntradas += mov.cantidad;
        if (mov.tipo_movimiento === "salida") totalSalidas += mov.cantidad;
      });

      const resumen = document.getElementById("resumen-historial-ingrediente");
      resumen.innerHTML = `
    <span class="text-success me-3">+${totalEntradas.toFixed(2)} Entradas</span>
    <span class="text-danger">-${totalSalidas.toFixed(2)} Salidas</span>
    `;
      document.getElementById("titulo-historial").textContent =
        `Historial de ${nombreIngrediente}`;
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

      // ✅ Mostrar panel, overlay y bloquear scroll
      document.getElementById("historial-contenedor").classList.add("mostrar");
      document.getElementById("overlay-historial").classList.add("mostrar");
      document.body.classList.add("bloquear-scroll");
    })
    .catch(err => {
      console.warn("❌ Error al cargar historial:", err);
      mostrarToast("❌ No se pudo cargar el historial", "error");
    });
}
document.getElementById("overlay-historial").addEventListener("click", cerrarHistorial);

// ❌ Ocultar historial
export function cerrarHistorial() {
  document.getElementById("historial-contenedor").classList.remove("mostrar");
  document.getElementById("overlay-historial").classList.remove("mostrar");
  document.body.classList.remove("bloquear-scroll"); // ✅ Restaurar scroll

}
// 🖱️ Selección de filas en tabla de ingredientes
export function setupIngredientRowSelection() {
  const tbody = document.getElementById("tabla-ingredientes");
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;

    const id = row.dataset.id;

    if (selectedIngredientId === id) {
      clearIngredientSelection();
    } else {
      selectIngredientRow(id, row);
    }
  });

  // Acciones visibles solo al seleccionar
  const historialBtn = document.getElementById("btn-historial-ingrediente");
  const restarBtn = document.getElementById("btn-restar-ingrediente-inventario");

  if (historialBtn) historialBtn.style.display = "none";
  if (restarBtn) restarBtn.style.display = "none";

  // Importante: los botones solo se les pone el listener UNA vez
  historialBtn?.addEventListener("click", () => {
    if (selectedIngredientId) {
      const nombre = selectedIngredientRow?.querySelector("td")?.textContent;
      verHistorialMovimientos(selectedIngredientId, nombre);
    }
  });

  restarBtn?.addEventListener("click", () => {
    if (selectedIngredientId && selectedIngredientRow) {
      const nombre = selectedIngredientRow.querySelector("td")?.textContent;
      const stock = selectedIngredientRow.querySelector("td:nth-child(2)")?.textContent;
      const medida = selectedIngredientRow.querySelector("td:nth-child(3)")?.textContent;
      abrirModalSalida(selectedIngredientId, nombre, stock, medida);
    }
  });
}


// 🔘 Seleccionar fila
function selectIngredientRow(id, row) {
  clearIngredientSelection();

  row.classList.add("selected-row");
  selectedIngredientRow = row;
  selectedIngredientId = id;

  document.getElementById("btn-historial-ingrediente").style.display = "inline-block";
  document.getElementById("btn-restar-ingrediente-inventario").style.display = "inline-block"
}


// 🧹 Limpiar selección
function clearIngredientSelection() {
  if (selectedIngredientRow) {
    selectedIngredientRow.classList.remove("selected-row");
    selectedIngredientRow = null;
    selectedIngredientId = null;
  }

  document.getElementById("btn-historial-ingrediente").style.display = "none";
  document.getElementById("btn-restar-ingrediente-inventario").style.display = "none";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarHistorial();
});

const filtrosIng = {
  buscar: document.getElementById("buscarIngrediente"),
  unidad: document.getElementById("filtroUnidad"),
  ordenarNombre: document.getElementById("ordenarNombreIngrediente"), // asegúrate de tener este select
  limpiarBtn: document.getElementById("btn-limpiar-filtros-ing"),
};

// Activar botón limpiar si hay filtros activos
function actualizarEstadoBotonLimpiarIng() {
  const hayFiltros =
    filtrosIng.buscar.value.trim() !== "" ||
    filtrosIng.unidad.value !== "" ||
    filtrosIng.ordenarNombre.value !== "az";

  filtrosIng.limpiarBtn.classList.toggle("disabled", !hayFiltros);
  filtrosIng.limpiarBtn.disabled = !hayFiltros;

  actualizarBadgesFiltroIng();
}

// Aplicar búsqueda por nombre
filtrosIng.buscar.addEventListener("input", () => {
  const texto = filtrosIng.buscar.value.toLowerCase();
  document.querySelectorAll("#tabla-ingredientes tr").forEach((fila) => {
    const nombre = fila.children[0].textContent.toLowerCase();
    fila.style.display = nombre.includes(texto) ? "" : "none";
  });
  actualizarEstadoBotonLimpiarIng();
});

// Filtrar por medida
filtrosIng.unidad.addEventListener("change", () => {
  const medida = filtrosIng.unidad.value.toLowerCase();
  document.querySelectorAll("#tabla-ingredientes tr").forEach((fila) => {
    const unidad = fila.children[2].textContent.toLowerCase();
    fila.style.display = !medida || unidad === medida ? "" : "none";
  });
  actualizarEstadoBotonLimpiarIng();
});

// Ordenar por nombre
filtrosIng.ordenarNombre.addEventListener("change", () => {
  const orden = filtrosIng.ordenarNombre.value;
  const tbody = document.getElementById("tabla-ingredientes");
  const filas = Array.from(tbody.querySelectorAll("tr"));

  filas.sort((a, b) => {
    const nombreA = a.children[0].textContent.toLowerCase();
    const nombreB = b.children[0].textContent.toLowerCase();
    return orden === "az" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
  });

  filas.forEach((fila) => tbody.appendChild(fila));
  actualizarEstadoBotonLimpiarIng();
});

// Limpiar filtros
filtrosIng.limpiarBtn.addEventListener("click", () => {
  if (filtrosIng.limpiarBtn.classList.contains("disabled")) return;

  const original = filtrosIng.limpiarBtn.innerHTML;
  filtrosIng.limpiarBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Limpiando...`;
  filtrosIng.limpiarBtn.disabled = true;

  setTimeout(() => {
    filtrosIng.buscar.value = "";
    filtrosIng.unidad.value = "";
    filtrosIng.ordenarNombre.value = "az";

    filtrosIng.buscar.dispatchEvent(new Event("input"));
    filtrosIng.unidad.dispatchEvent(new Event("change"));
    filtrosIng.ordenarNombre.dispatchEvent(new Event("change"));

    filtrosIng.limpiarBtn.innerHTML = original;
    filtrosIng.limpiarBtn.classList.add("disabled");
    filtrosIng.limpiarBtn.disabled = true;
  }, 600);
});

// Mostrar badges de filtros activos
function actualizarBadgesFiltroIng() {
  const contenedor = document.getElementById("filtros-activos-ing");
  const badgeMedida = document.getElementById("badge-medida");
  const badgeNombre = document.getElementById("badge-nombre-orden");

  let hay = false;

  animarTablaIngredientes();

  // Medida
  if (filtrosIng.unidad.value) {
    badgeMedida.querySelector("span").textContent = filtrosIng.unidad.value;
    badgeMedida.classList.remove("d-none");
    hay = true;
  } else {
    badgeMedida.classList.add("d-none");
  }

  // Orden nombre
  if (filtrosIng.ordenarNombre.value) {
    badgeNombre.querySelector("span").textContent =
      filtrosIng.ordenarNombre.value === "az" ? "A - Z" : "Z - A";
    badgeNombre.classList.remove("d-none");
    hay = true;
  } else {
    badgeNombre.classList.add("d-none");
  }

  contenedor.classList.toggle("d-none", !hay);
}

// Detectar cambios para actualizar estado
["input", "change"].forEach((ev) => {
  filtrosIng.buscar.addEventListener(ev, actualizarEstadoBotonLimpiarIng);
  filtrosIng.unidad.addEventListener(ev, actualizarEstadoBotonLimpiarIng);
  filtrosIng.ordenarNombre.addEventListener(ev, actualizarEstadoBotonLimpiarIng);
});
function animarTablaIngredientes() {
  const tabla = document.getElementById("tabla-ingredientes");
  tabla.classList.add("resaltar-tabla");
  setTimeout(() => tabla.classList.remove("resaltar-tabla"), 1000);
}

