const PROJECT_URL = "https://kicwgxkkayxneguidsxe.supabase.co"; // ← tu URL real
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg"; // ← tu key anon real

import { supabase } from "./supabase-config.js";
import { agregarProductoAlCarrito } from "./cart.js";

let sugerencias = [];
let indiceActual = 0;

export async function obtenerSugerencia() {
  console.log("📥 Entró a obtenerSugerencia");

  const cliente_id = localStorage.getItem("cliente_id");
  //  console.log("Cliente: ", cliente_id)
  if (!cliente_id) {
    console.error("❌ No hay cliente_id en localStorage");
    return;
  }

  try {
    mostrarCargaSugerencia(); // ← 🔄 muestra mensaje mientras carga

    //const res = await fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net//?cliente_id=${cliente_id}`);
    const res = await fetch(`http://localhost:5000/?cliente_id=${cliente_id}`);
    const data = await res.json();
    //  console.log("✅ Respuesta del servidor:", data);
    // console.log("Estado: ", data.estado);

    if (data.estado === "sin_historial") {
      const productosRentables = await obtenerTopProductosRentables();

      if (productosRentables.length > 0) {
        sugerencias = productosRentables;
        indiceActual = 0;
        mostrarSugerencia(sugerencias[0]);
      } else {
        ocultarTarjeta();
      }

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

    //  console.log("✅ Sugerencias con afinidad aplicada:", sugerencias);


    //  console.log("✅ Sugerencias recibidas:", sugerencias);

    if (sugerencias.length > 0) {
      mostrarSugerencia(sugerencias[indiceActual]);
    } else {
      ocultarTarjeta();
    }
  } catch (error) {
    boton.disabled = false;
    boton.innerHTML = `<i class="fas fa-cart-plus"></i> Agregar`;

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
    const badge = producto.esEstrella
      ? `<span class="badge bg-warning text-dark ms-2" style="font-size: 0.65rem; white-space: nowrap;">⭐ Producto estrella</span>`
      : "";

    nombre.innerHTML = `
      <span>${producto.nombre}</span>
      ${badge}
    `;

    imagen.src = producto.imagen_url || "default.jpg";
    tarjeta.classList.remove("oculto");
  }, 300);

  boton.onclick = () => agregarProductoAlCarrito(producto.id, 1);
  boton.disabled = false;
  boton.innerHTML = `<i class="fas fa-cart-plus"></i> Agregar`;
  // Quita el overlay si existe
  const overlay = document.getElementById("loader-overlay");
  if (overlay) overlay.remove();
}

function ocultarTarjeta() {
  const tarjeta = document.getElementById("tarjeta-sugerencia");
  if (tarjeta) tarjeta.style.display = "none";
}

//obtenerSugerencia();
// 🔥 Función para obtener los productos más rentables
export async function obtenerTopProductosRentables() {
  const { data: productos, error } = await supabase
    .from("productos_estrella")
    .select("id, nombre, imagen_url")
    .order("mcponderado", { ascending: false })
    .limit(3); // 🔥 Top 3

  if (error || !productos?.length) {
    console.warn("⚠️ No se pudo obtener productos rentables:", error);
    return [];
  }

  // Marca el primero como estrella
  productos[0].esEstrella = true;
  return productos;
}

function mostrarCargaSugerencia() {
  const tarjeta = document.getElementById("tarjeta-sugerencia");
  if (!tarjeta) return;

  // Asegura que la tarjeta tenga posición relativa
  tarjeta.style.position = "relative";
  tarjeta.style.display = "flex";

  // Crea el overlay si no existe
  let overlay = document.getElementById("loader-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loader-overlay";
    overlay.className = "glass-overlay";
overlay.innerHTML = `
  <div class="donut-loader mb-3"></div>
  <p class="fw-semibold animate__animated animate__pulse animate__infinite">
    Cargando tu recomendación deliciosa... 🍩
  </p>
`;

    tarjeta.appendChild(overlay);
  }

  // Desactiva botón mientras carga
  const boton = document.getElementById("btn-carrito");
  if (boton) {
    boton.disabled = true;
    boton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Espera...`;
  }
}
