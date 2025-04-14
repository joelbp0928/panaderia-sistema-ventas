// Función para obtener la fecha local en formato YYYY-MM-DD
export function getLocalDateString() {
    const now = new Date();
    const options = {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
  
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
    const dateObj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${dateObj.year}-${dateObj.month}-${dateObj.day}`; // → "2025-04-13"
}
export function getCDMXISOString() {
    const now = new Date();
    const options = {
      timeZone: 'America/Mexico_City',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
  
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(now);
    const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
  }
  