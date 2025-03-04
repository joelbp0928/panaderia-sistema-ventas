// Función para mostrar u ocultar productos por categoría
function toggleProducts(categoryId) {
    const allCategories = document.querySelectorAll('.category-products');
    allCategories.forEach(category => {
        if (category.id === categoryId) {
            category.classList.toggle('hidden');
        } else {
            category.classList.add('hidden');
        }
    });
}

function toggleCategory(categoryId) {
    const productsDiv = document.getElementById('products');
    productsDiv.classList.toggle('hidden');
}

function toggleCategory(category) {
    const productList = document.getElementById("product-list");
    const categoryButtons = document.getElementById("category-buttons");
  
    if (category === "reposteria") {
      // Ocultar los botones de categoría
      categoryButtons.style.display = "none";
  
      // Mostrar productos de repostería
      productList.innerHTML = `
        <div class="product">
          <img src="/img/pastel-chocolate.webp" alt="Pastel de Chocolate" />
          <h3>Pastel de Chocolate</h3>
          <p>Precio: $150.00</p>
        </div>
        <div class="product">
          <img src="/img/croissant.jpg" alt="Croissant" />
          <h3>Croissant</h3>
          <p>Precio: $25.00</p>
        </div>
        <div class="product">
          <img src="/img/muffin-arandanos.jpg" alt="Muffin de Arándanos" />
          <h3>Muffin de Arándanos</h3>
          <p>Precio: $30.00</p>
        </div>
        <div class="product">
          <img src="/img/pie-limon.jpg" alt="Pay de Limón" />
          <h3>Pay de Limón</h3>
          <p>Precio: $50.00</p>
        </div>
        <div class="product">
          <img src="/img/cheesecake.jpg" alt="Cheesecake" />
          <h3>Cheesecake</h3>
          <p>Precio: $70.00</p>
        </div>
        <button class="category-btn" onclick="showCategories()">Regresar</button>
      `;
    }
  }
  
  function showCategories() {
    // Restaurar los botones de categoría
    const categoryButtons = document.getElementById("category-buttons");
    const productList = document.getElementById("product-list");
  
    categoryButtons.style.display = "grid";
    productList.innerHTML = "";
  }
  