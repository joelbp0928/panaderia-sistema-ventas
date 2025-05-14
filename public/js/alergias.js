// 1. Mostrar el modal al dar clic en el botón de preferencias

const PROJECT_URL = "https://kicwgxkkayxneguidsxe.supabase.co"; // ← tu URL real
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg"; // ← tu key anon real

let alergiasActuales = [];

document.getElementById('btn-filtro-alergenos').addEventListener('click', function () {
  const modal = document.getElementById('modal-alergias');
  modal.style.display = 'block';

  const cliente_id = localStorage.getItem('cliente_id');
  console.log("👤 Cliente de alergias:", cliente_id);

  const contenedor = document.getElementById('contenedor-ingredientes');
  contenedor.innerHTML = ''; // Limpiar antes de cargar ingredientes

  if (!cliente_id) {
    alert("No se encontró el cliente.");
    return;
  }

  // Fetch ingredientes y alergias en paralelo
  const fetchIngredientes = fetch(`${PROJECT_URL}/rest/v1/ingredientes`, {
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`
    }
  }).then(res => res.json());

  const fetchAlergias = fetch(`${PROJECT_URL}/rest/v1/alergias?cliente_id=eq.${cliente_id}`, {
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`
    }
  }).then(res => res.json());

  Promise.all([fetchIngredientes, fetchAlergias])
    .then(([ingredientes, alergias]) => {
      alergiasActuales = alergias.map(a => a.ingrediente_id); // Guardar para comparar después

      ingredientes.forEach(ingrediente => {
        const checked = alergiasActuales.includes(ingrediente.id) ? 'checked' : '';
        const label = document.createElement('label');
        label.innerHTML = `
          <input type="checkbox" name="ingredientes" value="${ingrediente.id}" ${checked}>
          ${ingrediente.nombre}
        `;
        contenedor.appendChild(label);
        contenedor.appendChild(document.createElement('br'));
      });
    })
    .catch(error => console.error("Error al cargar ingredientes o alergias:", error));
});

// 2. Cerrar el modal al dar clic en la "X"
document.getElementById('cerrar-modal').addEventListener('click', function () {
  document.getElementById('modal-alergias').style.display = 'none';
});

// 3. Cerrar el modal si se da clic fuera del contenido
window.addEventListener('click', function (event) {
  const modal = document.getElementById('modal-alergias');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});

// 4. Enviar ingredientes seleccionados al backend
document.getElementById('form-alergias').addEventListener('submit', function (e) {
  e.preventDefault();

  const cliente_id = localStorage.getItem('cliente_id');
  if (!cliente_id) {
    alert("No se pudo obtener el ID del cliente.");
    return;
  }

  const seleccionados = Array.from(document.querySelectorAll('input[name="ingredientes"]:checked'))
    .map(cb => cb.value);

  const fecha = new Date().toISOString();

  // Calcular qué insertar y qué eliminar
  const aInsertar = seleccionados.filter(id => !alergiasActuales.includes(id));
  const aEliminar = alergiasActuales.filter(id => !seleccionados.includes(id));

  // Insertar nuevos
  aInsertar.forEach(ingrediente_id => {
    fetch(`${PROJECT_URL}/rest/v1/alergias`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cliente_id,
        ingrediente_id,
        fecha_registro: fecha
      })
    });
  });

  // Eliminar desmarcados
  aEliminar.forEach(ingrediente_id => {
    fetch(`${PROJECT_URL}/rest/v1/alergias?cliente_id=eq.${cliente_id}&ingrediente_id=eq.${ingrediente_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`
      }
    });
  });

  alert('Preferencias actualizadas.');
  document.getElementById('modal-alergias').style.display = 'none';
});

document.getElementById('mensaje-exito').style.display = 'block';
setTimeout(() => {
  document.getElementById('mensaje-exito').style.display = 'none';
}, 3000);