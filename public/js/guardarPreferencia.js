document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-preferencias");
  const modal = document.getElementById("modal-preferencias");
  const contenedor = document.getElementById("contenedor-preferencias");
  const btnGuardar = document.querySelector(".btn-guardar");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

 // Asegúrate de que coincida.
    const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) return alert("No se pudo obtener el ID del cliente.");
    const fecha = new Date().toISOString();

    // Detectar qué checkboxes están activos (productos o ingredientes)
    const checkProductos = document.querySelectorAll('input[name="productos"]');
    const checkIngredientes = document.querySelectorAll('input[name="ingredientes"]');

    // === GUSTOS ===
    if (checkProductos.length > 0) {
      const seleccionados = Array.from(checkProductos).filter(cb => cb.checked).map(cb => cb.value);
      const prevSeleccionados = Array.from(checkProductos)
  .filter(cb => cb.dataset.prev === "1")
  .map(cb => cb.value);

const aInsertar = seleccionados.filter(id => !prevSeleccionados.includes(id));
const aEliminar = prevSeleccionados.filter(id => !seleccionados.includes(id));


      aInsertar.forEach(producto_id => {
        fetch(`${PROJECT_URL}/rest/v1/gustos`, {
          method: "POST",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ cliente_id, productos_id: producto_id, fecha_registro: fecha })
        });
      });

      aEliminar.forEach(producto_id => {
        fetch(`${PROJECT_URL}/rest/v1/gustos?cliente_id=eq.${cliente_id}&productos_id=eq.${producto_id}`, {
          method: "DELETE",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`
          }
        });
      });

      alert("Gustos actualizados.");
    }

    // === ALERGIAS ===
    if (checkIngredientes.length > 0) {
      const seleccionados = Array.from(checkIngredientes).filter(cb => cb.checked).map(cb => cb.value);
      const aInsertar = seleccionados.filter(id => !alergiasActuales.includes(id));
      const aEliminar = alergiasActuales.filter(id => !seleccionados.includes(id));

      aInsertar.forEach(ingrediente_id => {
        fetch(`${PROJECT_URL}/rest/v1/alergias`, {
          method: "POST",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ cliente_id, ingrediente_id, fecha_registro: fecha })
        });
      });

      aEliminar.forEach(ingrediente_id => {
        fetch(`${PROJECT_URL}/rest/v1/alergias?cliente_id=eq.${cliente_id}&ingrediente_id=eq.${ingrediente_id}`, {
          method: "DELETE",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`
          }
        });
      });

      alert("Alergias actualizadas.");
    }

    modal.style.display = "none";
    contenedor.innerHTML = "";
    btnGuardar.style.display = "none";

    import("./sugerencias.js").then(modulo => {
      modulo.obtenerSugerencia();
    });
  });
});
