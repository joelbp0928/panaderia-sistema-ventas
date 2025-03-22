import { storage, ref, uploadBytes, getDownloadURL } from "../firebase-config.js";
import { mostrarToast } from "../manageError.js";
import { supabase } from "../supabase-config.js";


// 📌 Referencia al formulario
const formConfig = document.querySelector("#settings form");

formConfig.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nombreEmpresa = document.querySelector("#site-name").value.trim();
    const colorPrimario = document.querySelector("#primary-color").value;
    const logoFile = document.querySelector("#site-logo").files[0];  // Obtenemos el archivo de logo

    let logoUrl = null;  // Inicializamos logoUrl como null

    try {
        // 🔹 Verificar si hay un archivo para subir
        if (logoFile) {
            const storageRef = ref(storage, `config/logo`);  // Usamos un nombre fijo para el logo (no dependemos del nombre del archivo)

            // 🔹 Intentar subir el archivo
            try {
                const uploadTask = await uploadBytes(storageRef, logoFile);
                logoUrl = await getDownloadURL(storageRef);
                console.log("✅ Archivo subido correctamente:", logoUrl);
            } catch (uploadError) {
                console.error("❌ Error al subir archivo:", uploadError);
                alert("❌ Error al subir el logo. Verifica las reglas de seguridad.");
                return;
            }
        }

        // 🔹 Guardar la configuración en la base de datos
        const updateData = {
            id: 1,
            nombre_empresa: nombreEmpresa,
            color_primario: colorPrimario
        };

        // Solo actualizar logo_url si hay una URL del logo (es decir, si se subió una imagen)
        if (logoUrl) {
            updateData.logo_url = logoUrl;
        }

        const { data, error } = await supabase
            .from("configuracion")
            .upsert([updateData]);  // Usamos el objeto con las propiedades a actualizar

        if (error) throw error;
        mostrarToast("✅ Configuración guardada correctamente.", "success");

        cargarConfiguracion();  // Recargamos la configuración para reflejar los cambios

    } catch (error) {
        console.error("❌ Error al guardar la configuración:", error);
        alert(`Error: ${error.message}`);
    }
});


// 📌 Cargar configuración actual
export async function cargarConfiguracion() {
    try {
        // 🔹 Obtener la configuración desde la base de datos
        const { data, error } = await supabase
            .from("configuracion")
            .select("nombre_empresa, logo_url, color_primario");

        if (error) throw error;
        if (!data || data.length === 0) {
            console.warn("⚠️ No se encontró configuración en la base de datos.");
            return;
        }

        const configuracion = data[0]; // Solo hay una configuración

         // 🔹 Actualizar el nombre de la empresa en el footer
         document.getElementById("footer-company-name").textContent = configuracion.nombre_empresa || ""; // Usar el nombre de la empresa de la DB, si está disponible

        // 🔹 Actualizar la UI con los datos obtenidos
        document.getElementById("site-name").value = configuracion.nombre_empresa || "";
        document.getElementById("primary-color").value = configuracion.color_primario || "#6c1b2d";
        aplicarColorPrimario(configuracion.color_primario); // Aplicar el color al sitio

        // 🔹 Verificar si el elemento del logo existe antes de asignar la imagen
        const logoElement = document.getElementById("site-logo-preview");
        if (logoElement && configuracion.logo_url) {
            logoElement.src = configuracion.logo_url;
            //  console.log("✅ Logo cargado correctamente:", configuracion.logo_url);
        } else {
            console.warn("⚠️ No se pudo cargar el logo porque el elemento no existe.");
        }

        //  console.log("✅ Configuración cargada correctamente:", configuracion);
    } catch (error) {
        console.error("❌ Error al cargar la configuración:", error);
    }
}

// Función para aplicar el color primario al sitio
function aplicarColorPrimario(color) {
    // Aplicar color al fondo y a los botones
    document.documentElement.style.setProperty('--primary-color', color);
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.style.backgroundColor = color;
        button.style.borderColor = color;
    });
    // Si tienes más elementos que dependen de este color, también los puedes actualizar aquí
}

// 📌 Cargar la configuración cuando la página se cargue
document.addEventListener("DOMContentLoaded", cargarConfiguracion);
