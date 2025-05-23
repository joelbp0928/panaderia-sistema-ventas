// Archivo: estadisticas.js
import { supabase } from "./supabase-config.js";
import { formatearFecha } from "./formatearFecha.js";
import { showLoading, hideLoading } from "./manageError.js";

let salesChart;

// Inicia la carga de estadísticas con efecto loader y animación
export async function cargarEstadisticas() {
  showLoading();
  // setTimeout(() => {
  //   document.getElementById("loader").style.display = "none";

  document.getElementById("stats-period").value = "daily";
  updateSalesStats();
  updateSalesChart();
  updateTopProductsList();
  await updateTopProductsChart();
  await updateSalesByCategoryChart();
  updateTopSalesHour();
  updateTopSalesDate();

  hideLoading();
  //  }, 1200); // Delay para mostrar el spinner animado
}

// Escucha cambios en el selector de periodo
const selector = document.getElementById("stats-period");
if (selector) {
  selector.addEventListener("change", () => {
    // document.getElementById("click-sound").play();
    updateSalesChart();
    updateSalesStats();
    updateTopProductsList();

  });
}

// Actualiza el gráfico principal de ventas
async function updateSalesChart() {
  const period = document.getElementById("stats-period").value;
  const salesData = await fetchSalesData(period);

  console.log("Sales Data:", salesData);
  
  // Ordenar por fecha (por si acaso)
  if (period === 'daily') {
    salesData.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
  }

  const labels = salesData.map(item => item.label);
  const sales = salesData.map(item => item.sales);
  const ctx = document.getElementById('sales-chart').getContext('2d');

  if (salesChart) salesChart.destroy();

  salesChart = new Chart(ctx, {
    type: period === 'monthly' ? 'bar' : 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventas',
        data: sales,
        borderColor: '#4bc0c0',
        backgroundColor: period === 'monthly' ? '#4bc0c0' : '#4bc0c055',
        fill: period !== 'monthly',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: sales.map(s => s === 0 ? 3 : 4), // Puntos más grandes para días con ventas
        pointBackgroundColor: sales.map(s => s === 0 ? '#cccccc' : '#4bc0c0') // Color diferente para días sin ventas
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const value = tooltipItem.raw;
              if (value === 0) {
                return 'Sin ventas registradas';
              }
              return `Ventas: ${value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`;
            }
          },
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return `${value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`;
            }
          }
        },
        x: { 
          beginAtZero: true,
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10 // Mostrar máximo 10 etiquetas en el eje X
          }
        }
      }
    }
  });
}

// Consulta datos según el periodo desde las views de Supabase
async function fetchSalesData(period) {
  if (period !== 'daily') {
    // Mantenemos el comportamiento original para semanas y meses
    let query;
    switch (period) {
      case 'weekly':
        query = supabase.from('ventas_semanales').select('semana, año, ventas_totales').order('semana', { ascending: true });
        break;
      case 'monthly':
        query = supabase.from('ventas_mensuales').select('mes, año, ventas_totales').order('mes', { ascending: true });
        break;
      default:
        query = supabase.from('ventas_diarias').select('fecha, ventas_totales').order('fecha', { ascending: true });
        break;
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error al obtener datos de ventas:", error);
      return [];
    }

    if (period === 'weekly') {
      return data.map(item => ({ label: obtenerRangoSemana(item.semana, item.año), sales: item.ventas_totales }));
    } else if (period === 'monthly') {
      return data.map(item => ({ label: `${item.mes} - ${item.año}`, sales: item.ventas_totales }));
    }
  }

  // Para el caso diario, implementamos la lógica de completar días faltantes
  return await fetchDailyDataWithMissingDays();
}

async function fetchDailyDataWithMissingDays() {
  // 1. Obtener el rango de fechas completo que queremos mostrar (últimos 30 días)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30); // Mostrar últimos 30 días
  
  // 2. Obtener los datos existentes de Supabase para este rango
  const { data: existingData, error } = await supabase
    .from('ventas_diarias')
    .select('fecha, ventas_totales')
    .gte('fecha', startDate.toISOString().split('T')[0])
    .lte('fecha', endDate.toISOString().split('T')[0])
    .order('fecha', { ascending: true });

  if (error) {
    console.error("Error al obtener datos diarios:", error);
    return [];
  }

  // 3. Crear un mapa de fechas para búsqueda rápida
  const salesMap = new Map();
  existingData.forEach(item => {
    salesMap.set(item.fecha, item.ventas_totales);
  });

  // 4. Generar el rango completo de fechas
  const completeData = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    completeData.push({
      label: formatearFecha(dateStr),
      sales: salesMap.get(dateStr) || 0, // 0 para días sin datos
      rawDate: dateStr // Guardamos la fecha original para ordenamiento
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return completeData;
}

// Estadísticas resumen
async function updateSalesStats() {
  const period = document.getElementById("stats-period").value;
  const salesData = await fetchSalesData(period);

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const avgSales = totalSales / salesData.length;
  const salesChange = calculateSalesChange(salesData);

  // Obtener total pedidos para calcular ticket promedio
  let totalOrders = 0;
  switch (period) {
    case 'daily':
      totalOrders = await countOrdersForPeriod(); // función personalizada que cuente pedidos pagados diarios
      break;
    // agregar casos para weekly y monthly si quieres
    default:
      totalOrders = await countOrdersForPeriod();
  }

  const ticketPromedio = totalOrders > 0 ? totalSales / totalOrders : 0;

  document.getElementById("total-sales").textContent = `${totalSales.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`;
  document.getElementById("avg-sales").textContent = `$${avgSales.toFixed(2)}`;
  document.getElementById("sales-change").textContent = `${salesChange.toFixed(2)}%`;

  // Agrega un nuevo elemento en el HTML para mostrar ticket promedio si quieres
  // Por ejemplo: <p id="ticket-promedio"></p>
  const ticketPromedioEl = document.getElementById("ticket-promedio");
  if (ticketPromedioEl) {
    ticketPromedioEl.textContent = `$${ticketPromedio.toFixed(2)}`;
  }

  await updateTotalOrders(period);
  await updateTopProduct();
}

async function countOrdersForPeriod() {
  const { count, error } = await supabase
    .from('historial_cobros')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pagado');
  if (error) return 0;
  return count || 0;
}

function calculateSalesChange(data, period = 'daily') {
  // Validación básica
  if (!data || data.length < 2) {
    console.warn(`No hay suficientes datos (${data?.length || 0} puntos) para calcular cambio`);
    return 0;
  }

  const first = data[0].sales;
  const last = data[data.length - 1].sales;

  // Casos especiales
  if (first === 0 && last === 0) return 0;
  if (first === 0) return last > 0 ? Infinity : -Infinity;

  // Cálculo normal
  const percentage = ((last - first) / Math.abs(first)) * 100;
  const rounded = Math.round(percentage * 100) / 100;

  // Manejo de valores extremos
  if (isNaN(rounded)) {
    console.error("Error en cálculo de porcentaje:", { first, last, percentage });
    return 0;
  }

  return rounded;
}

async function updateTotalOrders(period) {
  let query;

  switch (period) {
    case 'daily':
      query = supabase
        .from('historial_cobros')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pagado');
      break;

    case 'weekly':
      query = supabase
        .from('historial_cobros')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pagado')
        .gte('fecha_cobro', getStartOfWeek())
        .lte('fecha_cobro', getEndOfWeek());
      break;

    case 'monthly':
      query = supabase
        .from('historial_cobros')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pagado')
        .gte('fecha_cobro', getStartOfMonth())
        .lte('fecha_cobro', getEndOfMonth());
      break;

    default:
      query = supabase
        .from('historial_cobros')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pagado');
      break;
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error al obtener total de pedidos:', error);
    document.getElementById('total-orders').textContent = '0';
    return;
  }

  document.getElementById('total-orders').textContent = count || 0;
}

// Obtiene el inicio de la semana actual
function getStartOfWeek() {
  const today = new Date();
  const first = today.getDate() - today.getDay() + 1; // Ajuste: semana inicia en lunes
  const firstDay = new Date(today.setDate(first));
  return firstDay.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// Obtiene el fin de la semana actual
function getEndOfWeek() {
  const today = new Date();
  const last = today.getDate() - today.getDay() + 7;
  const lastDay = new Date(today.setDate(last));
  return lastDay.toISOString().split('T')[0];
}

// Obtiene el inicio del mes actual
function getStartOfMonth() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return firstDay.toISOString().split('T')[0];
}

// Obtiene el fin del mes actual
function getEndOfMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return lastDay.toISOString().split('T')[0];
}


// Obtener el producto más vendido
async function updateTopProduct() {
  const { data, error } = await supabase
    .from('top_productos_vendidos')
    .select('nombre, total_vendido')
    .order('total_vendido', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Error al obtener el top producto:', error);
    return;
  }

  const nombre = data[0].nombre;
  const totalVendido = data[0].total_vendido;

  document.getElementById("top-product").innerHTML = `🥇 ${nombre}`;
  document.getElementById("top-product-sales").innerHTML = `<span class="badge bg-success">Ventas: ${totalVendido}</span>`;
}


async function updateTopProductsList() {
  const { data, error } = await supabase
    .from('top_productos_vendidos')
    .select('nombre, total_vendido')
    .limit(3);

  const lista = document.getElementById("top-products-list");
  lista.innerHTML = '';

  if (error || !data) {
    console.error('Error al obtener top productos:', error);
    lista.innerHTML = `<tr><td colspan='2' class='text-center text-muted'>Sin datos suficientes</td></tr>`;
    return;
  }

  const trofeos = [
    "<i class='fas fa-trophy text-warning'></i>",   // 🥇 Dorado
    "<i class='fas fa-trophy text-secondary'></i>", // 🥈 Plata
    "<i class='fas fa-trophy text-brown'></i>"       // 🥉 Bronce (puedes poner otro color)
  ];


  data.forEach((producto, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${trofeos[index] || ''} ${producto.nombre}</td>
          <td><span class='badge bg-info'>${producto.total_vendido}</span></td>
        `;
    lista.appendChild(row);
  });
}


function obtenerRangoSemana(numeroSemana, año) {
  const primerDiaDelAño = new Date(año, 0, 1);
  const diaSemana = primerDiaDelAño.getDay();
  const diasOffset = (diaSemana <= 4) ? diaSemana - 1 : diaSemana - 8;
  const primerLunes = new Date(año, 0, 1 - diasOffset + (numeroSemana - 1) * 7);

  const inicio = new Date(primerLunes);
  const fin = new Date(primerLunes);
  fin.setDate(fin.getDate() + 6);

  const opcionesDiaMes = { day: '2-digit', month: 'short', timeZone: 'UTC' };
  const opcionesDiaMesAnio = { ...opcionesDiaMes, year: 'numeric' };

  const mismoMes = inicio.getMonth() === fin.getMonth();
  const mismoAnio = inicio.getFullYear() === fin.getFullYear();

  const inicioStr = inicio.toLocaleDateString('es-MX', opcionesDiaMes);
  let finStr;

  if (!mismoAnio) {
    finStr = fin.toLocaleDateString('es-MX', opcionesDiaMesAnio);
  } else if (!mismoMes) {
    finStr = fin.toLocaleDateString('es-MX', opcionesDiaMes);
  } else {
    finStr = fin.getDate().toString().padStart(2, '0');
  }

  return `${inicioStr} -${finStr}`;
}


let topProductsChart;

async function updateTopProductsChart() {
  const { data, error } = await supabase
    .from('top_productos_vendidos')
    .select('nombre, total_vendido');

  const ctx = document.getElementById('top-products-chart').getContext('2d');

  if (topProductsChart) {
    topProductsChart.destroy();
  }

  if (error || !data || data.length === 0) {
    console.error('Error al cargar productos vendidos:', error);
    document.getElementById('top-product-resume').innerHTML = `<span class="text-muted">Sin datos</span>`;
    return;
  }

  const labels = data.map(item => item.nombre);
  const ventas = data.map(item => item.total_vendido);

  topProductsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Productos Vendidos',
        data: ventas,
        backgroundColor: generateColors(ventas.length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const total = ventas.reduce((a, b) => a + b, 0);
              const porcentaje = ((tooltipItem.raw / total) * 100).toFixed(1);
              return `${tooltipItem.label}: ${tooltipItem.raw} vendidos (${porcentaje}%)`;
            }
          }
        }
      }
    }
  });

  // 🎯 Ahora también mostrar el resumen del producto top
  const totalVentas = ventas.reduce((a, b) => a + b, 0);
  const productoTop = labels[0];
  const ventasTop = ventas[0];
  const porcentajeTop = ((ventasTop / totalVentas) * 100).toFixed(1);

  document.getElementById('top-product-resume').innerHTML = `
  <i class="fas fa-crown text-warning"></i> ${productoTop} 
  <span class="badge bg-success ms-2">${porcentajeTop}%</span>
`;

}

// Función para generar colores aleatorios pastel 🎨
function generateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.floor(Math.random() * 360);
    colors.push(`hsl(${hue}, 70%, 75%)`);
  }
  return colors;
}

let salesByCategoryChart;

async function updateSalesByCategoryChart() {
  const { data, error } = await supabase
    .from('ventas_por_categoria')
    .select('categoria_nombre, total_vendidos');

  const ctx = document.getElementById('sales-by-category-chart').getContext('2d');

  if (salesByCategoryChart) {
    salesByCategoryChart.destroy();
  }

  if (error || !data || data.length === 0) {
    console.error('Error al cargar ventas por categoría:', error);
    document.getElementById('top-category').innerHTML = `<span class="text-muted">Sin datos</span>`;
    return;
  }

  const labels = data.map(item => item.categoria_nombre);
  const ventas = data.map(item => item.total_vendidos);

  salesByCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventas por Categoría',
        data: ventas,
        backgroundColor: generateColors(ventas.length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const total = ventas.reduce((a, b) => a + b, 0);
              const porcentaje = ((tooltipItem.raw / total) * 100).toFixed(1);
              return `${tooltipItem.label}: ${tooltipItem.raw} vendidos (${porcentaje}%)`;
            }
          }
        }
      }
    }
  });

  // 📚 Calcular categoría más vendida
  const totalVentas = ventas.reduce((a, b) => a + b, 0);
  const categoriaTop = labels[0];
  const ventasTop = ventas[0];
  const porcentajeTop = ((ventasTop / totalVentas) * 100).toFixed(1);

  document.getElementById('top-category').innerHTML = `
  <i class="fas fa-crown text-warning"></i> ${categoriaTop} 
  <span class="badge bg-primary ms-2">${porcentajeTop}%</span>
`;
}

async function updateTopSalesDate() {
  const { data, error } = await supabase
    .from('ventas_por_fecha')
    .select('dia, ventas_totales')
    .order('ventas_totales', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Error al cargar fecha top:', error);
    document.getElementById('top-sales-date').textContent = 'Sin datos';
    return;
  }

  document.getElementById('top-sales-date').textContent = formatearFecha(data[0].dia);
}

async function updateTopSalesHour() {
  const { data, error } = await supabase
    .from('ventas_por_hora')
    .select('hora, ventas')
    .order('ventas', { ascending: false })
    .limit(1);
  console.log("Datos de ventas por hora:", data); // <-- Ver todos los datos

  if (error || !data || data.length === 0) {
    console.error('Error al cargar hora top:', error);
    document.getElementById('top-sales-time').textContent = 'Sin datos';
    return;
  }

  const hour = data[0].hora;
  const formattedHour = formatHour(hour);
  const icon = getHourIcon(hour);

  document.getElementById('top-sales-time').innerHTML = `
      ${icon} ${formattedHour}
    `;
}

// Formatea la hora tipo "10:00 AM"
function formatHour(hour) {
  const periodo = hour >= 12 ? 'PM' : 'AM';
  const hora12 = hour % 12 || 12;
  return `${hora12}:00 ${periodo}`;
}

// Devuelve un ícono según la hora del día
function getHourIcon(hour) {
  if (hour >= 6 && hour < 12) {
    return '<i class="fas fa-sun text-warning"></i>'; // Mañana ☀️
  } else if (hour >= 12 && hour < 19) {
    return '<i class="fas fa-cloud-sun text-primary"></i>'; // Tarde 🌤️
  } else {
    return '<i class="fas fa-moon text-secondary"></i>'; // Noche 🌙
  }
}

