let predChart = null;

document.getElementById("mostrarPrediccionesBtn").addEventListener("click", async () => {
  const contenedor = document.getElementById("contenedorPredicciones");

  // Alternar visibilidad
  if (contenedor.style.display === "none") {
    contenedor.style.display = "block";

    if (!predChart) {
      // Obtener datos desde tu servidor SARIMAX
      const predData = await fetch("http://localhost:5050/predicciones")
        .then(res => res.json())
        .catch(err => {
          console.error("Error al obtener predicciones:", err);
          return [];
        });

      const fechas = predData.map(p => p.fecha);
      const valores = predData.map(p => p.prediccion);

      const ctx = document.getElementById("graficaPrediccion").getContext("2d");
      predChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: fechas,
          datasets: [{
            label: 'Predicción SARIMAX',
            data: valores,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Predicción de Ventas (SARIMAX)'
            },
            legend: {
              display: true
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

  } else {
    contenedor.style.display = "none";
  }
});
