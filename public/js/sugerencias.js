const PROJECT_URL = "https://kicwgxkkayxneguidsxe.supabase.co"; // ← tu URL real
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg"; // ← tu key anon real

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

    console.log("Estado: ", data.estado);

    if (data.estado === "sin_historial") {
      const tarjeta = document.getElementById("tarjeta-sugerencia");
      tarjeta.classList.add("oculto");

  setTimeout(() => {
    tarjeta.innerHTML = `
      <div style="padding: 10px; text-align: center;">
        <h3 style="margin-bottom: 10px;"> Aún no hay recomendaciones</h3>
        <p>Compra minimo 5 panes para poder darte sugerencias deliciosas</p>
        <i class="fas fa-bread-slice" style="font-size: 40px; color: #a67847;"></i>
      </div>
      <br>
    `;
    tarjeta.classList.remove("oculto");
    tarjeta.style.display = "flex";
  }, 300);

  return;
}

    // Verifica que venga con el nombre correcto desde el backend
    //sugerencias = data.sugerencias || [];// <-- asegúrate que el backend regrese esto
    //indiceActual = 0;
    const productosRecomendados = data.sugerencias || [];

// 👉 Obtener gustos desde Supabase
const gustosRes = await fetch(`${PROJECT_URL}/rest/v1/gustos?cliente_id=eq.${cliente_id}&select=productos_id`, {
  headers: {
    apikey: API_KEY,
    Authorization: `Bearer ${API_KEY}`
  }
});
const gustosData = await gustosRes.json();
const gustos = gustosData.map(g => g.productos_id);

// 👉 Aplicar afinidad: los productos en gustos van primero
function priorizarGustos(recomendaciones, gustos) {
  return recomendaciones.sort((a, b) => {
    const aGusto = gustos.includes(a.id) ? 1 : 0;
    const bGusto = gustos.includes(b.id) ? 1 : 0;
    return bGusto - aGusto; // los que están en gustos van antes
  });
}

sugerencias = priorizarGustos(productosRecomendados, gustos);
indiceActual = 0;

console.log("✅ Sugerencias con afinidad aplicada:", sugerencias);


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
  
  
  
