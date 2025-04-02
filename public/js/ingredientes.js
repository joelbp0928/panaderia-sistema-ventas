import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo, hideLoading, showLoading } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";
import { loadIngredients } from "./productos.js";

// Variables globales para almacenar la selección actual
let selectedRow = null;
let selectedIngredientId = null;

// Hacer accesibles globalmente las funciones necesarias
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;
document.addEventListener('DOMContentLoaded', () => {
    showLoading(); // Mostrar spinner al cargar la página

    // Configurar eventos y cargar datos
    setupRowSelection();
    setupRealTimePriceUpdate();

    // Cargar ingredientes iniciales
    cargarIngredientes().finally(() => {
        hideLoading(); // Asegurarse de ocultar si hay error
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#ingredient-table') && !e.target.closest('.button-container')) {
            clearSelection();
            setupRowSelection()
        }
    });
});
// Mostrar el formulario para agregar o editar ingrediente
export function showIngredientForm() {
    const modal = new bootstrap.Modal(document.getElementById("ingredientModal"));

    // Resetear el formulario completamente
    const form = document.getElementById("ingredient-form");
    form.reset();
    form.dataset.ingredienteId = "";

    // Establecer el tipo de precio predeterminado (unitario)
    document.querySelector('input[name="price-type"][value="unitario"]').checked = true;

    // Mostrar campos iniciales
    document.getElementById("unitario-fields").style.display = "block";
    document.getElementById("total-fields").style.display = "none";

    // Limpiar campos calculados
    document.getElementById("calculated-price-total").style.display = "none";

    // Cambiar texto del botón de submit
    document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";

    // Mostrar el modal
    modal.show();

    // Forzar el cálculo inicial
    handlePriceChange();
}

// Función para manejar el cambio entre precio unitario y precio total
export function handlePriceChange() {
    const priceType = document.querySelector('input[name="price-type"]:checked').value;

    // Mostrar/ocultar campos según el tipo de precio seleccionado
    if (priceType === "unitario") {
        document.getElementById("unitario-fields").style.display = "block";
        document.getElementById("total-fields").style.display = "none";
    } else {
        document.getElementById("unitario-fields").style.display = "none";
        document.getElementById("total-fields").style.display = "block";
    }

    // Solo continuar con cálculos si los campos requeridos tienen valores
    try {
        const stock = parseFloat(document.getElementById("ingredient-stock").value) || 0;
        const price = parseFloat(document.getElementById("ingredient-price").value) || 0;
        const priceTotal = parseFloat(document.getElementById("ingredient-price-total").value) || 0;
        const cantidad_unitario = parseFloat(document.getElementById("cantidad-unitario").value) || 1;

        const medida_unitario = document.getElementById("medida-unitario").value;
        const medidaIngrediente = document.getElementById("ingredient-measure").value;

        let conversionFactor = 1;

        if (medida_unitario !== medidaIngrediente) {
            if (medidaIngrediente === "kg" && medida_unitario === "gr") {
                conversionFactor = 1000;
            } else if (medidaIngrediente === "gr" && medida_unitario === "kg") {
                conversionFactor = 0.001;
            }
        }

        if (priceType === "unitario") {
            const totalPrice = ((price * conversionFactor) / cantidad_unitario) * stock;
            document.getElementById("calculated-price-total").innerText = "Precio Total: $" + totalPrice.toFixed(2);
            document.getElementById("calculated-price-total").style.display = "inline";
        } else {
            const preciouni = (priceTotal / stock);
            document.getElementById("calculated-price-total").innerText = "Precio Unitario: $" + preciouni.toFixed(2);
            document.getElementById("calculated-price-total").style.display = "inline";
        }
    } catch (error) {
        console.error("Error en cálculos:", error);
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

    if (priceType === "unitario") {
        if (medida_unitario !== medida) {
            console.log("diferente. ", medida_unitario, "  ", medida);
            if (medida === "kg" && medida_unitario === "gr") {
                conversionFactor = 1000;
            } else if (medida === "gr" && medida_unitario === "kg") {
                conversionFactor = 0.001;
            }
        }
        precio_total = ((precio_unitario * conversionFactor) / cantidad_unitario) * cantidad;
        console.log(precio_total, " = ((", precio_unitario, " * ", conversionFactor, " ) / ", cantidad_unitario, ") * ", cantidad);
    } else {
        cantidad_unitario = 1;
        precio_total = precio_total_ingrediente;
        precio_unitario = precio_total_ingrediente / cantidad;
    }

    console.log("precio_total: " + precio_total);
    try {
        // 🔹 Si idIngrediente existe, actualizamos, si no, agregamos un nuevo ingrediente
        if (idIngrediente) {
            await actualizarIngrediente(idIngrediente, { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario });
        } else {
            await agregarIngrediente({ nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario });
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
    const { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario } = datos;
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
                medida_unitario,
                cantidad_unitario
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
    // Mostrar spinner de carga
    showLoading();
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
            <td>${formatCurrency(ingrediente.precio_total)}</td>
            <td>${formatNumber(ingrediente.cantidad)} ${ingrediente.medida}</td>
            <td>${formatCurrency(ingrediente.precio_unitario)} x ${formatNumber(ingrediente.cantidad_unitario)} ${ingrediente.medida_unitario}</td>
            <td>${fechaRegistro}</td>
        `;
            listaIngredientes.appendChild(fila);
        });

    } catch (error) {
        console.error("❌ Error al cargar ingredientes:", error);
        // Mostrar notificación de error
        mostrarToast("Error al cargar ingredientes", "error");
    } finally {
        hideLoading(); // Ocultar spinner independientemente del resultado
        clearSelection(); // Limpiar selección al recargar
        setupRowSelection()
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
        document.getElementById("ingredient-stock").value = data.cantidad;


        // Determinar si es precio unitario o total
        if (data.precio_unitario && data.cantidad_unitario) {
            document.querySelector('input[name="price-type"][value="unitario"]').checked = true;
            document.getElementById("ingredient-price").value = data.precio_unitario;
            document.getElementById("cantidad-unitario").value = data.cantidad_unitario;
            document.getElementById("medida-unitario").value = data.medida_unitario;
        } else {
            document.querySelector('input[name="price-type"][value="total"]').checked = true;
            document.getElementById("ingredient-price-total").value = data.precio_total;
        }
        // Asegurar que los campos numéricos tengan valores válidos
        const priceTotalInput = document.getElementById("ingredient-price-total");
        if (priceTotalInput && !priceTotalInput.value) {
            priceTotalInput.value = data.precio_total || 0;
        }
        // 📌 Cambiar el título del modal y el botón de acción
        document.getElementById("ingredientModalLabel").innerText = "Editar Ingrediente";
        document.querySelector('#ingredient-form button[type="submit"').innerText = "Actualizar Ingrediente";
        // Actualizar visualización
        handlePriceChange();
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

// Función para formatear moneda (con $, comas y 2 decimales)
function formatCurrency(value) {
    return '$' + formatNumber(value, 2);
}

// Función para formatear números con comas y decimales opcionales
function formatNumber(value, decimals = 0) {
    const number = Number(value);
    if (isNaN(number)) return '0';

    return number.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}
