import { supabase } from "./supabase-config.js";
import { mostrarToast, showLoading, hideLoading } from "./manageError.js";
import { cargarProductos } from "./productos.js";

// 🏷️ Variables de estado
let promocionesActivas = [];
let sugerenciasPromociones = [];

// 🌐 Exponer funciones globales
window.updateDiscountOptions = updateDiscountOptions;
window.aceptarSugerencia = aceptarSugerencia;
window.crearPromocion = crearPromocion;

// 🚀 Inicialización
document.addEventListener("DOMContentLoaded", function () {
    // cargarPromociones();
    cargarSugerencias();
    // Formulario de creación
    document.getElementById("create-promotion-form").addEventListener("submit", function (e) {
        e.preventDefault();
        crearPromocion();
    });
});

// Vista previa de la imagen seleccionada
document.getElementById('promotion-image').addEventListener('change', function(e) {
    const preview = document.getElementById('promotion-image-preview');
    const file = e.target.files[0];
    
    if (file) {
      const reader = new FileReader();
      
      reader.onload = function(e) {
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
    container.innerHTML = promocionesActivas.map(promo => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${obtenerIconoTipo(promo.tipo)} ${promo.nombre}
            <span class="badge bg-${promo.fecha_expiracion < new Date().toISOString() ? 'danger' : 'secondary'}">
                Vence: ${new Date(promo.fecha_expiracion).toLocaleDateString()}
            </span>
        </li>
    `).join('');
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
     const storageRef = firebase.storage().ref();
     const fileRef = storageRef.child(`promociones/${Date.now()}_${file.name}`);
     
     // Subir el archivo
     const snapshot = await fileRef.put(file);
     imagenUrl = await snapshot.ref.getDownloadURL();
 }
        // Construir objeto de promoción
        const promocion = {
            nombre: document.getElementById("promotion-name").value.trim(),
            tipo: tipo,
            fecha_expiracion: document.getElementById("promotion-expiry").value || null,
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
                .from('productos_promocion')
                .insert(productosSeleccionados.map(producto_id => ({
                    promocion_id: data[0].id,
                    producto_id: producto_id
                })));
        }

        mostrarToast("✅ Promoción creada exitosamente", "success");
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