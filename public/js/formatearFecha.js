// 📌 **Función auxiliar para formatear fechas**
export function formatearFecha(fechaISO) {
    if (!fechaISO) return "N/A";
    const fecha = new Date(fechaISO);
    return `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`;
}