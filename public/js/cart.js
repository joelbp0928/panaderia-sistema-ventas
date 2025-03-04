document.addEventListener("DOMContentLoaded", function () {
    mostrarCarrito();
    
    document.getElementById("vaciar-carrito").addEventListener("click", function () {
      localStorage.removeItem("carrito");
      mostrarCarrito();
    });
  });
  
  function mostrarCarrito() {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let cartContainer = document.getElementById("cart-items");
    let totalCarrito = document.getElementById("total-carrito");
    
    cartContainer.innerHTML = ""; // Limpiar la tabla
    let total = 0;
  
    carrito.forEach((producto, index) => {
      let totalProducto = producto.precio * producto.cantidad;
      total += totalProducto;
  
      let fila = document.createElement("tr");
      fila.innerHTML = `
        <td><img src="${producto.imagen}" width="50"></td>
        <td>${producto.nombre}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>
          <button onclick="cambiarCantidad(${index}, -1)">-</button>
          ${producto.cantidad}
          <button onclick="cambiarCantidad(${index}, 1)">+</button>
        </td>
        <td>$${totalProducto.toFixed(2)}</td>
        <td><button onclick="eliminarProducto(${index})">❌</button></td>
      `;
      cartContainer.appendChild(fila);
    });
  
    totalCarrito.textContent = total.toFixed(2);
  }
  
  function cambiarCantidad(index, cambio) {
    let carrito = JSON.parse(localStorage.getItem("carrito"));
    
    carrito[index].cantidad += cambio;
    if (carrito[index].cantidad <= 0) {
      carrito.splice(index, 1);
    }
  
    localStorage.setItem("carrito", JSON.stringify(carrito));
    mostrarCarrito();
  }
  
  function eliminarProducto(index) {
    let carrito = JSON.parse(localStorage.getItem("carrito"));
    carrito.splice(index, 1);
    
    localStorage.setItem("carrito", JSON.stringify(carrito));
    mostrarCarrito();
  }
  