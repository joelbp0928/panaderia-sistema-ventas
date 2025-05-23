import { guardarPedido } from "./guardarPedido.js";
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { mostrarCarrito } from "./cart.js";
import { configuracionGlobal } from "./config.js";
import { getClienteActivo } from "./estado.js";
import { calcularDescuentosCarrito } from "./cart.js";

export async function confirmarPedido() {
  try {
    const { data: user } = await supabase.auth.getUser();
    const usuario_id = user?.user?.id;
    if (!usuario_id) {
      mostrarToast("Debes iniciar sesión para realizar un pedido", "warning");
      return;
    }

    const { productos, resumen } = await calcularDescuentosCarrito(usuario_id); // 💥 obtener carrito con descuentos
    const promocionesAplicadas = resumen.promocionesAplicadas || [];

    if (!productos || productos.length === 0) {
      mostrarToast("Tu carrito está vacío", "warning");
      return;
    }

    const productosSeleccionados = productos.map(item => ({
      id: item.productos.id,
      nombre: item.productos.nombre,
      cantidad: item.cantidad,
      precio: item.productos.precio,
      descuento: item.descuento,
      promocion_id: item.promocion_id || null, // 💥 en evaluarDescuento podrías retornar esto también
      total: (item.productos.precio * item.cantidad) - item.descuento
    }));

    const total = productosSeleccionados.reduce((acc, p) => acc + p.total, 0);
    const totalSinDescuentos = productosSeleccionados.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
    const ahorroTotal = totalSinDescuentos - total;
    const totalPiezas = productosSeleccionados.reduce((sum, p) => sum + p.cantidad, 0);

    const resumenHTML = productosSeleccionados.map(p => {
      const tieneDescuento = p.descuento && p.descuento > 0;
      const precioOriginal = (p.precio * p.cantidad).toFixed(2);
      const precioConDescuento = (p.precio * p.cantidad - p.descuento).toFixed(2);
      const precioUnitarioConDescuento = (p.precio - (p.descuento / p.cantidad)).toFixed(2);

      return `
    <tr>
      <td>
        <i class="fas fa-cookie-bite me-1 text-secondary"></i> ${p.nombre}
        ${tieneDescuento && p.descuentoTexto ? `<br><small class="text-success"><i class="fas fa-tag me-1"></i>${p.descuentoTexto}</small>` : ''}
      </td>
      <td>${p.cantidad}</td>
      <td>
        ${tieneDescuento
          ? `<span class="text-danger text-decoration-line-through">$${p.precio.toFixed(2)}</span><br><strong>$${precioUnitarioConDescuento}</strong>`
          : `$${p.precio.toFixed(2)}`
        }
      </td>
      <td>
        ${tieneDescuento
          ? `<span class="text-danger text-decoration-line-through">$${precioOriginal}</span><br><strong>$${precioConDescuento}</strong><br><small class="text-success"><i class="fas fa-coins me-1"></i>- $${p.descuento.toFixed(2)}</small>`
          : `$${p.total.toFixed(2)}`
        }
      </td>
    </tr>`;
    }).join("");


    const { isConfirmed } = await Swal.fire({
      title: '🧾 Confirmar pedido',
      html: `
    <div class="table-responsive">
      <table class="table table-bordered">
        <thead class="table-dark">
          <tr>
            <th><i class="fas fa-box-open"></i> Producto</th>
            <th><i class="fas fa-sort-numeric-up"></i> Cant.</th>
            <th><i class="fas fa-dollar-sign"></i> Precio</th>
            <th><i class="fas fa-receipt"></i> Total</th>
          </tr>
        </thead>
        <tbody>${resumenHTML}</tbody>
         <tfoot class="table-light">
        <tr><td colspan="3" class="text-end"><strong><i class="fas fa-cubes text-primary"></i> Total de piezas:</strong></td><td><strong>${totalPiezas}</strong></td></tr>
        ${ahorroTotal > 0 ? `<tr><td colspan="3" class="text-end"><strong><i class="fas fa-piggy-bank text-success"></i> Ahorraste:</strong></td><td class="text-success"><strong>-$${ahorroTotal.toFixed(2)}</strong></td></tr>` : ''}
        <tr><td colspan="3" class="text-end"><strong><i class="fas fa-coins"></i> Total a pagar:</strong></td><td><strong>$${total.toFixed(2)}</strong></td></tr>
      </tfoot>
    </table>
  </div>
  ${promocionesAplicadas.length > 0 ? `
    <div class="resumen-promo text-start">
      <i class="fas fa-tags text-info me-1"></i><strong>Promociones aplicadas:</strong>
      <ul class="mb-0 mt-1 ps-3">
        ${promocionesAplicadas.map(p => `<li>${p}</li>`).join("")}
      </ul>
    </div>
  ` : ''}
  `,
      icon: 'info',
      confirmButtonText: 'Confirmar pedido',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-outline-secondary'
      },
      buttonsStyling: false
    });


    if (!isConfirmed) return;

    const pedido = await guardarPedido(productosSeleccionados, usuario_id, "cliente"); // 💥 pasar total

    if (!pedido) return;

    const { data: clienteData } = await supabase
      .from("usuarios")
      .select("nombre")
      .eq("id", usuario_id)
      .maybeSingle();

    const nombreCliente = clienteData?.nombre || "Cliente";

    await supabase.from("carrito").delete().eq("usuario_id", usuario_id);
    mostrarToast("Pedido realizado con éxito", "success");

    await mostrarCarrito();

    const ticketContenido = document.getElementById("ticket-visual");
    const color = configuracionGlobal.color_primario || "#D2772D";

    ticketContenido.innerHTML = `
      <div class="ticket-impresion animate__animated animate__fadeInDown" style="max-width: 320px; background: white; font-family: 'Courier New', monospace; border: 2px dashed ${color}; padding: 16px; border-radius: 12px;">
        <div class="text-center mb-2">
          <h5 style="margin: 4px 0; color: ${color};">${configuracionGlobal.nombre_empresa}</h5>
          <hr />
          <small><i class="fas fa-user me-1 text-primary"></i><strong>Cliente:</strong> ${nombreCliente}</small><br/>
          <small><i class="fas fa-receipt me-1 text-secondary"></i><strong>Ticket:</strong> ${pedido.codigo_ticket}</small><br/>
          <small><i class="fas fa-calendar-day me-1 text-muted"></i>${new Date().toLocaleString()}</small>
        </div>
        <hr />
        ${productosSeleccionados.map(p => `
          <div class="d-flex justify-content-between border-bottom py-1">
            <div>
              <span><i class="fas fa-cookie-bite me-1 text-success"></i>${p.nombre} x${p.cantidad}</span><br>
              ${p.descuentoTexto ? `<small class="text-success"><i class="fas fa-tag me-1"></i>${p.descuentoTexto}</small>` : ""}
            </div>
            <div class="text-end">
              ${p.descuento > 0
        ? `<span class="text-danger text-decoration-line-through d-block">$${(p.precio * p.cantidad).toFixed(2)}</span>
                   <strong>$${p.total.toFixed(2)}</strong>`
        : `<strong>$${p.total.toFixed(2)}</strong>`}
            </div>
          </div>`).join('')}
        <hr />
        <div class="mb-2">
          <strong><i class="fas fa-cubes me-1"></i> Total de piezas:</strong> ${totalPiezas}<br>
          <strong><i class="fas fa-coins me-1"></i> Subtotal:</strong> $${totalSinDescuentos.toFixed(2)}<br>
          ${ahorroTotal > 0 ? `<strong class="text-success"><i class="fas fa-piggy-bank me-1"></i> Ahorraste:</strong> -$${ahorroTotal.toFixed(2)}<br>` : ''}
          <strong><i class="fas fa-coins me-1"></i> Total:</strong> $${total.toFixed(2)}
        </div>
        ${promocionesAplicadas.length > 0 ? `
        <div class="text-start mt-2">
          <i class="fas fa-tags text-info me-1"></i><strong>Promociones aplicadas:</strong>
          <ul class="ps-3 mb-0">
            ${promocionesAplicadas.map(p => `<li><i class="fas fa-check-circle text-success me-1"></i>${p}</li>`).join('')}
          </ul>
        </div>` : ''}
        <div class="text-center mt-3" id="qr-pedido" style="display: flex; justify-content: center;"></div>
        <div class="alert alert-warning mt-3 p-2 text-start" style="font-size: 0.68rem;">
          <i class="fas fa-info-circle me-1 text-warning"></i>
          <strong>Importante:</strong><br>
          <ul class="ps-3 mb-0">
            <li>Este <strong>no es un comprobante de pago</strong>.</li>
            <li><i class="fas fa-save me-1"></i>Guarda este ticket para poder pagar.</li>
            <li><i class="fas fa-clock me-1"></i>Estado actual: pendiente.</li>
            <li><i class="fa-solid fa-exclamation"></i> Espera confirmación de tienda antes de pagar.</li>
          </ul>
        </div>
        <p class="text-center mb-0 mt-2" style="font-size: 0.65rem; color: #999;">
          <i class="fas fa-star text-warning me-1"></i>Gracias por tu preferencia
        </p>
      </div>`;



    const modal = new bootstrap.Modal(document.getElementById("modalTicket"));
    modal.show();

    const audio = new Audio('./sounds/print.mp3');
    audio.volume = 0.7;
    audio.play();

    modal._element.addEventListener('shown.bs.modal', () => {
      // Limpiar el contenedor del QR antes de generar uno nuevo
      const qrContainer = document.getElementById("qr-pedido");
      qrContainer.innerHTML = ''; // Esto limpia cualquier QR anterior

      // Generar el nuevo QR
      new QRCode(qrContainer, {
        text: pedido.codigo_ticket,
        width: 100,
        height: 100,
        colorDark: color, // Opcional: usar el color primario para el QR
        colorLight: "#ffffff"
      });
    });

    document.getElementById("btn-descargar-ticket").onclick = async () => {
      const ticketElement = document.querySelector("#ticket-visual .ticket-impresion");

      if (!ticketElement) {
        mostrarToast("❌ Ticket no encontrado", "error");
        return;
      }

      try {
        const canvas = await html2canvas(ticketElement, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false
        });

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png", 1.0);
        link.download = `ticket-${pedido.codigo_ticket}.png`;
        link.click();
      } catch (error) {
        console.error("❌ Error al generar imagen del ticket:", error);
        mostrarToast("Error al descargar el ticket", "error");
      }
    };


  } catch (err) {
    console.error("Error al confirmar el pedido:", err);
    mostrarToast("Error al confirmar el pedido", "error");
  }
}
