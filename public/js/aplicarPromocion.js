import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

// Función principal modificada para manejar descuentos por total del pedido
// Función principal para aplicar promociones
export async function aplicarPromociones(productoId, productosSeleccionados) {
    const producto = productosSeleccionados.find(p => p.id === productoId);
    if (!producto) return;

    // Calcular el total actual del pedido (sin descuentos)
    const totalPedido = calcularTotalPedido(productosSeleccionados);

    // Obtener promociones válidas para este producto
    const promociones = await verificarPromocion(productoId, producto.cantidad, totalPedido);

    // Resetear descuentos antes de aplicar nuevas promociones
    producto.descuento = 0;
    producto.promocionAplicada = null;

    if (promociones && promociones.length > 0) {
        promociones.forEach(promocion => {
            switch (promocion.promocion.tipo) {
                case 'percentage':
                    producto.descuento = (producto.precio * producto.cantidad * promocion.promocion.porcentaje) / 100;
                    producto.promocionAplicada = promocion.promocion;
                    break;

                case 'bogo':
                    if (producto.cantidad >= (promocion.promocion.buy_quantity || 2)) {
                        const grupos = Math.floor(producto.cantidad / (promocion.promocion.buy_quantity || 2));
                        producto.descuento = grupos * producto.precio * (promocion.promocion.get_quantity || 1);
                        producto.promocionAplicada = promocion.promocion;
                    }
                    break;

                case 'threshold':
                    // Marcamos la promoción pero el descuento se aplicará a nivel de pedido
                    producto.promocionAplicada = promocion.promocion;
                    break;

                default:
                    console.warn(`Tipo de promoción no reconocido: ${promocion.promocion.tipo}`);
            }
        });
    }

    producto.total = (producto.precio * producto.cantidad) - producto.descuento;
}

// Función para aplicar descuentos a nivel de pedido (threshold por total)
export function aplicarDescuentosPedido(productosSeleccionados) {
    // Calcular SUBTOTAL (sin descuentos)
    const subtotal = calcularSubtotalPedido(productosSeleccionados);
    let descuentoThreshold = 0;
    let promocionThreshold = null;

    // Buscar promociones de threshold en todos los productos
    productosSeleccionados.forEach(producto => {
        if (producto.promocionAplicada && producto.promocionAplicada.tipo === 'threshold') {
            const promocion = producto.promocionAplicada;
            console.log(subtotal)
            if (subtotal >= promocion.threshold) {
                descuentoThreshold = (subtotal * promocion.porcentaje) / 100;
                promocionThreshold = promocion;
                
            }
        }
    });

    // Calcular descuentos por productos
    const descuentosProductos = productosSeleccionados.reduce((total, producto) => {
        return total + (producto.descuento || 0);
    }, 0);

    return {
        subtotal,
        descuentoThreshold,
        descuentosProductos,
        promocionThreshold,
        totalConDescuento: subtotal - descuentosProductos - descuentoThreshold
    };
}

// Nueva función para calcular subtotal (sin descuentos)
export function calcularSubtotalPedido(productosSeleccionados) {
    return productosSeleccionados.reduce((total, producto) => {
        return total + (producto.precio * producto.cantidad);
    }, 0);
}
// Función para calcular el total del pedido (con descuentos aplicados)
export function calcularTotalPedido(productosSeleccionados) {
    return productosSeleccionados.reduce((total, producto) => {
        // Se debe usar el precio después de aplicar el descuento
        const precioConDescuento = (producto.precio * producto.cantidad) - producto.descuento;
        return total + precioConDescuento;
    }, 0);
}


// Función verificarPromocion modificada
async function verificarPromocion(productoId, cantidad, subtotal) {
    const { data: promocionesGenerales, error: errorGenerales } = await supabase
        .from('promociones')
        .select('*')
        .eq('es_general', true)
        .lte('fecha_inicio', new Date().toISOString())
        .gte('fecha_expiracion', new Date().toISOString())
        .eq('activa', true);

    const { data: promocionesEspecificas, error: errorEspecificas } = await supabase
        .from('productos_promocion')
        .select('promociones(*)')
        .eq('producto_id', productoId)
        .lte('promociones.fecha_inicio', new Date().toISOString())
        .gte('promociones.fecha_expiracion', new Date().toISOString())
        .eq('promociones.activa', true);

    if (errorGenerales || errorEspecificas) {
        console.error("Error al obtener promociones:", errorGenerales || errorEspecificas);
        return null;
    }

    const todasPromociones = [
        ...(promocionesGenerales || []),
        ...(promocionesEspecificas?.map(p => p.promociones) || [])
    ];

    if (todasPromociones.length === 0) return null;

    const promocionesValidas = todasPromociones.filter(promocion => {
        if (!promocion) return false;

        switch (promocion.tipo) {
            case 'percentage':
                return true;
            case 'bogo':
                return cantidad >= (promocion.buy_quantity || 2);
            case 'threshold':
                return subtotal >= promocion.threshold;
            default:
                return false;
        }
    });

    return promocionesValidas.map(promocion => ({
        promocion,
        cantidadAplicada: promocion.tipo === 'bogo'
            ? Math.floor(cantidad / (promocion.buy_quantity || 2))
            : 1
    }));
}
/*
function mostrarNotificacionPromocion(promocion) {
    if (!promocion || !promocion.tipo) return;

    let mensaje = '';
    const icono = '🎉';

    switch (promocion.tipo) {
        case 'percentage':
            mensaje = `${icono} ¡Descuento del ${promocion.porcentaje}% aplicado!`;
            break;

        case 'bogo':
            if (promocion.buy_quantity && promocion.get_quantity) {
                mensaje = `${icono} ¡Promoción ${promocion.buy_quantity}x${promocion.get_quantity} aplicada!`;
            } else {
                mensaje = `${icono} ¡Promoción 2x1 aplicada!`;
            }
            break;

        case 'threshold':
            mensaje = `${icono} ¡Descuento por volumen (${promocion.threshold}+ unidades): ${promocion.porcentaje}%!`;
            break;

        case 'free_product':
            mensaje = `${icono} ¡Producto gratis aplicado! (${promocion.nombre})`;
            break;

        case 'fixed_amount':
            mensaje = `${icono} ¡Descuento fijo de $${promocion.monto} aplicado!`;
            break;

        default:
            mensaje = `${icono} ¡Promoción "${promocion.nombre}" aplicada!`;
    }

    mostrarToast(mensaje, 'success');
}*/