import { supabase } from "./supabase-config.js";
import { formatearFecha } from "./formatearFecha.js";
import { showLoading, hideLoading } from "./manageError.js";

let salesChart;

// Llamamos a la función para cargar las estadísticas de ventas cuando la página se cargue
export function cargarEstadisticas() {
    showLoading();
    // Establecer el valor "diario" por defecto
    document.getElementById("stats-period").value = "daily";  // Establece "diario" como opción predeterminada

    // Llamar a la función para actualizar las estadísticas
    updateSalesStats();
    updateSalesChart(); // Actualiza el gráfico con la opción "diario" seleccionada
    hideLoading();
}
async function updateSalesChart() {
    const period = document.getElementById("stats-period").value;

    const salesData = await fetchSalesData(period);

    const labels = salesData.map(item => item.label); // Etiquetas como fecha, semana, mes
    const sales = salesData.map(item => item.sales); // Datos de ventas

    const ctx = document.getElementById('sales-chart').getContext('2d');

    if (salesChart) {
        salesChart.destroy();  // Eliminar el gráfico anterior
    }

    salesChart = new Chart(ctx, {
        type: 'line', // Puedes cambiarlo a 'bar' para un gráfico de barras
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas',
                data: sales,
                borderColor: '#4bc0c0',
                fill: false,
                tension: 0.1,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            // Agregar el símbolo $ en el tooltip junto con las ventas
                            return `Ventas: $${tooltipItem.raw.toFixed(2)}`;
                        }
                    },
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return `$$${value.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// Obtener los datos de ventas desde Supabase
async function fetchSalesData(period) {
    let query;

    switch (period) {
        case 'daily':
            query = supabase.from('ventas_diarias').select('fecha, ventas_totales');
            break;
        case 'weekly':
            query = supabase.from('ventas_semanales').select('semana, año, ventas_totales');
            break;
        case 'monthly':
            query = supabase.from('ventas_mensuales').select('mes, año, ventas_totales');
            break;
        default:
            query = supabase.from('ventas_diarias').select('fecha, ventas_totales'); // Por defecto diario
            break;
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error al obtener datos de ventas:', error);
        return [];
    }

    // Aquí formateamos los datos según el periodo
    if (period === 'daily') {
        return data.map(item => ({
            label: formatearFecha(item.fecha), // Usamos la función para formatear la fecha
            sales: item.ventas_totales
        }));
    } else if (period === 'weekly') {
        return data.map(item => ({
            label: `Semana ${item.semana} - ${item.año}`, // Aquí mostramos la semana y el año
            sales: item.ventas_totales
        }));
    } else if (period === 'monthly') {
        return data.map(item => ({
            label: `${item.mes} - ${item.año}`, // Aquí mostramos el mes y el año
            sales: item.ventas_totales
        }));
    }

    return [];
}

document.getElementById("stats-period").addEventListener("change", () => {
    updateSalesChart();
    updateSalesStats();
});

async function updateSalesStats() {
    const period = document.getElementById("stats-period").value;

    const salesData = await fetchSalesData(period);

    // Calcular las métricas
    const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
    const avgSales = totalSales / salesData.length;
    const salesChange = calculateSalesChange(salesData);

    // Actualizar el DOM con los nuevos datos
    document.getElementById("total-sales").textContent = `$${totalSales.toFixed(2)}`;
    document.getElementById("avg-sales").textContent = `$${avgSales.toFixed(2)}`;
    document.getElementById("sales-change").textContent = `${salesChange.toFixed(2)}%`;
}

function calculateSalesChange(data) {
    // Aquí calculas el porcentaje de cambio entre el primer y último dato
    const firstSales = data[0].sales;
    const lastSales = data[data.length - 1].sales;
    return ((lastSales - firstSales) / firstSales) * 100;
}
