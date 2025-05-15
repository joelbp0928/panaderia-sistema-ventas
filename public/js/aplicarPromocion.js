import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";

// Función principal modificada para manejar descuentos por total del pedido
// Función principal para aplicar promociones
export async function aplicarPromociones(productoId, productosSeleccionados) {
    // Primero resetear todos los descuentos y promociones
    productosSeleccionados.forEach(p => {
        p.descuento = 0;
        p.promocionAplicada = null;
    });

    const subtotal = calcularSubtotalPedido(productosSeleccionados);

    // Verificar promociones para todos los productos
    for (const producto of productosSeleccionados) {
        const promociones = await verificarPromocion(producto.id, producto.cantidad, subtotal, productosSeleccionados);

        if (promociones && promociones.length > 0) {
            for (const promocionData of promociones) {
                const promocion = promocionData.promocion;
                switch (promocion.tipo) {
                    case 'percentage':
                        // Solo aplicamos el descuento percentage si es general (no por producto)
                        if (promocion.promocion.es_general) {
                            // Marcamos la promoción pero el descuento se aplicará a nivel de pedido
                            producto.descuento = (producto.precio * producto.cantidad * promocion.promocion.porcentaje) / 100;
                            producto.promocionAplicada = promocion.promocion;
                        }
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

                    case 'products':
                        // Descuento específico por producto
                        producto.descuento = (producto.precio * producto.cantidad * promocion.promocion.porcentaje) / 100;
                        producto.promocionAplicada = promocion.promocion;
                        break;

                    // Modificación en la función aplicarPromociones
                    case 'buy-get':
                        const buyQuantity = promocion.buy_quantity || 1;
                        const getQuantity = promocion.get_quantity || 1;

                        // Calcular grupos completos de compra
                        const grupos = Math.floor(producto.cantidad / buyQuantity);

                        // Buscar el producto gratis
                        const productoGratis = promocion.producto_gratis_id
                            ? productosSeleccionados.find(p => p.id === promocion.producto_gratis_id)
                            : null;

                        if (productoGratis) {
                            // Calcular máximo de productos gratis posibles
                            const maxGratis = grupos * getQuantity;
                            console.log(getQuantity, buyQuantity)
                            const cantidadGratis = Math.min(maxGratis, productoGratis.cantidad);

                            if (cantidadGratis > 0) {
                                // Aplicar descuento al producto gratis
                                productoGratis.descuento = cantidadGratis * productoGratis.precio;
                                productoGratis.promocionAplicada = promocion;

                                // Marcar el producto de compra
                                producto.promocionAplicada = promocion;
                            }
                        }
                        break;
                    default:
                        console.warn(`Tipo de promoción no reconocido: ${promocion.promocion.tipo}`);
                }
            }
        }

        producto.total = (producto.precio * producto.cantidad) - producto.descuento;
    }

}
// Función para aplicar descuentos a nivel de pedido
export function aplicarDescuentosPedido(productosSeleccionados) {
    // Calcular SUBTOTAL (sin descuentos)
    const subtotal = calcularSubtotalPedido(productosSeleccionados);
    let descuentoThreshold = 0;
    let descuentoPercentage = 0;
    let descuentosProductos = 0;
    let descuentosBogo = 0;
    let descuentosBuyGet = 0;
    let promocionThreshold = null;
    let promocionPercentage = null;

    // Buscar promociones en todos los productos
    productosSeleccionados.forEach(producto => {
        if (producto.promocionAplicada) {
            switch (producto.promocionAplicada.tipo) {
                case 'threshold':
                    if (subtotal >= producto.promocionAplicada.threshold) {
                        descuentoThreshold = (subtotal * producto.promocionAplicada.porcentaje) / 100;
                        promocionThreshold = producto.promocionAplicada;
                    }
                    break;

                case 'percentage':
                    if (producto.promocionAplicada.es_general) {
                        descuentoPercentage = (subtotal * producto.promocionAplicada.porcentaje) / 100;
                        promocionPercentage = producto.promocionAplicada;
                    }
                    break;

                case 'products':
                    // Descuento específico por producto
                    descuentosProductos += (producto.precio * producto.cantidad * producto.promocionAplicada.porcentaje) / 100;
                    break;

                case 'bogo':
                    // Calcular descuentos por productos 2x1
                    descuentosBogo += (producto.descuento || 0);
                    break;

                case 'buy-get':
                    // Solo sumamos el descuento si este producto es el que se está regalando
                    if (producto.promocionAplicada.producto_gratis_id === producto.id) {
                        descuentosBuyGet += producto.descuento || 0;
                    }
                    break;
            }
        }
    });

    // Calcular el total de descuentos por productos
    /*  const descuentosTotales = productosSeleccionados.reduce((total, producto) => {
          return total + (producto.descuento || 0);
      }, 0);
  */
    return {
        subtotal,
        descuentoThreshold,
        descuentoPercentage,
        descuentosProductos,
        descuentosBogo,
        descuentosBuyGet,
        promocionThreshold,
        promocionPercentage,
        totalConDescuento: subtotal -/* descuentosTotales -*/ descuentoThreshold - descuentoPercentage - descuentosProductos - descuentosBogo - descuentosBuyGet
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
async function verificarPromocion(productoId, cantidad, subtotal, productosSeleccionados) {
    // Obtener promociones generales
    const { data: promocionesGenerales, error: errorGenerales } = await supabase
        .from('promociones')
        .select('*')
        .eq('es_general', true)
        .lte('fecha_inicio', new Date().toISOString())
        .gte('fecha_expiracion', new Date().toISOString())
        .eq('activa', true);

    // Obtener promociones específicas para este producto con el producto_gratis_id
    const { data: promocionesEspecificas, error: errorEspecificas } = await supabase
        .from('productos_promocion')
        .select(`
            promociones(*),
            producto_gratis_id
        `)
        .eq('producto_id', productoId)
        .lte('promociones.fecha_inicio', new Date().toISOString())
        .gte('promociones.fecha_expiracion', new Date().toISOString())
        .eq('promociones.activa', true);

    if (errorGenerales || errorEspecificas) {
        console.error("Error al obtener promociones:", errorGenerales || errorEspecificas);
        return null;
    }

    // Preparar las promociones combinadas
    const todasPromociones = [];

    // Agregar promociones generales
    if (promocionesGenerales) {
        promocionesGenerales.forEach(p => {
            todasPromociones.push({
                ...p,
                producto_gratis_id: null // Las generales no tienen producto gratis específico
            });
        });
    }

    // Agregar promociones específicas con su producto_gratis_id
    if (promocionesEspecificas) {
        promocionesEspecificas.forEach(p => {
            todasPromociones.push({
                ...p.promociones,
                producto_gratis_id: p.producto_gratis_id
            });
        });
    }

    if (todasPromociones.length === 0) return null;

    // Filtrar promociones válidas
    const promocionesValidas = todasPromociones.filter(promocion => {
        if (!promocion) return false;

        switch (promocion.tipo) {
            case 'percentage':
                return true;
            case 'bogo':
                return cantidad >= (promocion.buy_quantity || 2);
            case 'threshold':
                return subtotal >= promocion.threshold;
            case 'products':
                return true;
            case 'buy-get':
                // Verificar si hay suficiente cantidad del producto comprado
                const cumpleCantidad = cantidad > (promocion.buy_quantity - 1 || 1);

                // Verificar si el producto gratis está en el carrito (si aplica)
                let tieneProductoGratis = true;
                if (promocion.producto_gratis_id) {
                    tieneProductoGratis = productosSeleccionados.some(
                        p => p.id === promocion.producto_gratis_id
                    );
                }

                return cumpleCantidad && tieneProductoGratis;
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