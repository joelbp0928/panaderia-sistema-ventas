import { cargarConfiguracion, configuracionGlobal } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js';
import { supabase } from './supabase-config.js';

// Variable para almacenar los productos del ticket
let productosTicket = [];
let ticketActual = null;


const input = document.getElementById("amount-input");
const totalSpan = document.getElementById("total-amount");
const changeSpan = document.getElementById("change");

function actualizarCambio() {
  const total = parseFloat(document.getElementById('total-amount').textContent.replace("$", "")) || 0;
  const pagado = parseFloat(document.getElementById('amount-input').value) || 0;
  const cambio = pagado - total;
  
  const cambioElement = document.getElementById('change');
  
  // Limpiar clases previas
  cambioElement.classList.remove('text-danger', 'text-success', 'text-primary');
  
  // Determinar el texto y clase según el valor
  let textoCambio;
  if (cambio < 0) {
    textoCambio = `-$${Math.abs(cambio).toFixed(2)}`; // Agregar signo negativo
    cambioElement.classList.add('text-danger'); // Rojo
  } else if (cambio > 0) {
    textoCambio = `$${cambio.toFixed(2)}`; // Positivo (sin signo)
    cambioElement.classList.add('text-success'); // Verde
  } else {
    textoCambio = `$${cambio.toFixed(2)}`; // Cero
    cambioElement.classList.add('text-primary'); // Color primario
  }
  
  cambioElement.textContent = textoCambio;
  
  // Animación
  cambioElement.classList.remove('fade-change');
  void cambioElement.offsetWidth; // Forzar reflow
  cambioElement.classList.add('fade-change');
}

const estiloAnimacion = document.createElement('style');
estiloAnimacion.textContent = `
  .fade-change {
    animation: fadeFlash 0.4s ease-in-out;
  }

  @keyframes fadeFlash {
    0% { background-color: #d1ffd6; }
    50% { background-color: #b4f5c3; }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(estiloAnimacion);

input.addEventListener("input", actualizarCambio);
input.addEventListener("change", actualizarCambio);
document.getElementById("codigo-ticket-input").addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const codigo = e.target.value.trim();
    if (!codigo) return;

    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("codigo_ticket", codigo)
      .single();

    if (error || !data) {
      Swal.fire({
        icon: "error",
        title: "Ticket no encontrado",
        text: "Verifica el código e intenta de nuevo",
      });
      return;
    }

    ticketActual = data;
    const estado = ticketActual.estado || 'desconocido';
    const estadoTexto = (estado === 'pagado')
      ? '<span style="color:green;font-weight:bold;">PAGADO</span>'
      : '<span style="color:red;font-weight:bold;">PENDIENTE DE PAGO</span>';

    document.getElementById('ticket-status').innerHTML = `Estado: ${estadoTexto}`;

    await cargarProductosTicket();
    actualizarTablaProductos();
    document.getElementById("amount-input").value = "";
    document.getElementById("change").textContent = "$0.00";

    Swal.fire({
      icon: "success",
      title: "Ticket cargado",
      text: `Folio: ${ticketActual.folio_secuencial || "N/A"}`,
      timer: 1500,
      showConfirmButton: false,
    });
  }
});

window.onload = async function () {
  await verificarSesion();
  cargarConfiguracion();

  // Si hay un ticket, cargar sus productos
  /* if (ticketActual) {
       await cargarProductosTicket();
       actualizarTablaProductos();
   }*/

  document.getElementById("logout-btn").addEventListener("click", cerrarSesion);

  // Configurar teclado numérico
  // configurarTecladoNumerico();
  configurarBotonesPago();
};

async function cargarProductosTicket() {
  if (!ticketActual) return;

  try {
    const { data, error } = await supabase
      .from('pedido_productos')
      .select(`
                cantidad,
                precio_unitario,
                productos:producto_id (id, nombre, imagen_url)
            `)
      .eq('pedido_id', ticketActual.id);

    if (error) throw error;

    productosTicket = data.map(item => ({
      id: item.productos.id,
      nombre: item.productos.nombre,
      imagen: item.productos.imagen_url,
      cantidad: item.cantidad,
      precioUnitario: item.precio_unitario,
      subtotal: item.cantidad * item.precio_unitario
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
    fila.classList.add('producto-row');

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

document.querySelectorAll(".keypad-btn").forEach(button => {
  button.addEventListener("click", function () {
    const value = this.getAttribute("data-num");
    const quantityInput = document.getElementById("amount-input");
    // Si es un número, lo agregamos al campo de entrada
    if (value !== "C" && value !== "backspace") {
      // Si el campo está vacío o es el primer dígito después de abrir el modal
      if (quantityInput.value === "0" || quantityInput.dataset.fresh === "true") {
        quantityInput.value = value; // Reemplazar el valor
        quantityInput.dataset.fresh = "false"; // Marcar que ya no es "fresco"
      } else {
        quantityInput.value += value; // Concatenar normalmente
      }
    }
    // Limpiar el campo de entrada (borrar todo)
    else if (value === "C") {
      quantityInput.value = ""; // Borrar todo
      quantityInput.dataset.fresh = "true"; // Marcar como fresco al limpiar
    }
    // Retroceder (borrar un solo número)
    else if (value === "backspace") {
      // Borrar el último carácter del campo de entrada
      if (quantityInput.value.length <= 1) {
        quantityInput.value = "0";
        quantityInput.dataset.fresh = "true"; // Marcar como fresco al borrar todo
      } else {
        quantityInput.value = quantityInput.value.slice(0, -1);
      }
    }
    // Confirmar la cantidad
    else {
      mostrarToast("La cantidad debe ser mayor que 0.", "warning");
      marcarErrorCampo("amount-input", "Ingrese cantidad mayor a 0.")

    }
    actualizarCambio(); // 👈 Y también aquí
  });
});

function configurarBotonesPago() {
  const botonesPago = document.querySelectorAll('.payment-btn');
  const inputMonto = document.getElementById('amount-input');

  botonesPago.forEach(boton => {
    boton.addEventListener('click', () => {
      const valor = parseFloat(boton.querySelector('img').alt.replace('$', ''));
      const montoActual = parseFloat(inputMonto.value) || 0;
      inputMonto.value = (montoActual + valor);
      actualizarCambio(); // 👈 Y también aquí
    });
  });

  document.getElementById('submit-payment').addEventListener('click', procesarPago);
}

async function procesarPago() {
  const total = calcularTotal();
  const montoPagado = parseFloat(document.getElementById('amount-input').value) || 0;

  if (montoPagado < total) {
    Swal.fire({
      icon: "warning",
      title: "Monto insuficiente",
      text: `Faltan $${(total - montoPagado).toFixed(2)} para completar el pago.`,
    });
    return;
  }

  const cambio = montoPagado - total;
  document.getElementById('change').textContent = `$${cambio.toFixed(2)}`;

  const confirmacion = await Swal.fire({
    title: "¿Confirmar pago?",
    html: `
        <p>Total: <strong>$${total.toFixed(2)}</strong></p>
        <p>Entregado: <strong>$${montoPagado.toFixed(2)}</strong></p>
        <p>Cambio: <strong style="color:green">$${cambio.toFixed(2)}</strong></p>
      `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí, confirmar",
    cancelButtonText: "Cancelar",
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'pagado' })
      .eq('id', ticketActual.id);

    if (error) throw error;

    // 🔔 Reproducir sonido al confirmar pago
    const sonido = new Audio('../sounds/success.mp3');
    sonido.volume = 0.8; // volumen opcional
    sonido.play().catch(err => console.error("No se pudo reproducir el sonido:", err));

    Swal.fire({
      icon: "success",
      title: "Pago registrado",
      text: "El ticket ha sido marcado como pagado correctamente.",
      timer: 2000,
      showConfirmButton: false,
    });

    // Generar e imprimir ticket
    const ticketHTML = generarTicketHTML(ticketActual, productosTicket, montoPagado, cambio);
    const ventana = window.open('', '_blank', 'width=400,height=600');

    ventana.document.open();
    ventana.document.write(ticketHTML);
    ventana.document.close();

    // Usamos setTimeout para asegurar que todo esté cargado
    setTimeout(() => {
      ventana.focus();
      ventana.print();
      // Cerrar después de imprimir (con retraso para navegadores lentos)
      setTimeout(() => ventana.close(), 1000);
    }, 500); // 500ms debería ser suficiente para cargar todo

    // Reset visual
    productosTicket = [];
    ticketActual = null;
    actualizarTablaProductos();
    document.getElementById('amount-input').value = '';
    document.getElementById('change').textContent = '$0.00';
    document.getElementById('codigo-ticket-input').value = '';

  } catch (error) {
    console.error('Error al registrar pago:', error);
    Swal.fire({
      icon: "error",
      title: "Error al registrar",
      text: "Hubo un problema al marcar el ticket como pagado.",
    });
  }
}

function calcularTotal() {
  return productosTicket.reduce((sum, producto) => sum + producto.subtotal, 0);
}

function generarTicketHTML(ticket, productos, pagado, cambio) {
  const fecha = new Date(ticket.fecha).toLocaleString('es-MX');
  let filas = '';

  productos.forEach(p => {
    filas += `
        <tr>
          <td>${p.nombre}</td>
          <td>${p.cantidad}</td>
          <td>$${p.precioUnitario.toFixed(2)}</td>
          <td>$${p.subtotal.toFixed(2)}</td>
        </tr>`;
  });

  return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 10px;
              width: 280px;
              color: #000;
              margin: auto;
            }
            img.logo {
              display: block;
              max-width: 80px;
              width: 100%;
              height: auto;
              margin: 0 auto 5px auto;
            }
            h2, p {
              text-align: center;
              margin: 2px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th, td {
              padding: 4px;
              text-align: left;
              font-size: 12px;
            }
            th {
              border-bottom: 1px dashed #000;
            }
            .total {
              font-weight: bold;
              text-align: right;
            }
            .linea {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            #qrcode {
              display: block;
              margin: 10px auto;
              width: 100px;
              height: 100px;
            }
          </style>
                    <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>
        </head>
        <body>
          <img src="${configuracionGlobal.logo_url}" class="logo" />
          <h2>${configuracionGlobal.nombre_empresa}</h2>
          <p>Ticket: ${ticket.codigo_ticket}</p>
          <p>Fecha de empaque: ${fecha}</p>
          <p>Cajero: ${document.getElementById("employee-name").textContent.replace("Sesión: ", "")}</p>
  
          <div class="linea"></div>
          <table>
            <thead>
              <tr><th>Producto</th><th>Cant</th><th>PU</th><th>Sub</th></tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <div class="linea"></div>
  
          <p class="total">Total: $${ticket.total.toFixed(2)}</p>
          <p class="total">Pagado: $${pagado.toFixed(2)}</p>
          <p class="total">Cambio: $${cambio.toFixed(2)}</p>
  
          <canvas id="qrcode"></canvas>
  
          <div class="linea"></div>
          <p style="text-align:center;">¡Gracias por tu compra!</p>
          <p style="text-align:center;">K3DS powered POS 🍩</p>
           <script>
            // Generar el QR inmediatamente después de cargar la página
            (function() {
              try {
                // Contenido del QR (puedes personalizarlo)
                const qrContent = [
                  'Ticket: ${ticket.codigo_ticket}',
                  'Fecha: ${fecha}',
                  'Total: $${ticket.total.toFixed(2)}',
                  'Pagado: $${pagado.toFixed(2)}',
                  'Cambio: $${cambio.toFixed(2)}'
                ].join('\\n');
                
                // Crear el QR
                new QRious({
                  element: document.getElementById('qrcode'),
                  value: qrContent,
                  size: 100,
                  level: 'H'
                });
                
                console.log('QR generado correctamente');
              } catch(e) {
                console.error('Error generando QR:', e);
              }
            })();
          </script>
        </body>
      </html>
    `;
}

