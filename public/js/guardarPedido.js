// guardarPedido.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { getCDMXISOString, getLocalDateString } from "./dateLocalDate.js"

export async function guardarPedido(productosSeleccionados, userId, origen = "empacador", estadoPersonalizado = null) {
  const total = productosSeleccionados.reduce((acc, p) => acc + p.total, 0);
  const fechaActual = getCDMXISOString();

  // Determinar el estado automáticamente si no se especifica
  const estado = estadoPersonalizado || (origen === "empacador" ? "empacado" : "pendiente");

  const { codigo_ticket, folio_secuencial } = await generarCodigoTicket(origen, userId);

  try {
    const pedidoData = {
      fecha: fechaActual,
      total: total.toFixed(2),
      estado, // Usamos el estado determinado
      notas: "",
      codigo_ticket,
      origen,
      folio_secuencial,
      [origen === "empacador" ? "empleado_id" : "cliente_id"]: userId
    };

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert(pedidoData)
      .select()
      .single();

    if (error) throw error;

    const productosDB = productosSeleccionados.map(prod => ({
      pedido_id: pedido.id,
      producto_id: prod.id,
      cantidad: prod.cantidad,
      precio_unitario: prod.precio,
    }));

    const { error: errorProductos } = await supabase
      .from("pedido_productos")
      .insert(productosDB);

    if (errorProductos) throw errorProductos;

    return pedido;

  } catch (err) {
    console.error("❌ Error al guardar el pedido:", err);
    mostrarToast("❌ Error al guardar el pedido", "error");
    return null;
  }
}

/**
 * 🧾 Genera un código de ticket con información útil y legible.
 * Formato: EMPAC-YYYYMMDD-XXX (ej. EMPAC-20250412-007)
 * 
 * Devuelve: {
 *   codigo_ticket: "EMPAC-20250412-007",
 *   folio_secuencial: 7
 * }
 */
export async function generarCodigoTicket(origen = "empacador", userId) {
  const hoy = getLocalDateString();
  
  // Configuración de filtros
  const filters = {
    gte: `${hoy}T00:00:00`,
    lte: `${hoy}T23:59:59`,
    origen: origen
  };

  // Agregar filtro específico según el origen
  if (origen === "empacador") {
    filters.empleado_id = userId;
  } else if (origen === "cliente") {
    filters.cliente_id = userId;
  }

  // Construir la consulta
  let query = supabase
    .from("pedidos")
    .select("*", { count: "exact", head: true })
    .gte("fecha", filters.gte)
    .lte("fecha", filters.lte)
    .eq("origen", filters.origen);

  // Aplicar filtro adicional según el origen
  if (origen === "empacador") {
    query = query.eq("empleado_id", filters.empleado_id);
  } else if (origen === "cliente") {
    query = query.eq("cliente_id", filters.cliente_id);
  }

  // Ejecutar consulta
  const { count, error } = await query;

  if (error) {
    console.error("Error al contar pedidos:", error);
    throw new Error("No se pudo generar el código del ticket");
  }

  const folio_secuencial = (count ?? 0) + 1;
  const numeroTicket = folio_secuencial.toString().padStart(3, "0");

  return {
    codigo_ticket: `${origen.toUpperCase().slice(0, 5)}-${hoy.replaceAll("-", "")}-${numeroTicket}`,
    folio_secuencial
  };
}