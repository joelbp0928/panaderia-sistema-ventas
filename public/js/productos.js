import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { ref, storage, uploadBytes, getDownloadURL } from "./firebase-config.js"
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// Hacer accesibles globalmente las funciones necesarias
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;

window.updateIngredientsList = updateIngredientsList;
window.updateIngredientQuantity = updateIngredientQuantity;


// 📌 Mostrar el formulario de producto dentro del modal
export function showProductForm() {
    const modal = new bootstrap.Modal(document.getElementById("productModal"));
    modal.show(); // Mostrar el modal de producto

    // Si estamos editando un producto, prellenamos los datos en el formulario
    /*  if (product) {
          document.getElementById("product-name").value = product.nombre;
          document.getElementById("product-price").value = product.precio;
          document.getElementById("product-stock").value = product.stock;
          document.getElementById("product-category").value = product.categoria;
          // Cargar los ingredientes seleccionados
          const productIngredientsSelect = document.getElementById("product-ingredients");
          product.ingredientes.forEach(ingredient => {
              const option = document.createElement("option");
              option.value = ingredient.id;
              option.text = ingredient.nombre;
              productIngredientsSelect.appendChild(option);
          });
  
          // Cambiar el texto del botón
          document.querySelector("#product-form button[type='submit']").innerText = "Actualizar Producto";
  
          // Establecer el ID del producto a actualizar
          document.getElementById("product-form").dataset.productId = product.id;
      } else {*/
    // Si no estamos editando, reseteamos el formulario
    document.getElementById("product-form").reset();
    document.querySelector("#product-form button[type='submit']").innerText = "Guardar Producto";
    document.getElementById("product-form").dataset.productId = ""; // Limpiar el ID
    //  }
}

// 📌 Función para gestionar el producto (crear o actualizar)
export async function gestionarProducto(event) {
    event.preventDefault();

    const idProducto = document.getElementById("product-form").dataset.productId;
    const nombre = document.getElementById("product-name").value.trim();
    const precio = parseFloat(document.getElementById("product-price").value);
    const stock = parseInt(document.getElementById("product-stock").value);
    const categoria = document.getElementById("product-category").value;
    // Obtener los ingredientes seleccionados y sus cantidades
    const ingredientes = Array.from(document.getElementById("product-ingredients").selectedOptions);
   // const cantidades = document.getElementById("ingredient-quantity").value;
    const imagenFile = document.getElementById("product-image").files[0]; // Imagen seleccionada

    // Validación básica
    /*   if (!nombre || !precio || !stock || !categoria) {
           alert("⚠️ Todos los campos son obligatorios.");
           return;
       }*/

    try {
        let imagenURL = "";  // Inicializamos la URL de la imagen

        // 🔹 Subir la imagen a Firebase Storage si se seleccionó una imagen
        if (imagenFile) {
            const storageRef = ref(storage, `productos/${imagenFile.name}`);
            const uploadTask = await uploadBytes(storageRef, imagenFile);  // Subimos la imagen
            imagenURL = await getDownloadURL(storageRef);  // Obtenemos la URL de la imagen
        }

        const formData = {
            nombre,
            precio,
            stock,
            categoria,
            ingredientes: ingredientes.map(ingredient => ingredient.value),  // Ingredientes seleccionados
            cantidades: Array.from(document.querySelectorAll(".ingredient-quantity")).map(input => input.value),  // Cantidades de los ingredientes
            imagen_url: imagenURL
        };

        // Si el producto tiene un ID (editando un producto)
        if (idProducto) {
            // Actualizar el producto en la base de datos
            await actualizarProducto(idProducto, formData);
        } else {
            // Registrar el nuevo producto en la base de datos
            await agregarProducto(formData);
        }

        cargarProductos(); // 🔄 Recargar la lista de productos

        // Limpiar el formulario y ocultarlo
        document.getElementById("product-form").reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById("productModal"));
        modal.hide(); // Mostrar el modal de producto

    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
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
                stock: data.stock,
                categoria: data.categoria,
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

        // Relacionar los ingredientes con el producto
        await associateIngredientsWithProduct(product[0].id, data.ingredientes, data.cantidades);

        // Descontar los ingredientes del inventario
        await updateIngredientInventory(data.ingredientes, data.cantidades);

        // ✅ Mostrar mensaje de éxito
        mostrarToast("✅ Producto agregado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    }
}


// Actualizar un producto existente en la base de datos
async function actualizarProducto(data) {
    const { error } = await supabase
        .from("productos")
        .update({
            nombre: data.nombre,
            precio: data.precio,
            stock: data.stock,
            categoria: data.categoria,
            imagen_url: data.imagenURL,
        })
        .eq("id", data.id);

    if (error) throw error;

    // Relacionar los ingredientes con el producto (si ha habido cambios)
    await associateIngredientsWithProduct(data.id, data.ingredientes);

    // Descontar los ingredientes del inventario
    await updateIngredientInventory(data.ingredientes);
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
async function updateIngredientInventory(ingredientIds, cantidades) {
    for (let i = 0; i < ingredientIds.length; i++) {
        // 🔹 Obtener el ingrediente desde Supabase
        const { data: ingredient, error } = await supabase
            .from("ingredientes")
            .select("id, cantidad")
            .eq("id", ingredientIds[i])
            .single();

        if (error || !ingredient) {
            throw new Error("No se pudo obtener el ingrediente.");
        }

        // 🔹 Restar la cantidad de ingrediente usado
        const newQuantity = ingredient.cantidad - cantidades[i];  // Aquí usamos la cantidad correspondiente
        if (newQuantity < 0) {
            throw new Error("No hay suficiente cantidad en inventario.");
        }

        // Actualizar el inventario
        const { error: updateError } = await supabase
            .from("ingredientes")
            .update({ cantidad: newQuantity })
            .eq("id", ingredientIds[i]);

        if (updateError) throw updateError;
    }
}

function editarProducto(idProducto) {
    console.log("editando Producto:", idProducto);
}

function eliminarProducto(idProducto) {
    console.log("elminando Prodcuto:", idProducto);
}

// Cargar ingredientes disponibles para asignar a los productos
export async function loadIngredients() {
    const { data, error } = await supabase
        .from("ingredientes")
        .select("*");

    if (error) throw error;

    const ingredientsSelect = document.getElementById("product-ingredients");

    data.forEach(ingredient => {
        const option = document.createElement("option");
        option.value = ingredient.id;
        option.text = ingredient.nombre;
        option.setAttribute("data-medida", ingredient.medida); // Añadir la medida como un atributo data
        ingredientsSelect.appendChild(option);
    });
}

// 📌 Función para actualizar la lista de ingredientes seleccionados
export function updateIngredientsList() {
    const selectedIngredients = Array.from(document.getElementById("product-ingredients").selectedOptions);
    const ingredientsListContainer = document.getElementById("selected-ingredients-list");

    ingredientsListContainer.innerHTML = ''; // Limpiar la lista actual antes de actualizar

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
        ingredientInput.addEventListener("change", function() {
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



// 📌 Función para cargar productos desde Supabase y mostrarlos en una tabla
export async function cargarProductos() {
    try {
        // 🔹 Obtener los productos desde Supabase
        const { data: productos, error: productosError } = await supabase
            .from("productos")
            .select("id, nombre, precio, stock, categoria, imagen_url"); // Obtener las columnas necesarias

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
            const imagen = producto.imagen_url ? producto.imagen_url : "path/to/default-image.jpg";

            // Crear una fila para el producto
            const fila = document.createElement("tr");

            // Crear las celdas de la fila con la información del producto
            const ingredientesText = producto.ingredientes.map((ingredient) => {
                return `${ingredient.nombre}: ${ingredient.cantidad} ${ingredient.medida}`;
            }).join(", ");

            fila.innerHTML = `
                <td><img src="${imagen}" alt="${producto.nombre}" class="img-thumbnail" style="width: 50px; height: 50px;"></td>
                <td>${producto.nombre}</td>
                <td>${producto.categoria}</td>
                <td>$${producto.precio}</td>
                <td>${producto.stock}</td>
                <td>${ingredientesText}</td>  <!-- Ingredientes y cantidades -->
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarProducto('${producto.id}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.id}')">Eliminar</button>
                </td>
            `;

            // Agregar la fila a la tabla
            tablaProductos.appendChild(fila);
        });
    } catch (error) {
        console.error("❌ Error al cargar productos:", error);
        mostrarToast(`❌ Error: ${error.message}`, "error");
    }
}


