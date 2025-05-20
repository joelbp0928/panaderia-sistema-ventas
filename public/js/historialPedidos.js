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
            .select("*, pedido_productos(descuento, promocion_id)")
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

        const pedidosConPromo = pedidos.map(p => {
            const totalDescuentos = p.pedido_productos?.reduce((acc, pp) => acc + (pp.descuento || 0), 0);
            return {
                ...p,
                tienePromo: totalDescuentos > 0
            };
        });

        const pedidosPorFecha = {};
        pedidosConPromo.forEach(p => {
            const fecha = new Date(p.fecha).toLocaleDateString();
            if (!pedidosPorFecha[fecha]) pedidosPorFecha[fecha] = [];
            pedidosPorFecha[fecha].push(p);
        });

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
                <div>
                  <i class="fa-solid fa-ticket-simple"></i><strong> ${p.codigo_ticket}</strong>
                  ${p.tienePromo ? '<i class="fas fa-tags text-success ms-2" title="Incluye promoción"></i>' : ''}
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="text-muted small mt-1"><i class="fas fa-clock me-1"></i>${new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div><span class="badge bg-${obtenerColorEstado(p.estado)} text-capitalize"><i class="fas fa-circle me-1 small"></i>${p.estado}</span></div>
                </div>
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

                const { data: pedido, error: errorPedido } = await supabase
                    .from("pedidos")
                    .select("*")
                    .eq("id", pedidoId)
                    .maybeSingle();

                const { data: productos, error: errorProd } = await supabase
                    .from("pedido_productos")
                    .select("cantidad, precio_unitario, descuento, promocion_id, productos:producto_id(nombre), promociones:promocion_id(nombre)")
                    .eq("pedido_id", pedidoId);

                if (errorPedido || !pedido || errorProd || !productos) {
                    mostrarToast("Error al cargar el pedido o sus productos", "error");
                    return;
                }

                const totalPiezas = productos.reduce((sum, p) => sum + p.cantidad, 0);
                const subtotal = productos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);
                const totalDescuentos = productos.reduce((sum, p) => sum + (p.descuento || 0), 0);
                const promocionesAplicadas = [...new Set(productos.map(p => p.promociones?.nombre).filter(Boolean))];

                const tablaHTML = productos.map(p => `
                    <tr>
                        <td>${p.productos?.nombre || "Producto"}</td>
                        <td>${p.cantidad}</td>
                        <td>$${p.precio_unitario.toFixed(2)}</td>
                        <td>
                          ${p.descuento > 0
                            ? `<span class='text-danger text-decoration-line-through'>$${(p.precio_unitario * p.cantidad).toFixed(2)}</span><br><strong>$${((p.precio_unitario * p.cantidad) - p.descuento).toFixed(2)}</strong>`
                            : `$${(p.precio_unitario * p.cantidad).toFixed(2)}`
                        }
                        </td>
                    </tr>
                `).join("");

                Swal.fire({
                    title: '<i class="fas fa-clipboard-list me-2"></i>Detalles del pedido',
                    html: `
                        <div class="text-start">
                            <p><i class="fa-solid fa-ticket-simple"></i><strong> Ticket:</strong> ${pedido.codigo_ticket}</p>
                            <p><i class="fas fa-traffic-light me-2"></i><strong>Estado:</strong> <span class="badge bg-${obtenerColorEstado(pedido.estado)} text-capitalize">${pedido.estado}</span></p>
                            <p><i class="fas fa-boxes me-2"></i><strong>Total productos:</strong> ${totalPiezas}</p>
                            <table class="table table-bordered table-sm mt-3">
                                <thead class="table-light">
                                    <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
                                </thead>
                                <tbody>${tablaHTML}</tbody>
                            </table>
                            <hr>
                            <p><strong><i class="fas fa-coins me-1"></i>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
                            ${totalDescuentos > 0 ? `<p class="text-success"><strong><i class="fas fa-piggy-bank me-1"></i>Ahorraste:</strong> -$${totalDescuentos.toFixed(2)}</p>` : ""}
                            <p><strong><i class="fas fa-wallet me-1"></i>Total:</strong> $${pedido.total.toFixed(2)}</p>
                            ${promocionesAplicadas.length > 0 ? `
                            <p class="mt-2"><strong><i class="fas fa-tags text-info me-1"></i>Promociones aplicadas:</strong></p>
                            <ul class="mb-0 ps-3">
                                ${promocionesAplicadas.map(p => `<li><i class="fas fa-check-circle text-success me-1"></i>${p}</li>`).join("")}
                            </ul>
                            ` : ""}
                            <p class="mt-3 text-muted small">
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
                    preConfirm: async () => {
                        await descargarTicketDesdeHistorial(pedidoId);
                        return false;
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
        }, 500);
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

export async function descargarTicketDesdeHistorial(pedidoId) {
  const swalInstance = Swal.fire({
    title: 'Generando ticket...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", pedidoId)
      .maybeSingle();

    const { data: clienteData } = await supabase
      .from("usuarios")
      .select("nombre")
      .eq("id", pedido.cliente_id)
      .maybeSingle();

    const { data: productos, error: errorProductos } = await supabase
      .from("pedido_productos")
      .select("cantidad, precio_unitario, descuento, promocion_id, productos:producto_id (nombre)")
      .eq("pedido_id", pedidoId);

    if (errorProductos || !productos || productos.length === 0) {
      await swalInstance.close();
      mostrarToast("❌ No se pudieron cargar los productos del ticket", "error");
      return;
    }

    const promocionesAplicadas = [];
    for (const p of productos) {
      if (p.promocion_id) {
        const { data: promo } = await supabase
          .from("promociones")
          .select("nombre")
          .eq("id", p.promocion_id)
          .maybeSingle();
        if (promo?.nombre && !promocionesAplicadas.includes(promo.nombre)) {
          promocionesAplicadas.push(promo.nombre);
        }
      }
    }

    const nombreCliente = clienteData?.nombre || "Cliente";
    const color = configuracionGlobal.color_primario || "#6c1b2d";

    const totalPiezas = productos.reduce((sum, p) => sum + p.cantidad, 0);
    const subtotal = productos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);
    const totalDescuentos = productos.reduce((sum, p) => sum + (p.descuento || 0), 0);
    const totalFinal = subtotal - totalDescuentos;

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
          <div>
            <span><i class="fas fa-cookie-bite me-1 text-success"></i>${p.productos?.nombre || "Producto"} x${p.cantidad}</span>
          </div>
          <div class="text-end">
            ${p.descuento > 0
              ? `<span class="text-danger text-decoration-line-through d-block">$${(p.precio_unitario * p.cantidad).toFixed(2)}</span>
                 <strong>$${((p.precio_unitario * p.cantidad) - p.descuento).toFixed(2)}</strong>`
              : `<strong>$${(p.precio_unitario * p.cantidad).toFixed(2)}</strong>`}
          </div>
        </div>`).join('')}
      <hr />
      <div class="mb-2">
        <strong><i class="fas fa-cubes me-1"></i> Total de piezas:</strong> ${totalPiezas}<br>
        <strong><i class="fas fa-coins me-1"></i> Subtotal:</strong> $${subtotal.toFixed(2)}<br>
        ${totalDescuentos > 0 ? `<strong class="text-success"><i class="fas fa-piggy-bank me-1"></i> Ahorraste:</strong> -$${totalDescuentos.toFixed(2)}<br>` : ''}
        <strong><i class="fas fa-coins me-1"></i> Total:</strong> $${totalFinal.toFixed(2)}
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
          <li><i class="fas fa-clock me-1"></i>Estado actual: ${pedido.estado}.</li>
          <li><i class="fa-solid fa-exclamation"></i> Espera confirmación de tienda antes de pagar.</li>
        </ul>
      </div>
      <p class="text-center mb-0 mt-2" style="font-size: 0.65rem; color: #999;">
        <i class="fas fa-star text-warning me-1"></i>Gracias por tu preferencia
      </p>
    </div>`;

    const temp = document.createElement("div");
    temp.innerHTML = ticketHTML;
    document.body.appendChild(temp);

    const qrElement = temp.querySelector("#qr-pedido");
    new QRCode(qrElement, {
      text: pedido.codigo_ticket,
      width: 100,
      height: 100
    });

    const element = temp.querySelector("#ticket-imagen");
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png", 1.0);
    link.download = `ticket-${pedido.codigo_ticket}.png`;
    link.click();

    await swalInstance.close();
    Swal.fire({
      icon: 'success',
      title: 'Ticket descargado',
      text: `El ticket ${pedido.codigo_ticket} se ha descargado correctamente`,
      timer: 2000,
      showConfirmButton: false
    });

    document.body.removeChild(temp);
  } catch (err) {
    await swalInstance.close();
    mostrarToast("❌ No se pudo descargar el ticket", "error");
    console.error(err);
  }
}

function obtenerColorEstado(estado) {
    switch (estado.toLowerCase()) {
        case 'pendiente': return 'warning';
        case 'preparacion': return 'info';
        case 'empacado': return 'success';
        case 'cancelado': return 'danger';
        default: return 'secondary';
    }
}
