const PROJECT_URL = "https://kicwgxkkayxneguidsxe.supabase.co"; // ← tu URL real
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg"; // ← tu key anon real

let gustosActuales = [];
let tipoSeleccionado = null; // puede ser 'alergias' o 'gustos'

document.addEventListener("DOMContentLoaded", () => {
  const btnMostrarGustos = document.getElementById("btn-ver-gustos");
  const modal = document.getElementById("modal-preferencias");
  const cerrar = document.getElementById("cerrar-modal-preferencias");
  const contenedor = document.getElementById("contenedor-preferencias");
  const form = document.getElementById("form-preferencias");
  const btnGuardar = document.querySelector(".btn-guardar");

  if (!btnMostrarGustos || !modal || !cerrar || !contenedor || !form || !btnGuardar) {
    console.warn("Algunos elementos del DOM no existen.");
    return;
  }

  btnMostrarGustos.addEventListener("click", () => {
    modal.style.display = "block";
    contenedor.innerHTML = "";
    btnGuardar.style.display = "block";

    const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) {
      alert("No se encontró el cliente.");
      return;
    }

    Promise.all([
    fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net/productos_visibles`).then(res => res.json()),
    //fetch("http://localhost:5000/productos_visibles").then(res => res.json()),

    fetch(`${PROJECT_URL}/rest/v1/gustos?cliente_id=eq.${cliente_id}`, {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`
        }
      }).then(res => res.json())
    ])
    .then(([productos, gustos]) => {
      if (!Array.isArray(gustos)) {
        console.error("⚠️ La tabla gustos no devolvió un arreglo:", gustos);
        gustos = [];
      }

      // Solo mantener gustos cuyo producto aún existe (por si desactivaste una categoría)
      const productosIdsVisibles = productos.map(p => p.id);
      gustosActuales = gustos
        .filter(g => productosIdsVisibles.includes(g.productos_id))
        .map(g => g.productos_id);


      productos.forEach(producto => {
        const yaSeleccionado = gustosActuales.includes(producto.id);

const input = document.createElement("input");
input.type = "checkbox";
input.name = "productos";
input.value = producto.id;
if (yaSeleccionado) input.checked = true;
input.dataset.prev = yaSeleccionado ? "1" : "0"; // ← muy importante

const label = document.createElement("label");
label.style.flex = "1";
label.appendChild(input);
label.appendChild(document.createTextNode(` ${producto.nombre}`));

        const card = document.createElement("div");
        card.style.marginBottom = "10px";
        card.style.border = "1px solid #ccc";
        card.style.borderRadius = "8px";
        card.style.padding = "10px";
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.gap = "10px";

        const img = document.createElement("img");
        img.src = producto.imagen_url;
        img.alt = producto.nombre;
        img.style.width = "60px";
        img.style.height = "60px";
        img.style.borderRadius = "5px";
        img.style.objectFit = "cover";


        card.appendChild(img);
        card.appendChild(label);
        contenedor.appendChild(card);
      });
    })
    .catch(error => console.error("❌ Error al cargar productos o gustos:", error));
  });

  cerrar.addEventListener("click", () => {
    modal.style.display = "none";
    contenedor.innerHTML = "";
    btnGuardar.style.display = "none";
  });

  window.addEventListener("click", event => {
    if (event.target === modal) {
      modal.style.display = "none";
      contenedor.innerHTML = "";
      btnGuardar.style.display = "none";
    }
  });

});
