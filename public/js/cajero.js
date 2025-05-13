import { cargarConfiguracion, configuracionGlobal } from "./config.js";
import { verificarSesion, cerrarSesion } from './auth-check.js';
import { getCDMXISOString } from './dateLocalDate.js'; // Asegúrate de que la ruta sea correcta
import { supabase } from './supabase-config.js';
import { getLocalDateString } from "./dateLocalDate.js";
import { registrarCorteCaja, cargarHistorialCortes, verDetalleCorte } from './corteCaja.js';

// Variable para almacenar los productos del ticket
let productosTicket = [];
let ticketActual = null;

const sonidoTeclado = new Audio('../sounds/teclado.wav');
sonidoTeclado.volume = 1.0; // Volumen suave

const input = document.getElementById("amount-input");
const totalSpan = document.getElementById("total-amount");
const changeSpan = document.getElementById("change");

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
      <span style="font-weight: bold;" class="estado-${estado}">Estado: ${estadoTexto}</span>
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
  await verificarSesion();
  cargarConfiguracion();

  document.getElementById("logout-btn").addEventListener("click", cerrarSesion);

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

  const total = calcularTotal();
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
    }, 500); // 500ms debería ser suficiente para cargar todo


    // Reset visual
    productosTicket = [];
    ticketActual = null;
    actualizarTablaProductos();
    document.getElementById('amount-input').value = '';
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
          <p style="text-align:center;">¡Gracias por tu compra! <i class="fa-solid fa-heart"></i></p>
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
            nombre
          )
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

  // Extraemos los detalles del cobro (productos y cantidades)
  const cobro = data[0];  // Asumimos que 'data' contiene solo un cobro

  // Generar la tabla de productos
  const detalleHTML = cobro.pedidos.pedido_productos.map(item => `
    <tr>
      <td>${item.productos.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${item.precio_unitario.toFixed(2)}</td>
      <td>$${(item.cantidad * item.precio_unitario).toFixed(2)}</td>
    </tr>
  `).join("");

  // Información adicional del pedido
  const nombreEmpleado = cobro.pedidos.empleado ? cobro.pedidos.empleado.nombre : "Empleado no disponible";
  const codigoTicket = cobro.pedidos.codigo_ticket;
  const totalTicket = cobro.pedidos.total.toFixed(2);
  const fechaEmpaque = new Date(cobro.pedidos.fecha).toLocaleString("es-MX");
  const origenPedido = cobro.pedidos.origen.charAt(0).toUpperCase() + cobro.pedidos.origen.slice(1); // Capitalizar la primera letra
  const cantidadProductos = cobro.pedidos.pedido_productos.reduce((total, item) => total + item.cantidad, 0);

  // Mostrar los detalles en el modal
  document.getElementById("detalle-pedido-body").innerHTML = detalleHTML;
  document.getElementById("codigo-ticket").textContent = `${codigoTicket}`;
  document.getElementById("empleado-nombre").textContent = `${nombreEmpleado}`;
  document.getElementById("total-pedido").textContent = `$${totalTicket}`;
  document.getElementById("fecha-empaque").textContent = `${fechaEmpaque}`;
  document.getElementById("origen-pedido").textContent = `${origenPedido}`;
  document.getElementById("cantidad-productos").textContent = `${cantidadProductos}`;

  // Mostrar modal
  new bootstrap.Modal(document.getElementById("detallePedidoModal")).show();
}


document.getElementById("btn-aplicar-filtros").addEventListener("click", cargarHistorialCobros);
/*
async function cargarHistorialPedidos() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session.user.id;

  const desde = document.getElementById("filtro-fecha-desde").value;
  const hasta = document.getElementById("filtro-fecha-hasta").value;

  // Crear la consulta con los filtros de fecha
  let query = supabase
    .from("historial_cobros")
    .select("id, fecha_cobro, monto_cobrado, pedidos(codigo_ticket, total)")
    .eq("empleado_cobro_id", userId)
    .order("fecha_cobro", { ascending: false });

  if (desde) {
    query = query.gte("fecha_cobro", `${desde}T00:00:00`);
  }

  if (hasta) {
    query = query.lte("fecha_cobro", `${hasta}T23:59:59`);
  }

  const { data: cobros, error } = await query;
  const badgeResultados = document.getElementById("badge-resultados");
  const cantidadPedidos = document.getElementById("cantidad-pedidos");


  const lista = document.getElementById("lista-historial");
  lista.innerHTML = ""; // Limpiar la lista antes de agregar elementos

  if (error) {
    badgeResultados.style.display = "none";
    lista.innerHTML = `<li class="list-group-item text-danger">Error al cargar cobros</li>`;
    return;
  }

  if (!cobros.length) {
    badgeResultados.style.display = "none";
    lista.innerHTML = `<li class="list-group-item text-muted">No se encontraron cobros con los filtros seleccionados.</li>`;
    return;
  }
  // Si hay pedidos, actualiza el badge
  cantidadPedidos.textContent = cobros.length;
  badgeResultados.style.display = "block";
  setTimeout(() => badgeResultados.classList.add("show"), 50);

  cobros.forEach(cobro => {
    const item = document.createElement("li");
    item.classList.add("list-group-item", "list-group-item-action", "fade-in");
    item.innerHTML = `
      <div>
        <strong><i class="fa-solid fa-ticket"></i> ${cobro.pedidos.codigo_ticket}</strong><br>
        <small><i class="fa-solid fa-calendar-day"></i> ${new Date(cobro.fecha_cobro).toLocaleString()}</small><br>
        <small><i class="fa-solid fa-dollar-sign"></i>${cobro.pedidos.total}</small> · 
        <span class="badge bg-success">Cobrado</span>
      </div>
    `;
    item.onclick = () => verDetalleCobro(cobro.id);
    lista.appendChild(item);
  });
}*/