// Elementos del Modal
const loginModal = document.getElementById("login-modal");
const loginBtn = document.getElementById("login-btn");
const closeBtn = document.querySelector(".close");

// Mostrar el Modal al hacer clic en el botón de Iniciar Sesión
loginBtn.addEventListener("click", () => {
    loginModal.style.display = "block";
});

// Ocultar el Modal al hacer clic en el botón de cerrar
closeBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
});

// Ocultar el Modal al hacer clic fuera del contenido
window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
        loginModal.style.display = "none";
    }
});


// Referencias a los modales
const signupModal = document.getElementById('signup-modal');
const createAccountLink = document.getElementById('create-account');

// Cerrar modales
const closeButtons = document.querySelectorAll('.close');

closeButtons.forEach(button => {
    button.onclick = () => {
        signupModal.style.display = 'none';
        loginModal.style.display = 'none';
    };
});

// Abrir el modal de Crear Cuenta desde el enlace
createAccountLink.onclick = (e) => {
    e.preventDefault();
    loginModal.style.display = 'none'; // Cerrar el modal de inicio de sesión
    signupModal.style.display = 'flex'; // Mostrar el modal de crear cuenta
};

// Cerrar modales al hacer clic fuera de ellos
window.onclick = (event) => {
    if (event.target === signupModal) {
        signupModal.style.display = 'none';
    }
};

document.getElementById("forgot-password-form").addEventListener("submit", function (e) {
    e.preventDefault(); // Evita el envío tradicional del formulario

    const emailInput = document.getElementById("recovery-email").value;
    const alertBox = document.getElementById("forgot-password-alert");

    // Simula la validación (puedes sustituir esto con una petición al servidor)
    if (emailInput === "") {
        alertBox.classList.remove("d-none", "alert-success");
        alertBox.classList.add("alert-danger");
        alertBox.textContent = "Por favor, ingresa un correo válido.";
    } else {
        alertBox.classList.remove("d-none", "alert-danger");
        alertBox.classList.add("alert-success");
        alertBox.textContent = "Se ha enviado un enlace de recuperación a tu correo.";
    }
});

// Lista para almacenar los ingredientes disponibles
const ingredients = [];

// Función para agregar un ingrediente
function addIngredient() {
    const ingredientName = document.getElementById("ingredient-name").value;
    if (ingredientName.trim() !== "") {
        ingredients.push(ingredientName);
        updateIngredientList();
        updateProductIngredients();
        document.getElementById("ingredient-name").value = "";
        alert("Ingrediente agregado con éxito.");
    } else { alert("Por favor, ingresa un nombre para el ingrediente."); }
}

document.addEventListener("DOMContentLoaded", function () {
    fetch("/api/products/promotions") // Llamada a la API
        .then(response => response.json())
        .then(data => {
            const promoContainer = document.getElementById("promotions");
            promoContainer.innerHTML = ""; // Limpia cualquier contenido previo

            data.forEach(promo => {
                const promoElement = document.createElement("div");
                promoElement.classList.add("promo-slider");
                promoElement.innerHTML = `<img src="${promo.imagen_url}" alt="${promo.nombre}" />`;
                promoContainer.appendChild(promoElement);
            });
        })
        .catch(error => console.error("Error cargando promociones:", error));
});

document.addEventListener("DOMContentLoaded", function () {
    actualizarContadorCarrito();

    // Escuchar eventos en todos los botones "Agregar al carrito"
    document.querySelectorAll(".add-to-cart-btn").forEach(button => {
        button.addEventListener("click", function (event) {
            const productCard = event.target.closest(".product-card");
            const productName = productCard.querySelector("h3").textContent;
            const productPrice = parseFloat(productCard.querySelector("p").textContent.replace("$", ""));
            const productImg = productCard.querySelector("img").src;

            agregarAlCarrito(productName, productPrice, productImg);
        });
    });
});

function agregarAlCarrito(nombre, precio, imagen) {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

    // Buscar si el producto ya está en el carrito
    let productoExistente = carrito.find(producto => producto.nombre === nombre);

    if (productoExistente) {
        productoExistente.cantidad += 1;  // Si ya existe, aumenta la cantidad
    } else {
        carrito.push({ nombre, precio, imagen, cantidad: 1 }); // Si no existe, agrégalo
    }

    localStorage.setItem("carrito", JSON.stringify(carrito)); // Guardar en `localStorage`
    actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let totalProductos = carrito.reduce((acc, producto) => acc + producto.cantidad, 0);

    document.getElementById("cart-btn").textContent = `Carrito (${totalProductos})`;
}



// Actualizar lista de ingredientes en el selector de productos 
function updateProductIngredients() { const ingredientSelect = document.getElementById("product-ingredients"); ingredientSelect.innerHTML = ""; ingredients.forEach((ingredient) => { const option = document.createElement("option"); option.value = ingredient; option.textContent = ingredient; ingredientSelect.appendChild(option); }); }

// Función para eliminar un ingrediente 
function removeIngredient(index) { ingredients.splice(index, 1); updateIngredientList(); updateProductIngredients(); }

// Función para agregar un producto (solo muestra mensaje por ahora) 
function addProduct() { alert("Aquí puedes agregar un nuevo producto completando el formulario."); }
