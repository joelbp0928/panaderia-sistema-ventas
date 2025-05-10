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
    const { data, error } = await supabase
      .from("carrito")
      .select(`
        id,
        cantidad,
        productos:producto_id (
          nombre,
          precio,
          imagen_url
        )
      `)
      .eq("usuario_id", usuario_id);

    if (error) throw error;

    if (!data || data.length === 0) {
      carritoBody.innerHTML = "<p class='text-muted'><i class='fa-solid fa-ban'></i> Tu carrito está vacío</p>";
      badgeCount.textContent = "0";
      return;
    }

    badgeCount.textContent = data.length;
    badgeCount.classList.remove("animate__bounceIn");
    void badgeCount.offsetWidth;
    badgeCount.classList.add("animate__animated", "animate__bounceIn");

    const total = data.reduce((sum, item) => sum + (item.productos.precio * item.cantidad), 0);
    const cantidadTotal = data.reduce((sum, item) => sum + item.cantidad, 0);

    carritoBody.innerHTML = `
       <div class="d-grid gap-2 mb-3">
        <button id="limpiar-carrito" class="btn btn-outline-danger animate__animated"><i class="fas fa-trash me-2"></i>Vaciar Carrito</button>
        <button id="hacer-pedido" class="btn btn-success animate__animated animate__pulse animate__infinite"><i class="fas fa-check-circle me-2"></i>Hacer Pedido</button>
      </div>
      <div class="animate__animated animate__fadeInRight">
        ${data.map(item => `
  <div class="mb-3 d-flex align-items-center border-bottom pb-2 justify-content-between">
    <img src="${item.productos.imagen_url}" class="img-thumbnail me-2" style="width: 60px; height: 60px; object-fit: cover;">
    <div class="flex-grow-1 me-2">
      <h6 class="mb-1">${item.productos.nombre}</h6>
      <div class="input-group input-group-sm w-75">
        <button class="btn btn-outline-secondary actualizar-cantidad" data-id="${item.id}" data-action="restar"><i class="fas fa-minus"></i></button>
        <input type="text" class="form-control text-center cantidad-input" data-id="${item.id}" id="cantidad-${item.id}" value="${item.cantidad}" readonly>
        <button class="btn btn-outline-secondary actualizar-cantidad" data-id="${item.id}" data-action="sumar"><i class="fas fa-plus"></i></button>
      </div>
    </div>
    <div class="text-end">
      <button class="btn btn-sm btn-outline-danger eliminar-producto" data-id="${item.id}" title="Eliminar"><i class="fas fa-times"></i></button>
<p class="mb-1 fw-bold text-success" id="subtotal-${item.id}" data-precio="${item.productos.precio}">
  $${(item.productos.precio * item.cantidad).toFixed(2)}
</p>
    </div>
  </div>
        `).join("")}
      </div>
      <div class="mt-3 border-top pt-3 text-end">
<p class="mb-1"><i class="fas fa-shopping-cart me-1"></i> Productos: <strong class="carrito-total-productos">${cantidadTotal}</strong></p>
<p class="mb-0"><i class="fas fa-dollar-sign me-1"></i> Total: <strong class="carrito-total-precio">$${total.toFixed(2)}</strong></p>
      </div>
    `;

    document.querySelectorAll(".actualizar-cantidad").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const input = document.getElementById(`cantidad-${id}`);
        const subtotal = document.getElementById(`subtotal-${id}`);
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

          // Actualizar subtotal
          const precioUnitario = parseFloat(subtotal.dataset.precio);
          const nuevoSubtotal = (precioUnitario * cantidad).toFixed(2);
          subtotal.innerText = `$${nuevoSubtotal}`;

          // ⚡ Animar producto editado
          itemContenedor.classList.remove("resplandor-temporal");
          void itemContenedor.offsetWidth;
          itemContenedor.classList.add("resplandor-temporal");          

          // Actualizar totales generales
          actualizarTotalesCarrito();
          mostrarToast("Cantidad actualizada", "success");
        }
      });
    });

    // Eventos de eliminar individual
    document.querySelectorAll(".eliminar-producto").forEach((btn, index) => {
      btn.addEventListener("click", async () => {
        const id = data[index].id;
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

    // Evento de "hacer pedido" (por ahora solo alerta)
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

function actualizarTotalesCarrito() {
  let total = 0;
  let cantidadTotal = 0;

  document.querySelectorAll(".cantidad-input").forEach(input => {
    const cantidad = parseInt(input.value);
    const subtotal = document.getElementById(`subtotal-${input.dataset.id}`);
    const precioUnitario = parseFloat(subtotal.dataset.precio);

    total += cantidad * precioUnitario;
    cantidadTotal += cantidad;
  });

  document.querySelector(".carrito-total-productos").innerText = cantidadTotal;
  document.querySelector(".carrito-total-precio").innerText = `$${total.toFixed(2)}`;
}


function reproducirSonido(nombre) {
  const audio = new Audio(`./sounds/${nombre}.mp3`);
  audio.volume = 0.8;
  audio.play();
}
