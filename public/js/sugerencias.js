// Código Fetch para traer la sugerencia de pan
function obtenerSugerencia() {
  console.log("Entró a la función");

  const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) {
        console.error("❌ No hay cliente_id en localStorage");
        return;
    }


  fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net//?cliente_id=${cliente_id}`)  
  //fetch(`http://localhost:5000/?cliente_id=${cliente_id}`)
  .then(res => res.json())
  .then(data => {
    console.log("Usuario:", cliente_id);
    console.log("✅ Sugerencia:", data);

    if (data.estado === "sin_historial") {
      // Mostrar mensaje 
      const contenedor = document.getElementById("tarjeta-sugerencia");
      contenedor.style.display = "flex";
      contenedor.innerHTML = `
        <div style="text-align:center; padding: 20px;">
          <h2 style="margin-bottom:10px;">   🔍 Aún no hay recomendaciones</h2>
          <p>${data.mensaje}</p>
          <img src="https://media.gettyimages.com/id/165604356/es/vector/pan-redondo.jpg?s=612x612&w=gi&k=20&c=rpEWUW_3LPEb-RUkHePrZ9howUHgX2oSaItfHejHsVI=" alt="Pan esperando" style="max-width: 200px; margin-top: 10px;">
        </div>
      `;
      return;
    }

    document.getElementById("tarjeta-sugerencia").style.display = "flex";
    document.getElementById('imagen-pan').src = data.imagen_url;
    document.getElementById('nombre-pan').textContent = data.nombre;

    // Añadir evento al botón
    const btn = document.getElementById('btn-carrito');

    btn.onclick = () => {
      // Obtener carrito actual (si existe)
      let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    
      // Verificar si el producto ya está en el carrito
      const index = carrito.findIndex(item => item.id === data.id);
    
      if (index !== -1) {
        // Si ya está, aumentar la cantidad
        carrito[index].cantidad += 1;
      } else {
        // Si no está, agregar al carrito
        carrito.push({
          id: data.id,
          nombre: data.nombre,
          cantidad: 1
        });
      }
    
      // Guardar de nuevo en localStorage
      localStorage.setItem("carrito", JSON.stringify(carrito));
    
      // Feedback visual
      alert(`✅ "${data.nombre}" añadido al carrito`);
      console.log("🛒 Carrito actualizado:", carrito);
    };
    
  });

  }

 
obtenerSugerencia();
  
