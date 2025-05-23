import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let graficaMCP, graficaBarras, debounceTimer;
let utilidad = 0;  // Definir utilidad globalmente
let sugerenciasHtml = "";

export async function cargarReportePuntoEquilibrio() {
  try {
    // 1. Obtener productos activos (precio venta y costo variable)
    const { data: productos } = await supabase
      .from("productos")
      .select("id, nombre, precio, precio_unitario");

    // 2. Obtener sueldos
    const { data: empleados } = await supabase
      .from("empleados")
      .select("sueldo");

    const totalSueldos = empleados.reduce((sum, emp) => sum + (emp.sueldo || 0), 0);

    // 3. Obtener costos fijos
    const { data: costosFijosData, error: errorCostos } = await supabase
      .from("costos_fijos")
      .select("id, tipo, monto");

    if (errorCostos) {
      console.warn("⚠️ Error al obtener costos fijos:", errorCostos);
    }

    // 4. Obtener ventas reales por producto (solo pedidos pagados)
    const { data: ventasProductos } = await supabase
      .from("pedido_productos")
      .select("producto_id, cantidad")
      .in("pedido_id",
        await supabase
          .from("pedidos")
          .select("id")
          .eq("estado", "pagado")
          .then(res => res.data.map(p => p.id))
      );

    // Mapear cantidades vendidas por producto
    const ventasPorProducto = {};
    (ventasProductos || []).forEach(v => {
      if (!ventasPorProducto[v.producto_id]) ventasPorProducto[v.producto_id] = 0;
      ventasPorProducto[v.producto_id] += v.cantidad;
    });

    // Calcular total ventas reales
    const totalVentasReales = productos.reduce((sum, p) => {
      const cantidadVendida = ventasPorProducto[p.id] || 0;
      return sum + cantidadVendida * (p.precio ?? 0);
    }, 0);

    // Construir array productos con datos calculados
    const productosConDatos = productos.map(p => {
      const cantidadVendida = ventasPorProducto[p.id] || 0;
      const ingreso = cantidadVendida * (p.precio ?? 0);
      const costoVariable = cantidadVendida * (p.precio_unitario ?? 0);
      //  const margenContribucion = p.precio - p.precio_unitario;
      const margenUnitario = (p.precio ?? 0) - (p.precio_unitario ?? 0);
      const margenContribucion = margenUnitario * cantidadVendida;
      //  const margenContribucion = ingreso - costoVariable;
      console.log(margenContribucion, p.precio, p.precio_unitario);
      //   const proporcion = totalVentasReales > 0 ? ingreso / totalVentasReales : 0;

      const proporcion = totalVentasReales > 0 ? ingreso / totalVentasReales : 0;
      const mcPonderado = margenUnitario * proporcion;


      return {
        /* ...p,
         cantidadVendida,
         ingreso,
         costoVariable,
         margenContribucion,
         proporcion,
         mcPonderado: margenContribucion * proporcion,*/
        ...p,
        cantidadVendida,
        ingreso,
        costoVariable,
        margenUnitario,
        margenContribucion,
        proporcion,
        mcPonderado,
      };
    });

    const totalCostosFijos = totalSueldos + (costosFijosData?.reduce((sum, item) => sum + (item.monto || 0), 0) ?? 0);
    const MCP = productosConDatos.reduce((sum, p) => sum + p.mcPonderado, 0);

    const listaCostos = document.getElementById("lista-costos-fijos");
    listaCostos.innerHTML = "";

    // 🎯 Mostrar sueldos primero
    const liSueldos = document.createElement("li");
    liSueldos.className = "list-group-item d-flex justify-content-between align-items-center";
    liSueldos.innerHTML = `
      <span><i class="fas fa-user-tie me-2 text-info"></i>Sueldos del personal </span>
      <span class="fw-bold text-end">${totalSueldos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
    `;
    listaCostos.appendChild(liSueldos);

    // 🎯 Mostrar costos fijos ordenados con íconos personalizados
    const iconosPorTipo = {
      renta: "fas fa-building text-warning",
      luz: "fas fa-bolt text-warning",
      agua: "fas fa-tint text-primary",
      internet: "fas fa-wifi text-info",
      mantenimiento: "fas fa-tools text-secondary",
      publicidad: "fas fa-bullhorn text-danger",
      gasolina: "fas fa-gas-pump text-success",
      transporte: "fas fa-truck text-dark",
      plastico: "fas fa-recycle text-muted",
      default: "fas fa-tag text-muted"
    };

    if (costosFijosData && costosFijosData.length > 0) {
      costosFijosData
        .sort((a, b) => a.tipo.localeCompare(b.tipo))
        .forEach(c => {
          const tipoLower = c.tipo.toLowerCase();
          const icono = iconosPorTipo[tipoLower] || iconosPorTipo.default;
          const li = document.createElement("li");
          li.className = "list-group-item d-flex justify-content-between align-items-center costo-fijo-item";
          li.setAttribute("data-id", c.id); // para identificar el costo fijo
          li.setAttribute("data-tipo", c.tipo);
          li.setAttribute("data-monto", c.monto);
          li.innerHTML = `
            <span><i class="${icono} me-2"></i>${c.tipo}</span>
            <span class="fw-bold text-end">
              ${(c.monto ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </span>
          `;
          listaCostos.appendChild(li);
        });
    }
    prepararEdicionCostosFijos();

    if (!costosFijosData || costosFijosData.length === 0) {
      const liVacio = document.createElement("li");
      liVacio.className = "list-group-item text-muted";
      liVacio.textContent = "No hay costos fijos registrados aún.";
      listaCostos.appendChild(liVacio);
    }


    // Insertar input para utilidad deseada arriba del resultado (solo una vez)
    const contenedor = document.getElementById("resultado-pe").parentElement;
    if (!document.getElementById("inputUtilidad")) {
      const inputHTML = `
        <div class="mt-3 d-flex align-items-center gap-2">
          <label for="inputUtilidad" class="mb-0 fw-semibold">Utilidad deseada ($):</label>
          <input type="number" id="inputUtilidad" class="form-control form-control-sm" placeholder="0" min="0" style="max-width: 150px;">
        </div>
      `;
      contenedor.insertAdjacentHTML("beforeend", inputHTML);

      // Evento con debounce para recalcular al cambiar utilidad
      // Evento con debounce para recalcular al cambiar utilidad
      document.getElementById("inputUtilidad")?.addEventListener("input", e => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const valor = parseFloat(e.target.value);
          utilidad = isNaN(valor) ? 0 : valor;
          calcularYRenderizar(utilidad);
        }, 400);
      });
    }

    // Función que calcula y renderiza resultados (margen, PE, gráficas, desglose)
    function calcularYRenderizar(utilidad = 0) {
      const puntoEquilibrio = MCP > 0 ? totalCostosFijos / MCP : 0;
      const puntoConUtilidad = utilidad > 0 ? puntoEquilibrio + utilidad / MCP : puntoEquilibrio;

      document.getElementById("costosFijosTotal").innerText =
        totalCostosFijos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

      document.getElementById("resultado-pe").innerHTML =
        MCP > 0
          ? `
      <p>Punto de equilibrio (sin utilidad): <strong>${puntoEquilibrio.toLocaleString()}</strong> unidades</p>
      <p>Punto de equilibrio (con utilidad deseada): <strong>${puntoConUtilidad.toLocaleString()}</strong> unidades</p>
    `
          : "No se puede calcular (MCP = 0)";


      sugerenciasHtml = ""; // reset

      // 1. Productos sin ventas
      const sinVentas = productosConDatos.filter(p => p.cantidadVendida === 0);
      if (sinVentas.length > 0) agregarSugerencia("warning", "fas fa-eye-slash",
        `Algunos productos no tienen ventas registradas. Revisa su visibilidad o promoción:
    <ul class='mb-0 small'>${sinVentas.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join("")}</ul>`);

      // 2. Margen de contribución negativo
      const margenNegativo = productosConDatos.filter(p => p.margenContribucion < 0);
      if (margenNegativo.length > 0) agregarSugerencia("danger", "fas fa-minus-circle",
        `Estos productos generan pérdidas. Su costo es mayor que su precio:
    <ul class='mb-0 small'>${margenNegativo.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join("")}</ul>`);

      // 3. Margen muy bajo (<10%)
      const margenBajo = productosConDatos.filter(p => p.precio > 0 && (p.margenUnitario / p.precio) < 0.1);
      if (margenBajo.length > 0) agregarSugerencia("warning", "fas fa-compress-alt",
        `Algunos productos tienen un margen muy bajo. Evalúa si es rentable mantenerlos:` +
        `<ul class='mb-0 small'>${margenBajo.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join("")}</ul>`);

      // 4. Mezcla menor al 2%
      const bajaParticipacion = productosConDatos.filter(p => p.proporcion < 0.02 && p.cantidadVendida > 0);
      if (bajaParticipacion.length > 0) agregarSugerencia("info", "fas fa-percent",
        `Algunos productos tienen muy baja participación en las ventas:
    <ul class='mb-0 small'>${bajaParticipacion.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join("")}</ul>`);

      // 5. Costo > Precio
      const precioMenorCosto = productosConDatos.filter(p => p.precio_unitario > p.precio);
      if (precioMenorCosto.length > 0) agregarSugerencia("danger", "fas fa-balance-scale-left",
        `Estos productos tienen un costo mayor que su precio:
    <ul class='mb-0 small'>${precioMenorCosto.slice(0, 5).map(p => `<li>${p.nombre}</li>`).join("")}</ul>`);

      // 6. Producto estrella
      const topProducto = productosConDatos.reduce((prev, current) =>
        (prev.mcPonderado ?? 0) > (current.mcPonderado ?? 0) ? prev : current, {});
      if (topProducto.nombre) agregarSugerencia("success", "fas fa-star",
        `El producto con mayor rentabilidad y mezcla es: <strong>${topProducto.nombre}</strong>. Potencia su visibilidad.`);


      // Renderizar componentes (tabla, gráficas, desglose)
      renderizarTablaProductos(productosConDatos);
      renderizarDesgloseFinal(productosConDatos, puntoConUtilidad);
      renderizarGraficaMCP(productosConDatos);
      renderizarGraficaBarras(productosConDatos, puntoConUtilidad);
      // Mostrar botón de sugerencias si hay contenido
      const btnSugerencias = document.getElementById("btn-ver-sugerencias");
      if (btnSugerencias) btnSugerencias.classList.toggle("d-none", sugerenciasHtml.trim() === "");

    }

    // Calcular inicialmente sin utilidad
    calcularYRenderizar(0);

  } catch (err) {
    console.error("Error al cargar el reporte de punto de equilibrio:", err);
    mostrarToast("Error al generar reporte", "error");
  }
}

function agregarSugerencia(tipo = "info", icono = "fas fa-info-circle", htmlTexto) {
  sugerenciasHtml += `
    <div class="alert alert-${tipo} d-flex align-items-start gap-2">
      <i class="${icono} mt-1"></i>
      <div>${htmlTexto}</div>
    </div>`;
}

// Modal para mostrar sugerencias (puede llamarse desde botón)
document.getElementById("btn-ver-sugerencias")?.addEventListener("click", () => {
  // console.log("📦 Sugerencias actuales:", sugerenciasHtml);

  Swal.fire({
    title: "Sugerencias del sistema",
    html: sugerenciasHtml || "<p class='text-muted'>No hay sugerencias en este momento.</p>",
    width: 700,
    confirmButtonText: "Entendido",
    showCloseButton: true
  });
});


// Función para evitar duplicados en desglose final y hacer que sea plegable
function renderizarDesgloseFinal(productos, puntoEquilibrio) {
  const contenedor = document.getElementById("resultado-pe").parentElement;

  // Eliminar desgloses previos completamente
  const desglosesPrevios = contenedor.querySelectorAll(".desglose-container");
  desglosesPrevios.forEach(el => el.remove());

  // Crear nuevo contenedor para el desglose
  const desgloseContainer = document.createElement("div");
  desgloseContainer.className = "desglose-container mt-3";

  // Crear botón de colapso con flecha
  const collapseBtnId = `collapseDesglose-${Date.now()}`;
  desgloseContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <strong>Desglose por producto:</strong>
      <button class="btn btn-sm btn-outline-secondary d-flex align-items-center rounded-pill" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseBtnId}" aria-expanded="false" aria-controls="${collapseBtnId}">
        <i class="fas fa-chevron-down me-2 rotate-icon"></i> Ver detalles
      </button>
    </div>
    <div class="collapse" id="${collapseBtnId}">
      <ul class="mt-2 ps-3">
        ${productos.map(p => {
    const unidades = puntoEquilibrio * (p.proporcion ?? 0);
    return `<li>${p.nombre}: <strong>${unidades.toFixed(0)}</strong> unidades</li>`;
  }).join("")}
      </ul>
    </div>
  `;

  // Insertar el nuevo desglose
  contenedor.appendChild(desgloseContainer);

  // Configurar eventos para la flecha del botón
  const collapseBtn = desgloseContainer.querySelector(`[data-bs-target="#${collapseBtnId}"]`);
  const rotateIcon = collapseBtn.querySelector(".rotate-icon");
  const collapseEl = desgloseContainer.querySelector(`#${collapseBtnId}`);

  collapseEl.addEventListener("shown.bs.collapse", () => {
    rotateIcon.classList.add("rotado");
  });
  collapseEl.addEventListener("hidden.bs.collapse", () => {
    rotateIcon.classList.remove("rotado");
  });
}


function renderizarTablaProductos(productos) {
  const cuerpo = document.getElementById("tabla-mezcla-productos");
  cuerpo.innerHTML = productos.map(p => {
    const precio = p.precio ?? 0;
    const precioUnitario = p.precio_unitario ?? 0;
    const margen = p.margenUnitario ?? 0;
    const proporcion = p.proporcion ?? 0;

    return `
      <tr>
        <td>${p.nombre}</td>
        <td>$${precio.toFixed(2)}</td>
        <td>$${precioUnitario.toFixed(2)}</td>
        <td>$${margen.toFixed(2)}</td>
        <td>${(proporcion * 100).toFixed(1)}%</td>
      </tr>
    `;
  }).join("");
}

function renderizarGraficaMCP(productos) {
  const canvas = document.getElementById("graficaMezcla");
  const loader = document.getElementById("loadingChart");

  if (!canvas || !loader) {
    console.warn("No se encontró el canvas o el loader.");
    return;
  }

  if (graficaMCP) graficaMCP.destroy();

  loader.classList.remove("d-none");
  canvas.classList.add("d-none");

  setTimeout(() => {
    const ctx = canvas.getContext("2d");
    graficaMCP = new Chart(ctx, {
      type: "pie",
      data: {
        labels: productos.map(p => p.nombre),
        datasets: [{
          label: "Proporción en mezcla",
          data: productos.map(p => p.proporcion),
          backgroundColor: productos.map(() => randomColor()),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 1500,
          easing: "easeOutElastic"
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, padding: 20 }
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${(ctx.parsed * 100).toFixed(1)}%`
            }
          }
        }
      }
    });
    loader.classList.add("d-none");
    canvas.classList.remove("d-none");
  }, 800);
}

function renderizarGraficaBarras(productos, puntoEquilibrio) {
  let container = document.getElementById("graficaBarrasContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "graficaBarrasContainer";
    container.className = "card mt-4 shadow-sm";
    container.innerHTML = `
      <div class="position-relative mx-auto" style="max-width: 100%; height: 400px">
        <h5 class="card-title mb-3">
          <i class="fas fa-chart-bar me-2"></i> Unidades a vender por producto
        </h5>
        <canvas id="graficaBarras" class="w-100 h-100"></canvas>
      </div>
    `;
    document.querySelector("#reportes .container").appendChild(container);
  }

  const ctx = container.querySelector("#graficaBarras").getContext("2d");

  if (graficaBarras) graficaBarras.destroy();

  graficaBarras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: productos.map(p => p.nombre),
      datasets: [{
        label: "Unidades necesarias",
        data: productos.map(p => Math.round(p.proporcion * puntoEquilibrio)),
        backgroundColor: productos.map(() => randomColor())
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: "easeInOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y} unidades`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}


function randomColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 70%, 70%)`;
}

document.getElementById("btn-agregar-costo-fijo")?.addEventListener("click", abrirModalAgregarCostoFijo);

export async function abrirModalAgregarCostoFijo() {
  const { value: formValues } = await Swal.fire({
    title: "Agregar nuevo costo fijo",
    html: `
      <div class="mb-2 text-start">
        <label for="tipo-nuevo" class="form-label">Tipo o concepto</label>
        <input type="text" id="tipo-nuevo" class="form-control" placeholder="Ej. Renta, Luz, Agua">
      </div>
      <div class="mb-2 text-start">
        <label for="monto-nuevo" class="form-label">Monto mensual ($)</label>
        <input type="number" id="monto-nuevo" class="form-control" placeholder="Ej. 1000" step="0.01">
      </div>
    `,
    confirmButtonText: "Agregar",
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => {
      const tipo = document.getElementById("tipo-nuevo").value.trim();
      const monto = parseFloat(document.getElementById("monto-nuevo").value);
      if (!tipo || isNaN(monto)) {
        Swal.showValidationMessage("Por favor completa ambos campos correctamente");
        return false;
      }
      return { tipo, monto };
    }
  });

  if (formValues) {
    const { error } = await supabase.from("costos_fijos").insert({
      tipo: formValues.tipo,
      monto: formValues.monto
    });

    if (error) {
      mostrarToast("❌ Error al agregar costo fijo", "error");
    } else {
      mostrarToast("✅ Costo fijo agregado", "success");
      cargarReportePuntoEquilibrio();
    }
  }
}

// Rotar flecha en botón de colapsar
document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(btn => {
  const icono = btn.querySelector(".rotate-icon");
  const targetId = btn.getAttribute("data-bs-target");

  const collapseEl = document.querySelector(targetId);
  if (!collapseEl) return;

  collapseEl.addEventListener("shown.bs.collapse", () => {
    icono.classList.add("rotado");
  });
  collapseEl.addEventListener("hidden.bs.collapse", () => {
    icono.classList.remove("rotado");
  });
});

// Referencia al botón y spinner
const btnActualizar = document.getElementById("btn-actualizar-mezcla");
const originalBtnHTML = btnActualizar?.innerHTML;

if (btnActualizar) {
  btnActualizar.addEventListener("click", async () => {
    btnActualizar.disabled = true;
    btnActualizar.innerHTML = `<span class='spinner-border spinner-border-sm me-2'></span> Actualizando...`;
    await cargarReportePuntoEquilibrio();
    btnActualizar.innerHTML = originalBtnHTML;
    btnActualizar.disabled = false;
    mostrarToast("✅ Mezcla de productos actualizada", "success");
  });
}

// Evento delegado para editar/eliminar costo fijo con SweetAlert
function prepararEdicionCostosFijos() {
  const ul = document.getElementById("lista-costos-fijos");
  if (!ul) return;

  // Evita múltiples listeners
  ul.removeEventListener("click", handleCostoFijoClick);
  ul.addEventListener("click", handleCostoFijoClick);
}

async function handleCostoFijoClick(e) {
  // Busca el <li> clickeado
  let li = e.target;
  // Si clickean un span o icono, sube al li
  while (li && li.tagName !== "LI") li = li.parentElement;
  if (!li || !li.classList.contains("costo-fijo-item")) return;

  const id = li.getAttribute("data-id");
  console.log(id)
  const tipo = li.getAttribute("data-tipo");
  const monto = li.getAttribute("data-monto");

  // SweetAlert para editar/eliminar
  const result = await Swal.fire({
    title: `Editar "${tipo}"`,
    html: `
      <p class="mb-2">Monto actual: <strong>${parseFloat(monto).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong></p>
      <label class="form-label">Nuevo monto</label>
      <input id="nuevo-monto" class="form-control" type="number" step="0.01" min="0" value="${monto}">
    `,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Guardar cambios",
    denyButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const nuevoMonto = parseFloat(document.getElementById("nuevo-monto").value);
      if (isNaN(nuevoMonto) || nuevoMonto < 0) {
        Swal.showValidationMessage("Ingresa un monto válido");
        return false;
      }
      return { tipo, nuevoMonto };
    }
  });

  // Si presiona "Eliminar"
  if (result.isDenied) {
    const { isConfirmed } = await Swal.fire({
      title: `¿Eliminar "${tipo}"?`,
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No"
    });
    if (isConfirmed) {
      const { error } = await supabase.from("costos_fijos").delete().eq("id", id);
      if (error) {
        mostrarToast("❌ Error al eliminar", "error");
      } else {
        mostrarToast("✅ Costo fijo eliminado", "success");
        cargarReportePuntoEquilibrio();
      }
    }
    return;
  }

  // Si confirma edición
  if (result.isConfirmed && result.value) {
    const { nuevoMonto } = result.value;
    const { error } = await supabase.from("costos_fijos").update({ monto: nuevoMonto }).eq("id", id);
    if (error) {
      mostrarToast("❌ Error al actualizar", "error");
    } else {
      mostrarToast("✅ Costo fijo actualizado", "success");
      cargarReportePuntoEquilibrio();
    }
  }
}