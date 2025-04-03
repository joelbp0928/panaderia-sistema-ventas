import { cargarConfiguracion } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js'; // Importa la función para verificar la sesión

window.onload = async function () {
    await verificarSesion(); // Verificar si la sesión está activa
    cargarConfiguracion();

    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
    
}


















document.getElementById('submit-payment').addEventListener('click', () => {
    const total = 44.00; // Total del ticket
    const amountGiven = parseFloat(document.getElementById('amount-input').value) || 0;
    const change = amountGiven - total;

    if (change >= 0) {
        document.getElementById('change-amount').textContent = `$${change.toFixed(2)}`;
    } else {
        alert('Cantidad insuficiente.');
    }
});

// Agregar funcionalidad a botones de billetes/monedas
const paymentButtons = document.querySelectorAll('.payment-btn');
paymentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const currentAmount = parseFloat(document.getElementById('amount-input').value) || 0;
        const additionalAmount = parseFloat(btn.textContent.replace('$', ''));
        document.getElementById('amount-input').value = (currentAmount + additionalAmount).toFixed(2);
    });
});
