import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// Hacer accesibles globalmente las funciones necesarias
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;

// Mostrar el formulario para agregar o editar ingrediente
export function showIngredientForm() {
    const modal = new bootstrap.Modal(document.getElementById("ingredientModal"));
    modal.show(); // Mostrar el modal

    // 🔹 No resetear el formulario si es edición
    const formulario = document.getElementById("ingredient-form");

    // Limpiar el ID solo si se está agregando un ingrediente
    if (!formulario.dataset.ingredienteId) {
        formulario.reset(); // Limpiar formulario solo cuando no es edición
        document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";
    }
}


// 📌 Función para agregar o actualizar un ingrediente
export async function gestionarIngrediente(event) {
    event.preventDefault(); // Evita la recarga de la página

    // 🔹 Obtener datos del formulario
    const idIngrediente = document.getElementById("ingredient-form").dataset.ingredienteId;
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    const cantidad = document.getElementById("ingredient-stock").value;

    // Validaciones
    if (!nombre || !medida || !cantidad) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        // 🔹 Si idIngrediente existe, actualizamos, si no, agregamos un nuevo ingrediente
        if (idIngrediente) {
            console.log("aqui")
            await actualizarIngrediente(idIngrediente, { nombre, medida, cantidad });
        } else {
            await agregarIngrediente({ nombre, medida, cantidad });
        }

        // 🔄 Recargar la lista de ingredientes después de agregar o actualizar
        cargarIngredientes();

        // Limpiar el formulario y ocultar el modal
        document.getElementById("ingredient-form").reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById("ingredientModal"));
        modal.hide(); // Ocultar el modal después de guardar o actualizar


    } catch (error) {
        console.error("❌ Error al guardar el ingrediente:", error);
        mostrarToast(`❌ Error al guardar el ingrediente.`, "error");
    }
}

// 📌 Agregar un nuevo ingrediente
export async function agregarIngrediente(datos) {

    // 🔹 Obtener datos del formulario
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    const cantidad = document.getElementById("ingredient-stock").value;

    // Validaciones
    if (!nombre || !medida || !cantidad) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }
    console.log("datos", datos)
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

    } catch (error) {
        console.error("❌ Error al agregar ingrediente:", error);
        mostrarToast(`❌ Error al agregar ingrediente`, "error");
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
    // Mostrar el modal de confirmación de eliminación
    const modal = new bootstrap.Modal(document.getElementById('deleteIngredientModal'));
    modal.show();
    // Manejar el evento de confirmación del modal
    document.getElementById("confirm-delete-btn").addEventListener("click", async () => {

        try {
            const { error } = await supabase
                .from("ingredientes")
                .delete()
                .eq("id", idIngrediente);

            if (error) throw error;

            // 🔄 Recargar la lista de ingredientes después de eliminar
            cargarIngredientes();

            // Cerrar el modal
            modal.hide();

            mostrarToast("✅ Ingrediente eliminado correctamente.", "success");

        } catch (error) {
            console.error("❌ Error al eliminar ingrediente:", error);
            mostrarToast(`❌ Error al eliminar ingrediente`, "error");
        }
    });

    // Si el usuario decide cancelar, simplemente cerramos el modal sin hacer nada
    document.getElementById("deleteIngredientModal").addEventListener('hidden.bs.modal', function () {
        console.log("Modal cerrado sin eliminar");
    });
}

// 📌 Función para editar un ingrediente
export async function editarIngrediente(idIngrediente) {
    console.log("editarIngrediente", idIngrediente)
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
        console.log("data", data)
        // 🔹 Llenar el formulario con los datos del ingrediente
        document.getElementById("ingredient-name").value = data.nombre;
        document.getElementById("ingredient-measure").value = data.medida;
        document.getElementById("ingredient-stock").value = data.cantidad;

        // 📌 Cambiar el botón a "Actualizar"
        document.querySelector('#ingredient-form button[type="submit"').innerText = "Actualizar Ingrediente";

        // 📌 Establecer el ID en el formulario para actualizar
        const formulario = document.getElementById("ingredient-form");
        formulario.dataset.ingredienteId = idIngrediente;
        console.log(formulario);

        // Mostrar el formulario en un modal
        showIngredientForm();
        console.log(formulario);

    } catch (error) {
        console.error("❌ Error al cargar el ingrediente para edición:", error);
        mostrarToast(`❌ Error al cargar el ingrediente para edición.`, "error");
    }
}

// 📌 Función para actualizar un ingrediente
export async function actualizarIngrediente(idIngrediente, datos) {
    const { nombre, medida, cantidad } = datos;

    try {
        // 🔹 Actualizar el ingrediente en la base de datos
        const { error } = await supabase
            .from("ingredientes")
            .update({ nombre, medida, cantidad })
            .eq("id", idIngrediente);

        if (error) throw error;

        mostrarToast("✍ Ingrediente actualizado correctamente.", "success");

        // 🔄 Recargar la lista de ingredientes después de actualizar
        cargarIngredientes();

    } catch (error) {
        console.error("❌ Error al actualizar ingrediente:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}
