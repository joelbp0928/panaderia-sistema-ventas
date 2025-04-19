import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { ref, storage, uploadBytes, getDownloadURL, deleteObject } from "./firebase-config.js"
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo, showLoading, hideLoading } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedProductRow = null;
let selectedProductId = null;
// Inicializar al cargar la página
let productModal;
// Hacer accesibles globalmente las funciones necesarias
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.updateIngredientsList = updateIngredientsList;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    setupProductRowSelection();
    cargarProductos();
    productModal = configurarModalProducto();
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
export function showProductForm() {
    limpiarErrorCampo([
        "product-category"
    ]);
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
    // Mostrar modal
    productModal.show();
}

// 📌 Función para gestionar el producto (crear o actualizar)
export async function gestionarProducto(event) {
    event.preventDefault();

    const formData = obtenerDatosFormulario();
    if (!validarFormulario(formData)) return;

    try {
        showLoading();

        if (formData.imagenFile) {
            formData.imagen_url = await manejarImagen(formData.imagenFile, formData.nombre, formData.idProducto);
        }

        const { costoTotal, costoUnitario } = await calcularCostoProducto(formData.ingredientes, formData.cantidades, formData.stock);
        formData.precio_total = costoTotal;
        formData.precio_unitario = costoUnitario;

        if (formData.idProducto) {
            await actualizarProducto(formData.idProducto, formData);
            await deleteProductoIngredientes(formData.idProducto);

            await createProductoIngredientes(formData.idProducto, formData.ingredientes, formData.cantidades);
        } else {
            const newId = await agregarProducto(formData);

            await createProductoIngredientes(newId, formData.ingredientes, formData.cantidades);
        }

        mostrarToast("✅ Producto guardado correctamente", "success");
        limpiarYOcultarFormulario();
        cargarProductos(true);
    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    } finally {
        hideLoading();
    }
}

function obtenerDatosFormulario() {
    const form = document.getElementById("product-form");
    const idProducto = form.dataset.productId || null;
    const nombre = document.getElementById("product-name").value.trim();
    const precio = parseFloat(document.getElementById("product-price").value);
    const stock = parseInt(document.getElementById("product-stock").value);
    const categoria = document.getElementById("product-category").value;
    const imagenFile = document.getElementById("product-image").files[0];

    const ingredientes = Array.from(document.querySelectorAll("#product-ingredients input[type='checkbox']:checked"))
        .map(cb => cb.value);
    const cantidades = ingredientes.map(id => {
        const input = document.getElementById(`quantity-${id}`);
        return input ? parseFloat(input.value) || 0 : 0;
    });

    return {
        idProducto,
        nombre,
        precio,
        stock,
        categoria,
        imagenFile,
        imagen_url: document.getElementById("product-image-preview").src || "",
        ingredientes,
        cantidades
    };
}

function validarFormulario({ nombre, precio, stock, categoria, ingredientes, imagenFile }) {
    limpiarErrorCampo([
        "product-category"
    ]);
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        mostrarToast("⚠️ Todos los campos son obligatorios", "error");
        return false;
    }

    if (categoria === "" || categoria === "Seleccionar Categoría") {
        mostrarToast("⚠️ Por favor selecciona una categoría", "error");
        marcarErrorCampo("product-category", "⚠️ Por favor selecciona una categoría")
        return false;
    }

    if (ingredientes.length === 0) {
        mostrarToast("⚠️ Debes seleccionar al menos un ingrediente", "error");
        return false;
    }

    if (imagenFile) {
        if (!ALLOWED_TYPES.includes(imagenFile.type)) {
            mostrarToast("⚠️ Tipo de imagen no permitido", "error");
            return false;
        }
        if (imagenFile.size > MAX_SIZE_BYTES) {
            mostrarToast("⚠️ La imagen excede los 2MB permitidos", "error");
            return false;
        }
    }

    return true;
}

async function manejarImagen(file, nombreProducto, idProducto) {
    try {
        const nombreUnico = generarNombreUnico(file.name);
        const storageRef = ref(storage, `productos/${nombreUnico}`);

        const metadata = {
            contentType: file.type,
            customMetadata: {
                uploadedBy: 'admin',
                productName: nombreProducto
            }
        };

        await uploadBytes(storageRef, file, metadata);
        const url = await getDownloadURL(storageRef);

        if (idProducto) await eliminarImagenAnterior(idProducto);

        return url;
    } catch (error) {
        console.error("❌ Error al manejar la imagen:", error);
        mostrarToast("❌ Error al subir la imagen", "error");
        throw error;
    }
}

async function eliminarImagenAnterior(idProducto) {
    const imagenAnterior = document.getElementById("product-image-preview").dataset.originalUrl;
    if (imagenAnterior && imagenAnterior.includes('firebasestorage.googleapis.com')) {
        try {
            const url = new URL(imagenAnterior);
            const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
            const oldImageRef = ref(storage, path);
            await deleteObject(oldImageRef);
        } catch (error) {
            console.warn("⚠️ No se pudo eliminar la imagen anterior:", error);
        }
    }
}

function limpiarYOcultarFormulario() {
    document.getElementById("product-form").reset();
    productModal.hide();
    clearProductSelection();
}

async function calcularPrecioCantidadUsada(ingredienteId, cantidadUsada) {
    const { data: ingrediente, error } = await supabase
        .from("ingredientes")
        .select("precio_total, cantidad")
        .eq("id", ingredienteId)
        .single();

    if (error || !ingrediente) {
        throw new Error(`No se pudo obtener el ingrediente con ID ${ingredienteId}`);
    }

    const precioTotal = parseFloat(ingrediente.precio_total);
    const cantidad = parseFloat(ingrediente.cantidad);

    if (isNaN(precioTotal) || isNaN(cantidad) || cantidad === 0) {
        throw new Error(`Datos inválidos para el ingrediente ${ingredienteId}`);
    }

    const precioUnitario = precioTotal / cantidad;
    return precioUnitario * cantidadUsada;
}


// Función para calcular el costo total y unitario del producto
async function calcularCostoProducto(ingredientesSeleccionados, cantidades, cantidadProducto) {
    let costoTotalProducto = 0;

    try {
        const detallesIngredientes = await Promise.all(ingredientesSeleccionados.map(async (ingredienteId, index) => {
            const cantidadUsada = cantidades[index];

            // Obtener el precio total y la cantidad inicial del ingrediente desde Supabase
            const { data: ingrediente, error } = await supabase
                .from("ingredientes")
                .select("precio_total, cantidad")
                .eq("id", ingredienteId)
                .single();

            if (error) {
                throw new Error(`Error al obtener el ingrediente con ID ${ingredienteId}`);
            }

            const precioIngrediente = parseFloat(ingrediente.precio_total);
            //   const cantidadIngrediente = parseFloat(ingrediente.cantidad_inicio);
            const cantidadIngrediente = parseFloat(ingrediente.cantidad);

            const precioUnitarioIngrediente = precioIngrediente / cantidadIngrediente;
            const precioCantidadUsada = precioUnitarioIngrediente * cantidadUsada;

            // Retornar el costo de este ingrediente
            return precioCantidadUsada;
        }));

        // Sumar los costos de todos los ingredientes seleccionados
        costoTotalProducto = detallesIngredientes.reduce((total, precio) => total + precio, 0);

        const costoUnitario = costoTotalProducto / cantidadProducto;

        return {
            costoTotal: parseFloat(costoTotalProducto.toFixed(2)),
            costoUnitario: parseFloat(costoUnitario.toFixed(2))
        };
    } catch (error) {
        console.error("Error calculando el costo del producto:", error);
        return { costoTotal: 0, costoUnitario: 0 };  // Retorna 0 si ocurre un error
    }
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

        // Ahora, obtenemos el ID del producto recién creado
        const newProduct = product[0].id;

        // cargarIngredientes();
        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Producto agregado correctamente.", "success");
        return newProduct;
    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    }
}

// Actualizar un producto existente en la base de datos
async function actualizarProducto(idProducto, data) {
    try {
        console.log(data.categoria)
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

        //  cargarIngredientes();
        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Producto actualizado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al actualizar el producto:", error);
        mostrarToast("❌ Error al actualizar el producto", "error");
    }
}

// Función para preseleccionar ingredientes en edición
async function editarProducto(idProducto) {
    console.log("editando Producto:", idProducto);
    showProductForm();
    selectProductRow(idProducto);

    // Obtener los detalles del producto desde Supabase
    const { data: producto, error } = await supabase
        .from("productos")
        .select(`*, categoria:categoria_id (id, nombre)`)
        .eq("id", idProducto)
        .single();

    if (error) throw error;

    // Llenar los campos del formulario con los detalles del producto
    document.getElementById("product-name").value = producto.nombre;
    document.getElementById("product-price").value = producto.precio;
    document.getElementById("product-stock").value = producto.stock;
    console.log(producto.categoria_id)
    document.getElementById("product-category").value = producto.categoria.id;

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

/**
 * Crea nuevas relaciones producto-ingrediente
 * @param {number} productoId - ID del producto
 * @param {Array<number>} ingredientesIds - IDs de los ingredientes
 * @param {Array<number>} cantidades - Cantidades usadas de cada ingrediente
 * @returns {Promise<void>}
 */
export async function createProductoIngredientes(productoId, ingredientesIds, cantidades) {
    try {
        const relaciones = await Promise.all(
            ingredientesIds.map(async (ingredienteId, index) => {
                const cantidadUsada = cantidades[index];
                const precioCantidadUsada = await calcularPrecioCantidadUsada(ingredienteId, cantidadUsada);

                return {
                    producto_id: productoId,
                    ingrediente_id: ingredienteId,
                    cantidad_usada: cantidadUsada,
                    precio_cantidad_usada: precioCantidadUsada
                };
            })
        );

        const { error } = await supabase
            .from("productos_ingredientes")
            .insert(relaciones);

        if (error) throw error;
    } catch (error) {
        console.error("Error en createProductoIngredientes:", error);
        throw error;
    }
}


/**
 * Elimina todas las relaciones de un producto con ingredientes
 * @param {number} productoId - ID del producto
 * @returns {Promise<void>}
 */
export async function deleteProductoIngredientes(productoId) {
    try {
        const { error } = await supabase
            .from("productos_ingredientes")
            .delete()
            .eq("producto_id", productoId);

        if (error) throw error;
    } catch (error) {
        console.error("Error en deleteProductoIngredientes:", error);
        throw error;
    }
}

// 🗑️ Elimina un producto con confirmación
async function eliminarProducto(idProducto) {
    console.log("Eliminando producto:", idProducto);

    // Mostrar el modal de confirmación
    const modal = new bootstrap.Modal(document.getElementById('deleteProductModal'));
    modal.show();

    // Manejar el evento de confirmación del modal
    document.getElementById("confirm-delete-btn-producto").addEventListener("click", async () => {
        const success = await eliminarProductoBackend(idProducto);
        if (success) {
            modal.hide(); // Cerrar el modal solo si la eliminación fue exitosa
            clearProductSelection();
        }
    }, { once: true }); // Usamos {once: true} para que el evento se ejecute solo una vez
}

// 🗑️ Función mejorada para eliminar completamente un producto
async function eliminarProductoBackend(idProducto) {
    try {
        // 1. Primero obtenemos los datos del producto
        const { data: producto, error: productoError } = await supabase
            .from("productos")
            .select("imagen_url")
            .eq("id", idProducto)
            .single();

        if (productoError) throw productoError;

        // 2. Eliminar la imagen de Firebase Storage si existe
        if (producto.imagen_url) {
            try {
                // Método más robusto para extraer el path de Firebase Storage
                let imagePath = producto.imagen_url;

                // Si es una URL completa (https://...)
                if (producto.imagen_url.startsWith('http')) {
                    const url = new URL(producto.imagen_url);
                    // Extraer el path entre '/o/' y '?alt=media'
                    const pathMatch = url.pathname.match(/\/o\/(.+?)(?:\?|$)/);
                    if (pathMatch && pathMatch[1]) {
                        imagePath = decodeURIComponent(pathMatch[1]);
                    } else {
                        throw new Error("Formato de URL no reconocido");
                    }
                }
                // Si ya es un path directo (gs://...)
                else if (producto.imagen_url.startsWith('gs://')) {
                    imagePath = producto.imagen_url.replace('gs://', '');
                }

                const imageRef = ref(storage, imagePath);
                await deleteObject(imageRef);
                console.log("✅ Imagen eliminada de Firebase Storage:", imagePath);
            } catch (storageError) {
                console.warn("⚠️ No se pudo eliminar la imagen de Firebase Storage:", storageError);
                // Continuamos aunque falle la eliminación de la imagen
                return;
            }
        }

        // 3. Eliminar las relaciones en productos_ingredientes (primero)
        const { error: eliminarRelacionesError } = await supabase
            .from("productos_ingredientes")
            .delete()
            .eq("producto_id", idProducto);

        if (eliminarRelacionesError) {
            throw new Error("No se pudieron eliminar las relaciones del producto con los ingredientes.");
        }

        // 4. Finalmente, eliminar el producto
        const { error: eliminarProductoError } = await supabase
            .from("productos")
            .delete()
            .eq("id", idProducto);

        if (eliminarProductoError) {
            throw new Error("No se pudo eliminar el producto.");
        }

        // Recargar los datos
        cargarProductos(true);
        //  cargarIngredientes();

        mostrarToast("✅ Producto eliminado completamente.", "success");
        return true;
    } catch (error) {
        console.error("❌ Error al eliminar el producto:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
        return false;
    }
}
// Función para agregar o editar el producto con los ingredientes
export async function loadIngredients() {
    // showLoading();
    const { data, error } = await supabase
        .from("ingredientes")
        .select("*");

    if (error) throw error;

    const ingredientsCheckboxContainer = document.getElementById("product-ingredients"); // Contenedor de checkboxes
    ingredientsCheckboxContainer.innerHTML = ''; // Limpiar el contenedor de ingredientes antes de agregar nuevos

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
        label.textContent = `${ingredient.nombre} - Medida en: ${ingredient.medida}`; //cambio la de arriba

        // Crear el campo de cantidad (inicialmente oculto)
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.id = `quantity-${ingredient.id}`;
        quantityInput.classList.add("form-control", "ingredient-quantity");
        quantityInput.placeholder = "Cantidad";
        quantityInput.min = 0;
        quantityInput.step = "0.01";  // Permite decimales con 2 lugares
        quantityInput.style.display = "none"; // Inicialmente oculto

        // Agregar el checkbox y el input de cantidad al contenedor
        ingredientElement.appendChild(checkbox);
        ingredientElement.appendChild(label);
        ingredientElement.appendChild(quantityInput);
        ingredientsCheckboxContainer.appendChild(ingredientElement);// Añadir el item al contenedor de ingredientes

        // Agregar el evento para mostrar/ocultar el input de cantidad al seleccionar/deseleccionar
        checkbox.addEventListener("change", function () {
            quantityInput.style.display = this.checked ? "block" : "none";
            if (!this.checked) quantityInput.value = '';
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

        // Añadir el input de cantidad
        ingredientElement.appendChild(ingredientInput);

        ingredientsListContainer.appendChild(ingredientElement);
    });
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
// Cache simple
let cacheProductos = null;

export async function cargarProductos(forceRefresh = false) {
    try {
        showLoading();

        // Mostrar skeleton o placeholder
        document.getElementById("products-list").innerHTML =
            '<tr><td colspan="8"><div class="skeleton-loader"></div></td></tr>'.repeat(5);

        // Usar cache si está disponible y no se fuerza refresco
        if (cacheProductos && !forceRefresh) {
            renderizarProductos(cacheProductos);
            return;
        }

        // Consulta optimizada
        const { data, error } = await supabase
            .from("productos")
            .select(`
                id, nombre, precio, precio_unitario, precio_total, stock, fecha_registro, imagen_url,
                categoria:categoria_id(nombre),
                productos_ingredientes:productos_ingredientes(
                    cantidad_usada, precio_cantidad_usada,
                    ingrediente:ingredientes(nombre, medida)
                )
            `)
            .order('nombre');

        if (error) throw error;

        // Guardar en cache y renderizar
        cacheProductos = data;
        renderizarProductos(data);

    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos", "error");
    } finally {
        hideLoading();
    }
}

function renderizarProductos(productos) {
    const fragment = document.createDocumentFragment();

    productos.forEach(producto => {
        const fila = document.createElement("tr");
        fila.dataset.id = producto.id;
        const fechaRegistro = formatearFecha(producto.fecha_registro);
        fila.innerHTML = `
            <td><img src="${producto.imagen_url || ''}" alt="${producto.nombre}" 
                 class="img-thumbnail" loading="lazy"></td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria?.nombre || "Sin categoría"}</td>
            <td>$${producto.precio.toFixed(2)}</td>
            <td>${producto.stock}</td>
            <td>${formatearIngredientes(producto.productos_ingredientes)}</td>
            <td>$${producto.precio_unitario.toFixed(2)}</td>
            <td>$${producto.precio_total.toFixed(2)}</td>
            <rd>${fechaRegistro}</td>
        `;
        fragment.appendChild(fila);
    });

    const tabla = document.getElementById("products-list");
    tabla.innerHTML = "";
    tabla.appendChild(fragment);
}

function formatearIngredientes(ingredientes) {
    return ingredientes?.map(i =>
        `${i.ingrediente.nombre}: ${parseFloat(i.cantidad_usada).toFixed(2)} ${i.ingrediente.medida} x $${i.precio_cantidad_usada.toFixed(2)}`
    ).join(", ") || "Sin ingredientes";
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

// Vista previa de la imagen seleccionada
document.getElementById('product-image').addEventListener('change', function (e) {
    const preview = document.getElementById('product-image-preview');
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }

        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
        preview.src = '#';
    }
});

// 📌 Función para generar un nombre único para la imagen
function generarNombreUnico(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop().toLowerCase(); // Normalizar extensión a minúsculas
    return `producto_${timestamp}_${randomString}.${extension}`;
}

function configurarModalProducto() {
    const modalElement = document.getElementById('productModal');
    const modalInstance = new bootstrap.Modal(modalElement, {
        focus: true,
        keyboard: true
    });

    // Manejar foco al abrir
    modalElement.addEventListener('shown.bs.modal', () => {
        setTimeout(() => {
            const firstInput = modalElement.querySelector('input:not([type="hidden"]), select, textarea');
            firstInput?.focus();
        }, 100);
    });

    // Limpiar al cerrar
    modalElement.addEventListener('hidden.bs.modal', () => {
        document.getElementById("product-form").reset();
        clearProductSelection();
    });

    return modalInstance;
}

