import { guardarPedido } from "./guardarPedido.js";
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { inicializarCarrito, mostrarCarrito } from "./cart.js";
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
            .select(`
                id,
                cantidad,
                productos:producto_id (
                  id,
                  nombre,
                  precio
                )
              `)
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

        const pedido = await guardarPedido(productosSeleccionados, usuario_id, "cliente");

        if (!pedido) return;

        await supabase.from("carrito").delete().eq("usuario_id", usuario_id);

        mostrarToast("Pedido realizado con éxito", "success");

        // Mostrar resumen y capturar ticket visual
        const ticketVisual = document.getElementById("ticket-visual");

        if (ticketVisual) {
            const productosTicket = productosSeleccionados.map(p => `
                <div class="d-flex justify-content-between border-bottom py-1">
                    <span>${p.nombre} x${p.cantidad}</span>
                    <span>$${p.total.toFixed(2)}</span>
                </div>
            `).join("");

            const nombreCliente = getClienteActivo()?.nombre || "Cliente";

            ticketVisual.innerHTML = `
                <div style="max-width: 320px; background: white; font-family: 'Courier New'; border: 2px dashed #6c1b2d; padding: 16px; border-radius: 12px;">
                    <div class="text-center">
                        <img src="${configuracionGlobal.logo_url}" style="max-height: 60px; object-fit: contain; margin-bottom: 8px;" />
                        <h5 style="margin: 4px 0;">${configuracionGlobal.nombre_empresa}</h5>
                        <hr/>
                        <small><strong>Cliente:</strong> ${nombreCliente}</small><br/>
                        <small><strong>Ticket:</strong> ${pedido.codigo_ticket}</small><br/>
                        <small>${new Date(pedido.fecha).toLocaleString()}</small>
                    </div>
                    <hr />
                    ${productosTicket}
                    <hr />
                    <div class="d-flex justify-content-between">
                        <strong>Total</strong>
                        <strong>$${pedido.total}</strong>
                    </div>
                    <div class="text-center mt-3">
                        <div id="qr-pedido"></div>
                        <p style="font-size: 0.75rem;">Muestra este ticket al cajero</p>
                    </div>
                </div>
            `;

            ticketVisual.classList.remove("d-none");

            setTimeout(() => {
                new QRCode(document.getElementById("qr-pedido"), {
                    text: pedido.codigo_ticket,
                    width: 100,
                    height: 100,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                setTimeout(() => {
                    html2canvas(ticketVisual).then(canvas => {
                        const link = document.createElement("a");
                        link.download = `ticket-${pedido.codigo_ticket}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        ticketVisual.classList.add("d-none");
                    });
                }, 500);

            }, 100);
        }

        await mostrarCarrito();

    } catch (err) {
        console.error("Error al confirmar el pedido:", err);
        mostrarToast("Error al confirmar el pedido", "error");
    }
}
