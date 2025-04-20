// ✅ VARIABLES Y CONFIG
import { supabase } from "./supabase-config.js";
import { mostrarToast, showLoading, hideLoading } from "./manageError.js";

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
    //  cargarInventarioProductos();
    setupProductRowSelection();
    cargarCategorias();

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
    showLoading();
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
    actualizarBadgesFiltro();
    hideLoading();
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
    const btn = formEntrada.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    const productoId = document.getElementById("producto-select").value;
    const cantidad = parseFloat(document.getElementById("cantidad-producto").value);
    const comentario = document.getElementById("comentario-produccion").value.trim();
    try {
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
            // console.log("📦 Ingredientes cargados:", ingredientes);

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
            // console.log(nuevoStock)
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
        selectedProductStock = nuevoStock;
        mostrarToast("✅ Producción registrada con éxito", "success");
        bootstrap.Modal.getInstance(document.getElementById("modalEntradaProducto")).hide();
        document.getElementById("form-entrada-producto").reset();
        cargarInventarioProductos();
    } catch (error) {
        console.error("❌ Error al registrar:", error);
        mostrarToast("❌ Error al guardar producción", "error");
    } finally {
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = 'Registrar Producción';
    }
}

//document.getElementById("form-entrada-producto")?.addEventListener("submit", registrarEntradaProducto);
// Asignar evento
const formEntrada = document.getElementById("form-entrada-producto");
if (formEntrada) {
    formEntrada.addEventListener("submit", registrarEntradaProducto);
}


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
    try {
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
        selectedProductStock = nuevoStock;
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
    } catch (error) {
        console.error("❌ Error al restar:", error);
        mostrarToast("❌ Error al restar producción", "error");
    } finally {
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = 'Restando Producción';
    }
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

    // 🧮 Contar entradas y salidas
    let totalEntradas = 0;
    let totalSalidas = 0;

    data.forEach(mov => {
        if (mov.tipo_movimiento === "entrada") totalEntradas += mov.cantidad;
        if (mov.tipo_movimiento === "salida") totalSalidas += mov.cantidad;
    });

    const resumen = document.getElementById("resumen-historial-producto");
    resumen.innerHTML = `
    <span class="text-success me-3">+${totalEntradas.toFixed(2)} Entradas</span>
    <span class="text-danger">-${totalSalidas.toFixed(2)} Salidas</span>
    `;

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
document.getElementById("overlay-historial-producto").addEventListener("click", cerrarHistorialProducto);

export function cerrarHistorialProducto() {
    document.getElementById("historial-contenedor-producto").classList.remove("mostrar");
    document.getElementById("overlay-historial-producto").classList.remove("mostrar");
    document.body.classList.remove("bloquear-scroll"); // ✅ Restaurar scroll
}
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarHistorialProducto();
});
document.getElementById("btn-cerrar-historial-producto").addEventListener("click", cerrarHistorialProducto);

// Función mejorada para cargar categorías
async function cargarCategorias() {
    const selectCategoria = document.getElementById('filtroCategoria');
    
    // Mostrar estado de carga
    selectCategoria.disabled = true;
    selectCategoria.innerHTML = '<option value="">Cargando categorías...</option>';
  
    try {
      const { data: categorias, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre', { ascending: true });
  
      if (error) throw error;
  
      // Limpiar y llenar el select
      selectCategoria.innerHTML = '<option value="">Todas</option>';
      
      if (categorias.length === 0) {
        selectCategoria.innerHTML = '<option value="">No hay categorías</option>';
        return;
      }
  
      categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.nombre;
        option.textContent = categoria.nombre;
        selectCategoria.appendChild(option);
      });
  
      selectCategoria.disabled = false;
  
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      selectCategoria.innerHTML = '<option value="">Error al cargar</option>';
      
      // Opcional: Reintentar después de 5 segundos
      setTimeout(cargarCategorias, 5000);
    }
  }
//-----------Filtros-------------

const filtros = {
    buscar: document.getElementById("buscarProducto"),
    categoria: document.getElementById("filtroCategoria"),
    ordenarStock: document.getElementById("ordenarStock"),
    ordenarNombre: document.getElementById("ordenarNombre"),
    limpiarBtn: document.getElementById("btn-limpiar-filtros")
};

// Habilitar/deshabilitar botón según si hay filtros activos
function actualizarEstadoBotonLimpiar() {
    const hayFiltros =
        filtros.buscar.value.trim() !== "" ||
        filtros.categoria.value !== "" ||
        filtros.ordenarStock.value !== "desc" ||
        filtros.ordenarNombre.value !== "az";

    if (hayFiltros) {
        filtros.limpiarBtn.classList.remove("disabled");
        filtros.limpiarBtn.removeAttribute("disabled");
    } else {
        filtros.limpiarBtn.classList.add("disabled");
        filtros.limpiarBtn.setAttribute("disabled", true);
    }
    actualizarBadgesFiltro()
}

// Escuchar cambios en los filtros
[filtros.buscar, filtros.categoria, filtros.ordenarStock, filtros.ordenarNombre].forEach(el =>
    el.addEventListener("input", actualizarEstadoBotonLimpiar)
);

// Evento para limpiar filtros
filtros.limpiarBtn.addEventListener("click", async () => {
    if (filtros.limpiarBtn.classList.contains("disabled")) return;

    const originalIcon = filtros.limpiarBtn.innerHTML;
    filtros.limpiarBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Limpiando...`;
    filtros.limpiarBtn.setAttribute("disabled", true);


    // Simular un pequeño delay visual (700ms)
    setTimeout(async () => {
        // Limpiar valores
        filtros.buscar.value = "";
        filtros.categoria.value = "";
        filtros.ordenarStock.value = "desc";
        filtros.ordenarNombre.value = "az";

        await cargarInventarioProductos(); // Recargar tabla

        // Animación visual
        animarTablaProductos();

        filtros.limpiarBtn.innerHTML = originalIcon;
        filtros.limpiarBtn.classList.add("disabled");
        filtros.limpiarBtn.setAttribute("disabled", true);
    }, 500);
});

function animarTablaProductos() {
    const tabla = document.getElementById("tabla-productos");
    tabla.classList.add("resaltar-tabla");

    // Quitar clase después de la animación
    setTimeout(() => {
        tabla.classList.remove("resaltar-tabla");
    }, 1000);
}


document.getElementById("buscarProducto").addEventListener("input", function () {
    const texto = this.value.toLowerCase();
    const filas = document.querySelectorAll("#tabla-productos tr");
    filas.forEach(fila => {
        const nombre = fila.children[1].textContent.toLowerCase();
        fila.style.display = nombre.includes(texto) ? "" : "none";
    });

});


document.getElementById("filtroCategoria").addEventListener("change", function () {
    const categoriaSeleccionada = this.value.toLowerCase();
    const filas = document.querySelectorAll("#tabla-productos tr");
    
    // Saltar la fila de encabezado si existe
    filas.forEach(fila => {
        // Asume que la categoría está en la primera columna (children[0])
        const categoria = fila.children[0]?.textContent.toLowerCase();
        
        // Mostrar fila si coincide con la categoría seleccionada o si no hay selección
        if (!categoriaSeleccionada || categoria === categoriaSeleccionada) {
            fila.style.display = "";
        } else {
            fila.style.display = "none";
        }
    });
    
    actualizarBadgesFiltro();
});

document.getElementById("ordenarStock").addEventListener("change", function () {
    const orden = this.value;
    const tbody = document.getElementById("tabla-productos");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
        const stockA = parseFloat(a.children[2].textContent);
        const stockB = parseFloat(b.children[2].textContent);
        return orden === "asc" ? stockA - stockB : stockB - stockA;
    });

    filas.forEach(fila => tbody.appendChild(fila));
    actualizarBadgesFiltro()
});

document.getElementById("ordenarNombre").addEventListener("change", function () {
    const orden = this.value;
    const tbody = document.getElementById("tabla-productos");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
        const nombreA = a.children[0].textContent.toLowerCase();
        const nombreB = b.children[0].textContent.toLowerCase();
        return orden === "az" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    });

    filas.forEach(fila => tbody.appendChild(fila));
    actualizarBadgesFiltro()
});

function actualizarBadgesFiltro() {
    const categoria = document.getElementById("filtroCategoria").value;
    const stock = document.getElementById("ordenarStock").value;
    const nombre = document.getElementById("ordenarNombre").value;

    let hayFiltros = false;

    // Categoría
    const badgeCategoria = document.getElementById("badge-categoria");
    if (categoria && categoria !== "") {
        badgeCategoria.querySelector("span").textContent = categoria;
        badgeCategoria.classList.remove("d-none");
        hayFiltros = true;
    } else {
        badgeCategoria.classList.add("d-none");
    }

    // Stock
    const badgeStock = document.getElementById("badge-stock");
    if (stock) {
        badgeStock.querySelector("span").textContent =
            stock === "asc" ? "Menor a mayor" : "Mayor a menor";
        badgeStock.classList.remove("d-none");
        hayFiltros = true;
    } else {
        badgeStock.classList.add("d-none");
    }

    // Nombre
    const badgeNombre = document.getElementById("badge-nombre");
    if (nombre) {
        badgeNombre.querySelector("span").textContent =
            nombre === "az" ? "A - Z" : "Z - A";
        badgeNombre.classList.remove("d-none");
        hayFiltros = true;
    } else {
        badgeNombre.classList.add("d-none");
    }

    // Mostrar o esconder contenedor
    const contenedor = document.getElementById("filtros-activos");
    contenedor.style.display = hayFiltros ? "block" : "none";
}
