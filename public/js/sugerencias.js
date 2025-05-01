// Código Fetch para traer la sugerencia de pan
function obtenerSugerencia() {
  console.log("Entró a la función");
  fetch('https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net/')
  .then(res => res.json())
  .then(data => {
    document.getElementById("tarjeta-sugerencia").style.display = "flex";
    document.getElementById('imagen-pan').src = data.imagen_url;
    document.getElementById('nombre-pan').textContent = data.nombre;
    document.getElementById('descripcion-pan').textContent = data.descripcion || "Sin descripción disponible";

    tarjeta.style.display = "block";

    // Añadir evento al botón
    const btn = document.getElementById('btn-carrito');
    btn.onclick = () => {
      console.log("Producto añadido al carrito:", data.nombre);
      alert(`✅ "${data.nombre}" añadido al carrito`);
    };
  });



  }

 
obtenerSugerencia();
