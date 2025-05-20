import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

let graficaMCP;

export async function cargarReportePuntoEquilibrio() {
    try {
        // 1. Obtener productos activos (precio venta y variable estimado)
        const { data: productos } = await supabase.from("productos").select("id, nombre, precio, precio_unitario");

        // 2. Obtener total sueldos
        const { data: empleados } = await supabase.from("empleados").select("sueldo");
        const totalSueldos = empleados.reduce((sum, emp) => sum + (emp.sueldo || 0), 0);

        // 3. Obtener costos fijos adicionales
        const { data: costosFijosData, error: errorCostos } = await supabase
            .from("costos_fijos")
            .select("tipo, monto");

        if (errorCostos) {
            console.warn("⚠️ Error al obtener costos fijos:", errorCostos);
        }

        const costosFijosExtras = (costosFijosData || []).reduce((sum, item) => sum + (item.monto || 0), 0);


        const totalCostosFijos = totalSueldos + costosFijosExtras;

        // 4. Calcular MCP y proporción de cada producto
        const totalVentas = productos.reduce((sum, p) => sum + (p.precio || 0), 0);

        const productosConDatos = productos.map(p => {
            const ingreso = p.precio;
            const costoVariable = p.precio_unitario;
            const margenContribucion = (ingreso ?? 0) - (costoVariable ?? 0);
            const proporcion = totalVentas > 0 ? (ingreso ?? 0) / totalVentas : 0;

            return {
                ...p,
                ingreso,
                costoVariable,
                margenContribucion,
                proporcion,
                mcPonderado: margenContribucion * proporcion,
            };
        });

        const MCP = productosConDatos.reduce((sum, p) => sum + p.mcPonderado, 0);
        const puntoEquilibrio = MCP > 0 ? totalCostosFijos / MCP : 0;

        // Mostrar en UI
        document.getElementById("costosFijosTotal").innerText = `$${totalCostosFijos.toFixed(2)}`;
        document.getElementById("resultado-pe").innerText = MCP > 0
            ? `Punto de equilibrio mezcla: $${puntoEquilibrio.toFixed(2)}`
            : "No se puede calcular (MCP = 0)";

        renderizarTablaProductos(productosConDatos);
        renderizarGraficaMCP(productosConDatos);
    } catch (err) {
        console.error("Error al cargar el reporte de punto de equilibrio:", err);
        mostrarToast("Error al generar reporte", "error");
    }
}

function renderizarTablaProductos(productos) {
    const cuerpo = document.getElementById("tabla-mezcla-productos");
    cuerpo.innerHTML = productos.map(p => {
        const precio = p.precio ?? 0;
        const precioUnitario = p.precio_unitario ?? 0;
        const margen = p.margenContribucion ?? 0;
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

  // Reset por si ya existe
  if (graficaMCP) graficaMCP.destroy();

  // Mostrar loading y ocultar canvas
  loader.classList.remove("d-none");
  canvas.classList.add("d-none");

  // Tiempo de espera opcional para simular carga (puedes quitarlo)
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
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${(ctx.parsed * 100).toFixed(1)}%`
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });

    // Mostrar canvas y ocultar loader
    loader.classList.add("d-none");
    canvas.classList.remove("d-none");
  }, 800);
}

// Color random suave para cada porción
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

document.getElementById("editarCostosFijos").addEventListener("click", abrirModalEditarCostosFijos);
// Modal para editar costos fijos
export async function abrirModalEditarCostosFijos() {
    const { data } = await supabase.from("costos_fijos").select("id, tipo, monto");

    const formHTML = data.map(c => `
    <div class="mb-2">
      <label class="form-label">${c.tipo}</label>
      <input type="number" class="form-control" id="costo-${c.id}" value="${c.monto}" step="0.01">
    </div>`).join("");

    const { isConfirmed } = await Swal.fire({
        title: "Editar Costos Fijos",
        html: `<form id="formEditarCostos">${formHTML}</form>`,
        confirmButtonText: "Guardar",
        showCancelButton: true,
        customClass: {
            confirmButton: "btn btn-success",
            cancelButton: "btn btn-secondary"
        },
        buttonsStyling: false,
        preConfirm: async () => {
            for (const c of data) {
                const input = document.getElementById(`costo-${c.id}`);
                const nuevoMonto = parseFloat(input.value);
                if (!isNaN(nuevoMonto)) {
                    await supabase.from("costos_fijos").update({ monto: nuevoMonto }).eq("id", c.id);
                }
            }
            mostrarToast("Costos actualizados", "success");
            cargarReportePuntoEquilibrio();
        }
    });
}
