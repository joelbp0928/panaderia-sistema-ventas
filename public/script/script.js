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

// Actualizar lista de ingredientes en la tabla function 
updateIngredientList() { const ingredientList = document.getElementById("ingredients-list"); ingredientList.innerHTML = ""; ingredients.forEach((ingredient, index) => { const row = document.createElement("tr"); row.innerHTML = <td>${ingredient}</td> <td> <button class="btn btn-danger btn-sm" onclick="removeIngredient(${index})">Eliminar</button> </td>; ingredientList.appendChild(row); }); }

// Actualizar lista de ingredientes en el selector de productos 
function updateProductIngredients() { const ingredientSelect = document.getElementById("product-ingredients"); ingredientSelect.innerHTML = ""; ingredients.forEach((ingredient) => { const option = document.createElement("option"); option.value = ingredient; option.textContent = ingredient; ingredientSelect.appendChild(option); }); }

// Función para eliminar un ingrediente 
function removeIngredient(index) { ingredients.splice(index, 1); updateIngredientList(); updateProductIngredients(); }

// Función para agregar un producto (solo muestra mensaje por ahora) 
function addProduct() { alert("Aquí puedes agregar un nuevo producto completando el formulario."); }
