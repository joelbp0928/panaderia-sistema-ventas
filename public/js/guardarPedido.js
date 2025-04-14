// guardarPedido.js
import { supabase } from "./supabase-config.js";
import { mostrarToast } from "./manageError.js";
import { getCDMXISOString, getLocalDateString } from "./dateLocalDate.js"

export async function guardarPedido(productosSeleccionados, userId, origen = "empacador") {
  const total = productosSeleccionados.reduce((acc, p) => acc + p.total, 0);
  const fechaActual = getCDMXISOString();

  const { codigo_ticket, folio_secuencial } = await generarCodigoTicket();

  try {
    // 1️⃣ Insertar en pedidos
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        fecha: fechaActual,
        total: total.toFixed(2),
        estado: "pendiente",
        notas: "",
        empleado_id: userId,
        //  cliente_id: "00000000-0000-0000-0000-000000000001", // 👤 por ahora usamos cliente default
        codigo_ticket,
        origen: origen,
        folio_secuencial
      })
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ Insertar productos del pedido
    const productosDB = productosSeleccionados.map((prod) => ({
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
export async function generarCodigoTicket(origen = "empacador") {
  // 1️⃣ Obtener fecha actual en formato YYYY-MM-DD
  const hoy = getLocalDateString();

  // 2️⃣ Contar cuántos pedidos hay hoy para ese origen
  const { count, error } = await supabase
    .from("pedidos")
    .select("*", { count: "exact", head: true })
    .eq("origen", origen)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  if (error) {
    console.error("❌ Error al contar pedidos del día:", error.message);
    throw new Error("No se pudo generar el código del ticket.");
  }

  const folio_secuencial = (count ?? 0) + 1;
  const numeroTicket = folio_secuencial.toString().padStart(3, "0");

  const codigo_ticket = `${origen.toUpperCase().slice(0, 5)}-${hoy.replaceAll("-", "")}-${numeroTicket}`;

  return {
    codigo_ticket,
    folio_secuencial
  };
}