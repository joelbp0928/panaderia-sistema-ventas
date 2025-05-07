import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { configuracionGlobal } from "./config.js";

export function inicializarHistorialPedidos() {
    const btnHistorial = document.getElementById("btnHistorialPedidos");
    const overlay = document.getElementById("sidebarHistorial");
    const sidebar = overlay.querySelector(".sidebar-historial");
    const cerrarBtn = document.getElementById("cerrarSidebarHistorial");
    const contenedor = document.getElementById("contenidoHistorial");

    btnHistorial?.addEventListener("click", async () => {
        overlay.classList.remove("d-none");
        sidebar.classList.add("animate__fadeInRight");
        document.body.style.overflow = "hidden";
        contenedor.innerHTML = `
      <div class="text-center my-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2">Cargando pedidos...</p>
      </div>
    `;

        const { data: user } = await supabase.auth.getUser();
        const usuario_id = user?.user?.id;
        if (!usuario_id) return;

        const { data: pedidos, error } = await supabase
            .from("pedidos")
            .select("*")
            .eq("cliente_id", usuario_id)
            .order("fecha", { ascending: false });

        if (error || !pedidos || pedidos.length === 0) {
            contenedor.innerHTML = `
        <p class="text-muted mt-3 text-center">
          <i class="fas fa-ban me-2"></i>No tienes pedidos recientes
        </p>`;
            return;

        }

        const totalesProductos = await obtenerTotalesProductosPorPedido(pedidos.map(p => p.id));

        // Agrupar pedidos por fecha (sin hora)
        const pedidosPorFecha = {};
        pedidos.forEach(p => {
            const fecha = new Date(p.fecha).toLocaleDateString();
            if (!pedidosPorFecha[fecha]) pedidosPorFecha[fecha] = [];
            pedidosPorFecha[fecha].push(p);
        });

        // Generar HTML agrupado
        contenedor.innerHTML = Object.entries(pedidosPorFecha).map(([fecha, lista], i) => `
        <div class="mb-3 fade-slide-in">
          <div class="encabezado-fecha d-flex justify-content-between align-items-center text-primary border-bottom pb-1" data-toggle="grupo-${i}" style="cursor: pointer;">
            <span><i class="fas fa-calendar-day me-2"></i>${fecha}</span>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-secondary me-2">${lista.length} pedido(s)</span>
              <i class="fas fa-chevron-down rotate-icon transition" id="icono-grupo-${i}"></i>
            </div>
          </div>
          <div id="grupo-${i}" class="grupo-pedidos collapse-fecha mt-2">
            ${lista.map(p => `
              <div class="border-bottom py-2 pedido-item" style="cursor: pointer;" data-id="${p.id}">
                <div class="d-flex justify-content-between align-items-center">
                  <div><i class="fa-solid fa-ticket-simple"></i><strong> ${p.codigo_ticket}</strong></div>
                  <div><span class="badge bg-${obtenerColorEstado(p.estado)} text-capitalize"><i class="fas fa-circle me-1 small"></i>${p.estado}</span></div>
                </div>
                <div class="text-muted small mt-1"><i class="fas fa-clock me-1"></i>${new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div class="d-flex justify-content-between mt-1">
                  <div><i class="fas fa-dollar-sign me-1"></i>${p.total}</div>
                  <div><i class="fas fa-boxes me-1"></i>${totalesProductos[p.id] || 0} producto(s)</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

        document.querySelectorAll(".encabezado-fecha").forEach(encabezado => {
            encabezado.addEventListener("click", () => {
                const targetId = encabezado.getAttribute("data-toggle");
                const grupo = document.getElementById(targetId);
                const icono = document.getElementById("icono-" + targetId);

                if (grupo.classList.contains("show")) {
                    grupo.classList.remove("show");
                    icono.classList.remove("rotado");
                } else {
                    grupo.classList.add("show");
                    icono.classList.add("rotado");
                }
            });
        });


        document.querySelectorAll(".pedido-item").forEach(el => {
            el.addEventListener("click", async () => {
                const pedidoId = el.dataset.id;

                // Obtener información del pedido primero
                const { data: pedido, error: errorPedido } = await supabase
                    .from("pedidos")
                    .select("*")
                    .eq("id", pedidoId)
                    .single();

                if (errorPedido || !pedido) {
                    mostrarToast("No se pudo cargar la información del pedido", "error");
                    return;
                }

                // Consulta con join para obtener los productos
                const { data: detalles, error } = await supabase
                    .from("pedido_productos")
                    .select(`
                        cantidad,
                        precio_unitario,
                        productos:producto_id (nombre)
                    `)
                    .eq("pedido_id", pedidoId);

                if (error || !detalles) {
                    mostrarToast("No se pudieron cargar los productos del pedido", "error");
                    return;
                }

                const tablaHTML = detalles.map(p => `
                    <tr>
                        <td>${p.productos?.nombre || "Producto"}</td>
                        <td>${p.cantidad}</td>
                        <td>$${p.precio_unitario.toFixed(2)}</td>
                        <td>$${(p.cantidad * p.precio_unitario).toFixed(2)}</td>
                    </tr>
                `).join("");

                Swal.fire({
                    title: '<i class="fas fa-clipboard-list me-2"></i>Detalles del Pedido',
                    html: `
                        <div class="text-start">
                            <p><i class="fa-solid fa-ticket-simple"></i><strong> Ticket:</strong> ${pedido.codigo_ticket}</p>
                            <p><i class="fas fa-traffic-light me-2"></i><strong>Estado:</strong> <span class="badge bg-${obtenerColorEstado(pedido.estado)} text-capitalize">${pedido.estado}</span></p>
                            <p><i class="fas fa-boxes me-2"></i><strong>Total productos:</strong> ${detalles.reduce((sum, item) => sum + item.cantidad, 0)}</p>
                            <table class="table table-bordered table-sm mt-3">
                                <thead class="table-light">
                                    <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
                                </thead>
                                <tbody>${tablaHTML}</tbody>
                            </table>
                            <p class="mt-2 text-muted small">
                                <i class="fas fa-info-circle me-1"></i>
                                Guarda tu ticket para poder pagar. <br>
                                Tu pedido aún no está confirmado hasta que el estado cambie a empacado.
                            </p>
                        </div>
                    `,
                    width: 600,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-download me-1"></i> Descargar Ticket',
                    cancelButtonText: 'Cerrar',
                    reverseButtons: true,
                    preConfirm: () => {
                        descargarTicketDesdeHistorial(pedidoId);
                    }
                });

            });


        });
    });

    cerrarBtn?.addEventListener("click", cerrarSidebar);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrarSidebar();
    });
    overlay?.addEventListener("click", (e) => {
        if (e.target.id === "sidebarHistorial") cerrarSidebar();
    });

    function cerrarSidebar() {
        const sidebar = overlay.querySelector(".sidebar-historial");

        sidebar.classList.remove("animate__fadeInRight");
        sidebar.classList.add("animate__fadeOutRight");

        setTimeout(() => {
            overlay.classList.add("d-none");
            sidebar.classList.remove("animate__fadeOutRight");
            document.body.style.overflow = "";
        }, 500); // coincide con la duración del fadeOut
    }

}

async function obtenerTotalesProductosPorPedido(idsPedidos) {
    const { data, error } = await supabase
        .from("pedido_productos")
        .select("pedido_id, cantidad");

    if (error || !data) return {};

    const totales = {};
    idsPedidos.forEach(id => totales[id] = 0);

    data.forEach(item => {
        if (totales[item.pedido_id] !== undefined) {
            totales[item.pedido_id] += item.cantidad;
        }
    });

    return totales;
}


async function descargarTicketDesdeHistorial(pedidoId) {
    try {
        // Obtener información del pedido
        const { data: pedido, error: errorPedido } = await supabase
            .from("pedidos")
            .select("*")
            .eq("id", pedidoId)
            .maybeSingle();

        if (errorPedido || !pedido) {
            mostrarToast("No se pudo obtener la información del pedido", "error");
            return;
        }

        // Obtener información del cliente
        const { data: clienteData } = await supabase
            .from("usuarios")
            .select("nombre")
            .eq("id", pedido.cliente_id)
            .maybeSingle();

        const nombreCliente = clienteData?.nombre || "Cliente";

        // Obtener productos del pedido
        const { data: productos } = await supabase
            .from("pedido_productos")
            .select("cantidad, precio_unitario, productos:producto_id (nombre)")
            .eq("pedido_id", pedidoId);

        // Obtener configuración global (color primario)
        const color = configuracionGlobal.color_primario || "#6c1b2d";

        // Crear el ticket con el mismo diseño que en procesar-pedido.js
        const ticketHTML = `
        <div id="ticket-imagen" class="ticket-impresion" style="max-width: 320px; background: white; font-family: 'Courier New', monospace; border: 2px dashed ${color}; padding: 16px; border-radius: 12px;">
            <div class="text-center mb-2">
            <h5 style="margin: 4px 0; color: ${color};">${configuracionGlobal.nombre_empresa}</h5>
                <hr />
                <small><i class="fas fa-user me-1 text-primary"></i><strong>Cliente:</strong> ${nombreCliente}</small><br/>
                <small><i class="fas fa-receipt me-1 text-secondary"></i><strong>Ticket:</strong> ${pedido.codigo_ticket}</small><br/>
                <small><i class="fas fa-calendar-day me-1 text-muted"></i>${new Date(pedido.fecha).toLocaleString()}</small>
            </div>
            <hr />
            ${productos.map(p => `
                <div class="d-flex justify-content-between border-bottom py-1">
                    <span><i class="fas fa-cookie-bite me-1 text-success"></i>${p.productos?.nombre || "Producto"} x${p.cantidad}</span>
                    <span>$${(p.precio_unitario * p.cantidad).toFixed(2)}</span>
                </div>`
        ).join('')}
            <hr />
            <div class="d-flex justify-content-between mb-2">
                <strong><i class="fas fa-coins me-1"></i>Total</strong>
                <strong>$${pedido.total.toFixed(2)}</strong>
            </div>
            <div class="text-center mt-3" id="qr-pedido"></div>
            
            <div class="alert alert-warning mt-3 p-2 text-start" style="font-size: 0.68rem;">
                <i class="fas fa-info-circle me-1 text-warning"></i>
                <strong>Importante:</strong><br>
                <ul class="ps-3 mb-0">
                    <li>Este <strong>no es un comprobante de pago</strong>.</li>
                    <li><i class="fas fa-save me-1"></i>Guarda este ticket para referencia.</li>
                    <li><i class="fas fa-clock me-1"></i>Estado actual: ${pedido.estado}.</li>
                    <li><i class="fa-solid fa-exclamation"></i> Espera confirmación de tienda antes de pagar.</li>
                </ul>
            </div>
            
            <p class="text-center mb-0 mt-2" style="font-size: 0.65rem; color: #999;">
                <i class="fas fa-star text-warning me-1"></i>Gracias por tu preferencia
            </p>
        </div>`;

        // Crear elemento temporal para renderizar el ticket
        const temp = document.createElement("div");
        temp.innerHTML = ticketHTML;
        document.body.appendChild(temp);

        // Generar QR (opcional)
        const qrElement = temp.querySelector("#qr-pedido");
        if (qrElement) {
            new QRCode(qrElement, {
                text: pedido.codigo_ticket,
                width: 100,
                height: 100
            });
        }

        // Convertir a imagen y descargar
        const element = temp.querySelector("#ticket-imagen");
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png", 1.0);
        link.download = `ticket-${pedido.codigo_ticket}.png`;
        link.click();

        // Limpiar
        document.body.removeChild(temp);
    } catch (err) {
        mostrarToast("❌ No se pudo descargar el ticket", "error");
        console.error(err);
    }
}

function obtenerColorEstado(estado) {
    switch (estado.toLowerCase()) {
        case 'pendiente': return 'warning';
        case 'pagado': return 'success';
        case 'cancelado': return 'danger';
        default: return 'secondary';
    }
}
