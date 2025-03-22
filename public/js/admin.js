import { mostrarFormularioEmpleado, gestionarEmpleado, cargarEmpleados } from "./empleados.js";
import { gestionarIngrediente, cargarIngredientes, showIngredientForm } from "./ingredientes.js";
import { addProduct, gestionarProducto, loadIngredients } from "./productos.js";
import { verificarAccesoAdmin, verificarSesion } from "./auth-check.js";
import { cargarConfiguracion } from "./admin/configAdmin.js";
window.onload = async function () {
    try {
        // 🔹 Cargar elementos principales de la página
        await verificarAccesoAdmin();
        await verificarSesion();
        await cargarEmpleados();
        await cargarConfiguracion(); // ✅ Cargar la configuración de la tienda
        await cargarIngredientes(); // 🔹 Cargar los ingredientes
        await loadIngredients(); // 🔹 Cargar los ingredientes para el producto

        // 🔹 Event listeners después de cargar el DOM
        document.getElementById("btn-agregar-empleado").addEventListener("click", mostrarFormularioEmpleado);
        document.getElementById("form-empleado").addEventListener("submit", gestionarEmpleado);
        document.getElementById("ingredient-form").addEventListener("submit", gestionarIngrediente);
        document.getElementById("btn-agregar-ingrediente").addEventListener("click", showIngredientForm);
        document.getElementById("product-form").addEventListener("submit", gestionarProducto);
        document.getElementById("btn-agregar-producto").addEventListener("click", addProduct);

        //console.log("✅ Eventos y configuraciones cargados correctamente.");
    } catch (error) {
        console.error("❌ Error en la inicialización de admin.js:", error);
    }
};







//-------------------------------------------------------------------------------------------------------------
function updateDiscountOptions() {
  // Ocultar todas las configuraciones
  document.querySelectorAll(".discount-option").forEach((option) => {
    option.classList.add("d-none");
  });

  // Mostrar la configuración correspondiente
  const selectedType = document.getElementById(
    "promotion-discount-type"
  ).value;
  const configId = {
    percentage: "percentage-config",
    "buy-get": "buy-get-config",
    bogo: "bogo-config",
    threshold: "threshold-config",
  }[selectedType];

  if (configId) {
    document.getElementById(configId).classList.remove("d-none");
  }
}

const promoRecommendations = [];

document.addEventListener("DOMContentLoaded", function () {
  const promoList = document.getElementById("promo-recommendations");
  promoRecommendations.forEach((promo) => {
    const listItem = document.createElement("li");
    listItem.className = "list-group-item";
    listItem.innerHTML = `
        <strong>${promo.name}</strong><br />
        <small>${promo.reason}</small>
      `;
    promoList.appendChild(listItem);
  });
});

const promotions = [];
const products = ["Dona Chocolate", "Concha", "Bolillo"]; // Ejemplo de productos

function showPromotionForm() {
  document.getElementById("promotion-form").style.display = "block";
  const promoProducts = document.getElementById("promo-products");
  promoProducts.innerHTML = "";
  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product;
    option.textContent = product;
    promoProducts.appendChild(option);
  });
}

function cancelPromotion() {
  document.getElementById("promotion-form").style.display = "none";
}

// Función para crear o editar una promoción
/*  document
  .getElementById("create-promo-btn")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Evita que se recargue la página

    const promoName = document.getElementById("promo-name").value; // Nombre de la promoción
    const promoDiscount = document.getElementById("promo-discount").value; // Descuento de la promoción
    const promoProducts = Array.from(
      document.getElementById("promo-products").selectedOptions
    ).map((option) => option.value); // Productos seleccionados

    // Verificación de que los campos no estén vacíos o incorrectos
    if (promoName && promoDiscount && promoProducts.length > 0) {
      const newPromo = {
        name: promoName,
        discount: promoDiscount,
        products: promoProducts,
      };

      // Si se está editando una promoción existente, actualiza el elemento en el arreglo
      if (editingPromoIndex !== null) {
        promotions[editingPromoIndex] = newPromo;
      } else {
        // Si no, agrega una nueva promoción al arreglo
        promotions.push(newPromo);
      }

      // Actualiza la lista de promociones y cierra el modal
      updatePromotionList();
      cancelPromotion(); // Cancela la creación o edición de la promoción
    } else {
      // Si los campos están vacíos o incorrectos, muestra un mensaje de error
      alert("Por favor, llena todos los campos correctamente.");
    }
  });
*/
function updatePromotionList() {
  const promoList = document.getElementById("promotion-list");
  promoList.innerHTML = "";
  promotions.forEach((promo, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
              <td>${promo.name}</td>
              <td>${promo.discount}%</td>
              <td>${promo.products.join(", ")}</td>
              <td>
                <button class="btn btn-warning btn-sm" onclick="editPromotion(${index})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deletePromotion(${index})">Eliminar</button>
              </td>
            `;
    promoList.appendChild(row);
  });
}

function editPromotion(index) {
  const promo = promotions[index];
  document.getElementById("promo-name").value = promo.name;
  document.getElementById("promo-discount").value = promo.discount;
  const promoProducts = document.getElementById("promo-products");
  Array.from(promoProducts.options).forEach((option) => {
    option.selected = promo.products.includes(option.value);
  });
  promotions.splice(index, 1); // Elimina temporalmente para actualizar
  showPromotionForm();
}

function deletePromotion(index) {
  promotions.splice(index, 1);
  updatePromotionList();
}

let salesChart;
const salesData = {
  daily: [120, 150, 90, 180, 200],
  weekly: [500, 700, 800, 600, 900],
  monthly: [3000, 4000, 3200, 5000, 4800],
};

function initializeSalesChart() {
  const ctx = document.getElementById("sales-chart").getContext("2d");
  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
      datasets: [
        {
          label: "Ventas",
          data: salesData.daily,
          borderColor: "#6c1b2d",
          backgroundColor: "rgba(108, 27, 45, 0.3)",
          borderWidth: 2,
        },
      ],
    },
  });
}

function updateSalesChart() {
  const period = document.getElementById("stats-period").value;
  salesChart.data.datasets[0].data = salesData[period];
  salesChart.update();
}

document.addEventListener("DOMContentLoaded", initializeSalesChart);
