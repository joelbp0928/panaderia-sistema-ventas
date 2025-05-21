import { supabase } from "./supabase-config.js";

export async function eliminarPedidosAntiguosYRestaurarStock() {
    const hace48Horas = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    console.log("Eliminando pedidos antiguos y restaurando stock...");
    console.log(hace48Horas);
    // 1. Obtener todos los pedidos "pendientes" o "preparacion" con fecha anterior a 48h
    const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id, codigo_ticket, pedido_productos(producto_id, cantidad), empleado_id")
        .or('estado.eq.pendiente,estado.eq.preparacion')
        .lt("fecha", hace48Horas);

    if (error || !pedidos?.length) return;

    for (const pedido of pedidos) {
        // Por cada producto del pedido, registrar entrada
        for (const item of pedido.pedido_productos) {
            if (!item.producto_id) {
                console.warn(`⚠️ Producto sin ID en el pedido ${pedido.codigo_ticket}`);
                continue; // Saltar este item
            }
            const { data: inventario } = await supabase
                .from("inventario_productos")
                .select("id, stock_actual")
                .eq("producto_id", item.producto_id)
                .maybeSingle();

            let nuevoStock = item.cantidad;
            let inventarioProductoId;

            if (inventario) {
                inventarioProductoId = inventario.id;
                nuevoStock += inventario.stock_actual;
                await supabase
                    .from("inventario_productos")
                    .update({ stock_actual: nuevoStock, updated_at: new Date() })
                    .eq("id", inventario.id);
            } else {
                const { data: nuevoInv } = await supabase
                    .from("inventario_productos")
                    .insert({ producto_id: item.producto_id, stock_actual: nuevoStock })
                    .select()
                    .single();
                inventarioProductoId = nuevoInv.id;
            }

            await supabase.from("movimientos_productos").insert({
                inventario_producto_id: inventarioProductoId,
                tipo_movimiento: "entrada",
                cantidad: item.cantidad,
                stock_resultante: nuevoStock,
                descripcion: `Recuperado del pedido no pagado ${pedido.codigo_ticket}`,
            });
        }

        // Marcar pedido como eliminado
        await supabase
            .from("pedidos")
            .update({ estado: "cancelado", notas: "Cancelado por inactividad de 48h", cancelado_por_sistema: true })
            .eq("id", pedido.id);
    }

    if (pedidos.length > 0) {
        console.log(`✅ Se cancelaron y recuperaron ${pedidos.length} pedido(s) antiguos.`);
    }
}
