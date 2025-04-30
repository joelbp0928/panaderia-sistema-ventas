// Código Fetch para traer la sugerencia de pan
function obtenerSugerencia() {
    fetch('https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net')  // Recuerda: ahorita es LOCALHOST
      .then(response => response.json())
      .then(data => {
        console.log(data); // Aquí ves qué te regresó Flask
        const sugerencia = data.sugerencia;
  
        // Mostrar la sugerencia en el HTML
        const contenedor = document.getElementById('sugerencia-pan');
        contenedor.textContent = "Hoy te sugerimos: " + sugerencia;
      })
      .catch(error => {
        console.error('Error al obtener sugerencia:', error);
      });
  }
  
  // Ejecutar la función cuando cargue la página
obtenerSugerencia();
  
