let predChart = null;

document.getElementById("mostrarPrediccionesBtn").addEventListener("click", async () => {
  document.getElementById("contenedorPredicciones").style.display = "block"; // 👈 esto es esencial

  const periodo = document.getElementById("stats-period").value;
  
  // Determinar el endpoint según el periodo
  let endpoint = "";
  if (periodo === "daily") endpoint = "/predicciones_diarias";
  else if (periodo === "weekly") endpoint = "/predicciones_semanales";
  else if (periodo === "monthly") endpoint = "/predicciones_mensuales";
  else return; // Salir si no hay opción válida

  try {
    const res = await fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net${endpoint}`);
    //const res = await fetch(`http://localhost:5000${endpoint}`);
    const predData = await res.json();

    if (!Array.isArray(predData)) {
      console.error("Respuesta inválida:", predData);
      return;
    }

    // Ordenar por fecha
    predData.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const fechas = predData.map(p => {
      const date = new Date(p.fecha);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    });

    const valores = predData.map(p => p.prediccion);

    // Mostrar gráfica SARIMAX
    const ctx = document.getElementById("graficaPrediccion").getContext("2d");
    if (window.predChart) window.predChart.destroy();
    window.predChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: fechas,
    datasets: [{
      label: "Predicción SARIMAX",
      data: valores,
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.1)", // Relleno debajo
                     fill: true,
                tension: 0.3,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          font: {
            size: 14
          },
          color: "#333"
        }
      },
      title: {
        display: true,
        text: "Predicción de Ventas",
        font: {
          size: 18
        },
        color: "#444"
      },
      tooltip: {
        backgroundColor: "#fff",
        titleColor: "#000",
        bodyColor: "#000",
        borderColor: "#ccc",
        borderWidth: 1,
        callbacks: {
          label: context => `Predicción: ${context.parsed.y.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          font: { size: 13 },
          color: "#333"
        },
        grid: {
          color: "#eee"
        }
      },
      y: {
        beginAtZero: false,
        ticks: {
          font: { size: 13 },
          color: "#333",
          callback: value => `${value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`
        },
        grid: {
          color: "#eee"
        }
      }
    }
  }
});

  } catch (error) {
    console.error("Error al obtener predicciones:", error);
  }
});
