import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { ref, storage, uploadBytes, getDownloadURL } from "./firebase-config.js"
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo, showLoading } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";
import { cargarIngredientes } from "./ingredientes.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedProductRow = null;
let selectedProductId = null;

// Hacer accesibles globalmente las funciones necesarias
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.updateIngredientsList = updateIngredientsList;
window.updateIngredientQuantity = updateIngredientQuantity;
window.removeIngredientFromProduct = removeIngredientFromProduct;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    setupProductRowSelection();
    cargarProductos();

    // Evento para agregar producto
    document.getElementById("btn-agregar-producto").addEventListener("click", () => {
        clearProductSelection();
        showProductForm();
    });

    // Evento para formulario
    document.getElementById("product-form").addEventListener("submit", gestionarProducto);

    // Deseleccionar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#products-list') && !e.target.closest('.product-actions')) {
            clearProductSelection();
        }
    });
});

// 📌 Mostrar el formulario de producto dentro del modal
export function showProductForm(/*product = null*/) {
    const modal = new bootstrap.Modal(document.getElementById("productModal"));
    modal.show(); // Mostrar el modal de producto

    document.getElementById("product-form").reset();
    document.getElementById("product-image-preview").src = ""; // Limpiar la vista previa de la imagen
    document.getElementById("selected-ingredients-list").innerHTML = ''; //limpiamos lista de ingredientes
    document.getElementById("productModalLabel").innerText = "Agregar Producto"; // Cambiar título
    document.querySelector("#product-form button[type='submit']").innerText = "Guardar Producto"; // Cambiar texto del botón
    document.getElementById("product-form").dataset.productId = ""; // Limpiar el ID
    // Ocultar todos los inputs de cantidad (inicialmente)
    const quantityInputs = document.querySelectorAll(".ingredient-quantity");
    quantityInputs.forEach(input => {
        input.style.display = "none"; // Ocultar todos los inputs de cantidad
    });
    // Cargar las categorías al abrir el formulario
    cargarCategorias();
}

// 📌 Función para gestionar el producto (crear o actualizar)
export async function gestionarProducto(event) {
    event.preventDefault();

    const idProducto = document.getElementById("product-form").dataset.productId;
    const nombre = document.getElementById("product-name").value.trim();
    const precio = parseFloat(document.getElementById("product-price").value);
    const stock = parseInt(document.getElementById("product-stock").value);
    const categoria = document.getElementById("product-category").value; // Obtener el ID de la categoría seleccionada
    // Obtener los ingredientes seleccionados y sus cantidades
    const ingredientes = Array.from(document.querySelectorAll("#product-ingredients input[type='checkbox']:checked"));
    const ingredientesSeleccionados = ingredientes.map(checkbox => checkbox.value);  // Ingredientes seleccionados

    // Obtener las cantidades de los ingredientes seleccionados
    const cantidades = ingredientes.map(checkbox => {
        const ingredientId = checkbox.value;
        const quantityInput = document.getElementById(`quantity-${ingredientId}`);
        return quantityInput ? quantityInput.value : 0; // Obtener la cantidad de cada ingrediente
    });

    const imagenFile = document.getElementById("product-image").files[0]; // Imagen seleccionada

    // Validación básica
    /*   if (!nombre || !precio || !stock || !categoria) {
           alert("⚠️ Todos los campos son obligatorios.");
           return;
       }*/

    try {
        let imagenURL = "";  // Inicializamos la URL de la imagen

        // Si se selecciona una nueva imagen, subimos la imagen
        if (imagenFile) {
            const storageRef = ref(storage, `productos/${imagenFile.name}`);
            const uploadTask = await uploadBytes(storageRef, imagenFile);  // Subimos la imagen
            imagenURL = await getDownloadURL(storageRef);  // Obtenemos la URL de la imagen
        } else {
            // Si no se selecciona una nueva imagen, mantenemos la imagen actual
            imagenURL = document.getElementById("product-image-preview").src;  // Mantener la imagen actual
        }

        const formData = {
            nombre,
            precio,
            stock,
            categoria,
            ingredientes: ingredientesSeleccionados,  // Ingredientes seleccionados
            cantidades,  // Cantidades de los ingredientes
            imagen_url: imagenURL
        };

        // Calculando el precio unitario y total
     //   const { costoTotal, costoUnitario } = await calcularCostoProducto(ingredientesSeleccionados, cantidades, stock);

      //  console.log(`Costo total: $${costoTotal}, Costo unitario: $${costoUnitario}`);

        // Validación de precio y total antes de proceder
    //    if (isNaN(costoUnitario) || isNaN(costoTotal)) {
      //      throw new Error("El precio unitario o el precio total no son válidos.");
      //  }

        // Guardar el producto con los nuevos valores de precio unitario y total
     //   formData.precio_unitario = costoUnitario;
      //  formData.precio_total = costoTotal;

        // Si el producto tiene un ID (editando un producto)
        if (idProducto) {
            // Actualizar el producto en la base de datos
            await actualizarProducto(idProducto, formData);
        } else {
            // Registrar el nuevo producto en la base de datos
            await agregarProducto(formData);
        }

        cargarProductos(); // 🔄 Recargar la lista de productos
        cargarIngredientes(); // 🔄 Recargar la lista de ingredientes

        // Limpiar el formulario y ocultarlo
        document.getElementById("product-form").reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById("productModal"));
        modal.hide(); // cerrar el modal de producto

        // Recargar y limpiar selección
      //  await cargarProductos();
        clearProductSelection();
    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    }
}

// Función para calcular el costo total y unitario del producto
async function calcularCostoProducto(ingredientesSeleccionados, cantidades, cantidadProducto) {
    let costoTotalProducto = 0;

    try {
        const detallesIngredientes = await Promise.all(ingredientesSeleccionados.map(async (ingredienteId, index) => {
            const cantidadUsada = cantidades[index];

            // Verificamos que la cantidad sea válida
            if (isNaN(cantidadUsada) || cantidadUsada <= 0) {
                console.error(`Cantidad inválida para el ingrediente ${ingredienteId}: ${cantidadUsada}`);
                return 0; // Si la cantidad es inválida, retornamos 0
            }

            // Obtener el precio total y la cantidad inicial del ingrediente desde Supabase
            const { data: ingrediente, error } = await supabase
                .from("ingredientes")
                .select("precio_total, cantidad_inicio") // Precio total y cantidad inicial en inventario
                .eq("id", ingredienteId)
                .single();

            if (error) {
                throw new Error(`Error al obtener el ingrediente con ID ${ingredienteId}`);
            }

            // Validar que el precio total sea un número válido
            const precioIngrediente = parseFloat(ingrediente.precio_total);  // Precio total del ingrediente
            const cantidadIngrediente = parseFloat(ingrediente.cantidad_inicio);  // Cantidad comprada del ingrediente

            if (isNaN(precioIngrediente) || isNaN(cantidadIngrediente)) {
                console.error(`Precio o cantidad inválido para el ingrediente ${ingredienteId}`);
                return 0; // Si el precio o cantidad no son válidos, retornamos 0
            }

            // Calcular el precio unitario del ingrediente
            const precioUnitarioIngrediente = precioIngrediente / cantidadIngrediente;

            // Calcular el costo de este ingrediente para la cantidad que usamos
            return precioUnitarioIngrediente * cantidadUsada;
        }));

        // Sumar los costos de todos los ingredientes seleccionados
        costoTotalProducto = detallesIngredientes.reduce((total, precio) => total + precio, 0);

        // Verificar si el costo total es válido
        if (isNaN(costoTotalProducto)) {
            console.error("El costo total calculado es NaN");
            return { costoTotal: 0, costoUnitario: 0 };  // Retorna 0 si el cálculo falla
        }

        // Costo unitario por producto (costo total dividido por la cantidad de productos)
        const costoUnitario = costoTotalProducto / cantidadProducto;

        return { costoTotal: costoTotalProducto, costoUnitario: costoUnitario };

    } catch (error) {
        console.error("Error calculando el costo del producto:", error);
        return { costoTotal: 0, costoUnitario: 0 };  // Retorna 0 si ocurre un error
    }
}

// Función para calcular el precio unitario del producto
async function calcularPrecioUnitario(ingredientesSeleccionados, cantidades) {
    let precioUnitario = 0;
    // Recuperamos los detalles de los ingredientes seleccionados
    try {
        const ingredientesDetalles = await Promise.all(ingredientesSeleccionados.map(async (ingredienteId, index) => {
            // Verificar que la cantidad sea un valor válido
            const cantidadIngrediente = cantidades[index];
            if (isNaN(cantidadIngrediente) || cantidadIngrediente <= 0) {
                console.error(`Cantidad inválida para el ingrediente ${ingredienteId}: ${cantidadIngrediente}`);
                return 0; // Si la cantidad no es válida, retornamos 0
            }
            // Obtener el precio total y la cantidad en stock del ingrediente desde Supabase
            const { data: ingrediente, error } = await supabase
                .from("ingredientes")
                .select("precio_total, cantidad_inicio")
                .eq("id", ingredienteId)
                .single(); // Aseguramos que estamos obteniendo solo un ingrediente por ID

            if (error) {
                throw new Error(`Error al obtener el ingrediente con ID ${ingredienteId}`);
            }

            // Mostrar los datos recuperados para depuración
            console.log(`Ingrediente ID: ${ingredienteId}, Precio Total: ${ingrediente.precio_total}, Stock: ${ingrediente.cantidad_inicio}`);

            // Validar que el precio sea un número válido
            const precioIngrediente = parseFloat(ingrediente.precio_total);
            if (isNaN(precioIngrediente)) {
                console.error(`Precio inválido para el ingrediente ${ingredienteId}: ${ingrediente.precio_total}`);
                return 0; // Si el precio no es válido, retornamos 0
            }

            return precioIngrediente * cantidadIngrediente; // Retornamos el costo de este ingrediente
        }));

        // Sumar los precios de todos los ingredientes seleccionados
        precioUnitario = ingredientesDetalles.reduce((total, precio) => total + precio, 0);
        // Verificamos si el precio unitario es válido
        if (isNaN(precioUnitario)) {
            console.error("El precio unitario calculado es NaN");
            return 0; // Si no es válido, retornamos 0
        }
        return precioUnitario;

    } catch (error) {
        console.error("Error calculando el precio unitario:", error);
        return 0; // Retorna 0 si ocurre un error
    }
}

// Función para calcular el precio total del producto
function calcularPrecioTotal(precioUnitario, stock) {
    if (isNaN(precioUnitario) || isNaN(stock)) {
        console.error("Precio unitario o stock inválido:", precioUnitario, stock);
        return 0; // Si hay valores inválidos, retornamos 0
    }
    return precioUnitario * stock; // El precio total es el precio unitario multiplicado por el stock
}

// Crear un nuevo producto en la base de datos
async function agregarProducto(data) {
    try {
        console.log(data)
        const { data: product, error } = await supabase
            .from("productos")
            .insert([{
                nombre: data.nombre,
                precio: data.precio,
                precio_unitario: data.precio_unitario,  // Asegúrate de incluir este campo
                precio_total: data.precio_total,      // Asegúrate de incluir este campo
                stock: data.stock,
                categoria_id: data.categoria, // Guardar el ID de la categoría
                imagen_url: data.imagen_url,
            }])
            .select(); // Asegúrate de obtener los datos después de la inserción

        if (error) {
            console.error("❌ Error al insertar producto:", error);
            throw error;
        }

        // Verifica si el producto fue insertado correctamente
        if (!product || product.length === 0) {
            throw new Error("No se pudo insertar el producto.");
        }

        // Descontar los ingredientes del inventario
      //  await updateIngredientInventory(product[0].id, data.ingredientes, data.cantidades);

        // Relacionar los ingredientes con el producto
      //  await associateIngredientsWithProduct(product[0].id, data.ingredientes, data.cantidades);

        cargarIngredientes();
        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Producto agregado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    }
}

// Actualizar un producto existente en la base de datos
async function actualizarProducto(idProducto, data) {
    try {
        const { error } = await supabase
            .from("productos")
            .update({
                nombre: data.nombre,
                precio: data.precio,
                precio_unitario: data.precio_unitario,  // Asegúrate de incluir este campo
                precio_total: data.precio_total,      // Asegúrate de incluir este campo
                stock: data.stock,
                categoria_id: data.categoria, // Guardar el ID de la categoría
                imagen_url: data.imagen_url,
            })
            .eq("id", idProducto);

        if (error) {
            console.error("❌ Error al actualizar producto:", error);
            throw error;
        }

        console.log("Producto actualizado:", idProducto);

        // Descontar los ingredientes del inventario (solo si las cantidades cambiaron)
        await updateIngredientInventory(idProducto, data.ingredientes, data.cantidades);

        // Relacionar los ingredientes con el producto
        await associateIngredientsWithProduct(idProducto, data.ingredientes, data.cantidades);

        cargarIngredientes();
        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Producto actualizado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al actualizar el producto:", error);
        mostrarToast("❌ Error al actualizar el producto", "error");
    }
}

// Asociar ingredientes con un producto
async function associateIngredientsWithProduct(productId, ingredientIds, cantidades) {
    // Primero, eliminamos las relaciones anteriores
    await supabase
        .from("productos_ingredientes")
        .delete()
        .eq("producto_id", productId);

    // Luego insertamos las nuevas relaciones con sus cantidades
    for (let i = 0; i < ingredientIds.length; i++) {
        const { error } = await supabase
            .from("productos_ingredientes")
            .upsert({
                producto_id: productId,
                ingrediente_id: ingredientIds[i],
                cantidad_usada: cantidades[i]  // Guardar la cantidad usada de cada ingrediente
            });

        if (error) throw error;
    }
}

// Función para descontar ingredientes del inventario
async function updateIngredientInventory(productId, ingredientIds, cantidades) {
    // Obtener los ingredientes previamente asociados al producto
    const { data: previousIngredients, error: previousIngredientsError } = await supabase
        .from("productos_ingredientes")
        .select("ingrediente_id, cantidad_usada")
        .eq("producto_id", productId);

    if (previousIngredientsError) throw previousIngredientsError;

    // Si hay ingredientes previamente asociados al producto, comparamos las cantidades
    for (let i = 0; i < ingredientIds.length; i++) {
        const ingredientId = ingredientIds[i];  // ID del ingrediente
        const quantity = cantidades[i];  // Cantidad a usar de ese ingrediente

        // Verificamos si el ingrediente ya existía en el producto
        const previousIngredient = previousIngredients.find(item => item.ingrediente_id === ingredientId);

        // Si el ingrediente no existía previamente, lo descontamos por completo
        if (!previousIngredient) {
            console.log("inredientid", ingredientId, " quantity", quantity);
            await decreaseInventory(ingredientId, quantity);
        } else {
            // Si el ingrediente ya existía, calculamos la diferencia de cantidad
            const difference = quantity - previousIngredient.cantidad_usada;
            console.log("previo", previousIngredient)
            console.log("difference= " + difference, " ", quantity, " - ", previousIngredient.cantidad_usada)
            // Si la cantidad ha aumentado, restamos la diferencia del inventario
            if (difference !== 0) {
                await decreaseInventory(ingredientId, difference);
                console.log("ingredientid", ingredientId, difference)
            }
        }
    }
}

// Función para descontar la cantidad de un ingrediente del inventario
async function decreaseInventory(ingredientId, quantity) {
    // Obtener el ingrediente desde Supabase
    const { data: ingredient, error } = await supabase
        .from("ingredientes")
        .select("id, cantidad")
        .eq("id", ingredientId)
        .single();

    if (error || !ingredient) {
        throw new Error("No se pudo obtener el ingrediente.");
    }

    // Restar la cantidad de ingrediente usado
    const newQuantity = ingredient.cantidad - quantity;
    console.log("new=", newQuantity, " ingredient.cantidad", ingredient.cantidad, " - canridad ", quantity) // Aquí usamos la cantidad correspondiente
    if (newQuantity < 0) {
        throw new Error("No hay suficiente cantidad en inventario.");
    }

    // Actualizar el inventario con la nueva cantidad
    const { error: updateError } = await supabase
        .from("ingredientes")
        .update({ cantidad: newQuantity })
        .eq("id", ingredientId);

    if (updateError) throw updateError;

    console.log("descontado con exito´'segun")
}


// Función para preseleccionar ingredientes en edición
async function editarProducto(idProducto) {
    console.log("editando Producto:", idProducto);
    showProductForm();
    selectProductRow(idProducto);

    // Obtener los detalles del producto desde Supabase
    const { data: producto, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", idProducto)
        .single();

    if (error) throw error;

    // Llenar los campos del formulario con los detalles del producto
    document.getElementById("product-name").value = producto.nombre;
    document.getElementById("product-price").value = producto.precio;
    document.getElementById("product-stock").value = producto.stock;
    document.getElementById("product-category").value = producto.categoria;

    // Mostrar la imagen si existe
    const imagen = producto.imagen_url ? producto.imagen_url : ""; // Imagen por defecto si no tiene imagen
    document.getElementById("product-image-preview").src = imagen; // Mostrar la imagen en el formulario

    // Obtener los ingredientes del producto desde la tabla productos_ingredientes
    const { data: ingredientes, error: ingredientesError } = await supabase
        .from("productos_ingredientes")
        .select("ingrediente_id, cantidad_usada")
        .eq("producto_id", idProducto);

    if (ingredientesError) throw ingredientesError;

    // Obtener los checkboxes de ingredientes
    const ingredientCheckboxes = document.querySelectorAll("#product-ingredients input[type='checkbox']");

    // Pre-seleccionar los checkboxes de los ingredientes que ya están asociados al producto
    ingredientCheckboxes.forEach(checkbox => {
        // Marcar el checkbox si el ingrediente está asociado al producto
        ingredientes.forEach(ingrediente => {
            if (checkbox.value == ingrediente.ingrediente_id) {
                checkbox.checked = true;

                // Obtener el input de cantidad correspondiente al checkbox seleccionado
                const quantityInput = document.getElementById(`quantity-${ingrediente.ingrediente_id}`);
                if (quantityInput) {
                    quantityInput.value = ingrediente.cantidad_usada; // Actualizar el valor con la cantidad usada
                    quantityInput.style.display = "block"; // Asegurar que esté visible
                }

                console.log("Ingrediente seleccionado:", ingrediente);
            }
        });
    });

    // Cambiar el título del modal y el botón de acción
    document.getElementById("productModalLabel").innerText = "Editar Producto";
    document.querySelector('#product-form button[type="submit"]').innerText = "Actualizar Producto";

    const formulario = document.getElementById("product-form");
    formulario.dataset.productId = idProducto;
}


// ✏️ Carga los datos de un producto para editar
async function removeIngredientFromProduct(ingredientId) {
    const idProducto = document.getElementById("product-form").dataset.productId;

    // Eliminar el ingrediente de la base de datos (relación con el producto)
    const { error } = await supabase
        .from("productos_ingredientes")
        .delete()
        .eq("producto_id", idProducto)
        .eq("ingrediente_id", ingredientId);

    if (error) {
        console.error("❌ Error al eliminar ingrediente:", error);
        mostrarToast("❌ Error al eliminar ingrediente", "error");
    } else {
        // Recargar la lista de ingredientes
        cargarProductos();
        cargarIngredientes();
        mostrarToast("✅ Ingrediente eliminado correctamente", "success");
    }
}


// 🗑️ Elimina un producto con confirmación
async function eliminarProducto(idProducto) {
    console.log("elminando Prodcuto:", idProducto);
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('deleteProductModal'));
    modal.show();

    // Manejar el evento de confirmación del modal
    document.getElementById("confirm-delete-btn-producto").addEventListener("click", async () => {
        try {
            // Llamar a la función de eliminación
            await eliminarProductoBackend(idProducto);  // Llamada a la función que elimina el producto de la DB
            modal.hide(); // Cerrar el modal después de la eliminación
            clearProductSelection();
        } catch (error) {
            console.error("❌ Error al eliminar el producto:", error);
            mostrarToast(`❌ Error al eliminar el producto.`, "error");
        }
    });

    // Función para eliminar el producto desde Supabase
    async function eliminarProductoBackend(idProducto) {
        try {
            const { error: eliminarRelacionesError } = await supabase
                .from("productos_ingredientes")
                .delete()
                .eq("producto_id", idProducto);

            if (eliminarRelacionesError) {
                throw new Error("No se pudieron eliminar las relaciones del producto con los ingredientes.");
            }

            const { error: eliminarProductoError } = await supabase
                .from("productos")
                .delete()
                .eq("id", idProducto);

            if (eliminarProductoError) {
                throw new Error("No se pudo eliminar el producto.");
            }

            // Recargar la lista de productos después de eliminar
            cargarProductos();
            cargarIngredientes();
            // Mostrar mensaje de éxito
            mostrarToast("✅ Producto eliminado correctamente.", "success");
        } catch (error) {
            console.error("❌ Error al eliminar el producto:", error);
            mostrarToast(`❌ Error: ${error.message}`, "error");
        }
    }
}

// Función para agregar o editar el producto con los ingredientes
export async function loadIngredients() {
    const { data, error } = await supabase
        .from("ingredientes")
        .select("*");

    if (error) throw error;

    const ingredientsCheckboxContainer = document.getElementById("product-ingredients"); // Contenedor de checkboxes

    // Limpiar el contenedor de ingredientes antes de agregar nuevos
    ingredientsCheckboxContainer.innerHTML = '';

    // Crear un checkbox por cada ingrediente disponible
    data.forEach(ingredient => {
        const ingredientElement = document.createElement("div");
        ingredientElement.classList.add("ingredient-item");

        // Crear el checkbox para el ingrediente
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `ingredient-${ingredient.id}`;
        checkbox.value = ingredient.id;

        // Crear el label con el nombre del ingrediente, stock y medida
        const label = document.createElement("label");
        label.setAttribute("for", checkbox.id);
        label.textContent = `${ingredient.nombre} - Stock: ${ingredient.cantidad} ${ingredient.medida}`;

        // Crear el campo de cantidad (inicialmente oculto)
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.id = `quantity-${ingredient.id}`;
        quantityInput.classList.add("form-control", "ingredient-quantity");
        quantityInput.placeholder = "Cantidad";
        quantityInput.min = 0;
        quantityInput.style.display = "none"; // Inicialmente oculto

        // Agregar el checkbox y el input de cantidad al contenedor
        ingredientElement.appendChild(checkbox);
        ingredientElement.appendChild(label);
        ingredientElement.appendChild(quantityInput);

        // Añadir el item al contenedor de ingredientes
        ingredientsCheckboxContainer.appendChild(ingredientElement);

        // Agregar el evento para mostrar/ocultar el input de cantidad al seleccionar/deseleccionar
        checkbox.addEventListener("change", function () {
            const quantityField = document.getElementById(`quantity-${ingredient.id}`);
            if (checkbox.checked) {
                // Mostrar el campo de cantidad cuando el checkbox es seleccionado
                quantityField.style.display = "block";
            } else {
                // Ocultar el campo de cantidad cuando el checkbox es deseleccionado
                quantityField.style.display = "none";
            }
        });
    });
}

// 📌 Función para actualizar la lista de ingredientes seleccionados
export function updateIngredientsList() {
    const selectedIngredients = Array.from(document.getElementById("product-ingredients").selectedOptions);
    const ingredientsListContainer = document.getElementById("selected-ingredients-list");

    ingredientsListContainer.innerHTML = ''; // Limpiar la lista de ingredientes

    // Recorrer los ingredientes seleccionados y mostrar su nombre, medida y cantidad editable
    selectedIngredients.forEach((ingredient) => {
        const ingredientId = ingredient.value; // Obtener el ID del ingrediente
        const ingredientText = ingredient.textContent; // Obtener el nombre del ingrediente
        const ingredientMeasure = ingredient.getAttribute("data-medida"); // Obtener la medida desde el atributo data

        const ingredientElement = document.createElement("div");
        ingredientElement.classList.add("ingredient-item");

        // Crear el campo para cantidad con ID único y añadir un event listener
        const ingredientInput = document.createElement("input");
        ingredientInput.type = "number";
        ingredientInput.id = `ingredient-${ingredientId}`;
        ingredientInput.classList.add("form-control", "ingredient-quantity");
        ingredientInput.placeholder = "Cantidad";
        ingredientInput.min = "0";
        ingredientInput.value = "0"; // Valor inicial
        ingredientInput.addEventListener("change", function () {
            updateIngredientQuantity(ingredientId); // Al cambiar la cantidad, actualizamos
        });

        // Añadir la cantidad al elemento
        ingredientElement.innerHTML = `
            <label for="ingredient-${ingredientId}">${ingredientText}</label>
            <small class="text-muted">Medida: ${ingredientMeasure}</small>
        `;

        // Añadir el input de cantidad
        ingredientElement.appendChild(ingredientInput);

        ingredientsListContainer.appendChild(ingredientElement);
    });
}

// 📌 Función para actualizar la cantidad de un ingrediente
export function updateIngredientQuantity(ingredientId) {
    const quantityInput = document.getElementById(`ingredient-${ingredientId}`);
    const quantity = quantityInput.value; // Obtener la cantidad ingresada

    // Verifica si la cantidad es válida y actualiza el array de ingredientes (o cualquier estructura de datos que uses)
    if (quantity >= 0) {
        // Aquí puedes actualizar tu estructura de datos, por ejemplo:
        // selectedIngredients[ingredientId].quantity = quantity;
        console.log(`Actualizado el ingrediente con ID ${ingredientId} a ${quantity}`);
    } else {
        alert("⚠️ La cantidad no puede ser negativa.");
    }
}

// Cargar las categorías desde la base de datos
async function cargarCategorias() {
    try {
        // Obtener las categorías desde Supabase
        const { data: categorias, error } = await supabase.from("categorias").select("*");

        if (error) throw error;

        const selectCategoria = document.getElementById("product-category");
        selectCategoria.innerHTML = ''; // Limpiar las opciones previas

        // Añadir la opción "Seleccionar categoría" como primer valor
        const defaultOption = document.createElement("option");
        defaultOption.text = "Seleccionar Categoría";
        selectCategoria.appendChild(defaultOption);

        // Crear una opción para cada categoría
        categorias.forEach(categoria => {
            const option = document.createElement("option");
            option.value = categoria.id;
            option.text = categoria.nombre;
            selectCategoria.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar categorías:", error);
    }
}

// 📋 Carga la lista de productos
export async function cargarProductos() {
    try {
        // 🔹 Obtener los productos desde Supabase
        const { data: productos, error: productosError } = await supabase
            .from("productos")
            .select("id, nombre, precio, precio_unitario, precio_total, stock, categoria:categoria_id(nombre), imagen_url");

        if (productosError) throw productosError;

        // 📌 Recorrer cada producto y obtener sus ingredientes y cantidades
        for (let i = 0; i < productos.length; i++) {
            const { data: ingredientes, error: ingredientesError } = await supabase
                .from("productos_ingredientes")
                .select("ingrediente_id, cantidad_usada")
                .eq("producto_id", productos[i].id);

            if (ingredientesError) throw ingredientesError;

            // Obtener los nombres de los ingredientes y sus medidas
            const ingredientesDetalles = await Promise.all(ingredientes.map(async (ingrediente) => {
                const { data: ingredienteData, error: ingredienteError } = await supabase
                    .from("ingredientes")
                    .select("nombre, medida")
                    .eq("id", ingrediente.ingrediente_id)
                    .single(); // Obtener un solo ingrediente

                if (ingredienteError) throw ingredienteError;

                return {
                    nombre: ingredienteData.nombre,
                    cantidad: ingrediente.cantidad_usada,
                    medida: ingredienteData.medida // Obtener también la medida
                };
            }));

            // Guardamos los ingredientes y sus cantidades en el producto
            productos[i].ingredientes = ingredientesDetalles;
        }

        // 📌 Llenar la tabla con los productos y sus ingredientes
        const tablaProductos = document.getElementById("products-list");
        tablaProductos.innerHTML = ""; // Limpiar tabla antes de agregar los nuevos productos

        // 📌 Recorrer los productos y agregarlos a la tabla
        productos.forEach((producto) => {
            // Si la imagen está disponible, la mostramos; si no, mostramos una imagen por defecto
            const imagen = producto.imagen_url ? producto.imagen_url : "";

            // Crear una fila para el producto
            const fila = document.createElement("tr");
            fila.dataset.id = producto.id;  // Añadir data-id para selección

            // Crear las celdas de la fila con la información del producto
            const ingredientesText = producto.ingredientes.map((ingredient) => {
                return `${ingredient.nombre}: ${ingredient.cantidad} ${ingredient.medida} x `;
            }).join(", ");

            // Mostrar el nombre de la categoría en lugar del ID
            const categoriaNombre = producto.categoria ? producto.categoria.nombre : "Sin Categoría";

            fila.innerHTML = `
                <td><img src="${imagen}" alt="${producto.nombre}" class="img-thumbnail"></td>
                <td>${producto.nombre}</td>
                <td>${categoriaNombre}</td>
                <td>$${producto.precio}</td>
                <td>${producto.stock}</td>
                <td>${ingredientesText}</td>
                <td>$${producto.precio_unitario}</td>
                <td>$${producto.precio_total}</td>
            `;

            // Agregar la fila a la tabla
            tablaProductos.appendChild(fila);
        });
    } catch (error) {
        console.error("❌ Error al cargar productos:", error);
        mostrarToast(`❌ Error al cargar productos`, "error");
    }
}

//🖱️ Configura la selección de filas
function setupProductRowSelection() {
    const table = document.getElementById('products-list');
    if (!table) return;

    table.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;

        const productId = row.dataset.id;
        if (selectedProductId === productId) {
            clearProductSelection();
        } else {
            selectProductRow(productId);
        }
    });

    const deleteBtn = document.getElementById('delete-product-btn');
    const editBtn = document.getElementById('edit-product-btn');

    // Evento para el botón de eliminar
    deleteBtn.addEventListener('click', () => {
        if (selectedProductId) {
            eliminarProducto(selectedProductId);
        }
    });

    // Evento para el botón de editar
    editBtn.addEventListener('click', () => {
        if (selectedProductId) {
            editarProducto(selectedProductId);
        }
    });
}

//🔘 Selecciona una fila de producto
function selectProductRow(productId) {
    clearProductSelection();

    const row = document.querySelector(`#products-list tr[data-id="${productId}"]`);
    if (!row) return;

    row.classList.add('selected-row');
    selectedProductRow = row;
    selectedProductId = productId;

    // Mostrar botones de acción
    const deleteBtn = document.getElementById('delete-product-btn');
    const editBtn = document.getElementById('edit-product-btn');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (editBtn) editBtn.style.display = 'inline-block';
}

//🧹 Limpia la selección actual
function clearProductSelection() {
    if (selectedProductRow) {
        selectedProductRow.classList.remove('selected-row');
        selectedProductRow = null;
        selectedProductId = null;
    }

    // Ocultar botones de acción
    const deleteBtn = document.getElementById('delete-product-btn');
    const editBtn = document.getElementById('edit-product-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
}