// ✅ Versión FINAL lista para descarga en teléfono como imagen o captura

import { guardarPedido } from "./guardarPedido.js";
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { mostrarCarrito } from "./cart.js";
import { configuracionGlobal } from "./config.js";
import { getClienteActivo } from "./estado.js";

export async function confirmarPedido() {
    try {
        const { data: user } = await supabase.auth.getUser();
        const usuario_id = user?.user?.id;
        if (!usuario_id) {
            mostrarToast("Debes iniciar sesión para realizar un pedido", "warning");
            return;
        }

        const { data: carrito, error } = await supabase
            .from("carrito")
            .select(`id, cantidad, productos:producto_id (id, nombre, precio)`)
            .eq("usuario_id", usuario_id);

        if (error || !carrito || carrito.length === 0) {
            mostrarToast("Tu carrito está vacío", "warning");
            return;
        }

        const productosSeleccionados = carrito.map(item => ({
            id: item.productos.id,
            nombre: item.productos.nombre,
            cantidad: item.cantidad,
            precio: item.productos.precio,
            total: item.productos.precio * item.cantidad
        }));

        const total = productosSeleccionados.reduce((acc, p) => acc + p.total, 0);

        const resumenHTML = productosSeleccionados.map(p => `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.cantidad}</td>
        <td>$${p.precio.toFixed(2)}</td>
        <td>$${p.total.toFixed(2)}</td>
      </tr>
    `).join("");

        const { isConfirmed } = await Swal.fire({
            title: 'Confirmar Pedido',
            html: `
        <table class="table">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
          <tbody>${resumenHTML}</tbody>
          <tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>$${total.toFixed(2)}</strong></td></tr></tfoot>
        </table>
      `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar'
        });

        if (!isConfirmed) return;

        const { data: clienteData } = await supabase
            .from("usuarios")
            .select("nombre")
            .eq("id", usuario_id)
            .maybeSingle();

        const nombreCliente = clienteData?.nombre || "Cliente";

        const pedido = await guardarPedido(productosSeleccionados, usuario_id, "cliente");
        if (!pedido) return;

        await supabase.from("carrito").delete().eq("usuario_id", usuario_id);
        mostrarToast("Pedido realizado con éxito", "success");

        await mostrarCarrito();

        const ticketContenido = document.getElementById("ticket-visual");
        const color = configuracionGlobal.color_primario || "#6c1b2d";

        ticketContenido.innerHTML = `
        <div class="ticket-impresion animate__animated animate__fadeInDown" style="max-width: 320px; background: white; font-family: 'Courier New', monospace; border: 2px dashed ${color}; padding: 16px; border-radius: 12px;">
          <div class="text-center mb-2">
            <h5 style="margin: 4px 0; color: ${color};">${configuracionGlobal.nombre_empresa}</h5>
            <hr />
            <small><i class="fas fa-user me-1 text-primary"></i><strong>Cliente:</strong> ${nombreCliente}</small><br/>
            <small><i class="fas fa-receipt me-1 text-secondary"></i><strong>Ticket:</strong> ${pedido.codigo_ticket}</small><br/>
            <small><i class="fas fa-calendar-day me-1 text-muted"></i>${new Date(pedido.fecha).toLocaleString()}</small>
          </div>
          <hr />
          ${productosSeleccionados.map(p => `
            <div class="d-flex justify-content-between border-bottom py-1">
              <span><i class="fas fa-cookie-bite me-1 text-success"></i>${p.nombre} x${p.cantidad}</span>
              <span>$${p.total.toFixed(2)}</span>
            </div>`).join('')}
          <hr />
          <div class="d-flex justify-content-between mb-2">
            <strong><i class="fas fa-coins me-1"></i>Total</strong>
            <strong>$${pedido.total}</strong>
          </div>
          <div class="text-center mt-3" id="qr-pedido"></div>
        
          <div class="alert alert-warning mt-3 p-2 text-start" style="font-size: 0.68rem;">
            <i class="fas fa-info-circle me-1 text-warning"></i>
            <strong>Importante:</strong><br>
            <ul class="ps-3 mb-0">
              <li>Este <strong>no es un comprobante de pago</strong>.</li>
              <li><i class="fas fa-save me-1"></i>Guarda este ticket para poder pagar.</li>
              <li><i class="fas fa-clock me-1"></i>Espera confirmación en tienda antes de pagar.</li>
            </ul>
          </div>
        
          <p class="text-center mb-0 mt-2" style="font-size: 0.65rem; color: #999;">
            <i class="fas fa-star text-warning me-1"></i>Gracias por tu pedido<br>¡Esperamos verte pronto!
          </p>
        </div>`;
        

        const modal = new bootstrap.Modal(document.getElementById("modalTicket"));
        modal.show();

        const audio = new Audio('./sounds/print.mp3');
        audio.volume = 0.7;
        audio.play();

        modal._element.addEventListener('shown.bs.modal', () => {
            new QRCode(document.getElementById("qr-pedido"), {
                text: pedido.codigo_ticket,
                width: 100,
                height: 100
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
