document.addEventListener("DOMContentLoaded", function () {
    const cartItems = document.querySelector(".cart-items");
    const totalItems = document.getElementById("total-items");
    const totalPrice = document.getElementById("total-price");
    const clearCartBtn = document.getElementById("clear-cart-btn");
  
    // Actualizar el resumen del carrito
    function updateSummary() {
      let total = 0;
      let items = 0;
  
      document.querySelectorAll(".cart-item").forEach((item) => {
        const quantity = parseInt(item.querySelector(".quantity-input").value);
        const price = parseFloat(
          item.querySelector(".cart-item-details p").textContent.replace("$", "")
        );
        total += quantity * price;
        items += quantity;
      });
  
      totalItems.textContent = items;
      totalPrice.textContent = `$${total.toFixed(2)}`;
    }
  
    // Eliminar producto
    cartItems.addEventListener("click", function (e) {
      if (e.target.classList.contains("remove-btn")) {
        e.target.closest(".cart-item").remove();
        updateSummary();
      }
    });
  
    // Actualizar cantidades
    cartItems.addEventListener("input", function (e) {
      if (e.target.classList.contains("quantity-input")) {
        updateSummary();
      }
    });
  
    // Vaciar carrito
    clearCartBtn.addEventListener("click", function () {
      cartItems.innerHTML = "";
      updateSummary();
    });
  
    updateSummary(); // Inicializa el resumen
  });
  