import { supabase } from "./supabase-config.js";

export async function eliminarPedidosAntiguosYRestaurarStock() {
    const hace48Horas = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    console.log("Eliminando pedidos antiguos y restaurando stock...");
    console.log(hace48Horas);

    // Obtener pedidos en estado pendiente, preparación o empacado (para evaluar)
    const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id, codigo_ticket, estado, pedido_productos(producto_id, cantidad), empleado_id")
        .or('estado.eq.pendiente,estado.eq.preparacion,estado.eq.empacado')
        .lt("fecha", hace48Horas);

    if (error || !pedidos?.length) return;

    for (const pedido of pedidos) {
        if (pedido.estado === "empacado") {
            // Solo restaurar stock para pedidos empacados
            for (const item of pedido.pedido_productos) {
                if (!item.producto_id) {
                    console.warn(`⚠️ Producto sin ID en el pedido ${pedido.codigo_ticket}`);
                    continue;
                }
                const { data: inventario, error: invError } = await supabase
                    .from("inventario_productos")
                    .select("id, stock_actual")
                    .eq("producto_id", item.producto_id)
                    .maybeSingle();

                if (invError) {
                    console.error('Error al obtener inventario:', invError);
                    continue;
                }

                let nuevoStock = item.cantidad;
                let inventarioProductoId;

                if (inventario) {
                    inventarioProductoId = inventario.id;
                    nuevoStock += inventario.stock_actual;
                    const { error: updError } = await supabase
                        .from("inventario_productos")
                        .update({ stock_actual: nuevoStock, updated_at: new Date() })
                        .eq("id", inventario.id);
                    if (updError) {
                        console.error('Error actualizando inventario:', updError);
                        continue;
                    }
                } else {
                    const { data: nuevoInv, error: errorNuevoInv } = await supabase
                        .from("inventario_productos")
                        .insert({ producto_id: item.producto_id, stock_actual: nuevoStock })
                        .select()
                        .single();

                    if (errorNuevoInv) {
                        console.error('Error insertando nuevo inventario:', errorNuevoInv);
                        continue;
                    }
                    inventarioProductoId = nuevoInv.id;
                    console.log('Nuevo inventario insertado:', nuevoInv);
                }

                const { data: producto } = await supabase
                    .from("productos")
                    .select("precio_unitario")
                    .eq("id", item.producto_id)
                    .single();

                await supabase.from("movimientos_productos").insert({
                    inventario_producto_id: inventarioProductoId,
                    tipo_movimiento: "entrada",
                    cantidad: item.cantidad,
                    stock_resultante: nuevoStock,
                    descripcion: `Recuperado del pedido no pagado ${pedido.codigo_ticket}`,
                    costo_unitario: producto?.precio_unitario ?? null,
                });
            }
        }

        // Marcar pedido como cancelado en cualquier caso
        await supabase
            .from("pedidos")
            .update({ estado: "cancelado", notas: "Cancelado por inactividad de 48h", cancelado_por_sistema: true })
            .eq("id", pedido.id);
    }

    if (pedidos.length > 0) {
        console.log(`✅ Se cancelaron y procesaron ${pedidos.length} pedido(s) antiguos.`);
    }
}
