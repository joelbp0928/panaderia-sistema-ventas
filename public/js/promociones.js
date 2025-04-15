import { supabase } from "./supabase-config.js";
import { mostrarToast, showLoading, hideLoading } from "./manageError.js";
import { cargarProductos } from "./productos.js";
import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from "./firebase-config.js";

// 🏷️ Variables de estado
let promocionesActivas = [];
let sugerenciasPromociones = [];
let promoEditandoId = null;
let promocionModal;

// 🌐 Exponer funciones globales
window.updateDiscountOptions = updateDiscountOptions;
window.aceptarSugerencia = aceptarSugerencia;

// 🚀 Inicialización
document.addEventListener("DOMContentLoaded", function () {
    setupPromocionModal();
    setupEventListeners();
    cargarSugerencias();
});

// 🔧 Configuración del modal de promoción
function setupPromocionModal() {
    promocionModal = new bootstrap.Modal(document.getElementById("promocionModal"), {
        keyboard: false,
        backdrop: 'static'
    });

    document.getElementById("promocionModal").addEventListener("hidden.bs.modal", () => {
        resetFormularioPromocion();
    });
}

// 🎛️ Configurar event listeners
function setupEventListeners() {
    // Formulario de creación/edición
    document.getElementById("create-promotion-form").addEventListener("submit", function (e) {
        e.preventDefault();
        gestionarPromocion();
    });

    // Vista previa de imagen
    // Vista previa de imagen mejorada
    document.getElementById('promotion-image').addEventListener('change', function (e) {
        const preview = document.getElementById('promotion-image-preview');
        const file = e.target.files[0];

        // Limpiar vista previa si no hay archivo
        if (!file) {
            preview.style.display = 'none';
            preview.src = '#';
            return;
        }

        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            mostrarToast("Formato de imagen no válido. Use JPEG, PNG o WEBP", "error");
            e.target.value = ''; // Limpiar input
            preview.style.display = 'none';
            preview.src = '#';
            return;
        }

        // Validar tamaño (opcional)
        /*   const maxSizeMB = 2;
           if (file.size > maxSizeMB * 1024 * 1024) {
               mostrarToast(`La imagen es muy grande (máx ${maxSizeMB}MB)`, "error");
               e.target.value = '';
               preview.style.display = 'none';
               preview.src = '#';
               return;
           }*/

        // Crear vista previa
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            preview.alt = "Vista previa de imagen de promoción";
        };

        reader.onerror = function () {
            console.error("Error al leer la imagen");
            mostrarToast("Error al cargar la imagen", "error");
            preview.style.display = 'none';
            preview.src = '#';
        };

        reader.readAsDataURL(file);
    });

    // Evento click en tarjetas de promoción
    document.getElementById("promociones-activas").addEventListener("click", async (e) => {
        const card = e.target.closest(".promo-card");
        if (!card) return;

        const promoId = card.getAttribute("data-id");
        const promocion = promocionesActivas.find(p => p.id == promoId);
        if (!promocion) return;

        mostrarDetallePromocion(promocion);
    });
}

// 📋 Cargar promociones existentes
export async function cargarPromociones() {
    try {
        showLoading();
        const { data, error } = await supabase
            .from('promociones')
            .select(`*`)
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

// 💡 Cargar sugerencias de promociones
async function cargarSugerencias() {
    try {
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

// ✅ Función principal para gestionar promociones (crear/editar)
export async function gestionarPromocion() {
    const form = document.getElementById("create-promotion-form");
    const tipo = document.getElementById("promotion-discount-type").value;
    const imagenInput = document.getElementById("promotion-image");
    const esEdicion = promoEditandoId !== null;

    if (!validarFormularioPromocion(tipo)) return;

    const boton = document.getElementById("btn-save-promotion");
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${esEdicion ? "Actualizando" : "Creando"}...`;

    try {
        showLoading();

        // 1. Manejar la imagen
        let imagenUrl = null;
        if (imagenInput.files?.length) {
            const file = imagenInput.files[0];
            const nombreUnico = generarNombreUnicoImagen(file.name);
            const filePath = `promociones/${nombreUnico}`;
            const fileRef = ref(storage, filePath);

            await uploadBytes(fileRef, file);
            imagenUrl = await getDownloadURL(fileRef);

            // 🗑️ Eliminar imagen anterior si es edición
            if (esEdicion) {
                const promo = promocionesActivas.find(p => p.id === promoEditandoId);
                if (promo?.imagen_url) {
                    await eliminarImagenAnterior(promo.imagen_url);
                }
            }
        }

        // 2. Construir objeto principal
        const dataPromo = {
            nombre: document.getElementById("promotion-name").value.trim(),
            tipo,
            buy_quantity: document.getElementById("buy-quantity").value,
            get_quantity: document.getElementById("get-quantity").value,
            fecha_inicio: document.getElementById("promotion-inicio").value,
            fecha_expiracion: document.getElementById("promotion-fin").value,
            activa: true
        };
        if (imagenUrl) dataPromo.imagen_url = imagenUrl;

        // 3. Configuraciones por tipo
        function obtenerProductosSeleccionados(tipo) {
            const selectMap = {
                "bogo": "promotion-products",
                "percentage": "promotion-percentage-products",
                "products": "promotion-percentage-products"
            };
        
            if (selectMap[tipo]) {
                const select = document.getElementById(selectMap[tipo]);
                return select ? Array.from(select.selectedOptions).map(opt => opt.value) : [];
            }
        
            if (tipo === "buy-get") {
                const selectBuy = document.getElementById("promotion-products-buy");
                const selectFree = document.getElementById("promotion-products-free");
                
                return {
                    buyProducts: selectBuy ? Array.from(selectBuy.selectedOptions).map(opt => opt.value) : [],
                    freeProducts: selectFree ? Array.from(selectFree.selectedOptions).map(opt => opt.value) : []
                };
            }
        
            console.error(`Tipo de promoción no reconocido: ${tipo}`);
            return [];
        }

        let productosSeleccionados = []; // Inicializar como array vacío

        switch (tipo) {
            case "percentage":
                dataPromo.porcentaje = parseFloat(document.getElementById("percentage-value").value);
                break;
            case "products":
                dataPromo.porcentaje = parseFloat(document.getElementById("products-value").value);
                productosSeleccionados = obtenerProductosSeleccionados(tipo);
                break;
                case "buy-get":
                    dataPromo.buy_quantity = parseInt(document.getElementById("buy-quantity").value);
                    dataPromo.get_quantity = parseInt(document.getElementById("get-quantity").value);
                    productosSeleccionados = obtenerProductosSeleccionados(tipo);
                    
                    // Validación adicional
                    if (productosSeleccionados.buyProducts.length === 0 || productosSeleccionados.freeProducts.length === 0) {
                        mostrarToast("Debe seleccionar productos para comprar y productos gratis", "warning");
                        return;
                    }
                    break;
            case "threshold":
                dataPromo.threshold = parseFloat(document.getElementById("threshold-value").value);
                dataPromo.porcentaje = parseFloat(document.getElementById("threshold-percentage").value);
                break;
            case "bogo":
                // 4. Productos seleccionados
                productosSeleccionados = obtenerProductosSeleccionados(tipo);
                break;
        }

        // 5. Guardar
        if (esEdicion) {
            await actualizarPromocionEnSupabase(promoEditandoId, dataPromo, productosSeleccionados);
            mostrarToast("✅ Promoción actualizada", "success");
        } else {
            await crearPromocionEnSupabase(dataPromo, productosSeleccionados);
            mostrarToast("✅ Promoción creada exitosamente", "success");
        }

        // 6. Reset UI
        promocionModal.hide();
        form.reset();
        await cargarPromociones();

    } catch (error) {
        console.error("❌ Error al guardar promoción:", error);
        mostrarToast("❌ Error al guardar promoción", "error");
    } finally {
        boton.disabled = false;
        boton.innerHTML = `<i class="fas fa-check-circle me-2"></i>${esEdicion ? "Actualizar" : "Crear"} Promoción`;
        hideLoading();
    }
}

// 🔁 Actualizar una promoción
// 🛠️ Actualizar promoción en Supabase (versión mejorada)
async function actualizarPromocionEnSupabase(id, dataPromo, productosSeleccionados) {
    try {
        // 1. Actualizar datos principales de la promoción
        const { error: updateError } = await supabase
            .from("promociones")
            .update(dataPromo)
            .eq("id", id);
        
        if (updateError) throw updateError;

        // 2. Eliminar relaciones existentes
        const { error: deleteError } = await supabase
            .from("productos_promocion")
            .delete()
            .eq("promocion_id", id);
        
        if (deleteError) throw deleteError;

        // 3. Crear nuevas relaciones según el tipo
        if (dataPromo.tipo === "buy-get") {
            await manejarRelacionesBuyGet(id, productosSeleccionados);
        } else {
            await manejarRelacionesNormales(id, productosSeleccionados);
        }
    } catch (error) {
        console.error("Error en actualizarPromocionEnSupabase:", error);
        throw error;
    }
}
// ➕ Crear nueva promoción (versión mejorada)
async function crearPromocionEnSupabase(dataPromo, productosSeleccionados) {
    try {
        // 1. Insertar la promoción principal
        const { data, error } = await supabase
            .from("promociones")
            .insert([dataPromo])
            .select();
        
        if (error) throw error;
        
        const promocionId = data[0].id;

        // 2. Manejar relaciones con productos según el tipo
        if (dataPromo.tipo === "buy-get") {
            // Caso especial para "buy-get" que tiene productos para comprar y gratis
            await manejarRelacionesBuyGet(promocionId, productosSeleccionados);
        } else {
            // Caso normal para otros tipos de promoción
            await manejarRelacionesNormales(promocionId, productosSeleccionados);
        }

        return data;
    } catch (error) {
        console.error("Error en crearPromocionEnSupabase:", error);
        throw error;
    }
}

// Función auxiliar para manejar relaciones buy-get
async function manejarRelacionesBuyGet(promocionId, { buyProducts, freeProducts }) {
    // Verificar que ambos arreglos tengan elementos
    if (buyProducts.length > 0 || freeProducts.length > 0) {
        const relaciones = buyProducts.map((producto_id, index) => ({
            promocion_id: promocionId,
            producto_id: producto_id, // Producto comprado
            producto_gratis_id: freeProducts[index] || null // Producto gratuito (si existe)
        }));

        // Insertar todo en un solo registro
        const { error } = await supabase
            .from("productos_promocion")
            .insert(relaciones);

        if (error) {
            console.error("Error al insertar relaciones:", error);
            throw error;
        }
    }
}




// Función auxiliar para relaciones normales
async function manejarRelacionesNormales(promocionId, productosIds) {
    if (productosIds.length > 0) {
        const relaciones = productosIds.map(producto_id => ({
            promocion_id: promocionId,
            producto_id: producto_id
        }));
        
        const { error } = await supabase
            .from("productos_promocion")
            .insert(relaciones);
        
        if (error) throw error;
    }
}




// 🗑️ Eliminar imagen anterior de Firebase Storage
async function eliminarImagenAnterior(imagenUrl) {
    try {
        if (imagenUrl && imagenUrl.includes('firebasestorage.googleapis.com')) {
            const url = new URL(imagenUrl);
            const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
            const oldImageRef = ref(storage, path);
            await deleteObject(oldImageRef);
        }
    } catch (error) {
        console.warn("⚠️ No se pudo eliminar la imagen anterior:", error);
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
        case "products":
            if (!document.getElementById("products-value").value) {
                mostrarToast("Debe especificar un porcentaje", "warning");
                valido = false;
            } else if (!document.getElementById("promotion-percentage-products").value) {
                mostrarToast("Debe especificar los productos en descuento", "warning");
                valido = false;
            }
            break;
        case "buy-get":
            if (!document.getElementById("promotion-products-buy").value ||
                !document.getElementById("promotion-products-free").value) {
                mostrarToast("Debe especificar productos", "warning");
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

// 🎲 Generar sugerencia automática
async function generarSugerencia() {
    try {
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

// 🎯 Mostrar detalle de promoción
async function mostrarDetallePromocion(promocion) {
    // 🧠 Render contenido dinámico
    document.getElementById("detalle-promo-nombre").textContent = promocion.nombre;
    document.getElementById("detalle-promo-fechas-inicio").textContent = new Date(promocion.fecha_inicio).toLocaleDateString();
    document.getElementById("detalle-promo-fechas-fin").textContent = new Date(promocion.fecha_expiracion).toLocaleDateString();

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
        case "products":
            condiciones = `Descuento del ${promocion.porcentaje}% en productos seleccionados`;
            break;
        case "buy-get":
            condiciones = `Compra ${promocion.buy_quantity} de algun producto, lleva ${promocion.get_quantity} de otro gratis`;
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
        .from("productos_promocion")
        .select(`
            producto_id,
            producto_gratis_id,
            productos:producto_id(nombre),
            productos_gratis:producto_gratis_id(nombre)
        `)
        .eq("promocion_id", promocion.id);

        const lista = productos?.map(p => {
            // Recuperar los nombres de los productos comprados y gratuitos
            const nombreProducto = p.productos?.nombre;
            const nombreProductoGratis = p.productos_gratis?.nombre;
        
            // Concatenar los nombres con la lógica que desees
            return `${nombreProducto || ""} ${nombreProductoGratis ? `(Gratis: ${nombreProductoGratis})` : ""}`;
        }).join(", ") || "-";
        
        // Mostrar la lista en el elemento correspondiente
        document.getElementById("detalle-promo-productos").textContent = lista;

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById("detallePromocionModal"));
    modal.show();

    // Asociar botones
    document.getElementById("btn-editar-promocion").onclick = () => prepararEdicionPromocion(promocion);
    document.getElementById("btn-eliminar-promocion").onclick = () => confirmarEliminarPromocion(promocion);
}

// ✏️ Preparar formulario para edición
function prepararEdicionPromocion(promocion) {
    promoEditandoId = promocion.id;

    // 1. Rellenar campos del formulario
    document.getElementById("promotion-name").value = promocion.nombre;
    document.getElementById("promotion-discount-type").value = promocion.tipo;
    document.getElementById("promotion-inicio").value = promocion.fecha_inicio?.split("T")[0] || "";
    document.getElementById("promotion-fin").value = promocion.fecha_expiracion?.split("T")[0] || "";

    // Vista previa de imagen
    const imgPreview = document.getElementById("promotion-image-preview");
    if (promocion.imagen_url) {
        imgPreview.src = promocion.imagen_url;
        imgPreview.style.display = "block";
    } else {
        imgPreview.style.display = "none";
    }

    // Configuraciones específicas
    updateDiscountOptions();
    if (promocion.tipo === "percentage") {
        document.getElementById("percentage-value").value = promocion.porcentaje;
    } else if (promocion.tipo === "buy-get") {
        document.getElementById("buy-quantity").value = promocion.buy_quantity;
        document.getElementById("get-quantity").value = promocion.get_quantity;
      // Productos asociados
      cargarProductos().then(() => {
        const select = document.getElementById("promotion-products-buy");
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
    // Productos asociados
    cargarProductos().then(() => {
        const select = document.getElementById("promotion-products-free");
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
    } else if (promocion.tipo === "threshold") {
        document.getElementById("threshold-value").value = promocion.threshold;
        document.getElementById("threshold-percentage").value = promocion.porcentaje;
    } else if (promocion.tipo === "products") {
        document.getElementById("products-value").value = promocion.porcentaje;
        // Productos asociados
        cargarProductos().then(() => {
            const select = document.getElementById("promotion-percentage-products");
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
        console.log("aquiiii")
    } else if (promocion.tipo === "bogo") {
        // Productos asociados
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
        console.log("hereree")
    }



    // Cambiar texto del botón
    const boton = document.getElementById("btn-save-promotion");
    boton.innerHTML = `<i class="fas fa-save me-2"></i>Actualizar Promoción`;
    boton.classList.remove("btn-success");
    boton.classList.add("btn-warning");

    // Mostrar modal
    promocionModal.show();
}

// 🗑️ Confirmar eliminación de promoción
function confirmarEliminarPromocion(promocion) {
    document.getElementById("nombre-promo-a-eliminar").textContent = promocion.nombre;
    document.getElementById("confirmar-eliminar-btn").onclick = () => eliminarPromocion(promocion.id);

    const modal = new bootstrap.Modal(document.getElementById("confirmarEliminarModal"));
    modal.show();
}

// 🗑️ Eliminar promoción
async function eliminarPromocion(id) {
    const btn = document.getElementById("confirmar-eliminar-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Eliminando...`;

    try {
        // 1. Primero obtener los datos de la promoción (incluyendo la URL de la imagen)
        const { data: promocion, error: fetchError } = await supabase
            .from("promociones")
            .select("imagen_url")
            .eq("id", id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Eliminar la imagen de Firebase Storage si existe
        if (promocion?.imagen_url) {
            try {
                await eliminarImagenAnterior(promocion.imagen_url);
                console.log("Imagen eliminada de Firebase Storage");
            } catch (storageError) {
                console.warn("No se pudo eliminar la imagen de Firebase:", storageError);
                // Continuar con la eliminación aunque falle la imagen
            }
        }

        // 3. Eliminar relaciones de productos_promocion
        const { error: relationError } = await supabase
            .from("productos_promocion")
            .delete()
            .eq("promocion_id", id);

        if (relationError) throw relationError;

        // 4. Finalmente, eliminar la promoción de la base de datos
        const { error: deleteError } = await supabase
            .from("promociones")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        mostrarToast("🗑️ Promoción y su imagen eliminadas", "success");
        await cargarPromociones();

        // Cerrar modales
        bootstrap.Modal.getInstance(document.getElementById("detallePromocionModal"))?.hide();
        bootstrap.Modal.getInstance(document.getElementById("confirmarEliminarModal"))?.hide();

    } catch (error) {
        console.error("Error completo al eliminar:", error);
        mostrarToast(`❌ Error: ${error.message || "No se pudo completar la eliminación"}`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Sí, eliminar`;
    }
}

// 🔄 Resetear formulario de promoción
function resetFormularioPromocion() {
    const form = document.getElementById("create-promotion-form");
    form.reset();
    document.getElementById("promotion-image-preview").style.display = "none";
    document.getElementById("promotion-image-preview").src = "";

    // Restaurar botón
    const boton = document.getElementById("btn-save-promotion");
    boton.innerHTML = `<i class="fas fa-check-circle me-2"></i>Crear Promoción`;
    boton.classList.remove("btn-warning");
    boton.classList.add("btn-success");

    promoEditandoId = null;
}

// Función para cargar productos en el select
// Función para cargar productos en los selects
export async function cargarProductosPromocion() {
    try {
        const select = document.getElementById("promotion-products");
        const selectProducts = document.getElementById("promotion-percentage-products");
        const selectBuy = document.getElementById("promotion-products-buy");
        const selectFree = document.getElementById("promotion-products-free");

        // Mostrar estado de carga
        select.innerHTML = '<option disabled selected>🔄 Cargando productos...</option>';
        selectProducts.innerHTML = '<option disabled selected>🔄 Cargando productos...</option>';
        selectBuy.innerHTML = '<option disabled selected>🔄 Cargando productos...</option>';
        selectFree.innerHTML = '<option disabled selected>🔄 Cargando productos...</option>';

        // Obtener productos de Supabase
        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre')
            .order('nombre', { ascending: true }); // Orden alfabético

        if (error) throw error;

        // Limpiar selects
        select.innerHTML = '';
        selectProducts.innerHTML = '';
        selectBuy.innerHTML = '';
        selectFree.innerHTML = '';

        // Agregar opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.disabled = true;
        defaultOption.selected = true;
        defaultOption.textContent = 'Seleccione un producto';
        select.appendChild(defaultOption.cloneNode(true));
        selectProducts.appendChild(defaultOption.cloneNode(true));
        selectBuy.appendChild(defaultOption.cloneNode(true));
        selectFree.appendChild(defaultOption.cloneNode(true));

        // Si no hay productos
        if (data.length === 0) {
            const noProductsOption = document.createElement('option');
            noProductsOption.disabled = true;
            noProductsOption.textContent = 'No hay productos disponibles';
            select.appendChild(noProductsOption.cloneNode(true));
            selectProducts.appendChild(noProductsOption.cloneNode(true));
            selectBuy.appendChild(noProductsOption.cloneNode(true));
            selectFree.appendChild(noProductsOption.cloneNode(true));
            return;
        }

        // Llenar ambos selects con los productos
        data.forEach(producto => {
            // Crear opción para el primer select
            const option1 = document.createElement('option');
            option1.value = producto.id;
            option1.textContent = producto.nombre;
            select.appendChild(option1);

            // Crear opción para el segundo select (debe ser una nueva instancia)
            const option2 = document.createElement('option');
            option2.value = producto.id;
            option2.textContent = producto.nombre;
            selectProducts.appendChild(option2);

            // Crear opción para el segundo select (debe ser una nueva instancia)
            const option3 = document.createElement('option');
            option3.value = producto.id;
            option3.textContent = producto.nombre;
            selectBuy.appendChild(option3);

            // Crear opción para el segundo select (debe ser una nueva instancia)
            const option4 = document.createElement('option');
            option4.value = producto.id;
            option4.textContent = producto.nombre;
            selectFree.appendChild(option4);
        });

    } catch (err) {
        console.error("❌ Error al cargar productos:", err);
        mostrarToast("Error al cargar productos", "error");

        // Restablecer selects en caso de error
        const select = document.getElementById("promotion-products");
        const selectProducts = document.getElementById("promotion-percentage-products");
        select.innerHTML = '<option disabled selected>❌ Error al cargar</option>';
        selectProducts.innerHTML = '<option disabled selected>❌ Error al cargar</option>';
    }
}

// 🎨 Helper para obtener icono según tipo
function obtenerIconoTipo(tipo) {
    const iconos = {
        percentage: "📊",
        products: "🎉📊",
        "buy-get": "🛒",
        bogo: "🎉",
        threshold: "💰"
    };
    return iconos[tipo] || "🎯";
}

function obtenerTextoTipo(tipo) {
    const textos = {
        percentage: "Porcentaje de descuento",
        products: "Descuento en productos",
        "buy-get": "Compra y lleva gratis",
        bogo: "2x1",
        threshold: "Descuento por monto mínimo"
    };
    return textos[tipo] || "Promoción";
}

// 🧩 Helper para traducir tipo
function traducirTipoPromocion(tipo) {
    return {
        "percentage": "Porcentaje de descuento",
        "products": "Descuento en productos",
        "buy-get": "Compra y lleva gratis",
        "bogo": "2x1",
        "threshold": "Descuento por monto mínimo"
    }[tipo] || "Tipo desconocido";
}

function claseBadge(tipo) {
    return {
        "percentage": "bg-success text-white",
        "products": "bg-product text-white",
        "buy-get": "bg-purple text-white",
        "bogo": "bg-primary text-white",
        "threshold": "bg-warning text-dark"
    }[tipo] || "bg-secondary text-white";
}
function generarNombreUnicoImagen(nombreOriginal) {
    // Extraer extensión
    const extension = nombreOriginal.split('.').pop().toLowerCase();

    // Generar identificadores únicos
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);

    // Caracteres permitidos (opcional)
    const nombreLimpio = nombreOriginal
        .replace(/\.[^/.]+$/, "") // Quitar extensión
        .normalize("NFD") // Normalizar caracteres acentuados
        .replace(/[\u0300-\u036f]/g, "") // Eliminar diacríticos
        .replace(/[^\w]/g, "_") // Reemplazar caracteres especiales
        .substring(0, 50); // Limitar longitud

    return `promo_${nombreLimpio}_${timestamp}_${randomString}.${extension}`;
}