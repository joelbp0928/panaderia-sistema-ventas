import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";
import { loadIngredients } from "./productos.js";

// Variables globales para almacenar la selección actual
let selectedRow = null;
let selectedIngredientId = null;

// Hacer accesibles globalmente las funciones necesarias
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;
document.addEventListener('DOMContentLoaded', () => {
    setupRowSelection();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#ingredient-table') && !e.target.closest('.button-container')) {
            clearSelection();
        }
    });
});
// Mostrar el formulario para agregar o editar ingrediente
export function showIngredientForm() {
    const modal = new bootstrap.Modal(document.getElementById("ingredientModal"));
    modal.show(); // Mostrar el modal
    handlePriceChange();
    document.getElementById("ingredient-form").reset();
    document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";
}

// Función para manejar el cambio entre precio unitario y precio total
export function handlePriceChange() {
    const priceType = document.querySelector('input[name="price-type"]:checked').value;
    const stock = parseFloat(document.getElementById("ingredient-stock").value);
    const price = parseFloat(document.getElementById("ingredient-price").value);
    const priceTotal = parseFloat(document.getElementById("ingredient-price-total").value);
    const cantidad_unitario = parseFloat(document.getElementById("cantidad-unitario").value || 1); // Default a 1 si no se ingresa

    const medida_unitario = document.getElementById("medida-unitario").value;
    const medidaIngrediente = document.getElementById("ingredient-measure").value;

    // Si la medida del ingrediente es diferente a la del precio unitario, hacer la conversión
    let conversionFactor = 1;

    if (medida_unitario !== medidaIngrediente) {
        console.log("diferente. ", medida_unitario, "  ", medidaIngrediente)
        // Aquí se puede agregar la lógica de conversión (p.ej., 1kg = 1000g)
        if (medidaIngrediente === "kg" && medida_unitario === "gr") {
            conversionFactor = 1000; // 1 kg = 1000 gramos
        } else if (medidaIngrediente === "gr" && medida_unitario === "kg") {
            conversionFactor = 0.001; // 1 g = 0.001 kg
        }
        // Puedes agregar más conversiones dependiendo de las unidades que manejes.
    }

    if (priceType === "unitario") {
        // Mostrar los campos relacionados con el precio unitario
        document.getElementById("unitario-fields").style.display = "block";
        document.getElementById("total-fields").style.display = "none";
        // Calculamos el precio total si es precio unitario
        const totalPrice = ((price * conversionFactor) / cantidad_unitario) * stock;
        console.log(totalPrice, " = ((", price, " * ", conversionFactor, " ) / ", cantidad_unitario, ") * ", stock);
        document.getElementById("calculated-price-total").innerText = "Precio Total: $" + totalPrice;
        document.getElementById("calculated-price-total").style.display = "inline";
    } else {
        // Si es precio total, solo se toma el valor ingresado
        const preciouni = (priceTotal / stock)
        console.log(preciouni, " = ", priceTotal, " / ", stock)
        document.getElementById("calculated-price-total").innerText = "Precio Total: $" + priceTotal;
        document.getElementById("calculated-price-total").style.display = "inline";

        // Mostrar los campos relacionados con el precio total
        document.getElementById("unitario-fields").style.display = "none";
        document.getElementById("total-fields").style.display = "block";
    }
}

// 📌 Función para actualizar el precio en tiempo real cuando el usuario cambia la cantidad o el precio
export function setupRealTimePriceUpdate() {
    // Agregar listeners a los campos para actualizar el precio en tiempo real
    document.getElementById("ingredient-price").addEventListener("input", handlePriceChange);
    document.getElementById("cantidad-unitario").addEventListener("input", handlePriceChange);
    document.getElementById("ingredient-stock").addEventListener("input", handlePriceChange);
    document.querySelectorAll('input[name="price-type"]').forEach(radio => {
        radio.addEventListener("change", handlePriceChange);
    });
    document.getElementById("medida-unitario").addEventListener("change", handlePriceChange); // Escuchar cambios en el select de medida
}

// 📌 Función para agregar o actualizar un ingrediente
export async function gestionarIngrediente(event) {
    event.preventDefault(); // Evita la recarga de la página

   // 🔹 Obtener datos del formulario
   const idIngrediente = document.getElementById("ingredient-form").dataset.ingredienteId;
   const nombre = document.getElementById("ingredient-name").value.trim();
   const medida = document.getElementById("ingredient-measure").value;
   const cantidad = parseFloat(document.getElementById("ingredient-stock").value);
   const priceType = document.querySelector('input[name="price-type"]:checked').value;
   const preciounitario = parseFloat(document.getElementById("ingredient-price").value);
   const precio_total_ingrediente = parseFloat(document.getElementById("ingredient-price-total").value);

   // 🔹 Inicializar variables para medida y cantidad unitaria
   let medida_unitario = medida;
   let cantidad_unitario = cantidad;

   // Si es precio unitario, obtener los valores del formulario
   if (priceType === "unitario") {
       medida_unitario = document.getElementById("medida-unitario").value;
       cantidad_unitario = parseFloat(document.getElementById("cantidad-unitario").value);
   }

   let precio_total = 0;
   let precio_unitario = preciounitario;
   let conversionFactor = 1;

   if (medida_unitario !== medida) {
       console.log("diferente. ", medida_unitario, "  ", medida);
       if (medida === "kg" && medida_unitario === "gr") {
           conversionFactor = 1000;
       } else if (medida === "gr" && medida_unitario === "kg") {
           conversionFactor = 0.001;
       }
   }

   if (priceType === "unitario") {
       precio_total = ((precio_unitario * conversionFactor) / cantidad_unitario) * cantidad;
       console.log(precio_total, " = ((", precio_unitario, " * ", conversionFactor, " ) / ", cantidad_unitario, ") * ", cantidad);
   } else {
       precio_total = precio_total_ingrediente;
       precio_unitario = precio_total_ingrediente / cantidad;
   }

   console.log("precio_total: " + precio_total);
    try {
        // 🔹 Si idIngrediente existe, actualizamos, si no, agregamos un nuevo ingrediente
        if (idIngrediente) {
            console.log("aqui")
            await actualizarIngrediente(idIngrediente, { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario });
        } else {
            await agregarIngrediente({ nombre, medida, cantidad, precio_unitario, precio_total });
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
    console.log("datos", datos)
    // Validaciones
    if (!nombre || !medida || !cantidad || !precio_total) {
        alert("⚠️ Todos los campos son obligatorios.");
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
            fila.dataset.id = ingrediente.id; // Agregar el ID como atributo de datos

            const fechaRegistro = formatearFecha(ingrediente.fechaRegistro);
            fila.innerHTML = `
                <td>${ingrediente.nombre}</td>
                <td>$${Number(ingrediente.precio_total).toFixed(2)}</td>
                <td>${ingrediente.cantidad} ${ingrediente.medida}</td>
                <td>$${Number(ingrediente.precio_unitario).toFixed(2)} x ${ingrediente.cantidad_unitario} ${ingrediente.medida_unitario}</td>
                <td>${fechaRegistro}</td>
            `;
            listaIngredientes.appendChild(fila);
        });
        // Limpiar selección al recargar
        clearSelection();
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
        document.getElementById("medida-unitario").value = data.medida_unitario;

        const cantidad = document.getElementById("ingredient-stock").value = data.cantidad;
        const precio = document.getElementById("ingredient-price").value = data.precio_unitario;
        const cantidad_unitario = document.getElementById("cantidad-unitario").value = data.cantidad_unitario;
        const totalPrice = document.getElementById("price-unit").value = data.precio_total;
        document.getElementById("calculated-price-total").innerText = "Total: " + totalPrice || "";

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
    const { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario } = datos;
    console.log("preciototal: ", datos)
    try {
        // 🔹 Actualizar el ingrediente en la base de datos
        const { error } = await supabase
            .from("ingredientes")
            .update({ nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario })
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

// Función para manejar la selección de filas
function setupRowSelection() {
    console.log('Configurando selección de filas...');
    const table = document.getElementById('ingredient-table');
    const deleteBtn = document.getElementById('delete-btn');
    const editBtn = document.getElementById('edit-cuantity-modal-btn');
    console.log('Elementos encontrados:', { table, deleteBtn, editBtn });
    table.addEventListener('click', (e) => {
        const row = e.target.closest('tr');

        // Si se hizo clic en una fila del tbody (no en el thead)
        //     if (row && row.parentElement.id === 'ingredients-list') {
        // Deseleccionar la fila anterior si existe
        if (row.classList.contains('selected-row')) {
            console.log("seleccion", row)
            row.classList.remove('selected-row');
            selectedIngredientId = null; // Deseleccionar el producto
            document.getElementById("delete-btn").style.display = "none"; // Mostrar el botón de eliminar
            document.getElementById("edit-cuantity-modal-btn").style.display = "none"; // Mostrar
        } else {
            // Si la fila no está seleccionada, marcarla
            const filas = document.querySelectorAll("#ingredient-table tbody tr");
            filas.forEach(fila => fila.classList.remove('selected-row')); // Desmarcar todas las filas
            row.classList.add('selected-row');// Seleccionar la nueva fila
            selectedIngredientId = row.dataset.id; // Deseleccionar el producto
            document.getElementById("delete-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
            document.getElementById("edit-cuantity-modal-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
        }
    });

    // Evento para el botón de eliminar
    deleteBtn.addEventListener('click', () => {
        if (selectedIngredientId) {
            eliminarIngrediente(selectedIngredientId);
            // Limpiar selección después de eliminar
            clearSelection();
        }
    });

    // Evento para el botón de editar
    editBtn.addEventListener('click', () => {
        if (selectedIngredientId) {
            editarIngrediente(selectedIngredientId);
            // Limpiar selección después de eliminar
            clearSelection();
        }
    });
}

// Función para limpiar la selección
function clearSelection() {
    if (selectedRow) {
        selectedRow.classList.remove('selected-row');
        selectedRow = null;
        selectedIngredientId = null;

        // Desactivar botones
        document.getElementById('delete-btn').classList.remove('active');
        document.getElementById('edit-cuantity-modal-btn').classList.remove('active');
    }
}
