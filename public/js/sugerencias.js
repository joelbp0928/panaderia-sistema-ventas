import { agregarProductoAlCarrito } from "./cart.js";

let sugerencias = [];
let indiceActual = 0;

export async function obtenerSugerencia() {
  console.log("📥 Entró a obtenerSugerencia");

  const cliente_id = localStorage.getItem("cliente_id");
  console.log("Cliente: ", cliente_id)
  if (!cliente_id) {
    console.error("❌ No hay cliente_id en localStorage");
    return;
  }

  try {
    const res = await fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net//?cliente_id=${cliente_id}`);
    //const res = await fetch(`http://localhost:5000/?cliente_id=${cliente_id}`);
    const data = await res.json();

    // Verifica que venga con el nombre correcto desde el backend
    sugerencias = data.sugerencias || [];// <-- asegúrate que el backend regrese esto
    indiceActual = 0;

    console.log("✅ Sugerencias recibidas:", sugerencias);

    if (sugerencias.length > 0) {
      mostrarSugerencia(sugerencias[indiceActual]);
    } else {
      ocultarTarjeta();
    }
  } catch (error) {
    console.error("❌ Error al obtener la sugerencia:", error);
  }
}

document.getElementById("btn-otra-sugerencia").addEventListener("click", () => {
  if (sugerencias.length === 0) return;
  indiceActual = (indiceActual + 1) % sugerencias.length;
  mostrarSugerencia(sugerencias[indiceActual]);
});

function mostrarSugerencia(producto) {
  if (!producto) return;

  const tarjeta = document.getElementById("tarjeta-sugerencia");
  const imagen = document.getElementById("imagen-pan");
  const nombre = document.getElementById("nombre-pan");
  const boton = document.getElementById("btn-carrito");

  if (!tarjeta || !imagen || !nombre || !boton) {
    console.warn("⚠️ Faltan elementos HTML en la tarjeta");
    return;
  }

  tarjeta.classList.add("mostrar");
  tarjeta.style.display = "flex";
  tarjeta.classList.add("oculto");

  setTimeout(() => {
  nombre.textContent = producto.nombre || "Pan sugerido";
  imagen.src = producto.imagen_url || "default.jpg";

  tarjeta.classList.remove("oculto");
}, 300); // Espera a que termine el desvanecido

  boton.onclick = () => agregarProductoAlCarrito(producto.id, 1);
}

function ocultarTarjeta() {
  const tarjeta = document.getElementById("tarjeta-sugerencia");
  if (tarjeta) tarjeta.style.display = "none";
}

 
//obtenerSugerencia();
  
  
