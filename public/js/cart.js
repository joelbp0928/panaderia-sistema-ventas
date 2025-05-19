import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { getClienteActivo } from './estado.js';
import { confirmarPedido } from './procesar-pedido.js';

export async function inicializarCarrito() {
  if (!getClienteActivo()) {
    console.warn("No se puede inicializar carrito - cliente no verificado");
    return;
  }
  //  console.log("Carrito inicializado correctamente")
  //actualizar Contador Carrito
  const { data: user } = await supabase.auth.getUser();
  const usuario_id = user?.user?.id;
  const badgeCount = document.getElementById("carrito-count");

  if (!usuario_id || !badgeCount) return;

  const { data, error } = await supabase
    .from("carrito")
    .select("id")
    .eq("usuario_id", usuario_id);

  if (!error) {
    badgeCount.textContent = data.length;
    badgeCount.classList.remove("animate__bounceIn");
    void badgeCount.offsetWidth; // Reflow para reiniciar la animación
    badgeCount.classList.add("animate__animated", "animate__bounceIn");
  }

  // Actualizar el contenido del popover
  const resumenPopover = document.getElementById("popover-carrito-content");
  if (resumenPopover) {
    resumenPopover.innerHTML = `<strong>${data.length}</strong> productos en el carrito.`;
  }
}

export async function agregarProductoAlCarrito(productoId, cantidad) {
  try {
    const { data: user } = await supabase.auth.getUser();
    const usuario_id = user?.user?.id;

    if (!usuario_id) {
      mostrarToast("Debes iniciar sesión para agregar al carrito", "warning");
      return;
    }

    // Verificar si el producto ya está en el carrito
    const { data: existentes, error: errorConsulta } = await supabase
      .from("carrito")
      .select("id, cantidad")
      .eq("usuario_id", usuario_id)
      .eq("producto_id", productoId)
      .maybeSingle(); // 🔥 más seguro, no lanza 406

    if (errorConsulta && errorConsulta.code !== "PGRST116" && errorConsulta.code !== "406") {
      throw errorConsulta;
    }

    if (existentes) {
      // Ya existe → actualizar cantidad
      const nuevaCantidad = existentes.cantidad + cantidad;
      const { error: errorUpdate } = await supabase
        .from("carrito")
        .update({ cantidad: nuevaCantidad })
        .eq("id", existentes.id);
      if (errorUpdate) throw errorUpdate;
    } else {
      // No existe → insertar
      const { error: errorInsert } = await supabase
        .from("carrito")
        .insert([{ usuario_id, producto_id: productoId, cantidad }]);
      if (errorInsert) throw errorInsert;
    }

    await inicializarCarrito();
    reproducirSonido("add");
    mostrarToast("Producto añadido al carrito 🛒", "success");

  } catch (error) {
    console.error("❌ Error al agregar producto al carrito:", error);
    mostrarToast("❌ No se pudo agregar el producto", "error");
  }
}

export async function mostrarCarrito() {
  const { data: user } = await supabase.auth.getUser();
  const usuario_id = user?.user?.id;
  const carritoBody = document.getElementById("carrito-contenido");
  const badgeCount = document.getElementById("carrito-count");

  if (!usuario_id) {
    carritoBody.innerHTML = "<p class='text-muted'>Inicia sesión para ver tu carrito.</p>";
    return;
  }

  try {
    // Calcular todos los descuentos y totales
    const { productos, resumen } = await calcularDescuentosCarrito(usuario_id);

    if (!productos || productos.length === 0) {
      carritoBody.innerHTML = "<p class='text-muted'><i class='fa-solid fa-ban'></i> Tu carrito está vacío</p>";
      badgeCount.textContent = "0";
      return;
    }

    // Renderizar carrito
    badgeCount.textContent = productos.length;
    badgeCount.classList.remove("animate__bounceIn");
    void badgeCount.offsetWidth;
    badgeCount.classList.add("animate__animated", "animate__bounceIn");

    carritoBody.innerHTML = `
      <div class="d-grid gap-2 mb-3">
        <button id="limpiar-carrito" class="btn btn-outline-danger animate__animated"><i class="fas fa-trash me-2"></i>Vaciar Carrito</button>
        <button id="hacer-pedido" class="btn btn-success animate__animated animate__pulse animate__infinite"><i class="fas fa-check-circle me-2"></i>Hacer Pedido</button>
      </div>
      <div class="animate__animated animate__fadeInRight">
        ${productos.map(item => `
          <div class="mb-3 d-flex align-items-center border-bottom pb-2 justify-content-between">
            <img src="${item.productos.imagen_url}" class="img-thumbnail me-2" style="width: 60px; height: 60px; object-fit: cover;">
            <div class="flex-grow-1 me-2">
              <h6 class="mb-1">${item.productos.nombre}</h6>
              ${item.descuentoTexto ? `<small class="text-success animate__animated animate__fadeIn" data-promo-texto="true"><i class="fas fa-tag me-1"></i>${item.descuentoTexto}</small>` : ''}
              <div class="input-group input-group-sm w-75">
                <button class="btn btn-outline-secondary actualizar-cantidad" data-id="${item.id}" data-action="restar"><i class="fas fa-minus"></i></button>
                <input type="text" class="form-control text-center cantidad-input" data-id="${item.id}" id="cantidad-${item.id}" value="${item.cantidad}" readonly>
                <button class="btn btn-outline-secondary actualizar-cantidad" data-id="${item.id}" data-action="sumar"><i class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="text-end">
              <button class="btn btn-sm btn-outline-danger eliminar-producto" data-id="${item.id}" title="Eliminar"><i class="fas fa-times"></i></button>
              <p class="mb-1 fw-bold text-success" id="subtotal-${item.id}" data-precio="${item.productos.precio}">
                $${((item.productos.precio * item.cantidad) - item.descuento).toFixed(2)}
              </p>
              ${item.descuento > 0 ? `<small class="text-danger text-decoration-line-through">$${(item.productos.precio * item.cantidad).toFixed(2)}</small>` : ''}
            </div>
          </div>
        `).join("")}
      </div>
      <div class="mt-3 border-top pt-3 text-end">
        <p class="mb-1"><i class="fas fa-shopping-cart me-1"></i> Productos: <strong class="carrito-total-productos">${resumen.cantidadTotal}</strong></p>
        <div class="carrito-descuentos">
          ${resumen.descuentoTotal > 0 ? `<p class="mb-1"><i class="fas fa-tag me-1 text-success"></i> Descuentos: <strong class="text-success">-$${resumen.descuentoTotal.toFixed(2)}</strong></p>` : ''}
        </div>
        <div class="carrito-threshold">
          ${resumen.thresholdDescuento > 0 ? `<p class="mb-1"><i class="fas fa-percentage me-1 text-success"></i> ${resumen.thresholdTexto}: <strong class="text-success">-$${resumen.thresholdDescuento.toFixed(2)}</strong></p>` : ''}
        </div>
        <p class="mb-0"><i class="fas fa-dollar-sign me-1"></i> Total: <strong class="carrito-total-precio">$${resumen.total.toFixed(2)}</strong></p>
        <div class="carrito-ahorro">
          ${resumen.subtotal > resumen.total ? `<small class="text-muted">Ahorras: $${(resumen.subtotal - resumen.total).toFixed(2)}</small>` : ''}
        </div>
      </div>
    `;

    // Resto del código para manejar eventos (igual que antes)...
    document.querySelectorAll(".actualizar-cantidad").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const input = document.getElementById(`cantidad-${id}`);
        const itemContenedor = input.closest(".mb-3");

        let cantidad = parseInt(input.value);

        // Verificar si se debe eliminar
        if (action === "restar" && cantidad === 1) {
          const { error } = await supabase.from("carrito").delete().eq("id", id);
          if (!error) {
            reproducirSonido("remove");
            mostrarToast("Producto eliminado", "error");
            mostrarCarrito();
            inicializarCarrito();
          }
          return;
        }

        // Actualizar cantidad
        if (action === "sumar") cantidad++;
        else if (action === "restar" && cantidad > 1) cantidad--;

        const { error } = await supabase
          .from("carrito")
          .update({ cantidad })
          .eq("id", id);

        if (!error) {
          input.value = cantidad;
          reproducirSonido("update");

          // ⚡ Animar producto editado
          itemContenedor.classList.remove("resplandor-temporal");
          void itemContenedor.offsetWidth;
          itemContenedor.classList.add("resplandor-temporal");

          // Actualizar todos los totales y descuentos
          await actualizarTotalesCarrito();
          mostrarToast("Cantidad actualizada", "success");
        }
      });
    });

    // Eventos de eliminar individual
    document.querySelectorAll(".eliminar-producto").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const { error } = await supabase.from("carrito").delete().eq("id", id);
        if (!error) {
          reproducirSonido("remove");
          mostrarToast("Producto eliminado del carrito", "success");
          mostrarCarrito();
          inicializarCarrito();
        }
      });
    });

    // Evento de vaciar carrito
    document.getElementById("limpiar-carrito").addEventListener("click", async (e) => {
      e.target.classList.add("animate__shakeX");
      setTimeout(() => e.target.classList.remove("animate__shakeX"), 1000);
      const { error } = await supabase.from("carrito").delete().eq("usuario_id", usuario_id);
      if (!error) {
        reproducirSonido("remove");
        mostrarToast("Carrito vaciado", "warning");
        mostrarCarrito();
        inicializarCarrito();
      }
    });

    // Evento de "hacer pedido"
    document.getElementById("hacer-pedido").addEventListener("click", confirmarPedido);

  } catch (error) {
    console.error("❌ Error al mostrar el carrito:", error);
    carritoBody.innerHTML = "<p class='text-danger'>Error al cargar el carrito</p>";
  }
}

export async function generarResumenPopover() {
  const { data: user } = await supabase.auth.getUser();
  const usuario_id = user?.user?.id;
  const contenedor = document.getElementById("popover-carrito-content");

  if (!usuario_id || !contenedor) return;

  const { data, error } = await supabase
    .from("carrito")
    .select(`cantidad, productos:producto_id (nombre, precio)`)
    .eq("usuario_id", usuario_id);

  if (error || !data) {
    contenedor.innerHTML = "<p class='text-danger'>Error al cargar</p>";
    return;
  }

  if (data.length === 0) {
    contenedor.innerHTML = "<p class='text-muted'>Tu carrito está vacío</p>";
    return;
  }

  const total = data.reduce((sum, item) => sum + item.cantidad * item.productos.precio, 0);
  const resumen = data
    .slice(0, 9)
    .map(i => `<div><i class="fas fa-circle me-1 text-secondary" style="font-size: 0.5rem;"></i>${i.productos.nombre} (${i.cantidad})</div>`)
    .join("");

  contenedor.innerHTML = `
    ${resumen}
    <hr class="my-2">
    <strong>Total:</strong> $${total.toFixed(2)}
  `;
}

// Función centralizada para evaluar descuentos
function evaluarDescuento(promo, item) {
  const cantidad = item.cantidad;
  const precio = item.productos.precio;
  const productoId = item.productos.id;
  const productosPromo = promo.productos_promocion || [];

  // Verificar si el producto aplica para la promoción
  const productoEnPromo = productosPromo.some(pp => pp.producto_id === productoId);
  const esPromoGeneral = ['percentage', 'threshold'].includes(promo.tipo);

  if (!productoEnPromo && !esPromoGeneral) {
    return { aplica: false, descuento: 0, texto: "" };
  }

  switch (promo.tipo) {
    case "percentage":
      return {
        aplica: true,
        descuento: precio * cantidad * (promo.porcentaje / 100),
        texto: `${promo.porcentaje}% descuento`
      };

    case "products":
      return {
        aplica: true,
        descuento: precio * cantidad * (promo.porcentaje / 100),
        texto: `${promo.porcentaje}% descuento`
      };

    case "bogo":
      const pares = Math.floor(cantidad / 2);
      if (pares > 0) {
        return {
          aplica: true,
          descuento: pares * precio,
          texto: "2x1 aplicado"
        };
      }
      break;

    case "buy-get":
      const sets = Math.floor(cantidad / promo.buy_quantity);
      if (sets > 0) {
        const gratis = sets * promo.get_quantity;
        return {
          aplica: true,
          descuento: gratis * precio,
          texto: `Compra ${promo.buy_quantity} lleva ${promo.get_quantity} gratis`,
          promocion_id: promo.id // 💥
        };
      }
      break;

    default:
      return { aplica: false, descuento: 0, texto: "" };
  }

  return { aplica: false, descuento: 0, texto: "" };
}

// Función optimizada para calcular todos los descuentos
export async function calcularDescuentosCarrito(usuario_id) {
  const promocionesAplicadas = new Set();
  // Obtener productos del carrito
  const { data: carritoData, error: carritoError } = await supabase
    .from("carrito")
    .select(`
      id,
      cantidad,
      productos:producto_id (
        id,
        nombre,
        precio,
        imagen_url
      )
    `)
    .eq("usuario_id", usuario_id);

  if (carritoError) throw carritoError;

  // Obtener promociones activas
  const { data: promocionesData, error: promocionesError } = await supabase
    .from("promociones")
    .select(`
      id,
      nombre,
      tipo,
      porcentaje,
      threshold,
      buy_quantity,
      get_quantity,
      productos_promocion:productos_promocion(producto_id, producto_gratis_id)
    `)
    .gte("fecha_expiracion", new Date().toISOString())
    .eq("activa", true);

  if (promocionesError) throw promocionesError;

  // Calcular descuentos para cada producto
  const productosConDescuento = carritoData.map(item => {
    const producto = { ...item, descuento: 0, descuentoTexto: "" };

    promocionesData.forEach(promo => {
      const resultado = evaluarDescuento(promo, item);
      if (resultado.aplica) {
        producto.descuento += resultado.descuento;
        producto.promocion_id = resultado.promocion_id || null;
        // Solo actualizar el texto si no tiene uno o si es un descuento mayor
        if (!producto.descuentoTexto || resultado.descuento > 0) {
          producto.descuentoTexto = resultado.texto;
        }
        promocionesAplicadas.add(promo.nombre); // <<-- Aquí guardas la promo aplicada
      }
    });

    return producto;
  });

  // Calcular totales
  const subtotal = productosConDescuento.reduce((sum, item) =>
    sum + (item.productos.precio * item.cantidad), 0);

  const descuentoTotal = productosConDescuento.reduce((sum, item) => sum + item.descuento, 0);

  // Aplicar descuentos por threshold (monto mínimo)
  const thresholdPromos = promocionesData.filter(p => p.tipo === "threshold");
  let thresholdDescuento = 0;
  let thresholdTexto = "";

  if (thresholdPromos.length > 0 && subtotal >= thresholdPromos[0].threshold) {
    thresholdDescuento = subtotal * (thresholdPromos[0].porcentaje / 100);
    thresholdTexto = `${thresholdPromos[0].porcentaje}% descuento por compra mayor a $${thresholdPromos[0].threshold}`;
  }

  const total = subtotal - descuentoTotal - thresholdDescuento;
  const cantidadTotal = productosConDescuento.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    productos: productosConDescuento,
    resumen: {
      subtotal,
      descuentoTotal,
      thresholdDescuento,
      thresholdTexto,
      total,
      cantidadTotal,
      promocionesAplicadas: Array.from(promocionesAplicadas) // <<-- lo devuelves como array
    }
  };
}

// Función optimizada para actualizar los totales
async function actualizarTotalesCarrito() {
  try {
    const { data: user } = await supabase.auth.getUser();
    const usuario_id = user?.user?.id;
    if (!usuario_id) return;

    // Calcular todos los descuentos y totales
    const { productos, resumen } = await calcularDescuentosCarrito(usuario_id);

    // Actualizar los elementos del DOM
    document.querySelector(".carrito-total-productos").textContent = resumen.cantidadTotal;

    // Actualizar elementos de descuento
    const descuentoElement = document.querySelector(".carrito-descuentos");
    if (descuentoElement) {
      descuentoElement.innerHTML = resumen.descuentoTotal > 0 ?
        `<i class="fas fa-tag me-1 text-success"></i> Descuentos: <strong class="text-success">-$${resumen.descuentoTotal.toFixed(2)}</strong>` :
        '';
    }

    const thresholdElement = document.querySelector(".carrito-threshold");
    if (thresholdElement) {
      thresholdElement.innerHTML = resumen.thresholdDescuento > 0 ?
        `<i class="fas fa-percentage me-1 text-success"></i> ${resumen.thresholdTexto}: <strong class="text-success">-$${resumen.thresholdDescuento.toFixed(2)}</strong>` :
        '';
    }

    document.querySelector(".carrito-total-precio").textContent = `$${resumen.total.toFixed(2)}`;

    const ahorroElement = document.querySelector(".carrito-ahorro");
    if (ahorroElement) {
      ahorroElement.innerHTML = resumen.subtotal > resumen.total ?
        `<small class="text-muted">Ahorras: $${(resumen.subtotal - resumen.total).toFixed(2)}</small>` :
        '';
    }

    // Actualizar subtotales individuales
    productos.forEach(item => {
      const subtotalElement = document.getElementById(`subtotal-${item.id}`);
      if (subtotalElement) {
        subtotalElement.textContent = `$${((item.productos.precio * item.cantidad) - item.descuento).toFixed(2)}`;

        // Actualizar precio tachado
        const precioOriginal = (item.productos.precio * item.cantidad).toFixed(2);
        let precioOriginalElement = subtotalElement.nextElementSibling;

        if (precioOriginalElement && precioOriginalElement.classList.contains('text-danger')) {
          if (item.descuento > 0) {
            precioOriginalElement.textContent = `$${precioOriginal}`;
            precioOriginalElement.style.display = 'block';
            precioOriginalElement.classList.remove("d-none");
            // Reiniciar animación
            precioOriginalElement.classList.remove("animate__animated", "animate__fadeInDown");
            void precioOriginalElement.offsetWidth;
            precioOriginalElement.classList.add("animate__animated", "animate__fadeInDown");
          } else {
            precioOriginalElement.remove();
          }
        } else if (item.descuento > 0) {
          const nuevoSmall = document.createElement("small");
          nuevoSmall.className = "text-danger text-decoration-line-through animate__animated animate__fadeInDown";
          nuevoSmall.textContent = `$${precioOriginal}`;
          subtotalElement.after(nuevoSmall);
        }


        // Actualizar texto de descuento
        const contenedorItem = subtotalElement.closest('.mb-3');
        const descuentoTextoContainer = contenedorItem.querySelector("small.text-success[data-promo-texto='true']");

        if (item.descuentoTexto) {
          if (descuentoTextoContainer) {
            // Actualizar texto existente
            descuentoTextoContainer.innerHTML = `<i class="fas fa-tag me-1"></i>${item.descuentoTexto}`;
            descuentoTextoContainer.classList.remove("d-none");
          } else {
            // Crear nuevo elemento
            const nuevoTexto = document.createElement("small");
            nuevoTexto.className = "text-success animate__animated animate__fadeIn";
            nuevoTexto.dataset.promoTexto = "true";
            nuevoTexto.innerHTML = `<i class="fas fa-tag me-1"></i>${item.descuentoTexto}`;
            contenedorItem.querySelector("h6").after(nuevoTexto);
          }
        } else if (descuentoTextoContainer) {
          // Eliminar si no hay descuento
          descuentoTextoContainer.remove();
        }
      }
    });

  } catch (error) {
    console.error("Error al actualizar totales del carrito:", error);
  }
}

function reproducirSonido(nombre) {
  const audio = new Audio(`./sounds/${nombre}.mp3`);
  audio.volume = 0.8;
  audio.play();
}
