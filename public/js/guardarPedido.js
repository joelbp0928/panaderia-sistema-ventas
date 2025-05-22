// guardarPedido.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { getCDMXISOString, getLocalDateString } from "./dateLocalDate.js"

export async function guardarPedido(productosSeleccionados, userId, origen = "empacador") {
  const total = productosSeleccionados.reduce((acc, p) => acc + p.total, 0);
  const fechaActual = getCDMXISOString();

  // Determinar el estado automáticamente si no se especifica
  const estado = (origen === "empacador" ? "empacado" : "pendiente");

  const { codigo_ticket, folio_secuencial } = await generarCodigoTicket(origen, userId);
  console.log("Código de ticket generado:", codigo_ticket, folio_secuencial);
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

    // Insertar los productos en la tabla de pedido_productos
    const productosDB = productosSeleccionados.map(prod => ({
      pedido_id: pedido.id,
      producto_id: prod.id,
      cantidad: prod.cantidad,
      precio_unitario: prod.precio,
      descuento: prod.descuento || 0, // El descuento que aplica la promoción
      promocion_id: prod.promocionAplicada ? prod.promocionAplicada.id : null,
      total: prod.total
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

function mezclarUserFechaFolio(userId, fechaNum, folio) {
  // userId, año, mes, día, folio: todos en base36, para que siempre haya letras y números
  // fechaNum ejemplo: "20250522"
  const userBase = (parseInt(userId, 10) || 0).toString(36).toUpperCase().padStart(2, "0");
  const yearBase = (parseInt(fechaNum.slice(0, 4), 10) || 0).toString(36).toUpperCase().padStart(2, "0");
  const monthBase = (parseInt(fechaNum.slice(4, 6), 10) || 0).toString(36).toUpperCase().padStart(2, "0");
  const dayBase = (parseInt(fechaNum.slice(6, 8), 10) || 0).toString(36).toUpperCase().padStart(2, "0");
  const folioBase = (parseInt(folio, 10) || 0).toString(36).toUpperCase().padStart(2, "0");

  // Concatenado: userBase + yearBase + monthBase + dayBase + folioBase
  return `${userBase}${yearBase}${monthBase}${dayBase}${folioBase}`;
}

/**
 * 🧾 Genera un código de ticket único y corto mezclando user, fecha y folio.
 * Formato: EMPAC-2A2Y1565-001
 */
export async function generarCodigoTicket(origen = "empacador", userId) {
  const hoy = getLocalDateString(); // "2025-05-22"
  const fechaNum = hoy.replaceAll("-", ""); // "20250522"

  // ... tu código de filtros y folio_secuencial igual ...
  // Ejemplo de cómo lo haces (ajusta según tu lógica):
  const filters = {
    gte: `${hoy}T00:00:00`,
    lte: `${hoy}T23:59:59`,
    origen: origen
  };
  if (origen === "empacador") {
    filters.empleado_id = userId;
  } else if (origen === "cliente") {
    filters.cliente_id = userId;
  }
  let query = supabase
    .from("pedidos")
    .select("*", { count: "exact", head: true })
    .gte("fecha", filters.gte)
    .lte("fecha", filters.lte)
    .eq("origen", filters.origen);
  if (origen === "empacador") {
    query = query.eq("empleado_id", filters.empleado_id);
  } else if (origen === "cliente") {
    query = query.eq("cliente_id", filters.cliente_id);
  }
  const { count, error } = await query;
  if (error) {
    console.error("Error al contar pedidos:", error);
    throw new Error("No se pudo generar el código del ticket");
  }
  console.log("Cantidad de pedidos:", count);
  const folio_secuencial = (count ?? 0) + 1;
  console.log("Folio secuencial:", folio_secuencial);
  const numeroTicket = folio_secuencial.toString().padStart(3, "0");

  // Mezclar user, fecha, folio
  const parteMezclada = mezclarUserFechaFolio(userId, fechaNum, folio_secuencial);

  return {
    codigo_ticket: `${origen.toUpperCase().slice(0, 5)}-${parteMezclada}-${numeroTicket}`,
    folio_secuencial
  };
}

