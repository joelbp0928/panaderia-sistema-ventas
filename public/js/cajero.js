import { cargarConfiguracion, configuracionGlobal } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js';
import { getCDMXISOString } from './dateLocalDate.js'; // Asegúrate de que la ruta sea correcta
import { supabase } from './supabase-config.js';
import { getLocalDateString } from "./dateLocalDate.js";
import { registrarCorteCaja, cargarHistorialCortes, abrirCajaConFondo, verificarEstadoCaja, bloquearOperacionesSiCajaCerrada } from './corteCaja.js';

// Variable para almacenar los productos del ticket
let productosTicket = [];
let ticketActual = null;

const sonidoTeclado = new Audio('../sounds/teclado.wav');
sonidoTeclado.volume = 1.0; // Volumen suave

const input = document.getElementById("amount-input");
const totalSpan = document.getElementById("total-amount");
const changeSpan = document.getElementById("change");

// Verificación automática al cargar la página
/*(async function () {
  const today = getLocalDateString();
  const { data: corteHoy } = await supabase
    .from('cortes_caja')
    .select('id')
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .eq('cerrado', false) // 🔥 SOLO si no está cerrado
    .limit(1);

  if (!corteHoy || corteHoy.length === 0) {
    const abrioCaja = await abrirCajaConFondo(true);
    if (!abrioCaja) {
      // Si no se abrió caja, bloquear operaciones
      bloquearOperacionesSiCajaCerrada();
    }
  }

})();*/

function actualizarCambio() {
  const total = parseFloat(document.getElementById('total-amount').textContent.replace("$", "")) || 0;
  const pagado = parseFloat(document.getElementById('amount-input').value) || 0;
  const cambio = pagado - total;

  const cambioElement = document.getElementById('change');

  // Limpiar clases previas
  cambioElement.classList.remove('text-danger', 'text-success', 'cambio-cero');

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
    cambioElement.classList.add('cambio-cero'); // Color primario
  }

  cambioElement.textContent = textoCambio;

  // Animación
  cambioElement.classList.remove('fade-change');
  void cambioElement.offsetWidth; // Forzar reflow
  cambioElement.classList.add('fade-change');
}

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

    // Cambiar el texto y el color según el estado
    let estadoTexto = '';
    let color = '';

    switch (estado) {
      case 'pendiente':
        estadoTexto = 'Pendiente';
        color = 'yellow';
        break;
      case 'preparacion':
        estadoTexto = 'En Preparación';
        color = 'blue';
        break;
      case 'empacado':
        estadoTexto = 'Empacado';
        color = 'green';
        break;
      case 'pagado':
        estadoTexto = 'Pagado';
        color = 'purple';
        break;
      case 'cancelado':
        estadoTexto = 'Cancelado';
        color = 'red';
        break;
      default:
        estadoTexto = 'Estado desconocido';
        color = 'gray';
    }

    // Mostrar el estado con color
    document.getElementById('ticket-status').innerHTML = `
       <span style="font-weight: bold;" class="estado-${estado}"><i class="fa-solid fa-traffic-light"></i> ${estadoTexto}</span>
    `;

    // Habilitar o deshabilitar el cobro según el estado
    /*  if (estado === 'empacado') {
        document.getElementById("submit-payment").disabled = false;
      } else {
        document.getElementById("submit-payment").disabled = true;
      }
  */
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
  // Mostrar el spinner mientras se cargan los datos
  document.getElementById("loading-spinner").style.display = "flex";

  await verificarSesion();
  cargarConfiguracion();
  configurarBotonesPago();
  
  // Verificar estado de caja al cargar
  const cajaAbierta = await verificarEstadoCaja();
  console.log(cajaAbierta)
  if (!cajaAbierta) {
    // Mostrar modal para abrir caja inmediatamente
    const abrioCaja = await abrirCajaConFondo(true);
    console.log(abrioCaja)
    if (!abrioCaja) {
      // Si no abrió caja, bloquear operaciones
      await bloquearOperacionesSiCajaCerrada();
    }
  }

  // Ocultar el spinner cuando se haya cargado todo
  document.getElementById("loading-spinner").style.display = "none";

  document.getElementById("logout-btn").addEventListener("click", cerrarSesion);
};

async function cargarProductosTicket() {
  if (!ticketActual) return;

  try {
    const { data, error } = await supabase
      .from('pedido_productos')
      .select(`
        cantidad,
        precio_unitario,
        descuento,
        total,
        promocion_id,
        promociones:promocion_id (id, nombre, tipo),
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
      descuento: item.descuento || 0,
      subtotal: item.total,
      promocionAplicada: item.promociones || null
    }));

    // Aquí obtenemos el total directamente desde la tabla 'pedidos'
    const { data: totalData, error: totalError } = await supabase
      .from('pedidos')
      .select('total')
      .eq('id', ticketActual.id)
      .single();  // 'single' porque solo esperamos un único registro

    if (totalError || !totalData) throw totalError;

    document.getElementById('total-amount').classList.add('updated');
    setTimeout(() => {
      document.getElementById('total-amount').classList.remove('updated');
    }, 500);  // El efecto dura medio segundo

    // Actualizar el total en el frontend con el valor obtenido de la DB
    document.getElementById('total-amount').textContent = `$${totalData.total.toFixed(2)}`;

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

    // Determinar si tiene promoción aplicada
    const tienePromocion = producto.promocionAplicada !== null;
    const esProductoGratis = tienePromocion &&
      producto.promocionAplicada.tipo === 'buy-get' &&
      producto.descuento > 0;

    // Construir el contenido de la fila
    let contenidoFila = `
      <td>${producto.nombre}</td>
      <td>${producto.cantidad}</td>
      <td>$${producto.precioUnitario.toFixed(2)}</td>
    `;

    // Mostrar diferente si tiene descuento o es gratis
    if (esProductoGratis) {
      const precioOriginal = (producto.precioUnitario * producto.cantidad).toFixed(2);
      const precioConDescuento = (producto.precioUnitario * producto.cantidad - producto.descuento).toFixed(2);

      contenidoFila += `
  <td class="text-success" style="word-wrap: break-word;">
    <span class="text-decoration-line-through text-muted" style="font-size: 0.9em;">$${precioOriginal}</span>
    <span style="display: block; font-weight: bold;">$${precioConDescuento}</span>
    <div class="badge bg-success" style="margin-top: 2px; font-size: 0.7em;">
      <i class="fas fa-gift"></i> Promo
    </div>
  </td>
`;
    } else if (tienePromocion) {
      contenidoFila += `
        <td>
          $${producto.subtotal.toFixed(2)}
          <div class="badge bg-info mt-1">
            <i class="fas fa-tag"></i> ${producto.promocionAplicada.nombre}
          </div>
        </td>
      `;
    } else {
      contenidoFila += `<td>$${producto.subtotal.toFixed(2)}</td>`;
    }

    fila.innerHTML = contenidoFila;
    tablaBody.appendChild(fila);
    total += producto.subtotal;
  });

  // Mostrar resumen de promociones
  const promocionesAplicadas = productosTicket
    .filter(p => p.promocionAplicada)
    .map(p => p.promocionAplicada.nombre)
    .filter((v, i, a) => a.indexOf(v) === i); // Eliminar duplicados

  if (promocionesAplicadas.length > 0) {
    const filaPromociones = document.createElement('tr');
    filaPromociones.classList.add('promocion-row');
    filaPromociones.innerHTML = `
      <td colspan="3" class="text-end"><strong>Promociones aplicadas:</strong></td>
      <td class="text-success">
        ${promocionesAplicadas.join(', ')}
      </td>
    `;
    tablaBody.appendChild(filaPromociones);
  }

  // Actualizar total
  document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;
}


document.querySelectorAll(".keypad-btn").forEach(button => {
  button.addEventListener("click", function () {
    sonidoTeclado.play();
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
  // Validar si no hay ticket ingresado
  if (!ticketActual || !ticketActual.estado) {
    Swal.fire({
      icon: 'error',
      title: '¡No hay ticket!',
      text: 'Por favor, escanea o ingresa un código de ticket primero.',
      confirmButtonText: 'Entendido',
      background: '#f8d7da',
      iconColor: '#dc3545',
      confirmButtonColor: '#dc3545'
    });
    return;
  }

  // Obtener el total directamente desde la base de datos
  let total = 0;
  try {
    const { data: totalData, error: totalError } = await supabase
      .from('pedidos')
      .select('total')
      .eq('id', ticketActual.id)
      .single();  // 'single' porque solo esperamos un único registro

    if (totalError || !totalData) {
      throw totalError;
    }
    total = totalData.total;
  } catch (error) {
    console.error("Error al obtener el total del pedido:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el total',
      text: 'Hubo un problema al obtener el total del pedido desde la base de datos.',
    });
    return;
  }

  const montoPagado = parseFloat(document.getElementById('amount-input').value) || 0;

  // Mostrar alerta según el estado
  switch (ticketActual.estado) {
    case 'pagado':
      Swal.fire({
        icon: 'info',
        title: '¡Ticket ya pagado! 🛑',
        text: 'Este ticket ya ha sido pagado, no es posible realizar otro cobro.',
        confirmButtonText: 'Entendido',
        background: '#f8f9fa',
        iconColor: '#28a745',
        confirmButtonColor: '#28a745',
        footer: '<small>No se puede procesar el pago dos veces para el mismo ticket.</small>',
      });
      return; // Detenemos la ejecución si ya está pagado

    case 'preparacion':
      Swal.fire({
        icon: 'warning',
        title: 'En Preparación ⚙️',
        text: 'El pedido está en preparación. No puedes realizar el pago hasta que esté empacado.',
        confirmButtonText: 'Entendido',
      });
      return; // Detenemos la ejecución si está en preparación

    case 'pendiente':
      Swal.fire({
        icon: 'warning',
        title: 'Pendiente ⏳',
        text: 'Este pedido aún está pendiente. Por favor, espera a que sea procesado antes de pagar.',
        confirmButtonText: 'Entendido',
      });
      return; // Detenemos la ejecución si está pendiente

    case 'empacado':
      // Si el estado es "empacado", procesamos el pago
      break;

    case 'cancelado':
      Swal.fire({
        icon: 'error',
        title: '¡Ticket Cancelado! 🚫',
        text: 'Este ticket ha sido cancelado, no se puede realizar el pago.',
        confirmButtonText: 'Entendido',
        background: '#f8d7da', // Color de fondo rojo claro para alertas
        iconColor: '#dc3545', // Rojo
        confirmButtonColor: '#dc3545', // Rojo
      });
      return; // Detenemos la ejecución si está cancelado

    default:
      Swal.fire({
        icon: 'error',
        title: 'Estado desconocido 🚨',
        text: 'El estado del ticket es desconocido. No se puede procesar el pago.',
        confirmButtonText: 'Entendido',
      });
      return;
  }

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
    // Registrar el cobro en la tabla de pedidos
    const { data: sessionData } = await supabase.auth.getSession();
    const empleadoCobroId = sessionData.session.user.id;

    const { error } = await supabase
      .from('historial_cobros')
      .insert([{
        pedido_id: ticketActual.id,
        empleado_cobro_id: empleadoCobroId,
        monto_cobrado: montoPagado,
        fecha_cobro: getCDMXISOString(), // Usamos la función aquí
        estado: 'pagado'
      }]);

    if (error) throw error;

    const { errorpedidos } = await supabase
      .from('pedidos')
      .update({
        estado: 'pagado',
        empleado_cobro_id: empleadoCobroId
      })
      .eq('id', ticketActual.id);

    if (errorpedidos) throw error;

    const sonido = new Audio('../sounds/success.mp3');
    sonido.volume = 0.8;
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
    }, 800); // 500ms debería ser suficiente para cargar todo


    // Reset visual
    productosTicket = [];
    ticketActual = null;
    actualizarTablaProductos();
    document.getElementById('amount-input').value = '';
    document.getElementById('total-amount').textContent = '00.00';
    document.getElementById('change').textContent = '0.00';
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

function generarTicketHTML(ticket, productos, pagado, cambio) {
  const fecha = new Date(ticket.fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let filas = '';
  let promocionesAplicadas = [];

  productos.forEach(p => {
    const tienePromocion = p.promocionAplicada !== null;
    const esProductoGratis = tienePromocion && p.descuento > 0;

    if (tienePromocion && !promocionesAplicadas.includes(p.promocionAplicada.nombre)) {
      promocionesAplicadas.push(p.promocionAplicada.nombre);
    }

    filas += `
      <tr>
        <td style="font-size:15px">
          ${p.nombre}${tienePromocion ? ' <i class="fas fa-tag"></i>' : ''}
        </td>
        <td style="font-size:15px" align="center">
           ${p.cantidad}
        </td>
        <td style="font-size:15px" align="right">
          $ ${p.precioUnitario.toFixed(2)}
        </td>
        <td style="font-size:18px" align="right">
          ${esProductoGratis ?
        `<span style="font-size:14px" class="old-price">
              $ ${(p.precioUnitario * p.cantidad).toFixed(2)}
             </span><br>
             $ ${p.subtotal.toFixed(2)}` :
        `$ ${p.subtotal.toFixed(2)}`}
        </td>
      </tr>`;
  });

  // Sección de promociones
  let promocionesHTML = promocionesAplicadas.length > 0 ? `
    <div class="divider"></div>
    <p style="font-size:18px" class="promo-title">
      <i class="fas fa-percentage"></i> <b>PROMOCIONES APLICADAS:</b>
    </p>
    ${promocionesAplicadas.map(p => `
      <p style="font-size:18px" class="promo-item">
        <i class="fas fa-gift"></i> ${p}
      </p>`).join('')}
  ` : '';

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          * {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            line-height: 1.3;
          }
          body {
            width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header {
            text-align: center;
            margin-bottom: 3mm;
          }
          .logo {
            max-width: 50mm;
            max-height: 20mm;
            margin: 0 auto 2mm;
            display: block;
            filter: contrast(1.2) brightness(0.9);
          }
          .company-name {
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 2mm;
            letter-spacing: 1px;
          }
          .ticket-info {
            text-align: center;
            margin-bottom: 3mm;
          }
          .ticket-info p {
            font-size: 18px;
            margin: 2mm 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 3mm 0;
          }
          th {
            font-weight: bold;
            border-bottom: 2px solid #000;
            padding: 2mm 0;
            text-align: left;
            font-size: 18px;
          }
          td {
            padding: 1.5mm 0;
            vertical-align: middle;
          }
          .divider {
            border-top: 2px dashed #000;
            margin: 4mm 0;
            height: 2px;
          }
          .totals {
            text-align: right;
            margin: 4mm 0;
          }
          .totals p {
            font-size: 17px;
            font-weight: bold;
            margin: 2.5mm 0;
          }
          .qrcode-container {
            text-align: center;
            margin: 4mm 0;
          }
          .qrcode {
            width: 45mm;
            height: 45mm;
            filter: contrast(1.3);
          }
          .footer {
            text-align: center;
            margin-top: 4mm;
          }
          .footer p {
            font-size: 15px;
            margin: 2mm 0;
          }
          .old-price {
            text-decoration: line-through;
            color: #666;
            font-size: 14px;
          }
          .promo-title {
            margin-bottom: 3mm;
          }
          .promo-item {
            margin-left: 3mm;
          }
          .fa-times {
            font-size: 14px;
            opacity: 0.7;
          }
          .fa-dollar-sign {
            font-size: 14px;
          }
          @media print {
            body {
              width: 80mm !important;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>
      </head>
      <body>
        <div class="header">
          ${configuracionGlobal.logo_url ?
      `<img src="${configuracionGlobal.logo_url}" class="logo" onerror="this.remove()"/>` :
      `<p class="company-name">
              <i class="fas fa-store"></i> ${configuracionGlobal.nombre_empresa}
            </p>`
    }
        </div>

        <div class="ticket-info">
          <p><i class="fas fa-receipt"></i> <b>Ticket:</b> ${ticket.codigo_ticket}</p>
          <p><i class="far fa-calendar-alt"></i> <b>Fecha:</b> ${fecha}</p>
          <p><i class="fas fa-user-tie"></i> <b>Cajero:</b> ${document.getElementById("employee-name").textContent.replace("Sesión: ", "")}</p>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th> Producto</th>
              <th align="right"> Cant</th>
              <th align="right"> P.U.</th>
              <th align="right"> Subtotal</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        ${promocionesHTML}

        <div class="divider"></div>

        <div class="totals">
          <p><i class="fas fa-file-invoice-dollar"></i> <b>TOTAL:</b> $${ticket.total.toFixed(2)}</p>
          <p><i class="fas fa-money-bill-wave"></i> <b>PAGADO:</b> $${pagado.toFixed(2)}</p>
          <p><i class="fas fa-exchange-alt"></i> <b>CAMBIO:</b> $${cambio.toFixed(2)}</p>
        </div>

        <div class="qrcode-container">
          <canvas class="qrcode" id="qrcode"></canvas>
        </div>

        <div class="footer">
          <p><i class="fas fa-heart"></i> ¡Gracias por su compra! <i class="fas fa-heart"></i></p>
          ${configuracionGlobal.direccion ? `<p><i class="fas fa-map-marker-alt"></i> ${configuracionGlobal.direccion}</p>` : ''}
          ${configuracionGlobal.telefono ? `<p><i class="fas fa-phone"></i> Tel: ${configuracionGlobal.telefono}</p>` : ''}
        </div>

        <script>
          (function() {
            try {
              // QR solo con el código del ticket
              const qrContent = '${ticket.codigo_ticket}';
              
              new QRious({
                element: document.getElementById('qrcode'),
                value: qrContent,
                size: 300,
                level: 'H',
                padding: 15,
                background: '#fff',
                foreground: '#000'
              });
            
              // Esperar a que carguen los iconos
              setTimeout(() => {
              }, 800);
            } catch(e) {
              console.error('Error generando QR:', e);
            }
          })();
        </script>
      </body>
    </html>
  `;
}

// Modifica la consulta inicial para incluir los productos del pedido
async function cargarHistorialCobros() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session.user.id;

  const desde = document.getElementById("filtro-fecha-desde").value;
  const hasta = document.getElementById("filtro-fecha-hasta").value;

  try {
    let query = supabase
      .from("historial_cobros")
      .select(`
        id,
        fecha_cobro,
        monto_cobrado,
        pedidos(
          codigo_ticket,
          total,
          pedido_productos(count)
        )
      `)
      .eq('empleado_cobro_id', userId)
      .order('fecha_cobro', { ascending: false });

    // Convertir las fechas a un formato sin horas
    if (desde) query = query.gte("fecha_cobro", `${desde}T00:00:00`);
    if (hasta) query = query.lte("fecha_cobro", `${hasta}T23:59:59`);

    const { data: cobros, error } = await query;

    const badgeResultados = document.getElementById("badge-resultados");
    const cantidadPedidos = document.getElementById("cantidad-pedidos");
    const lista = document.getElementById("lista-historial");

    lista.innerHTML = "";

    if (error) {
      console.error("Error en consulta:", error);
      badgeResultados.style.display = "none";
      lista.innerHTML = `<li class="list-group-item text-danger">Error al cargar cobros: ${error.message}</li>`;
      return;
    }

    if (!cobros || cobros.length === 0) {
      badgeResultados.style.display = "none";
      lista.innerHTML = `<li class="list-group-item text-muted">No se encontraron cobros</li>`;
      return;
    }

    cantidadPedidos.textContent = cobros.length;
    badgeResultados.style.display = "block";
    setTimeout(() => badgeResultados.classList.add("show"), 50);

    // Agrupar cobros por día
    const cobrosPorDia = {};
    cobros.forEach(cobro => {
      const fechaKey = new Date(cobro.fecha_cobro).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!cobrosPorDia[fechaKey]) {
        cobrosPorDia[fechaKey] = [];
      }
      cobrosPorDia[fechaKey].push(cobro);
    });

    // Decidir cómo mostrar los resultados
    if (Object.keys(cobrosPorDia).length > 1) {
      mostrarCobrosAgrupados(cobrosPorDia, lista);
    } else {
      mostrarCobrosListaSimple(cobros, lista);
    }

  } catch (err) {
    console.error("Error inesperado:", err);
    const lista = document.getElementById("lista-historial");
    lista.innerHTML = `<li class="list-group-item text-danger">Error inesperado: ${err.message}</li>`;
  }
}


function mostrarCobrosAgrupados(cobrosPorDia, contenedor) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.id = 'cobros-accordion';
  contenedor.appendChild(accordion);

  Object.entries(cobrosPorDia).forEach(([fecha, cobrosDelDia], index) => {
    const totalDia = cobrosDelDia.reduce((sum, cobro) => sum + cobro.pedidos.total, 0);
    const totalPedidosDia = cobrosDelDia.length;

    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';

    const accordionHeader = document.createElement('h2');
    accordionHeader.className = 'accordion-header';
    accordionHeader.id = `heading-${index}`;

    const accordionButton = document.createElement('button');
    accordionButton.className = 'accordion-button collapsed';
    accordionButton.type = 'button';
    accordionButton.dataset.bsToggle = 'collapse';
    accordionButton.dataset.bsTarget = `#collapse-${index}`;
    accordionButton.innerHTML = `
          <span class="fw-bold">${fecha}</span>
          <span class="badge bg-primary ms-2">${totalPedidosDia} pedidos</span>
          <span class="badge bg-success ms-2">$${totalDia.toFixed(2)}</span>
      `;

    accordionHeader.appendChild(accordionButton);
    accordionItem.appendChild(accordionHeader);

    const accordionCollapse = document.createElement('div');
    accordionCollapse.id = `collapse-${index}`;
    accordionCollapse.className = 'accordion-collapse collapse';
    accordionCollapse.setAttribute('aria-labelledby', `heading-${index}`);

    const accordionBody = document.createElement('div');
    accordionBody.className = 'accordion-body p-0';

    cobrosDelDia.forEach(cobro => {
      // Obtener la cantidad de productos del pedido
      const cantidadProductos = cobro.pedidos.pedido_productos[0]?.count || 0;

      const item = document.createElement('div');
      item.className = 'list-group-item list-group-item-action border-0';
      item.innerHTML = `
              <div class="d-flex justify-content-between align-items-start">
                  <div>
                      <strong><i class="fa-solid fa-ticket"></i> ${cobro.pedidos.codigo_ticket}</strong>
                      <span class="badge bg-success ms-2">Cobrado</span>
                  </div>
                  <small class="text-muted">${new Date(cobro.fecha_cobro).toLocaleTimeString()}</small>
              </div>
              <div class="mt-2">
                <small><i class="fa-solid fa-boxes"></i> Productos: ${cantidadProductos}</small>
                <small class="ms-2"><i class="fa-solid fa-receipt"></i> Total: $${cobro.pedidos.total.toFixed(2)}</small>
              </div>
          `;
      item.onclick = (e) => {
        e.stopPropagation();
        verDetalleCobro(cobro.id);
      };
      accordionBody.appendChild(item);
    });

    accordionCollapse.appendChild(accordionBody);
    accordionItem.appendChild(accordionCollapse);
    accordion.appendChild(accordionItem);
  });

  new bootstrap.Collapse(document.getElementById('cobros-accordion'), {
    toggle: false
  });
}

function mostrarCobrosListaSimple(cobros, contenedor) {
  cobros.forEach(cobro => {
    const cantidadProductos = cobro.pedidos.pedido_productos[0]?.count || 0;
    const item = document.createElement('div');
    item.className = 'list-group-item list-group-item-action fade-in';
    item.innerHTML = `
          <div class="d-flex justify-content-between align-items-start">
              <div>
                  <strong><i class="fa-solid fa-ticket"></i> ${cobro.pedidos.codigo_ticket}</strong>
                  <span class="badge bg-success ms-2">Cobrado</span>
              </div>
              <small class="text-muted">${new Date(cobro.fecha_cobro).toLocaleString()}</small>
          </div>
          <div class="mt-2">
              <small><i class="fa-solid fa-boxes"></i> Productos: ${cantidadProductos}</small>
              <small class="ms-2"><i class="fa-solid fa-receipt"></i> Total: $${cobro.pedidos.total.toFixed(2)}</small>
          </div>
      `;
    item.onclick = () => verDetalleCobro(cobro.id);
    contenedor.appendChild(item);
  });
}

// Event listeners
document.getElementById("open-history-btn").addEventListener("click", async () => {
  new bootstrap.Offcanvas(document.getElementById("history-sidebar")).show();

  // Establecer fechas por defecto (hoy)
  const hoy = getLocalDateString();
  document.getElementById("filtro-fecha-desde").value = hoy;
  document.getElementById("filtro-fecha-hasta").value = hoy;

  await cargarHistorialCobros();
});

document.getElementById("btn-aplicar-filtros").addEventListener("click", cargarHistorialCobros);

async function verDetalleCobro(cobroId) {
  if (!cobroId) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se ha seleccionado un cobro válido.",
    });
    return;
  }

  // Obtener los detalles del cobro
  const { data, error } = await supabase
    .from("historial_cobros")
    .select(`
      id,
      pedido_id,
      monto_cobrado,
      fecha_cobro,
      estado,
      pedidos (
        codigo_ticket,
        estado,
        total,
        fecha,
        empleado_id,
        empleado:empleado_id(nombre),
        origen,
        pedido_productos (
          producto_id,
          cantidad,
          precio_unitario,
          productos (
            nombre,
            imagen_url
          ),
          descuento,
          total,
          promocion_id
        )
      )
    `)
    .eq("id", cobroId); // Asegúrate de que 'pedido_id' está bien relacionado.

  if (error) {
    console.error("Error al cargar detalles del cobro:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `Detalles del cobro no encontrados. ${error.message}`,
    });
    return;
  }

  // Comprobamos si hay datos del cobro
  if (!data || data.length === 0) {
    Swal.fire({
      icon: "error",
      title: "No se encontraron detalles",
      text: "No se encontraron productos para este cobro.",
    });
    return;
  }

  const cobro = data[0];  // Asumimos que 'data' contiene solo un cobro
  const productos = cobro.pedidos.pedido_productos;

  // Generar la tabla de productos
  let detalleHTML = '';
  productos.forEach(item => {
    const precioOriginal = (item.precio_unitario * item.cantidad).toFixed(2);
    const precioConDescuento = (item.total).toFixed(2);

    // Solo mostrar descuento si el producto tiene uno aplicado
    const descuentoHTML = item.descuento > 0
      ? `<small class="text-muted text-decoration-line-through">$${precioOriginal}</small><br><strong class="text-success">-$${(precioOriginal - precioConDescuento).toFixed(2)}</strong>`
      : "-"; // No mostrar nada si no hay descuento

    // Crear fila para cada producto
    detalleHTML += `
      <tr>
        <td> ${item.productos.nombre}</td>
        <td> ${item.cantidad}</td>
        <td><i class="fa-solid fa-tag"></i> ${item.precio_unitario.toFixed(2)}</td>
        <td><i class="fa-solid fa-dollar-sign"></i> ${precioOriginal}</td>
        <td>${descuentoHTML}</td>
      </tr>
    `;
  });

  // Información adicional del pedido
  const nombreEmpleado = cobro.pedidos.empleado ? cobro.pedidos.empleado.nombre : "Empleado no disponible";
  const codigoTicket = cobro.pedidos.codigo_ticket;
  const totalTicket = cobro.pedidos.total.toFixed(2);
  const fechaEmpaque = new Date(cobro.pedidos.fecha).toLocaleString("es-MX");
  const origenPedido = cobro.pedidos.origen.charAt(0).toUpperCase() + cobro.pedidos.origen.slice(1); // Capitalizar la primera letra
  const cantidadProductos = cobro.pedidos.pedido_productos.reduce((total, item) => total + item.cantidad, 0);

  // Obtener los nombres de las promociones aplicadas
  const promocionesAplicadas = await Promise.all(
    productos.map(async (item) => {
      if (item.promocion_id) {
        const { data, error } = await supabase
          .from('promociones')
          .select('nombre')
          .eq('id', item.promocion_id)
          .single(); // Obtener una sola promoción
        if (error) {
          console.error('Error al obtener promoción:', error);
          return null;
        }
        return data.nombre; // Retornamos el nombre de la promoción
      }
      return null;
    })
  );

  // Eliminar duplicados en promociones aplicadas
  const promocionesUnicas = [...new Set(promocionesAplicadas.filter(Boolean))];

  // Mostrar los detalles en el modal
  document.getElementById("detalle-pedido-body").innerHTML = detalleHTML;
  document.getElementById("codigo-ticket").textContent = `${codigoTicket}`;
  document.getElementById("empleado-nombre").textContent = `${nombreEmpleado}`;
  document.getElementById("total-pedido").textContent = `$${totalTicket}`;
  document.getElementById("fecha-empaque").textContent = `${fechaEmpaque}`;
  document.getElementById("origen-pedido").textContent = `${origenPedido}`;
  document.getElementById("cantidad-productos").textContent = `${cantidadProductos}`;

  // Calcular el subtotal, promociones y total con descuentos
  const subtotal = productos.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0).toFixed(2);

  // Mostrar el desglose de precios, promociones y total
  document.getElementById("desglose").innerHTML = `
    <div><strong><i class="fa-solid fa-calculator"></i> Subtotal:</strong> $${subtotal}</div>
    ${promocionesUnicas.length ? `
    <div><strong><i class="fa-solid fa-tags"></i> Promociones Aplicadas:</strong> ${promocionesUnicas.join(', ')}</div>
    ` : ''}
    <div><strong><i class="fa-solid fa-money-bill-wave"></i> Total con Descuento:</strong> $${totalTicket}</div>
  `;

  // Mostrar modal
  new bootstrap.Modal(document.getElementById("detallePedidoModal")).show();
}

document.getElementById("btn-aplicar-filtros").addEventListener("click", cargarHistorialCobros);
