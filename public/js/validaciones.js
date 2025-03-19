/**
 * 📌 **Valida un número de teléfono**
 * @param {string} telefono - Número de teléfono ingresado por el usuario
 * @returns {boolean} `true` si es válido, `false` si es incorrecto
 */
export function validarTelefono(telefono) {
    const regex = /^[0-9]{10}$/; // 📌 Expresión regular: solo 10 dígitos numéricos
    return regex.test(telefono);
}

export function validarEdad(fechaNacimiento) {
    const fechaIngresada = new Date(fechaNacimiento);
    const hoy = new Date();

    // 📌 Calculamos la diferencia de años
    let edad = hoy.getFullYear() - fechaIngresada.getFullYear();

    // 🔹 Ajustamos si la persona aún no ha cumplido años este año
    const mesActual = hoy.getMonth();
    const diaActual = hoy.getDate();
    const mesNacimiento = fechaIngresada.getMonth();
    const diaNacimiento = fechaIngresada.getDate();

    if (mesNacimiento > mesActual || (mesNacimiento === mesActual && diaNacimiento > diaActual)) {
        edad--; // Aún no ha cumplido años este año
    }

    return edad >= 16; // ✅ Retorna `true` si la persona tiene al menos 16 años
}