import { supabase } from "./supabase-config.js";
import { mostrarToast, showLoading, hideLoading } from "./manageError.js";
import { cargarProductos } from "./productos.js";
import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from "./firebase-config.js";

// 🏷️ Variables de estado
let promocionesActivas = [];
let sugerenciasPromociones = [];
let promoEditandoId = null;

// 🌐 Exponer funciones globales
window.updateDiscountOptions = updateDiscountOptions;
window.aceptarSugerencia = aceptarSugerencia;
//window.crearPromocion = crearPromocion;

// 🚀 Inicialización
document.addEventListener("DOMContentLoaded", function () {
    // cargarPromociones();
    cargarSugerencias();
    cargarProductosPromocion();
    // Formulario de creación
    document.getElementById("create-promotion-form").addEventListener("submit", function (e) {
        e.preventDefault();
        crearPromocion();
    });
});

// Vista previa de la imagen seleccionada
document.getElementById('promotion-image').addEventListener('change', function (e) {
    const preview = document.getElementById('promotion-image-preview');
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }

        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
        preview.src = '#';
    }
});

// 📋 Cargar promociones existentes
export async function cargarPromociones() {
    console.log("cargando promociones....")
    try {
        showLoading();
        const { data, error } = await supabase
            .from('promociones')
            .select(`
                *
            `)
            .order('fecha_expiracion', { ascending: true });

        if (error) throw error;

        promocionesActivas = data;
        renderizarPromociones();
    } catch (error) {
        mostrarToast("❌ Error al cargar promociones", "error");
        console.error("Error al cargar promociones:", error);
    } finally {
        hideLoading();
    }
}

// 💡 Cargar sugerencias de promociones
async function cargarSugerencias() {
    try {
        // Aquí podrías conectar con un sistema de recomendaciones basado en IA
        // Por ahora usamos datos de ejemplo
        sugerenciasPromociones = [
            {
                id: 1,
                descripcion: "2x1 en Donas de Chocolate",
                tipo: "bogo",
                producto_id: 1
            },
            {
                id: 2,
                descripcion: "Descuento del 15% en pedidos mayores a $100",
                tipo: "threshold",
                threshold: 100,
                porcentaje: 15
            }
        ];

        renderizarSugerencias();
    } catch (error) {
        console.error("Error al cargar sugerencias:", error);
    }
}

// 🖼️ Renderizar promociones activas
function renderizarPromociones() {
    const container = document.querySelector("#promociones-activas");
    container.innerHTML = promocionesActivas.map(promo => {
        const esExpirada = new Date(promo.fecha_expiracion) < new Date();
        const estadoTexto = esExpirada ? 'Expirada' : 'Activa';
        const estadoBadgeClass = esExpirada ? 'badge-expired' : 'bg-success';
        const tarjetaOpacityClass = esExpirada ? 'opacity-50 position-relative' : '';
        const icono = obtenerIconoTipo(promo.tipo);
        const iconoExpirado = esExpirada ? '<i class="fa-solid fa-circle-xmark text-danger ms-2" title="Expirada"></i>' : '';

        const tipoBadge = `<span class="badge badge-${promo.tipo}">${obtenerTextoTipo(promo.tipo)}</span>`;
        const overlayExpirado = esExpirada
            ? `<div class="expired-overlay"><i class="fa-solid fa-ban me-2"></i>Promoción expirada</div>`
            : '';

        return `
        <div class="promo-card ${tarjetaOpacityClass}" data-id="${promo.id}">
          ${overlayExpirado}
          <div class="promo-header">
            <span class="emoji">${icono}</span> ${promo.nombre} ${iconoExpirado}
          </div>
          <div class="promo-body">
            <i class="fa-solid fa-calendar-day"></i> Vence: ${new Date(promo.fecha_expiracion).toLocaleDateString()}
          </div>
          <div class="promo-footer">
            ${tipoBadge}
            <span class="badge ${estadoBadgeClass}">${estadoTexto}</span>
          </div>
        </div>
      `;
    }).join('');
}


// 🖼️ Renderizar sugerencias
function renderizarSugerencias() {
    const container = document.querySelector("#promo-recommendations ul.list-group:first-of-type");
    container.innerHTML = sugerenciasPromociones.map(sug => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${sug.descripcion}
            <button class="btn btn-success btn-sm" onclick="aceptarSugerencia(${sug.id})">
                Aceptar
            </button>
        </li>
    `).join('');
}

// ✨ Actualizar opciones de descuento dinámicamente
function updateDiscountOptions() {
    const tipo = document.getElementById("promotion-discount-type").value;

    // Ocultar todas las configuraciones primero
    document.querySelectorAll(".discount-option").forEach(el => {
        el.classList.add("d-none");
    });

    // Mostrar solo la configuración relevante
    if (tipo) {
        document.getElementById(`${tipo}-config`).classList.remove("d-none");
    }
}

// ✅ Aceptar una sugerencia de promoción
async function aceptarSugerencia(idSugerencia) {
    const sugerencia = sugerenciasPromociones.find(s => s.id === idSugerencia);
    if (!sugerencia) return;

    try {
        showLoading();

        // Crear la promoción basada en la sugerencia
        const nuevaPromo = {
            nombre: sugerencia.descripcion,
            tipo: sugerencia.tipo,
            fecha_expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días después
        };

        // Configurar según el tipo
        switch (sugerencia.tipo) {
            case "percentage":
                nuevaPromo.porcentaje = sugerencia.porcentaje;
                break;
            case "buy-get":
                nuevaPromo.buy_quantity = sugerencia.buy_quantity;
                nuevaPromo.get_quantity = sugerencia.get_quantity;
                break;
            case "threshold":
                nuevaPromo.threshold = sugerencia.threshold;
                nuevaPromo.porcentaje = sugerencia.porcentaje;
                break;
        }

        // Insertar en Supabase
        const { data, error } = await supabase
            .from('promociones')
            .insert([nuevaPromo])
            .select();

        if (error) throw error;

        // Si hay productos asociados
        if (sugerencia.producto_id) {
            await supabase
                .from('productos_promocion')
                .insert([{
                    promocion_id: data[0].id,
                    producto_id: sugerencia.producto_id
                }]);
        }

        mostrarToast("✅ Promoción creada exitosamente", "success");
        await cargarPromociones();
    } catch (error) {
        mostrarToast("❌ Error al crear promoción", "error");
        console.error("Error al aceptar sugerencia:", error);
    } finally {
        hideLoading();
    }
}

// ➕ Crear nueva promoción desde el formulario
async function crearPromocion() {
    const form = document.getElementById("create-promotion-form");
    const tipo = document.getElementById("promotion-discount-type").value;
    const imagenInput = document.getElementById("promotion-image");

    if (!validarFormularioPromocion(tipo)) return;

    try {
        showLoading();
        // 1. Subir imagen a Firebase Storage si existe
        let imagenUrl = null;
        if (imagenInput.files && imagenInput.files[0]) {
            const file = imagenInput.files[0];

            // Validar tamaño de la imagen (ejemplo: máximo 2MB)
            if (file.size > 2 * 1024 * 1024) {
                mostrarToast("❌ La imagen debe ser menor a 2MB", "error");
                return;
            }

            // Crear referencia en Firebase Storage
            const filePath = `promociones/${Date.now()}_${file.name}`;
            const fileRef = ref(storage, filePath);
            await uploadBytes(fileRef, file);
            imagenUrl = await getDownloadURL(fileRef);
            if (!imagenUrl) throw new Error("No se pudo obtener la URL de la imagen");


        }
        console.log("📷 URL de imagen subida:", imagenUrl);

        // Construir objeto de promoción
        const promocion = {
            nombre: document.getElementById("promotion-name").value.trim(),
            tipo: tipo,
            fecha_expiracion: document.getElementById("promotion-fin").value || null,
            imagen_url: imagenUrl, // Añadir la URL de la imagen

            activa: true
        };

        // Añadir configuraciones específicas
        switch (tipo) {
            case "percentage":
                promocion.porcentaje = parseFloat(document.getElementById("percentage-value").value);
                break;
            case "buy-get":
                promocion.buy_quantity = parseInt(document.getElementById("buy-quantity").value);
                promocion.get_quantity = parseInt(document.getElementById("get-quantity").value);
                break;
            case "threshold":
                promocion.threshold = parseFloat(document.getElementById("threshold-value").value);
                promocion.porcentaje = parseFloat(document.getElementById("threshold-percentage").value);
                break;
            case "bogo":
                const selectElement = document.getElementById("promotion-products");
                const selectedOptions = Array.from(selectElement.selectedOptions);
                selectedOptions.map(option => ({
                    id: option.value,
                    nombre: option.text
                }));
        }

        // Insertar en Supabase
        const { data, error } = await supabase
            .from('promociones')
            .insert([promocion])
            .select();

        if (error) throw error;

        // Asociar productos seleccionados
        const productosSeleccionados = Array.from(
            document.getElementById("promotion-products").selectedOptions
        ).map(option => option.value);

        if (productosSeleccionados.length > 0) {
            await supabase
                .from('products_promocion')
                .insert(productosSeleccionados.map(producto_id => ({
                    promocion_id: data[0].id,
                    producto_id: producto_id
                })));
        }

        mostrarToast("✅ Promoción creada exitosamente", "success");
        bootstrap.Modal.getInstance(document.getElementById("promocionModal"))?.hide();
        form.reset();
        await cargarPromociones();
    } catch (error) {
        mostrarToast("❌ Error al crear promoción", "error");
        console.error("Error al crear promoción:", error);
    } finally {
        hideLoading();
    }
}

// 🔍 Validar formulario de promoción
function validarFormularioPromocion(tipo) {
    let valido = true;

    // Validación básica
    if (!document.getElementById("promotion-name").value.trim()) {
        mostrarToast("El nombre de la promoción es obligatorio", "warning");
        valido = false;
    }

    // Validaciones específicas por tipo
    switch (tipo) {
        case "percentage":
            if (!document.getElementById("percentage-value").value) {
                mostrarToast("Debe especificar un porcentaje", "warning");
                valido = false;
            }
            break;
        case "buy-get":
            if (!document.getElementById("buy-quantity").value ||
                !document.getElementById("get-quantity").value) {
                mostrarToast("Debe especificar cantidades", "warning");
                valido = false;
            }
            break;
        case "threshold":
            if (!document.getElementById("threshold-value").value ||
                !document.getElementById("threshold-percentage").value) {
                mostrarToast("Debe especificar monto y porcentaje", "warning");
                valido = false;
            }
            break;
        case "bogo":
            if (!document.getElementById("promotion-products").value) {
                mostrarToast("Debe especificar los productos en descuento", "warning");
                valido = false;
            }
            break;
    }

    return valido;
}

// 🎲 Generar sugerencia automática
async function generarSugerencia() {
    try {
        // Aquí podrías implementar lógica más inteligente
        // Por ahora usamos un ejemplo simple basado en productos menos vendidos

        const { data: productos, error } = await supabase
            .from('productos')
            .select('*')
            .order('ventas', { ascending: true })
            .limit(1);

        if (error || !productos.length) throw error || new Error("No hay productos");

        const nuevoId = Math.max(...sugerenciasPromociones.map(s => s.id), 0) + 1;
        const producto = productos[0];

        const nuevaSugerencia = {
            id: nuevoId,
            descripcion: `2x1 en ${producto.nombre}`,
            tipo: "bogo",
            producto_id: producto.id
        };

        sugerenciasPromociones.push(nuevaSugerencia);
        renderizarSugerencias();
        mostrarToast("✨ Nueva sugerencia generada", "success");
    } catch (error) {
        mostrarToast("❌ Error al generar sugerencia", "error");
        console.error("Error al generar sugerencia:", error);
    }
}

// 🎨 Helper para obtener icono según tipo
function obtenerIconoTipo(tipo) {
    const iconos = {
        percentage: "📊",
        "buy-get": "🛒",
        bogo: "🎉",
        threshold: "💰"
    };
    return iconos[tipo] || "🎯";
}

function obtenerTextoTipo(tipo) {
    const textos = {
        percentage: "Porcentaje de descuento",
        "buy-get": "Compra y lleva gratis",
        bogo: "2x1",
        threshold: "Descuento por monto mínimo"
    };
    return textos[tipo] || "Promoción";
}

// 🎯 Evento click en tarjeta
const promoContainer = document.getElementById("promociones-activas");
promoContainer.addEventListener("click", async (e) => {
    console.log("aqui")
    const card = e.target.closest(".promo-card");
    if (!card) return;

    const promoId = card.getAttribute("data-id");
    const promocion = promocionesActivas.find(p => p.id == promoId);
    console.log(promoId)
    if (!promocion) return;

    // 🧠 Render contenido dinámico
    document.getElementById("detalle-promo-nombre").textContent = promocion.nombre;
    document.getElementById("detalle-promo-fechas").textContent = new Date(promocion.fecha_expiracion).toLocaleDateString();

    // 🖼 Imagen si hay
    const img = document.getElementById("detalle-promo-imagen");
    if (promocion.imagen_url) {
        img.src = promocion.imagen_url;
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }

    // 🏷️ Tipo
    const tipoSpan = document.getElementById("detalle-promo-tipo");
    tipoSpan.textContent = traducirTipoPromocion(promocion.tipo);
    tipoSpan.className = `badge rounded-pill ${claseBadge(promocion.tipo)}`;

    // ⚙️ Condiciones
    let condiciones = "";
    switch (promocion.tipo) {
        case "percentage":
            condiciones = `Descuento del ${promocion.porcentaje}%`;
            break;
        case "buy-get":
            condiciones = `Compra ${promocion.buy_quantity}, lleva ${promocion.get_quantity} gratis`;
            break;
        case "threshold":
            condiciones = `Descuento del ${promocion.porcentaje}% en compras desde $${promocion.threshold}`;
            break;
        case "bogo":
            condiciones = `Aplica 2x1 en productos seleccionados`;
            break;
    }
    document.getElementById("detalle-promo-condiciones").textContent = condiciones;

    // 📦 Productos asociados
    const { data: productos, error } = await supabase
        .from("products_promocion")
        .select("producto_id, productos(nombre)")
        .eq("promocion_id", promoId);

    const lista = productos?.map(p => p.productos?.nombre).join(", ") || "-";
    document.getElementById("detalle-promo-productos").textContent = lista;

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById("detallePromocionModal"));
    modal.show();

    // Asociar botones
    document.getElementById("btn-editar-promocion").onclick = () => editarPromocion(promocion);
    document.getElementById("btn-eliminar-promocion").onclick = () => confirmarEliminarPromocion(promocion);
});

// ✅ Acción cuando se da clic en "Editar"
function editarPromocion(promocion) {
    promoEditandoId = promocion.id;

    // 1. Rellenar campos del formulario
    document.getElementById("promotion-name").value = promocion.nombre;
    document.getElementById("promotion-discount-type").value = promocion.tipo;
    document.getElementById("promotion-inicio").value = promocion.fecha_inicio?.split("T")[0] || "";
    document.getElementById("promotion-fin").value = promocion.fecha_expiracion?.split("T")[0] || "";
    updateDiscountOptions();

    // 2. Mostrar configuraciones específicas
    if (promocion.tipo === "percentage") {
        document.getElementById("percentage-value").value = promocion.porcentaje;
    } else if (promocion.tipo === "buy-get") {
        document.getElementById("buy-quantity").value = promocion.buy_quantity;
        document.getElementById("get-quantity").value = promocion.get_quantity;
    } else if (promocion.tipo === "threshold") {
        document.getElementById("threshold-value").value = promocion.threshold;
        document.getElementById("threshold-percentage").value = promocion.porcentaje;
    }

    // 3. Productos asociados
    cargarProductos().then(() => {
        const select = document.getElementById("promotion-products");
        Array.from(select.options).forEach(opt => {
            opt.selected = false;
        });
        supabase.from("productos_promocion")
            .select("producto_id")
            .eq("promocion_id", promocion.id)
            .then(({ data }) => {
                data?.forEach(p => {
                    const option = select.querySelector(`option[value='${p.producto_id}']`);
                    if (option) option.selected = true;
                });
            });
    });

    // 4. Mostrar modal y cambiar botón
    const boton = document.querySelector("#create-promotion-form button[type='submit']");
    boton.textContent = "Actualizar Promoción";
    boton.classList.remove("btn-success");
    boton.classList.add("btn-warning");

    boton.onclick = (e) => {
        e.preventDefault();
        actualizarPromocion();
    };

    const modal = new bootstrap.Modal(document.getElementById("promocionModal"));
    modal.show();
}

// ✅ Actualizar en Supabase
async function actualizarPromocion() {
    const btn = document.getElementById("btn-save-promotion");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Editando...`;
    if (!promoEditandoId) return;

    try {
        showLoading();
        const tipo = document.getElementById("promotion-discount-type").value;

        const promocionActualizada = {
            nombre: document.getElementById("promotion-name").value.trim(),
            tipo,
            fecha_inicio: document.getElementById("promotion-inicio").value,
            fecha_expiracion: document.getElementById("promotion-fin").value,
        };

        // Configuración según tipo
        if (tipo === "percentage") {
            promocionActualizada.porcentaje = parseFloat(document.getElementById("percentage-value").value);
        } else if (tipo === "buy-get") {
            promocionActualizada.buy_quantity = parseInt(document.getElementById("buy-quantity").value);
            promocionActualizada.get_quantity = parseInt(document.getElementById("get-quantity").value);
        } else if (tipo === "threshold") {
            promocionActualizada.threshold = parseFloat(document.getElementById("threshold-value").value);
            promocionActualizada.porcentaje = parseFloat(document.getElementById("threshold-percentage").value);
        }

        // Subir nueva imagen si la hay
        const imagenInput = document.getElementById("promotion-image");
        if (imagenInput.files?.length) {
            const file = imagenInput.files[0];
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`promociones/${Date.now()}_${file.name}`);
            const snapshot = await fileRef.put(file);
            const imageUrl = await snapshot.ref.getDownloadURL();
            promocionActualizada.imagen_url = imageUrl;
        }

        // Actualizar promo
        const { error } = await supabase
            .from("promociones")
            .update(promocionActualizada)
            .eq("id", promoEditandoId);

        if (error) throw error;

        // Actualizar productos relacionados
        const productosSeleccionados = Array.from(document.getElementById("promotion-products").selectedOptions)
            .map(opt => parseInt(opt.value));

        await supabase.from("productos_promocion").delete().eq("promocion_id", promoEditandoId);

        if (productosSeleccionados.length) {
            await supabase.from("productos_promocion").insert(
                productosSeleccionados.map(pid => ({ promocion_id: promoEditandoId, producto_id: pid }))
            );
        }

        mostrarToast("✅ Promoción actualizada con éxito", "success");
        promoEditandoId = null;
        document.getElementById("create-promotion-form").reset();
        await cargarPromociones();

        const modal = bootstrap.Modal.getInstance(document.getElementById("promocionModal"));
        modal.hide();
    } catch (error) {
        console.error(error);
        mostrarToast("❌ Error al actualizar promoción", "error");
    } finally {
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Crear Promoción`;
        hideLoading();
        hideLoading();
    }
}

function confirmarEliminarPromocion(promocion) {
    // Mostrar nombre en el modal
    document.getElementById("nombre-promo-a-eliminar").textContent = promocion.nombre;

    // Guardar ID temporalmente
    document.getElementById("confirmar-eliminar-btn").onclick = () => eliminarPromocion(promocion.id);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById("confirmarEliminarModal"));
    modal.show();
}

async function eliminarPromocion(id) {
    const btn = document.getElementById("confirmar-eliminar-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Eliminando...`;

    try {
        const { error } = await supabase
            .from("promociones")
            .delete()
            .eq("id", id);

        if (error) throw error;

        mostrarToast("🗑️ Promoción eliminada", "success");
        await cargarPromociones();

        // Cerrar ambos modales si están abiertos
        bootstrap.Modal.getInstance(document.getElementById("detallePromocionModal"))?.hide();
        bootstrap.Modal.getInstance(document.getElementById("confirmarEliminarModal"))?.hide();
    } catch (error) {
        mostrarToast("❌ No se pudo eliminar la promoción", "error");
        console.error(error);
    } finally {
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Sí, eliminar`;
        hideLoading();
    }
}

// Función para cargar productos en el select
export async function cargarProductosPromocion() {
    try {
        const select = document.getElementById("promotion-products");
        select.innerHTML = '<option disabled selected>🔄 Cargando productos...</option>';

        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre');

        if (error) throw error;

        if (data.length === 0) {
            select.innerHTML = '<option disabled>No hay productos disponibles</option>';
            return;
        }

        // Renderiza opciones
        select.innerHTML = '';
        data.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = producto.nombre;
            select.appendChild(option);
        });
    } catch (err) {
        console.error("❌ Error al cargar productos:", err);
        mostrarToast("Error al cargar productos", "error");
    }
}

// 🧩 Helper para traducir tipo
function traducirTipoPromocion(tipo) {
    return {
        "percentage": "Porcentaje de descuento",
        "buy-get": "Compra y lleva gratis",
        "bogo": "2x1",
        "threshold": "Descuento por monto mínimo"
    }[tipo] || "Tipo desconocido";
}

function claseBadge(tipo) {
    return {
        "percentage": "bg-success text-white",
        "buy-get": "bg-purple text-white",
        "bogo": "bg-primary text-white",
        "threshold": "bg-warning text-dark"
    }[tipo] || "bg-secondary text-white";
}
