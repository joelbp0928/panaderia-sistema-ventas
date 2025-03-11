export function inicializarCarrito() {
 // document.getElementById("cart-btn").addEventListener("click", toggleCarrito);
}

// 🔹 Mostrar/Ocultar carrito
function toggleCarrito() {
  document.getElementById("cart").classList.toggle("open");
}

// 🔹 Agregar productos al carrito
export function agregarAlCarrito(nombre, precio, imagen) {
  let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

  let productoExistente = carrito.find(p => p.nombre === nombre);
  if (productoExistente) {
      productoExistente.cantidad++;
  } else {
      carrito.push({ nombre, precio, imagen, cantidad: 1 });
  }

  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarContadorCarrito();
}

// 🔹 Actualizar contador del carrito
function actualizarContadorCarrito() {
  let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
  let totalProductos = carrito.reduce((acc, producto) => acc + producto.cantidad, 0);
  document.getElementById("cart-btn").textContent = `Carrito (${totalProductos})`;
}
