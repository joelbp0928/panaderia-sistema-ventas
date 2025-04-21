import { cargarConfiguracion } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js';
import { supabase } from './supabase-config.js';

// Variable para almacenar los productos del ticket
let productosTicket = [];
let ticketActual = null;

window.onload = async function () {
    await verificarSesion();
    cargarConfiguracion();

    // Obtener el ticket actual (deberías implementar esta lógica según tu aplicación)
    await obtenerTicketActual();

    // Si hay un ticket, cargar sus productos
    if (ticketActual) {
        await cargarProductosTicket();
        actualizarTablaProductos();
    }

    document.getElementById("logout-btn").addEventListener("click", cerrarSesion);

    // Configurar teclado numérico
    configurarTecladoNumerico();
    configurarBotonesPago();
};

async function obtenerTicketActual() {
    // Implementa la lógica para obtener el ticket actual del empleado
    // Esto es un ejemplo - ajusta según tu aplicación
    const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('empleado_id', sessionStorage.getItem('userId'))
        .order('fecha', { descending: true })
        .limit(1);

    if (!error && data.length > 0) {
        ticketActual = data[0];
    }
}

async function cargarProductosTicket() {
    if (!ticketActual) return;

    try {
        const { data, error } = await supabase
            .from('paddle_products')
            .select(`
                cantidad,
                presio_unitario,
                products:products_id (id, nombre, imagen_url)
            `)
            .eq('pedido_id', ticketActual.id);

        if (error) throw error;

        productosTicket = data.map(item => ({
            id: item.products.id,
            nombre: item.products.nombre,
            imagen: item.products.imagen_url,
            cantidad: item.cantidad,
            precioUnitario: item.presio_unitario,
            subtotal: item.cantidad * item.presio_unitario
        }));

    } catch (error) {
        console.error("Error al cargar productos del ticket:", error);
    }
}

function actualizarTablaProductos() {
    const tablaBody = document.querySelector('#ticket-details tbody');
    tablaBody.innerHTML = '';

    let total = 0;

    productosTicket.forEach(producto => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.cantidad}</td>
            <td>$${producto.precioUnitario.toFixed(2)}</td>
            <td>$${producto.subtotal.toFixed(2)}</td>
        `;
        tablaBody.appendChild(fila);
        total += producto.subtotal;
    });

    // Actualizar total
    document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;
}

function configurarTecladoNumerico() {
    const teclas = document.querySelectorAll('.keypad-btn:not(#clear-key)');
    const inputMonto = document.getElementById('amount-input');

    teclas.forEach(tecla => {
        tecla.addEventListener('click', () => {
            inputMonto.value += tecla.textContent;
        });
    });

    document.getElementById('clear-key').addEventListener('click', () => {
        inputMonto.value = '';
    });
}

function configurarBotonesPago() {
    const botonesPago = document.querySelectorAll('.payment-btn');
    const inputMonto = document.getElementById('amount-input');

    botonesPago.forEach(boton => {
        boton.addEventListener('click', () => {
            const valor = parseFloat(boton.querySelector('img').alt.replace('$', ''));
            const montoActual = parseFloat(inputMonto.value) || 0;
            inputMonto.value = (montoActual + valor).toFixed(2);
        });
    });

    document.getElementById('submit-payment').addEventListener('click', procesarPago);
}

async function procesarPago() {
    const total = calcularTotal();
    const montoPagado = parseFloat(document.getElementById('amount-input').value) || 0;

    if (montoPagado < total) {
        alert('El monto pagado es menor que el total');
        return;
    }

    const cambio = montoPagado - total;
    document.getElementById('change').textContent = `$${cambio.toFixed(2)}`;

    // Aquí deberías implementar la lógica para actualizar el estado del pedido
    try {
        const { error } = await supabase
            .from('peddos')
            .update({ estado: 'pagado' })
            .eq('id', ticketActual.id);

        if (error) throw error;

        alert('Pago registrado correctamente');
    } catch (error) {
        console.error('Error al registrar pago:', error);
        alert('Error al registrar pago');
    }
}

function calcularTotal() {
    return productosTicket.reduce((sum, producto) => sum + producto.subtotal, 0);
}