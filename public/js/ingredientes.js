import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";
import { loadIngredients } from "./productos.js";

// Hacer accesibles globalmente las funciones necesarias
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;

// Mostrar el formulario para agregar o editar ingrediente
export function showIngredientForm() {
    const modal = new bootstrap.Modal(document.getElementById("ingredientModal"));
    modal.show(); // Mostrar el modal


    document.getElementById("ingredient-form").reset();
    document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";

    // Reset the price display logic
    //    resetPriceDisplay();
}

// Función para manejar el cambio entre precio unitario y precio total
export function handlePriceChange() {
    const priceType = document.querySelector('input[name="price-type"]:checked').value;
    const stock = parseFloat(document.getElementById("ingredient-stock").value);
    const price = parseFloat(document.getElementById("ingredient-price").value);

    if (priceType === "unitario") {
        // Calcular el precio total si es precio unitario
        // Mostrar los campos relacionados con el precio unitario
        document.getElementById("unitario-fields").style.display = "block";
        document.getElementById("total-fields").style.display = "none";

        const totalPrice = stock * price;
        document.getElementById("calculated-price-total").innerText = "Precio Total: " + totalPrice || "";
        document.getElementById("calculated-price-total").style.display = "inline";

    } else {
        // Mostrar el precio unitario si es precio total
        //  document.getElementById("calculated-price-total").style.display = "none";
        // Mostrar los campos relacionados con el precio total
        document.getElementById("unitario-fields").style.display = "none";
        document.getElementById("total-fields").style.display = "block";
    }
}
// 📌 Función para actualizar el precio en tiempo real cuando el usuario cambia la cantidad o el precio
export function setupRealTimePriceUpdate() {
    // Agregar listeners a los campos para actualizar el precio en tiempo real
    document.getElementById("ingredient-price").addEventListener("input", handlePriceChange);
    document.getElementById("ingredient-stock").addEventListener("input", handlePriceChange);
    document.querySelectorAll('input[name="price-type"]').forEach(radio => {
        radio.addEventListener("change", handlePriceChange);
    });

    // Obtener el select de medida unitario
    const medidaSelect = document.getElementById("ingredient-measure");
    document.getElementById("medida-unitario").value = medidaSelect;
}
// Función para resetear la visualización del precio
function resetPriceDisplay() {
    document.getElementById("calculated-price-total").style.display = "none";
    document.getElementById("price-total-label").style.display = "none";
}

// 📌 Función para agregar o actualizar un ingrediente
export async function gestionarIngrediente(event) {
    event.preventDefault(); // Evita la recarga de la página

    // 🔹 Obtener datos del formulario
    const idIngrediente = document.getElementById("ingredient-form").dataset.ingredienteId;
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    /*  const cantidad = document.getElementById("ingredient-stock").value;
      const precio_unitario = parseFloat(document.getElementById("ingredient-price").value);
      const precio_total = document.getElementById("price-unit").checked ? precio_unitario * cantidad : precio;
  */
    const priceType = document.querySelector('input[name="price-type"]:checked').value;
    const price = parseFloat(document.getElementById("ingredient-price").value);
    const quantity = parseFloat(document.getElementById("cantidad-unitario").value);
    const medidaUnitario = document.getElementById("medida-unitario").value;
    //   console.log("precio total", precio_total)
    let precio_total = 0;
    let precio_unitario = 0;
    // Validaciones
    /*  if (!nombre || !medida || !cantidad) {
          alert("⚠️ Todos los campos son obligatorios.");
          return;
      }*/
    if (priceType === "unitario") {
        // Precio Unitario: calcular precio total
        precio_unitario = price;
        precio_total = price * quantity;
    } else {
        // Precio Total: solo usar el valor ingresado
        precio_total = price;
    }
    try {
        // 🔹 Si idIngrediente existe, actualizamos, si no, agregamos un nuevo ingrediente
        if (idIngrediente) {
            console.log("aqui")
            await actualizarIngrediente(idIngrediente, { nombre, medida, cantidad, precio_unitario, precio_total, medidaUnitario });
        } else {
            await agregarIngrediente({ nombre, medida, cantidad, precio_unitario, precio_total, medidaUnitario });
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
    const { nombre, medida, cantidad, precio_unitario, precio_total } = datos;

    // Validaciones
    if (!nombre || !medida || !cantidad || !precio_total) {
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
                precio_unitario: precio_unitario,
                precio_total: precio_total,
            },
        ]);

        if (error) throw error;
        loadIngredients();
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
                <td>${ingrediente.cantidad}</td>
                <td>${ingrediente.medida}</td>
                <td>${ingrediente.precio_unitario}</td>
                <td>${ingrediente.precio_total}</td>
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
async function eliminarIngrediente(idIngrediente) {
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
            loadIngredients();
            mostrarToast("✅ Ingrediente eliminado correctamente.", "success");

        } catch (error) {
            console.error("❌ Error al eliminar ingrediente:", error);
            mostrarToast(`❌ Error al eliminar ingrediente`, "error");
        }
    });

    // Si el usuario decide cancelar, simplemente cerramos el modal sin hacer nada
    document.getElementById("deleteIngredientModal").addEventListener('hidden.bs.modal', function () {
        //console.log("Modal cerrado sin eliminar");
    });
}

// 📌 Función para editar un ingrediente
async function editarIngrediente(idIngrediente) {
    console.log("editarIngrediente", idIngrediente)
    // Mostrar el formulario en un modal
    showIngredientForm();
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
        const cantidad = document.getElementById("ingredient-stock").value = data.cantidad;
        const precio = document.getElementById("ingredient-price").value = data.precio_unitario;
        const totalPrice = document.getElementById("price-unit").checked ? precio * cantidad : precio;
        document.getElementById("calculated-price-total").innerText = totalPrice || "";

        // 📌 Cambiar el título del modal y el botón de acción
        document.getElementById("ingredientModalLabel").innerText = "Editar Ingrediente";
        document.querySelector('#ingredient-form button[type="submit"').innerText = "Actualizar Ingrediente";

        // 📌 Establecer el ID en el formulario para actualizar
        const formulario = document.getElementById("ingredient-form");
        formulario.dataset.ingredienteId = idIngrediente;
        console.log(formulario);


    } catch (error) {
        console.error("❌ Error al cargar el ingrediente para edición:", error);
        mostrarToast(`❌ Error al cargar el ingrediente para edición.`, "error");
    }
}

// 📌 Función para actualizar un ingrediente
export async function actualizarIngrediente(idIngrediente, datos) {
    const { nombre, medida, cantidad, precio_unitario, precio_total } = datos;
    console.log("preciototal: ", datos)
    try {
        // 🔹 Actualizar el ingrediente en la base de datos
        const { error } = await supabase
            .from("ingredientes")
            .update({ nombre, medida, cantidad, precio_unitario, precio_total })
            .eq("id", idIngrediente);

        if (error) throw error;

        loadIngredients();
        mostrarToast("✍ Ingrediente actualizado correctamente.", "success");

        // 🔄 Recargar la lista de ingredientes después de actualizar
        cargarIngredientes();

    } catch (error) {
        console.error("❌ Error al actualizar ingrediente:", error);
        mostrarToast(`❌ Error al actualizar ingrediente.`, "error");
    }
}
