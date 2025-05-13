import { agregarProductoAlCarrito } from "./cart.js";

export async function obtenerSugerencia() {
  console.log("Entró a la función");

  const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) {
        console.error("❌ No hay cliente_id en localStorage");
        return;
    }

  
  try {
    const res = await fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net//?cliente_id=${cliente_id}`);
    //const res = await fetch(`http://localhost:5000/?cliente_id=${cliente_id}`);
    const data = await res.json();

    console.log("👤 Cliente:", cliente_id);
    console.log("✅ Sugerencia:", data);

    const seccion = document.getElementById("seccion-sugerencias");
    const tarjeta = document.getElementById("tarjeta-sugerencia");
    const imagen = document.getElementById("imagen-pan");
    const nombre = document.getElementById("nombre-pan");
    const boton = document.getElementById("btn-carrito");

    // Caso sin historial
    if (data.estado === "sin_historial") {
      
      const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
      const totalAgregados = carrito.reduce((acc, item) => acc + item.cantidad, 0);
      const faltan = Math.max(0, 5 - totalAgregados);

      seccion.innerHTML = `
        <div style="background-color: var(--gris-claro); padding: 30px; border-radius: 2% 40%; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center;">
          <h2 style="color: #2c6580; font-size: 1.6rem; margin-bottom: 10px;">
            <i class="fas fa-search"></i> Aún no hay recomendaciones
          </h2>
          <p>Compra 5 productos para poder darte sugerencias deliciosas 🍞</p>
          <i class="fas fa-bread-slice" style="font-size: 80px; color: #a67847;"></i>
        </div>
      `;
      return;
    }

    // Mostrar sugerencia
    tarjeta.classList.add("mostrar");
    tarjeta.style.display = "flex";
    imagen.src = data.imagen_url;
    nombre.textContent = data.nombre;

    // Evento botón agregar
    boton.onclick = () => {
      agregarProductoAlCarrito(data.id, 1);
    };

  } catch (error) {
    console.error("❌ Error al obtener la sugerencia:", error);
  }
}
 
//obtenerSugerencia();
  
  
