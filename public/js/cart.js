import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

export function inicializarCarrito() {
  // Esta función queda para futuras mejoras (como renderizar carrito en tiempo real)
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
      carritoBody.innerHTML = "<p class='text-muted'>Tu carrito está vacío 💤</p>";
      badgeCount.textContent = "0";
      return;
    }

    badgeCount.textContent = data.length;

    carritoBody.innerHTML = `
      <div class="d-grid gap-2 mb-3">
        <button id="limpiar-carrito" class="btn btn-outline-danger"><i class="fas fa-trash me-2"></i>Vaciar Carrito</button>
        <button id="hacer-pedido" class="btn btn-success animate__animated animate__pulse animate__infinite"><i class="fas fa-check-circle me-2"></i>Hacer Pedido</button>
      </div>
      <div class="animate__animated animate__fadeInRight">
        ${data.map(item => `
          <div class="mb-3 d-flex align-items-center border-bottom pb-2 position-relative">
            <img src="${item.productos.imagen_url}" class="img-thumbnail me-2" style="width: 60px; height: 60px; object-fit: cover;">
            <div class="flex-grow-1">
              <h6 class="mb-0">${item.productos.nombre}</h6>
              <small>${item.cantidad} x $${item.productos.precio}</small>
            </div>
            <span class="text-success fw-bold me-2">$${(item.productos.precio * item.cantidad).toFixed(2)}</span>
            <button class="btn btn-sm btn-outline-danger eliminar-producto" data-id="${item.id}" style="position: absolute; top: 0; right: 0;"><i class="fas fa-times"></i></button>
          </div>
        `).join("")}
      </div>
    `;

    // Eventos de eliminar individual
    document.querySelectorAll(".eliminar-producto").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const { error } = await supabase.from("carrito").delete().eq("id", id);
        if (!error) {
          mostrarToast("🗑 Producto eliminado del carrito", "success");
          mostrarCarrito();
        }
      });
    });

    // Evento de vaciar carrito
    document.getElementById("limpiar-carrito").addEventListener("click", async () => {
      const { error } = await supabase.from("carrito").delete().eq("usuario_id", usuario_id);
      if (!error) {
        mostrarToast("🧹 Carrito vaciado", "info");
        mostrarCarrito();
      }
    });

    // Evento de "hacer pedido" (por ahora solo alerta)
    document.getElementById("hacer-pedido").addEventListener("click", () => {
      Swal.fire({
        icon: "success",
        title: "✨ Pedido iniciado",
        text: "Ahora procesaremos tu pedido en la siguiente fase",
        timer: 2500,
        showConfirmButton: false
      });
    });

  } catch (error) {
    console.error("❌ Error al mostrar el carrito:", error);
    carritoBody.innerHTML = "<p class='text-danger'>Error al cargar el carrito</p>";
  }
}

