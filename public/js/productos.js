import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { ref, storage, uploadBytes, getDownloadURL, deleteObject } from "./firebase-config.js"
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo, showLoading, hideLoading } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let productModal;
let productModalDetalles;

// Inicializar al cargar la página
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.updateIngredientsList = updateIngredientsList;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    // setupProductRowSelection();
    cargarProductos();
    // Inicializar el modal de producto
    productModal = new bootstrap.Modal(document.getElementById('productModal'), {
        //   keyboard: false,
        //   backdrop: 'static'
    });

    productModalDetalles = new bootstrap.Modal(document.getElementById('detalleProductoModal'), {
        //   keyboard: false,
        //   backdrop: 'static'
    });

    // Evento para agregar producto
    document.getElementById("btn-agregar-producto").addEventListener("click", () => {
        //   clearProductSelection();
        showProductForm();
    });

    // Evento para formulario
    document.getElementById("product-form").addEventListener("submit", gestionarProducto);

    // Deseleccionar al hacer clic fuera
    /*  document.addEventListener('click', (e) => {
          if (!e.target.closest('#products-list') && !e.target.closest('.product-actions')) {
           //   clearProductSelection();
          }
      });*/
});

// 📌 Mostrar el formulario de producto dentro del modal
export function showProductForm() {
    // Limpiar el formulario
    document.getElementById("product-form").reset();
    document.getElementById("product-form").dataset.productId = "";

    // Limpiar vista previa de imagen
    const imgPreview = document.getElementById("product-image-preview");
    imgPreview.src = "";
    imgPreview.style.display = "none";
    delete imgPreview.dataset.originalUrl;

    // Limpiar selección de ingredientes
    document.querySelectorAll("#product-ingredients input[type='checkbox']").forEach(checkbox => {
        checkbox.checked = false;
        const quantityInput = document.getElementById(`quantity-${checkbox.value}`);
        if (quantityInput) {
            quantityInput.value = "";
            quantityInput.style.display = "none";
        }
    });

    // Configurar para "agregar nuevo"
    document.getElementById("productModalLabel").textContent = "Agregar Producto";
    document.querySelector("#product-form button[type='submit']").innerHTML =
        '<i class="fas fa-check-circle me-2"></i>Guardar Producto';

    // Cargar categorías e ingredientes
    cargarCategorias();
    loadIngredients();

    // Mostrar el modal
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
        mostrarToast("⚠️ Todos los campos son obligatorios", "warning");
        return false;
    }

    if (categoria === "" || categoria === "Seleccionar Categoría") {
        mostrarToast("⚠️ Por favor selecciona una categoría", "warning");
        marcarErrorCampo("product-category", "⚠️ Por favor selecciona una categoría")
        return false;
    }

    if (ingredientes.length === 0) {
        mostrarToast("⚠️ Debes seleccionar al menos un ingrediente", "warning");
        return false;
    }

    if (imagenFile) {
        if (!ALLOWED_TYPES.includes(imagenFile.type)) {
            mostrarToast("⚠️ Tipo de imagen no permitido", "warning");
            return false;
        }
        if (imagenFile.size > MAX_SIZE_BYTES) {
            mostrarToast("⚠️ La imagen excede los 2MB permitidos", "warning");
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
    //  clearProductSelection();
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
        productModalDetalles.hide();
    } catch (error) {
        console.error("❌ Error al actualizar el producto:", error);
        mostrarToast("❌ Error al actualizar el producto", "error");
    }
}

// Función para preseleccionar ingredientes en edición
async function editarProducto(idProducto) {
    try {
        // 1. Mostrar el formulario limpio primero
        showProductForm();
        //  selectProductRow(idProducto);

        // 2. Obtener los datos del producto
        const { data: producto, error } = await supabase
            .from("productos")
            .select(`*, categoria:categoria_id (id, nombre)`)
            .eq("id", idProducto)
            .single();

        if (error) throw error;

        // 3. Llenar los campos del formulario
        document.getElementById("product-name").value = producto.nombre;
        document.getElementById("product-price").value = producto.precio;
        document.getElementById("product-stock").value = producto.stock;
        document.getElementById("product-category").value = producto.categoria?.id || "";

        // 4. Mostrar la imagen si existe
        const imgPreview = document.getElementById("product-image-preview");
        if (producto.imagen_url) {
            imgPreview.src = producto.imagen_url;
            imgPreview.style.display = "block";
            // Guardar la URL original para posible eliminación
            imgPreview.dataset.originalUrl = producto.imagen_url;
        } else {
            imgPreview.style.display = "none";
        }

        // 5. Obtener y marcar los ingredientes asociados
        const { data: ingredientes, error: ingredientesError } = await supabase
            .from("productos_ingredientes")
            .select("ingrediente_id, cantidad_usada")
            .eq("producto_id", idProducto);

        if (ingredientesError) throw ingredientesError;

        document.querySelectorAll("#product-ingredients input[type='checkbox']").forEach(checkbox => {
            const ingrediente = ingredientes.find(i => i.ingrediente_id == checkbox.value);
            if (ingrediente) {
                checkbox.checked = true;
                const quantityInput = document.getElementById(`quantity-${ingrediente.ingrediente_id}`);
                if (quantityInput) {
                    quantityInput.value = ingrediente.cantidad_usada;
                    quantityInput.style.display = "block";
                }
            }
        });

        // 6. Configurar el formulario para edición
        document.getElementById("productModalLabel").textContent = "Editar Producto";
        document.querySelector("#product-form button[type='submit']").innerHTML =
            '<i class="fas fa-save me-2"></i>Actualizar Producto';
        document.getElementById("product-form").dataset.productId = idProducto;

        // 7. Mostrar el modal
        productModal.show();

    } catch (error) {
        console.error("Error al cargar producto para edición:", error);
        mostrarToast("Error al cargar datos del producto", "error");
        productModal.hide();
    }
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

// 🗑️ Eliminar un producto con confirmación de relaciones
async function eliminarProducto(idProducto) {
    // 1. Mostrar el modal de confirmación inicial para eliminar el producto
    const modalConfirmacion = new bootstrap.Modal(document.getElementById('deleteProductModal'));
    modalConfirmacion.show();

    // 2. Manejar la confirmación de eliminar el producto
    document.getElementById("confirmDeleteProduct").addEventListener("click", async () => {
        // 3. Verificar si el producto tiene relaciones en la tabla 'pedido_productos'
        const { data: relaciones, error: relacionesError } = await supabase
            .from("pedido_productos")
            .select("*")
            .eq("producto_id", idProducto);

        if (relacionesError) {
            console.error("Error al verificar relaciones:", relacionesError);
            mostrarToast("❌ Error al verificar las relaciones.", "error");
            return;
        }

        // 4. Si tiene relaciones, mostrar el modal de confirmación de relaciones
        if (relaciones.length > 0) {
            const modalRelaciones = new bootstrap.Modal(document.getElementById('deleteRelationsModal'));
            modalRelaciones.show();

            // 5. Si el usuario decide eliminar las relaciones y el producto
            document.getElementById("confirmDeleteRelations").addEventListener("click", async () => {
                await eliminarProductoConRelaciones(idProducto); // Eliminar producto y relaciones
                modalRelaciones.hide();
                modalConfirmacion.hide();
            });

            // 6. Si el usuario decide mantener las relaciones (ponerlas a null)
            document.getElementById("confirmKeepRelations").addEventListener("click", async () => {
                await actualizarRelacionPedido(idProducto); // Solo poner relaciones a null
                modalRelaciones.hide();
                modalConfirmacion.hide();
            });
        } else {
            // Si no tiene relaciones, proceder a eliminar el producto directamente
            await eliminarProductoConRelaciones(idProducto); // Eliminar producto
            modalConfirmacion.hide();
        }
        productModalDetalles.hide();
    });
}

// 🗑️ Eliminar el producto y sus relaciones
async function eliminarProductoConRelaciones(idProducto) {
    try {
        // 1. Obtener la imagen del producto antes de eliminarlo
        const { data: producto, error: productoError } = await supabase
            .from("productos")
            .select("imagen_url")
            .eq("id", idProducto)
            .single();

        if (productoError) throw productoError;

        // Eliminar la imagen de Firebase Storage si existe
        if (producto.imagen_url) {
            const imagePath = producto.imagen_url.split('/o/')[1].split('?')[0]; // Obtener el path
            const imageRef = ref(storage, decodeURIComponent(imagePath));
            await deleteObject(imageRef);
        }

        // 2. Eliminar las relaciones en 'pedido_productos'
        const { error: eliminarRelacionesError } = await supabase
            .from("pedido_productos")
            .delete()
            .eq("producto_id", idProducto);

        if (eliminarRelacionesError) {
            throw new Error("No se pudieron eliminar las relaciones en pedidos.");
        }

        // 3. Eliminar el producto de la tabla 'productos'
        const { error: eliminarProductoError } = await supabase
            .from("productos")
            .delete()
            .eq("id", idProducto);

        if (eliminarProductoError) {
            throw new Error("No se pudo eliminar el producto.");
        }

        // 3. Recargar los productos
        cargarProductos(true);
        mostrarToast("✅ Producto eliminado completamente.", "success");
    } catch (error) {
        console.error("❌ Error al eliminar el producto:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}

// 🔄 Actualizar las relaciones de los pedidos a null si no se desea eliminar
async function actualizarRelacionPedido(idProducto) {
    try {
        // 1. Obtener la imagen del producto antes de eliminarlo
        const { data: producto, error: productoError } = await supabase
            .from("productos")
            .select("imagen_url")
            .eq("id", idProducto)
            .single();

        if (productoError) throw productoError;

        // Eliminar la imagen de Firebase Storage si existe
        if (producto.imagen_url) {
            const imagePath = producto.imagen_url.split('/o/')[1].split('?')[0]; // Obtener el path
            const imageRef = ref(storage, decodeURIComponent(imagePath));
            await deleteObject(imageRef);
        }

        // 2. Actualizar las relaciones en 'pedido_productos' a null
        const { error: actualizarError } = await supabase
            .from("pedido_productos")
            .update({ producto_id: null }) // Establecer el producto como null
            .eq("producto_id", idProducto);

        if (actualizarError) {
            throw new Error("No se pudieron actualizar las relaciones.");
        }

        // 3. Eliminar el producto de la tabla 'productos'
        const { error: eliminarProductoError } = await supabase
            .from("productos")
            .delete()
            .eq("id", idProducto);

        if (eliminarProductoError) {
            throw new Error("No se pudo eliminar el producto.");
        }

        // Recargar los productos
        cargarProductos(true);
        mostrarToast("✅ Relaciones actualizadas a null.", "success");
    } catch (error) {
        console.error("❌ Error al actualizar las relaciones:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}
/*
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

        // 2. Eliminar las relaciones en productos_promocion primero
        const { error: eliminarRelacionesError } = await supabase
            .from("productos_promocion")
            .delete()
            .eq("producto_id", idProducto);

        if (eliminarRelacionesError) {
            throw new Error("No se pudieron eliminar las relaciones del producto con promociones.");
        }

        // 3. Eliminar las relaciones en productos_ingredientes
        const { error: eliminarIngredientesError } = await supabase
            .from("productos_ingredientes")
            .delete()
            .eq("producto_id", idProducto);

        if (eliminarIngredientesError) {
            throw new Error("No se pudieron eliminar las relaciones con los ingredientes.");
        }

        // 4. Verificar si existe imagen y eliminarla de Firebase Storage
        if (producto.imagen_url) {
            try {
                let imagePath = producto.imagen_url;

                // Si es una URL completa de Firebase Storage
                if (producto.imagen_url.startsWith('https://firebasestorage.googleapis.com')) {
                    const url = new URL(producto.imagen_url);
                    const pathMatch = url.pathname.match(/\/o\/(.+?)(?:\?|$)/);
                    if (pathMatch && pathMatch[1]) {
                        imagePath = decodeURIComponent(pathMatch[1]);
                    } else {
                        throw new Error("URL de Firebase no tiene el formato esperado");
                    }
                }

                const imageRef = ref(storage, imagePath);
                await deleteObject(imageRef);
                console.log("✅ Imagen eliminada de Firebase Storage:", imagePath);
            } catch (storageError) {
                console.warn("⚠️ No se pudo eliminar la imagen de Firebase Storage:", storageError);
            }
        } else {
            console.warn("⚠️ El producto no tiene imagen URL. No se eliminará ninguna imagen.");
        }

        // 5. Finalmente, eliminar el producto
        const { error: eliminarProductoError } = await supabase
            .from("productos")
            .delete()
            .eq("id", idProducto);

        if (eliminarProductoError) {
            throw new Error("No se pudo eliminar el producto.");
        }

        // Recargar los datos
        cargarProductos(true);

        mostrarToast("✅ Producto eliminado completamente.", "success");
        return true;
    } catch (error) {
        console.error("❌ Error al eliminar el producto:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
        return false;
    }
}*/
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

export async function cargarProductos() {
    try {
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

        const catalogoContainer = document.getElementById("product-catalog");
        catalogoContainer.innerHTML = '';  // Limpiar contenedor

        // Iterar sobre los productos
        data.forEach(producto => {
            const card = document.createElement("div");
            card.classList.add("col-md-4");
            card.innerHTML = `
                <div class="card-product" data-id="${producto.id}" data-bs-toggle="modal" data-bs-target="#detalleProductoModal">
                    <img src="${producto.imagen_url}" alt="${producto.nombre}" class="card-img-top-product">
                    <div class="card-body-product">
                        <h5 class="card-title-product">${producto.nombre}</h5>
                        <p class="card-price-product">$${producto.precio}</p>
                    </div>
                </div>
            `;
            catalogoContainer.appendChild(card);

            // Añadir evento de clic en la card para mostrar los detalles del producto
            card.addEventListener("click", () => {
                mostrarDetallesProducto(producto.id);
            });
        });
    } catch (error) {
        console.error("Error al cargar los productos:", error);
    }
}

// Función para cargar los detalles del producto en el modal
async function mostrarDetallesProducto(idProducto) {
    try {
        const { data: producto, error } = await supabase
            .from("productos")
            .select(`
            nombre, precio, stock, categoria_id, imagen_url, fecha_registro, precio_unitario,
            productos_ingredientes:productos_ingredientes(ingrediente_id, cantidad_usada, precio_cantidad_usada),
            categorias:categoria_id(nombre)
        `)
            .eq("id", idProducto)
            .single();

        if (error) throw error;

        // Llenar el modal con los datos del producto
        document.getElementById("detalle-producto-nombre").innerText = producto.nombre;
        document.getElementById("detalle-producto-precio").innerText = `$${producto.precio.toFixed(2)}`;
        document.getElementById("detalle-producto-stock").innerText = producto.stock;
        document.getElementById("detalle-producto-categoria").innerText = producto.categorias?.nombre || "Sin categoría";
        document.getElementById("detalle-producto-fecha-registro").innerText = formatearFecha(producto.fecha_registro);
        document.getElementById("detalle-producto-costo-unitario").innerText = `$${producto.precio_unitario.toFixed(2)}`;
        // Mostrar imagen
        document.getElementById("detalle-producto-imagen").src = producto.imagen_url;

        // Mostrar ingredientes
        // Mostrar ingredientes
        const ingredientes = await Promise.all(producto.productos_ingredientes.map(async (i) => {
            // Consultar el nombre del ingrediente desde la base de datos
            const { data: ingrediente, error: ingredienteError } = await supabase
                .from("ingredientes")
                .select("nombre, medida")
                .eq("id", i.ingrediente_id)
                .single();

            if (ingredienteError) {
                console.error("Error al obtener el ingrediente:", ingredienteError);
                return `${i.ingrediente_id}: ${i.cantidad_usada} x $${i.precio_cantidad_usada.toFixed(2)}`;  // Mostrar solo el id si falla la consulta
            }

            // Formatear el ingrediente con nombre, cantidad y precio
            return `${ingrediente.nombre}: ${i.cantidad_usada}${ingrediente.medida} x $${i.precio_cantidad_usada.toFixed(2)}`;
        }));

        // Unir todos los ingredientes con una coma
        document.getElementById("detalle-producto-ingredientes").innerText = ingredientes.join(", ");
        // Mostrar el modal
        productModalDetalles.show(); // ✅ Usa la instancia global ya creada


        document.getElementById("btn-eliminar-producto").removeEventListener("click", eliminarProducto);
        document.getElementById("btn-editar-producto").removeEventListener("click", editarProducto);
        // Acción de eliminar producto
        document.getElementById("btn-eliminar-producto").onclick = () => eliminarProducto(idProducto);
        document.getElementById("btn-editar-producto").onclick = () => editarProducto(idProducto);

    } catch (error) {
        console.error("Error al cargar los detalles del producto:", error);
        mostrarToast("Error al cargar los detalles del producto", "error");
    }
}
/*
// Función para abrir los detalles al hacer clic en una tarjeta
function setupProductRowSelection() {
    const productCards = document.querySelectorAll('.card-product');
    productCards.forEach(card => {
        card.addEventListener('click', () => {
            const productId = card.dataset.id;
            console.log("aquiiii")
            mostrarDetallesProducto(productId);
        });
    });
}
*//*
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
*/
//🧹 Limpia la selección actual
/*function clearProductSelection() {
    if (selectedProductRow) {
        selectedProductRow.classList.remove('selected-row');
        selectedProductRow = null;
        selectedProductId = null;
    }

    // Ocultar botones de acción
 /*   const deleteBtn = document.getElementById('delete-product-btn');
    const editBtn = document.getElementById('edit-product-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';*/
//}

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

/*function configurarModalProducto() {
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

*/