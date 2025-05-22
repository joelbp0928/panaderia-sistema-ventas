const PROJECT_URL = "https://kicwgxkkayxneguidsxe.supabase.co"; // ← tu URL real
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg"; // ← tu key anon real


let alergiasActuales = [];
let tipoSeleccionado = null; // puede ser 'alergias' o 'gustos'


document.addEventListener("DOMContentLoaded", () => {
  const btnAbrir = document.getElementById("btn-filtro-alergenos");
  const modal = document.getElementById("modal-preferencias");
  const cerrar = document.getElementById("cerrar-modal-preferencias");
  const contenedor = document.getElementById("contenedor-preferencias");
  const form = document.getElementById("form-preferencias");
  const btnGuardar = document.querySelector(".btn-guardar");

  if (!btnAbrir || !modal || !cerrar || !contenedor || !form || !btnGuardar) {
    console.warn("Algunos elementos del DOM no existen.");
    return;
  }

  btnAbrir.addEventListener("click", () => {
    modal.style.display = "block";
    contenedor.innerHTML = "";
    btnGuardar.style.display = "block";

    const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) {
      alert("No se encontró el cliente.");
      return;
    }

    Promise.all([
      fetch(`${PROJECT_URL}/rest/v1/ingredientes`, {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`
        }
      }).then(res => res.json()),

      fetch(`${PROJECT_URL}/rest/v1/alergias?cliente_id=eq.${cliente_id}`, {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`
        }
      }).then(res => res.json())
    ])
      .then(([ingredientes, alergias]) => {
        alergiasActuales = alergias.map(a => a.ingrediente_id);

        ingredientes.forEach(ingrediente => {
          const checked = alergiasActuales.includes(ingrediente.id) ? "checked" : "";
          const label = document.createElement("label");
          label.innerHTML = `
            <input type="checkbox" name="ingredientes" value="${ingrediente.id}" ${checked}>
            ${ingrediente.nombre}
          `;
          contenedor.appendChild(label);
          contenedor.appendChild(document.createElement("br"));
        });
      })
      .catch(error => console.error("Error al cargar ingredientes o alergias:", error));
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

