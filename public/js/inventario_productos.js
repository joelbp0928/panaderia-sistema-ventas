// ✅ VARIABLES Y CONFIG
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let selectedProductId = null;
let selectedProductRow = null;
let selectedProductName = null;
let selectedProductStock = null;

// ✅ FUNCIONES GLOBALES
window.abrirModalEntradaProducto = abrirModalEntradaProducto;
window.abrirModalSalidaProducto = abrirModalSalidaProducto;
window.verHistorialProducto = verHistorialProducto;

// ✅ INICIALIZACIÓN

document.addEventListener("DOMContentLoaded", () => {
    cargarInventarioProductos();
    setupProductRowSelection();

    document.getElementById("btn-restar-producto-inventario")?.addEventListener("click", () => {
        if (selectedProductId && selectedProductName && selectedProductStock != null) {
            abrirModalSalidaProducto();
        }
    });

    document.getElementById("btn-historial-producto")?.addEventListener("click", () => {
        if (selectedProductId && selectedProductName) {
            verHistorialProducto();
        }
    });
});

// ✅ CARGAR PRODUCTOS EN TABLA DE INVENTARIO
export async function cargarInventarioProductos() {
    const { data, error } = await supabase
        .from("inventario_productos")
        .select("*, productos:producto_id(nombre,categoria:categoria_id(nombre), stock, precio_unitario)")
        .order("updated_at", { ascending: false });

    const tbody = document.getElementById("tabla-productos");
    tbody.innerHTML = "";

    data?.forEach((item) => {
        const fila = document.createElement("tr");
        fila.dataset.id = item.id;
        fila.dataset.nombre = item.productos.nombre;
        fila.dataset.stock = item.stock_actual;

        const stock = parseFloat(item.stock_actual);
        const costoTotal = stock * item.productos.precio_unitario;

        fila.innerHTML = `
        <td>${item.productos.categoria.nombre}</td>
      <td>${item.productos.nombre}</td>
      <td>${stock}</td>
     <!-- <td>${item.productos.stock}</td> -->
      <td>$${item.productos.precio_unitario.toFixed(2)}</td>
      <td>$${costoTotal.toFixed(2)}</td>
    `;

        tbody.appendChild(fila);
    });
}

// ✅ SELECCIÓN DE FILA
function setupProductRowSelection() {
    const table = document.getElementById("tabla-productos");
    if (!table) return;

    table.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-id]");
        if (!row) return;

        const id = row.dataset.id;
        const nombre = row.dataset.nombre;
        const stock = parseFloat(row.dataset.stock);

        if (selectedProductId === id) {
            clearProductSelection();
        } else {
            selectProductRow(id, nombre, stock);
        }
    });

    document.getElementById("btn-historial-producto").style.display = "none";
    document.getElementById("btn-restar-producto-inventario").style.display = "none";
}

function selectProductRow(id, nombre, stock) {
    clearProductSelection();

    const row = document.querySelector(`#tabla-productos tr[data-id='${id}']`);
    if (!row) return;

    row.classList.add("selected-row");
    selectedProductRow = row;
    selectedProductId = id;
    selectedProductName = nombre;
    selectedProductStock = stock;

    document.getElementById("btn-historial-producto").style.display = "inline-block";
    document.getElementById("btn-restar-producto-inventario").style.display = "inline-block";
}

function clearProductSelection() {
    if (selectedProductRow) {
        selectedProductRow.classList.remove("selected-row");
    }
    selectedProductRow = null;
    selectedProductId = null;
    selectedProductName = null;
    selectedProductStock = null;

    document.getElementById("btn-historial-producto").style.display = "none";
    document.getElementById("btn-restar-producto-inventario").style.display = "none";
}

// ✅ MODAL DE ENTRADA (PRODUCCIÓN)
export async function abrirModalEntradaProducto() {
    const select = document.getElementById("producto-select");
    select.innerHTML = `<option value="" disabled selected>Selecciona un producto...</option>`;

    const { data } = await supabase.from("productos").select("id, nombre").order("nombre");
    data?.forEach((prod) => {
        const option = document.createElement("option");
        option.value = prod.id;
        option.textContent = prod.nombre;
        select.appendChild(option);
    });

    new bootstrap.Modal(document.getElementById("modalEntradaProducto")).show();

}

// Mostrar ingredientes requeridos al cambiar producto o cantidad
document.getElementById("producto-select").addEventListener("change", mostrarIngredientesRequeridos);
document.getElementById("cantidad-producto").addEventListener("input", mostrarIngredientesRequeridos);

async function mostrarIngredientesRequeridos() {
    const productoId = document.getElementById("producto-select").value;
    const cantidad = parseFloat(document.getElementById("cantidad-producto").value);

    const contenedor = document.getElementById("ingredientes-requeridos");
    const lista = document.getElementById("lista-ingredientes-requeridos");
    lista.innerHTML = "";
    contenedor.style.display = "none";

    if (!productoId || isNaN(cantidad) || cantidad <= 0) return;

    const { data: ingredientes, error } = await supabase
        .from("productos_ingredientes")
        .select("ingrediente_id, cantidad_usada, ingrediente:ingrediente_id(nombre, medida), producto:producto_id(stock)")
        .eq("producto_id", productoId);


    if (!ingredientes || ingredientes.length === 0) return;

    let hayFaltantes = false;

    for (const ing of ingredientes) {
        // Suponiendo que cada ingrediente incluye: cantidad_usada, stock
        const lotesNecesarios = cantidad / ing.producto.stock;
        const cantidadNecesaria = ing.cantidad_usada * lotesNecesarios;

        const { data: inventario } = await supabase
            .from("inventario_ingredientes")
            .select("stock_actual")
            .eq("ingrediente_id", ing.ingrediente_id)
            .single();

        const stockDisponible = inventario?.stock_actual ?? 0;
        const suficiente = stockDisponible >= cantidadNecesaria;
        if (!suficiente) hayFaltantes = true;

        const li = document.createElement("li");
        li.innerHTML = `
        ${ing.ingrediente.nombre} - 
        necesita <strong>${cantidadNecesaria.toFixed(2)} ${ing.ingrediente.medida}</strong> 
        | stock: <span class="${suficiente ? "text-success" : "text-danger"} fw-bold">
          ${stockDisponible.toFixed(2)} ${ing.ingrediente.medida}
        </span>
      `;
        lista.appendChild(li);
    }

    // Cambiar color del contenedor si hay faltantes
    contenedor.classList.remove("alert-info", "alert-danger");
    contenedor.classList.add(hayFaltantes ? "alert-danger" : "alert-info");
    contenedor.style.display = "block";
}



export async function registrarEntradaProducto(e) {
    e.preventDefault();
    const productoId = document.getElementById("producto-select").value;
    const cantidad = parseFloat(document.getElementById("cantidad-producto").value);
    const comentario = document.getElementById("comentario-produccion").value.trim();

    const { data: ingredientes, error: errorIngredientes } = await supabase
        .from("productos_ingredientes")
        .select("ingrediente_id, cantidad_usada")
        .eq("producto_id", productoId);

    if (errorIngredientes || !Array.isArray(ingredientes)) {
        console.error("❌ Error al obtener ingredientes:", errorIngredientes);
        mostrarToast("❌ No se pudieron obtener los ingredientes del producto", "error");
        return;
    }
    const { data: productoInfo } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", productoId)
        .single();

    const piezasPorReceta = productoInfo?.stock ?? 1;

    for (const ing of ingredientes) {
        const { data: inventarioIng } = await supabase
            .from("inventario_ingredientes")
            .select("id, stock_actual")
            .eq("ingrediente_id", ing.ingrediente_id)
            .single();
        console.log("📦 Ingredientes cargados:", ingredientes);

        // Suponiendo que cada ingrediente incluye: cantidad_usada, piezas_por_receta
        const requerido = ing.cantidad_usada * (cantidad / piezasPorReceta);
        if (!inventarioIng || inventarioIng.stock_actual < requerido) {
            mostrarToast("⚠️ Ingrediente insuficiente en inventario", "error");
            return;
        }
    }

    for (const ing of ingredientes) {
        // Suponiendo que cada ingrediente incluye: cantidad_usada, piezas_por_receta
        const lotesNecesarios = cantidad / productoInfo.stock;
        const requerido = ing.cantidad_usada * lotesNecesarios;
        await supabase.rpc("descontar_ingrediente", {
            p_ingrediente_id: ing.ingrediente_id,
            p_cantidad: requerido,
        });
    }

    const { data: existente } = await supabase
        .from("inventario_productos")
        .select("id, stock_actual")
        .eq("producto_id", productoId)
        .single();

    let inventarioProductoId;
    let nuevoStock = cantidad;

    if (existente) {
        inventarioProductoId = existente.id;
        nuevoStock += existente.stock_actual;
        console.log(nuevoStock)
        await supabase
            .from("inventario_productos")
            .update({ stock_actual: nuevoStock, updated_at: new Date() })
            .eq("id", existente.id);
    } else {
        const { data: nuevoInv } = await supabase
            .from("inventario_productos")
            .insert({ producto_id: productoId, stock_actual: cantidad })
            .select()
            .single();
        inventarioProductoId = nuevoInv.id;
    }

    const { data: producto } = await supabase
        .from("productos")
        .select("precio_unitario")
        .eq("id", productoId)
        .single();

    await supabase.from("movimientos_productos").insert({
        inventario_producto_id: inventarioProductoId,
        tipo_movimiento: "entrada",
        cantidad,
        stock_resultante: nuevoStock,
        descripcion: comentario,
        costo_unitario: producto?.precio_unitario ?? null,
    });

    mostrarToast("✅ Producción registrada con éxito", "success");
    bootstrap.Modal.getInstance(document.getElementById("modalEntradaProducto")).hide();
    document.getElementById("form-entrada-producto").reset();
    cargarInventarioProductos();
}


document.getElementById("form-entrada-producto")?.addEventListener("submit", registrarEntradaProducto);

// ✅ MODAL SALIDA MANUAL
export function abrirModalSalidaProducto() {
    if (!selectedProductId) return;
    document.getElementById("nombre-producto-salida").textContent = selectedProductName;
    document.getElementById("stock-actual-producto").textContent = selectedProductStock;
    document.getElementById("form-salida-producto").dataset.productoId = selectedProductId;

    new bootstrap.Modal(document.getElementById("modalSalidaProducto")).show();
}

export async function registrarSalidaProducto(e) {
    e.preventDefault();
    const btn = formSalida.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    const productoId = e.target.dataset.productoId;
    const cantidad = parseFloat(document.getElementById("cantidad-salida-producto").value);
    const comentario = document.getElementById("comentario-salida-producto").value;

    const { data: existente } = await supabase
        .from("inventario_productos")
        .select("id, stock_actual")
        .eq("id", productoId)
        .single();

    if (!existente || existente.stock_actual < cantidad) {
        mostrarToast("❌ Stock insuficiente", "error");
        return;
    }

    const nuevoStock = existente.stock_actual - cantidad;

    await supabase
        .from("inventario_productos")
        .update({ stock_actual: nuevoStock, updated_at: new Date() })
        .eq("id", productoId);

    await supabase.from("movimientos_productos").insert({
        inventario_producto_id: productoId,
        tipo_movimiento: "salida",
        cantidad,
        stock_resultante: nuevoStock,
        descripcion: comentario,
    });

    mostrarToast("✅ Salida registrada", "success");
    bootstrap.Modal.getInstance(document.getElementById("modalSalidaProducto")).hide();
    document.getElementById("form-salida-producto").reset();
    cargarInventarioProductos();
}

// Asignar evento
const formSalida = document.getElementById("form-salida-producto");
if (formSalida) {
    formSalida.addEventListener("submit", registrarSalidaProducto);
}


async function verHistorialProducto() {
    if (!selectedProductId) return;

    const { data, error } = await supabase
        .from("movimientos_productos")
        .select("*")
        .eq("inventario_producto_id", selectedProductId)
        .order("created_at", { ascending: false });

    const lista = document.getElementById("lista-historial-producto");
    const titulo = document.getElementById("titulo-historial-producto");
    const sidebar = document.getElementById("historial-contenedor-producto");
    const overlay = document.getElementById("overlay-historial-producto");

    lista.innerHTML = "";
    titulo.textContent = `Historial de ${selectedProductName}`;

    if (!data || data.length === 0) {
        lista.innerHTML = `<li class='list-group-item text-muted'>Sin movimientos</li>`;
    } else {
        data.forEach((mov) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-start";
            li.innerHTML = `
          <div>
            <strong class="text-${mov.tipo_movimiento === "entrada" ? "success" : "danger"}">
              ${mov.tipo_movimiento.toUpperCase()}
            </strong>
            <div class="small">${mov.descripcion || "(Sin comentario)"}</div>
          </div>
          <div class="text-end">
            <span class="fw-bold">${parseFloat(mov.cantidad).toFixed(2)}</span><br/>
            <small class="text-muted">${new Date(mov.created_at).toLocaleString()}</small>
          </div>
        `;
            lista.appendChild(li);
        });
    }

    // Mostrar sidebar y overlay
    sidebar.classList.add("mostrar");
    overlay.classList.add("mostrar");
}

export function cerrarHistorialProducto() {
    document.getElementById("historial-contenedor-producto").classList.remove("mostrar");
    document.getElementById("overlay-historial-producto").classList.remove("mostrar");
    document.body.classList.remove("bloquear-scroll"); // ✅ Restaurar scroll
}
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarHistorialProducto();
});
document.getElementById("btn-cerrar-historial-producto").addEventListener("click", cerrarHistorialProducto);


//busqueda
document.getElementById("buscarProducto").addEventListener("input", function () {
    const texto = this.value.toLowerCase();
    const filas = document.querySelectorAll("#tabla-productos tr");
    filas.forEach(fila => {
        const nombre = fila.children[0].textContent.toLowerCase();
        fila.style.display = nombre.includes(texto) ? "" : "none";
    });
});


document.getElementById("filtroCategoria").addEventListener("change", function () {
    const categoriaSeleccionada = this.value.toLowerCase();
    const filas = document.querySelectorAll("#tabla-productos tr");
    filas.forEach(fila => {
        const categoria = fila.dataset.categoria?.toLowerCase();
        fila.style.display = !categoriaSeleccionada || categoria === categoriaSeleccionada ? "" : "none";
    });
});


document.getElementById("ordenarStock").addEventListener("change", function () {
    const orden = this.value;
    const tbody = document.getElementById("tabla-productos");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
        const stockA = parseFloat(a.children[1].textContent);
        const stockB = parseFloat(b.children[1].textContent);
        return orden === "asc" ? stockA - stockB : stockB - stockA;
    });

    filas.forEach(fila => tbody.appendChild(fila));
});
