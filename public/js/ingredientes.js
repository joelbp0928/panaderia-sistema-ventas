import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// Hacer accesibles globalmente las funciones necesarias
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;

// Mostrar el formulario para agregar o editar ingrediente
export function showIngredientForm() {
    const formulario = document.getElementById("ingredient-form");

    // 🔹 Si el formulario está oculto, se muestra; si está visible, se oculta
    if (formulario.classList.contains("d-none")) {
        formulario.classList.remove("d-none"); // Mostrar formulario
    } else {
        formulario.classList.add("d-none"); // Ocultar formulario
        return; // 🔹 Si se oculta, terminamos aquí para evitar reset innecesario
    }

    // 🔹 Restablecer valores y ocultar ID de edición solo si se está mostrando
    formulario.reset();
    formulario.dataset.ingredienteId = "";
    document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";
}

// 📌 Agregar un nuevo ingrediente
export async function agregarIngrediente(event) {
    event.preventDefault(); // 📌 Evita recargar la página

    // 🔹 Obtener datos del formulario
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    const cantidad = document.getElementById("ingredient-stock").value;

    // Validaciones
    if (!nombre || !medida || !cantidad) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    if (cantidad <= 0) {
        alert("⚠️ La cantidad debe ser mayor a 0.");
        return;
    }

    try {
        // 🔹 Insertar el ingrediente en la base de datos de Supabase
        const { error } = await supabase.from("ingredientes").insert([
            {
                nombre,
                medida,
                cantidad,
                fechaRegistro: new Date().toISOString(),
            },
        ]);

        if (error) throw error;

        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Ingrediente agregado correctamente.", "success");

        // 🔄 Recargar la lista de ingredientes después de agregar
        cargarIngredientes();

        // 📌 Limpiar el formulario
        document.getElementById("ingredient-form").reset();
        document.getElementById("ingredient-form").style.display = "none";

    } catch (error) {
        console.error("❌ Error al agregar ingrediente:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}

// 📌 Función para cargar los ingredientes desde Supabase y mostrarlos
export async function cargarIngredientes() {
    try {
        const { data, error } = await supabase
            .from("ingredientes")
            .select("*");

        if (error) throw error;

        const listaIngredientes = document.getElementById("ingredients-list");
        listaIngredientes.innerHTML = ""; // Limpiar lista antes de agregar

        // 📌 Recorrer los ingredientes y agregarlos a la tabla
        data.forEach((ingrediente) => {
            const fila = document.createElement("tr");
            const fechaRegistro = formatearFecha(ingrediente.fechaRegistro);
            fila.innerHTML = `
                <td>${ingrediente.nombre}</td>
                <td>${ingrediente.medida}</td>
                <td>${ingrediente.cantidad}</td>
                <td>${fechaRegistro}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarIngrediente('${ingrediente.id}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarIngrediente('${ingrediente.id}')">Eliminar</button>
                </td>
            `;
            listaIngredientes.appendChild(fila);
        });
    } catch (error) {
        console.error("❌ Error al cargar ingredientes:", error);
    }
}

// 📌 Función para eliminar un ingrediente
export async function eliminarIngrediente(idIngrediente) {
    try {
        if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar este ingrediente? Esta acción es irreversible.")) {
            return;
        }

        const { error } = await supabase
            .from("ingredientes")
            .delete()
            .eq("id", idIngrediente);

        if (error) throw error;

        // 🔄 Recargar la lista de ingredientes después de eliminar
        cargarIngredientes();

        mostrarToast("✅ Ingrediente eliminado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al eliminar ingrediente:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}

// 📌 Función para editar un ingrediente
export async function editarIngrediente(idIngrediente) {

    try {
        // 🔹 Obtener el ingrediente desde Supabase
        const { data, error } = await supabase
            .from("ingredientes")
            .select("*")
            .eq("id", idIngrediente)
            .single(); // 📌 Obtener un solo ingrediente

        if (error || !data) {
            throw new Error("No se pudo cargar el ingrediente.");
        }

        // 🔹 Llenar el formulario con los datos del ingrediente
        document.getElementById("ingredient-name").value = data.nombre;
        document.getElementById("ingredient-measure").value = data.medida;
        document.getElementById("ingredient-stock").value = data.cantidad;

        // 📌 Cambiar el botón a "Actualizar"
        document.querySelector("#ingredient-form button[type='submit']").innerText = "Actualizar Ingrediente";

        // 📌 Establecer el ID en el formulario para actualizar
        const formulario = document.getElementById("ingredient-form");
        formulario.dataset.ingredienteId = idIngrediente;

        // 📌 Mostrar el formulario si estaba oculto
        formulario.classList.remove("d-none");
    } catch (error) {
        console.error("❌ Error al cargar el ingrediente para edición:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}

// 📌 Función para actualizar un ingrediente
export async function actualizarIngrediente(event) {
    event.preventDefault();

    const idIngrediente = document.getElementById("ingredient-form").dataset.ingredienteId;
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    const cantidad = document.getElementById("ingredient-stock").value;

    if (!nombre || !medida || !cantidad) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    if (cantidad <= 0) {
        alert("⚠️ La cantidad debe ser mayor a 0.");
        return;
    }

    try {
        // 🔹 Actualizar el ingrediente en la base de datos
        const { error } = await supabase
            .from("ingredientes")
            .update({ nombre, medida, cantidad })
            .eq("id", idIngrediente);

        if (error) throw error;

        mostrarToast("✅ Ingrediente actualizado correctamente.", "success");

        // 🔄 Recargar la lista de ingredientes después de actualizar
        cargarIngredientes();

        // Limpiar el formulario
        document.getElementById("ingredient-form").reset();
        document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";
        document.getElementById("ingredient-form").dataset.ingredienteId = ""; // Limpiar ID del ingrediente

    } catch (error) {
        console.error("❌ Error al actualizar ingrediente:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}
