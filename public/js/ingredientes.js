// 📦 MÓDULOS IMPORTADOS
import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo, hideLoading, showLoading } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha, formatearFechaDb } from "./formatearFecha.js"; // 📌 Formateo de fechas
import { loadIngredients } from "./productos.js"; // 📌 Carga de productos relacionados

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedRow = null;
let selectedIngredientId = null;

// 🌐 EXPOSICIÓN DE FUNCIONES AL SCOPE GLOBAL
window.editarIngrediente = editarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    // showLoading(); // Mostrar spinner al cargar la página

    // Configuración inicial
    setupRowSelection(); // Manejo de selección de filas
    setupRealTimePriceUpdate(); // Actualizaciones en tiempo real

    // Cargar ingredientes iniciales
    //  cargarIngredientes().finally(() => {
    //    hideLoading(); // Asegurarse de ocultar si hay error
    // });

    // Manejo de clics fuera de la tabla
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#ingredient-table') && !e.target.closest('.button-container')) {
            clearSelection();
        }
    });

    // Listeners para cambio de tipo de precio
    document.querySelectorAll('input[name="price-type"]').forEach(radio => {
        radio.addEventListener("change", function () {
            handlePriceChange();
            validarFormulario();
        });
    });
});

// 🧩 FUNCIONES PRINCIPALES

/**
 * 🖼️ Muestra el formulario para agregar/editar ingredientes
 * @description Prepara y muestra el modal del formulario
 */
export function showIngredientForm() {
    const modal = new bootstrap.Modal(document.getElementById("ingredientModal"));

    // 🔄 Resetear estado del formulario
    const form = document.getElementById("ingredient-form");
    form.reset();
    form.dataset.ingredienteId = "";

    // 🏷️ Configuración inicial
    document.querySelector('input[name="price-type"][value="unitario"]').checked = true;
    document.getElementById("unitario-fields").style.display = "block";
    document.getElementById("total-fields").style.display = "none";
    document.getElementById("calculated-price-total").style.display = "none";
    document.querySelector("#ingredient-form button[type='submit']").innerText = "Guardar Ingrediente";

    // 🕶️ Ocultar botones de acciones
    document.getElementById("delete-btn").style.display = "none";
    document.getElementById("edit-cuantity-modal-btn").style.display = "none";

    modal.show(); // Mostrar modal
    handlePriceChange(); // Actualizar cálculos iniciales
}

/**
 * 🔄 Maneja cambios entre precio unitario/total
 * @description Actualiza la UI y cálculos según el tipo de precio seleccionado
 */
export function handlePriceChange() {
    const priceType = document.querySelector('input[name="price-type"]:checked').value;

    // 👁️ Mostrar/ocultar campos según tipo
    if (priceType === "unitario") {
        document.getElementById("unitario-fields").style.display = "block";
        document.getElementById("total-fields").style.display = "none";
        // Validar campos visibles
        //      if (isNaN(parseFloat(document.getElementById("ingredient-price").value))) {
        //        marcarErrorCampo("ingredient-price", "Ingresa un precio válido");
        //  }
    } else {
        document.getElementById("unitario-fields").style.display = "none";
        document.getElementById("total-fields").style.display = "block";
        // Validar campos visibles
        // if (isNaN(parseFloat(document.getElementById("ingredient-price-total").value))) {
        //   marcarErrorCampo("ingredient-price-total", "Ingresa un precio válido");
        //}
    }

    // 🧮 Realizar cálculos
    try {
        const stock = parseFloat(document.getElementById("ingredient-stock").value) || 0;
        const price = parseFloat(document.getElementById("ingredient-price").value) || 0;
        const priceTotal = parseFloat(document.getElementById("ingredient-price-total").value) || 0;
        const cantidad_unitario = parseFloat(document.getElementById("cantidad-unitario").value) || 1;

        const medida_unitario = document.getElementById("medida-unitario").value;
        const medidaIngrediente = document.getElementById("ingredient-measure").value;

        // 🔄 Factor de conversión para diferentes unidades
        let conversionFactor = 1;
        if (medida_unitario !== medidaIngrediente) {
            if (medidaIngrediente === "kg" && medida_unitario === "gr") {
                conversionFactor = 1000;
            } else if (medidaIngrediente === "gr" && medida_unitario === "kg") {
                conversionFactor = 0.001;
            }
        }

        // 💰 Calcular y mostrar precios
        const calculatedElement = document.getElementById("calculated-price-total");
        if (priceType === "unitario") {
            const totalPrice = ((price * conversionFactor) / cantidad_unitario) * stock;
            calculatedElement.innerText = `Precio Total: $${totalPrice.toFixed(2)}`;
        } else {
            const unitPrice = (priceTotal / stock);
            calculatedElement.innerText = `Precio Unitario: $${unitPrice.toFixed(2)}`;
        }
        calculatedElement.style.display = "inline";

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

    // Validar formulario antes de continuar
    if (!validarFormulario()) {
        mostrarToast("Por favor corrige los errores en el formulario", "warning");
        return;
    }

    // 🔹 Obtener datos del formulario (solo si la validación pasó)
    const idIngrediente = document.getElementById("ingredient-form").dataset.ingredienteId;
    const nombre = document.getElementById("ingredient-name").value.trim();
    const medida = document.getElementById("ingredient-measure").value;
    const cantidad = parseFloat(document.getElementById("ingredient-stock").value);
    const priceType = document.querySelector('input[name="price-type"]:checked').value;

    try {
        let precio_total, precio_unitario, medida_unitario, cantidad_unitario;

        if (priceType === "unitario") {
            const preciounitario = parseFloat(document.getElementById("ingredient-price").value);
            medida_unitario = document.getElementById("medida-unitario").value;
            cantidad_unitario = parseFloat(document.getElementById("cantidad-unitario").value);

            let conversionFactor = 1;
            if (medida_unitario !== medida) {
                if (medida === "kg" && medida_unitario === "gr") {
                    conversionFactor = 1000;
                } else if (medida === "gr" && medida_unitario === "kg") {
                    conversionFactor = 0.001;
                }
            }

            precio_total = ((preciounitario * conversionFactor) / cantidad_unitario) * cantidad;
            precio_unitario = preciounitario;
        } else {
            const precio_total_ingrediente = parseFloat(document.getElementById("ingredient-price-total").value);
            precio_total = precio_total_ingrediente;
            precio_unitario = precio_total_ingrediente / cantidad;
            medida_unitario = medida;
            cantidad_unitario = 1;
        }

        // 🔹 Guardar o actualizar
        if (idIngrediente) {
            await actualizarIngrediente(idIngrediente, {
                nombre, medida, cantidad,
                precio_unitario, precio_total,
                medida_unitario, cantidad_unitario
            });
        } else {
            await agregarIngrediente({
                nombre, medida, cantidad,
                precio_unitario, precio_total,
                medida_unitario, cantidad_unitario
            });
        }

        cargarIngredientes();
        document.getElementById("ingredient-form").reset();
        bootstrap.Modal.getInstance(document.getElementById("ingredientModal")).hide();

    } catch (error) {
        console.error("❌ Error al guardar el ingrediente:", error);
        mostrarToast(`❌ Error al guardar el ingrediente.`, "error");
    }
}

// 📌 Agregar un nuevo ingrediente
export async function agregarIngrediente(datos) {
    const { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario } = datos;
    // console.log("datos", datos)

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

            const fechaRegistro = formatearFechaDb(ingrediente.fechaRegistro);
            fila.innerHTML = `
            <td>${ingrediente.nombre}</td>
            <td>${formatCurrency(ingrediente.precio_total)} x ${formatNumber(ingrediente.cantidad)} ${ingrediente.medida}</td>
           <!-- <td>${formatCurrency(ingrediente.precio_unitario)} x ${formatNumber(ingrediente.cantidad_unitario)} ${ingrediente.medida_unitario}</td>-->
            <td>${fechaRegistro}</td>
        `;
            listaIngredientes.appendChild(fila);
        });

    } catch (error) {
        console.error("❌ Error al cargar ingredientes:", error);
        mostrarToast("Error al cargar ingredientes", "error");
    } finally {
        hideLoading(); // Ocultar spinner independientemente del resultado
        clearSelection(); // Limpiar selección al recargar
        //   setupRowSelection()
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


            loadIngredients();
            clearSelection();
            document.getElementById("delete-btn").style.display = "none"; // ocultar el botón de eliminar
            document.getElementById("edit-cuantity-modal-btn").style.display = "none"; // ocultar
            mostrarToast("✅ Ingrediente eliminado correctamente.", "success");

            modal.hide();// Cerrar el modal
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
    //  console.log("editarIngrediente", idIngrediente)
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
        //    console.log("data", data)
        // 🔹 Llenar el formulario con los datos del ingrediente
        document.getElementById("ingredient-name").value = data.nombre;
        document.getElementById("ingredient-measure").value = data.medida;
        document.getElementById("ingredient-stock").value = data.cantidad;
        document.getElementById("ingredient-price-total").value = data.precio_total;

        // Determinar si es precio unitario o total
        if (data.precio_unitario && data.cantidad_unitario) {
            document.querySelector('input[name="price-type"][value="unitario"]').checked = true;
            document.getElementById("ingredient-price").value = data.precio_unitario;
            document.getElementById("cantidad-unitario").value = data.cantidad_unitario;
            document.getElementById("medida-unitario").value = data.medida_unitario;
        } else {
            document.querySelector('input[name="price-type"][value="total"]').checked = true;

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
        //    console.log(formulario);
    } catch (error) {
        console.error("❌ Error al cargar el ingrediente para edición:", error);
        mostrarToast(`❌ Error al cargar el ingrediente para edición.`, "error");
    }
}

// 📌 Función para actualizar un ingrediente
export async function actualizarIngrediente(idIngrediente, datos) {
    const { nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario } = datos;
    //  console.log("preciototal: ", datos)
    try {
        // 🔹 Actualizar el ingrediente en la base de datos
        const { error } = await supabase
            .from("ingredientes")
            .update({ nombre, medida, cantidad, precio_unitario, precio_total, medida_unitario, cantidad_unitario })
            .eq("id", idIngrediente);

        if (error) throw error;

        loadIngredients();
        document.getElementById("delete-btn").style.display = "none"; // ocultar el botón de eliminar
        document.getElementById("edit-cuantity-modal-btn").style.display = "none"; // ocultar
        clearSelection();
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
    //   console.log('Configurando selección de filas...');
    const table = document.getElementById('ingredient-table');
    const deleteBtn = document.getElementById('delete-btn');
    const editBtn = document.getElementById('edit-cuantity-modal-btn');
    //  console.log('Elementos encontrados:', { table, deleteBtn, editBtn });
    table.addEventListener('click', (e) => {
        const row = e.target.closest('tr');

        // Si se hizo clic en una fila del tbody (no en el thead)
        if (row && row.parentElement.id === 'ingredients-list') {
            // Deseleccionar la fila anterior si existe
            if (row.classList.contains('selected-row')) {
                //     console.log("seleccion", row)
                row.classList.remove('selected-row');
                selectedIngredientId = null; // Deseleccionar el producto
                selectedRow = null;
                document.getElementById("delete-btn").style.display = "none"; // ocultar el botón de eliminar
                document.getElementById("edit-cuantity-modal-btn").style.display = "none"; // ocultar
            } else {
                // Si la fila no está seleccionada, marcarla
                const filas = document.querySelectorAll("#ingredient-table tbody tr");
                filas.forEach(fila => fila.classList.remove('selected-row')); // Desmarcar todas las filas
                row.classList.add('selected-row');// Seleccionar la nueva fila
                selectedIngredientId = row.dataset.id; // Deseleccionar el producto
                selectedRow = row.dataset.id;
                document.getElementById("delete-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
                document.getElementById("edit-cuantity-modal-btn").style.display = "inline-block"; // Mostrar el botón de eliminar
            }
        }
    });

    // Evento para el botón de eliminar
    deleteBtn.addEventListener('click', () => {
        if (selectedIngredientId) {
            eliminarIngrediente(selectedIngredientId);
            // Limpiar selección después de eliminar
            // clearSelection();

        }
    });

    // Evento para el botón de editar
    editBtn.addEventListener('click', () => {
        if (selectedIngredientId) {
            editarIngrediente(selectedIngredientId);
            // Limpiar selección después de eliminar
            //  clearSelection();
        }
    });
}

// Función para limpiar la selección
function clearSelection() {
    // console.log(selectedRow)
    try {
        // Remover selección visual
        const table = document.getElementById('ingredient-table');
        if (table) {
            const selectedRows = table.querySelectorAll('tr.selected-row');
            selectedRows.forEach(row => row.classList.remove('selected-row'));
        }

        // Limpiar estado
        selectedRow = null;
        selectedIngredientId = null;

        // Ocultar botones de acción
        ['delete-btn', 'edit-cuantity-modal-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'none';
                btn.classList.remove('active'); // Si usas clases CSS para estado
            }
        });

    } catch (error) {
        console.error('Error al limpiar selección:', error);
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

function validarFormulario() {
    let isValid = true;
    const priceType = document.querySelector('input[name="price-type"]:checked').value;

    // Limpiar errores previos
    limpiarErrorCampo([
        'ingredient-name',
        'ingredient-measure',
        'ingredient-stock',
        'ingredient-price',
        'ingredient-price-total',
        'cantidad-unitario',
        'medida-unitario'
    ]);

    // Validar campos comunes
    if (!document.getElementById("ingredient-name").value.trim()) {
        marcarErrorCampo("ingredient-name", "El nombre es obligatorio");
        isValid = false;
    }

    if (!document.getElementById("ingredient-measure").value) {
        marcarErrorCampo("ingredient-measure", "Selecciona una medida");
        isValid = false;
    }

    const cantidad = parseFloat(document.getElementById("ingredient-stock").value);
    if (isNaN(cantidad) || cantidad <= 0) {
        marcarErrorCampo("ingredient-stock", "Ingresa una cantidad válida");
        isValid = false;
    }

    // Validaciones según tipo de precio
    if (priceType === "unitario") {
        const precioUnitario = parseFloat(document.getElementById("ingredient-price").value);
        if (isNaN(precioUnitario) || precioUnitario <= 0) {
            marcarErrorCampo("ingredient-price", "Ingresa un precio unitario válido");
            isValid = false;
        }

        const cantidadUnitario = parseFloat(document.getElementById("cantidad-unitario").value);
        if (isNaN(cantidadUnitario)) {
            marcarErrorCampo("cantidad-unitario", "Ingresa una cantidad válida");
            isValid = false;
        }

        if (!document.getElementById("medida-unitario").value) {
            marcarErrorCampo("medida-unitario", "Selecciona una medida unitaria");
            isValid = false;
        }
    } else {
        const precioTotal = parseFloat(document.getElementById("ingredient-price-total").value);
        if (isNaN(precioTotal) || precioTotal <= 0) {
            marcarErrorCampo("ingredient-price-total", "Ingresa un precio total válido");
            isValid = false;
        }
    }
    return isValid;
}

const filtrosIngrediente = {
    buscar: document.getElementById("buscarIngredienteGeneral"),
    fecha: document.getElementById("filtroFecha"),
    ordenarNombre: document.getElementById("ordenarNombreIngrediente"),
    limpiarBtn: document.getElementById("btn-limpiar-filtros-ing-1"),
};

// Activar botón limpiar si hay filtros activos
function actualizarEstadoBotonLimpiarIng() {
    const hayFiltros =
        filtrosIngrediente.buscar.value.trim() !== "" ||
        filtrosIngrediente.fecha.value !== "" ||
        filtrosIngrediente.ordenarNombre.value !== "az"; // Considerar si no es el valor por defecto

    filtrosIngrediente.limpiarBtn.classList.toggle("disabled", !hayFiltros);
    filtrosIngrediente.limpiarBtn.disabled = !hayFiltros;

    actualizarBadgesFiltroIng();
}

// Búsqueda por Nombre
filtrosIngrediente.buscar.addEventListener("input", () => {
    const texto = filtrosIngrediente.buscar.value.toLowerCase();
    document.querySelectorAll("#ingredients-list tr").forEach((fila) => {
        const nombre = fila.children[0].textContent.toLowerCase();
        fila.style.display = nombre.includes(texto) ? "" : "none";
    });
    actualizarEstadoBotonLimpiarIng();
});

// Filtro por Fecha de Registro
filtrosIngrediente.fecha.addEventListener("change", () => {
    const fecha = filtrosIngrediente.fecha.value;
    const fechaFormateada = formatDate(fecha); // Formatear la fecha del input a dd/mm/yyyy

    document.querySelectorAll("#ingredients-list tr").forEach((fila) => {
        const fechaRegistro = fila.children[2].textContent.trim();
        // Comparamos las fechas en el formato correcto
        fila.style.display = !fecha || fechaRegistro === fechaFormateada ? "" : "none";
    });

    actualizarEstadoBotonLimpiarIng();
});

// Función para formatear la fecha a dd/mm/yyyy
function formatDate(inputDate) {
    const dateParts = inputDate.split("-"); // Separamos la fecha en partes [yyyy, mm, dd]
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`; // Lo convertimos a dd/mm/yyyy
}

// Ordenar por Nombre (A-Z / Z-A)
filtrosIngrediente.ordenarNombre.addEventListener("change", () => {
    const orden = filtrosIngrediente.ordenarNombre.value;
    const tbody = document.getElementById("ingredients-list");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
        const nombreA = a.children[0].textContent.toLowerCase();
        const nombreB = b.children[0].textContent.toLowerCase();
        return orden === "az" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    });

    // Volver a añadir las filas ordenadas a la tabla
    filas.forEach((fila) => tbody.appendChild(fila));
    actualizarEstadoBotonLimpiarIng();
});


// Limpiar filtros
filtrosIngrediente.limpiarBtn.addEventListener("click", () => {
    if (filtrosIngrediente.limpiarBtn.classList.contains("disabled")) return;

    const original = filtrosIngrediente.limpiarBtn.innerHTML;
    filtrosIngrediente.limpiarBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Limpiando...`;
    filtrosIngrediente.limpiarBtn.disabled = true;

    setTimeout(() => {
        filtrosIngrediente.buscar.value = "";
        filtrosIngrediente.fecha.value = "";
        filtrosIngrediente.ordenarNombre.value = "az"; // Resetear el orden también

        filtrosIngrediente.buscar.dispatchEvent(new Event("input"));
        filtrosIngrediente.fecha.dispatchEvent(new Event("change"));
        filtrosIngrediente.ordenarNombre.dispatchEvent(new Event("change"));

        filtrosIngrediente.limpiarBtn.innerHTML = original;
      //  filtrosIngrediente.limpiarBtn.classList.add("disabled");
        //filtrosIngrediente.limpiarBtn.disabled = true
    }, 600);
});


// Mostrar badges de filtros activos
function actualizarBadgesFiltroIng() {
    const contenedor = document.getElementById("filtros-activos-ing-general");
    const badgeNombre = document.getElementById("badge-nombre-ingrediente");
    const badgeFecha = document.getElementById("badge-fecha-ingrediente");
    const badgeOrden = document.getElementById("badge-orden-ingrediente");

    let hay = false;

    animarTablaIngredientes();
    // Nombre
    if (filtrosIngrediente.buscar.value) {
        badgeNombre.querySelector("span").textContent = filtrosIngrediente.buscar.value;
        badgeNombre.classList.remove("d-none");
        hay = true;
    } else {
        badgeNombre.classList.add("d-none");
    }

    // Fecha
    if (filtrosIngrediente.fecha.value) {
        badgeFecha.querySelector("span").textContent = filtrosIngrediente.fecha.value;
        badgeFecha.classList.remove("d-none");
        hay = true;
    } else {
        badgeFecha.classList.add("d-none");
    }
    // Orden
    if (filtrosIngrediente.ordenarNombre.value) {
        badgeOrden.querySelector("span").textContent = filtrosIngrediente.ordenarNombre.value === "az" ? "A - Z" : "Z - A";
        badgeOrden.classList.remove("d-none");
        hay = true;
    } else {
        badgeOrden.classList.add("d-none");
    }

    contenedor.classList.toggle("d-none", !hay);
}

function animarTablaIngredientes() {
    const tabla = document.getElementById("ingredients-list");
    tabla.classList.add("resaltar-tabla");
    setTimeout(() => tabla.classList.remove("resaltar-tabla"), 1000);
}
