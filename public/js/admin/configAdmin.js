import { supabase } from "../supabase-config.js";
import { storage, ref, uploadBytes, getDownloadURL } from "../firebase-config.js";

// 📌 Referencia al formulario
const formConfig = document.querySelector("#settings form");

formConfig.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nombreEmpresa = document.querySelector("#site-name").value.trim();
    const colorPrimario = document.querySelector("#primary-color").value;
    const logoFile = document.querySelector("#site-logo").files[0];

    if (!nombreEmpresa) {
        alert("⚠️ El nombre del sitio es obligatorio.");
        return;
    }

    let logoUrl = null;

    try {
        // 🔹 Verificar si hay un archivo para subir
        if (logoFile) {
            const storageRef = ref(storage, `config/${logoFile.name}`);

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
        const { error } = await supabase.from("configuracion").upsert([
            {
                id: 1,
                nombre_empresa: nombreEmpresa,
                logo_url: logoUrl || null,
                color_primario: colorPrimario
            }
        ]);

        if (error) throw error;

        alert("✅ Configuración guardada correctamente.");
        cargarConfiguracion();

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

        // 🔹 Actualizar la UI con los datos obtenidos
        document.getElementById("site-name").value = configuracion.nombre_empresa || "";
        document.getElementById("primary-color").value = configuracion.color_primario || "#6c1b2d";

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


// 📌 Cargar la configuración cuando la página se cargue
document.addEventListener("DOMContentLoaded", cargarConfiguracion);
