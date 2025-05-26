/**
 * Formatea fecha de YYYY-MM-DD a DD/MM/YYYY
 * @param {string} fechaStr - Cadena en formato YYYY-MM-DD
 * @returns {string} Fecha en formato DD/MM/YYYY o "N/A" si es inválida
 */
export function formatearFecha(fechaStr) {
    // Verificar formato exacto YYYY-MM-DD con regex
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        return "N/A";
    }
    
    // Extraer componentes directamente (más eficiente que crear Date)
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return "N/A";
    
    const [anio, mes, dia] = partes;
    
    // Validar componentes numéricos
    if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return "N/A";
    
    // Formatear a DD/MM/YYYY
    return `${dia}/${mes}/${anio}`;
}

// 📌 **Función auxiliar para formatear fechas**
export function formatearFechaDb(fechaInput) {
  if (!fechaInput) return "N/A";
  
  try {
    const fecha = new Date(fechaInput);
    if (isNaN(fecha.getTime())) return "Fecha inválida";
    
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '/');
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return "N/A";
  }
}