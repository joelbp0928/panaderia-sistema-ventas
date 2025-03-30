// Obtener el token de la URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token"); // Obtener el token
const data = urlParams.get("email"); // Obtener el token
console.log("Token:" + token);
// Redirigir al usuario a la página de login
document
    .getElementById("redirect-login")
    .addEventListener("click", function () {
        window.location.href = "../index.html"; // Redirigir a la página de login
    });

// Mostrar el enlace de restablecer contraseña y redirigir a la página correspondiente
document.getElementById("reset-password-link").addEventListener("click", function () {
    // Redirigir a la página de restablecimiento de contraseña
    window.location.href = "./establecer-contraseña.html?token=" + token; // Redirigir a la página de restablecimiento de contraseña
});