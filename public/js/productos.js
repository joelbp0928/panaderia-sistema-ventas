import { supabase } from "./supabase-config.js"; // 📌 Importar configuración de Supabase
import { ref, storage, uploadBytes, getDownloadURL } from "./firebase-config.js"
import { mostrarToast, marcarErrorCampo, limpiarErrorCampo } from "./manageError.js"; // 📌 Manejo de errores
import { formatearFecha } from "./formatearFecha.js";

// Mostrar el formulario para agregar o editar un producto
export function showProductForm(product = null) {
    const form = document.getElementById("product-form");

    // Mostrar el formulario
    form.style.display = "block";

    if (product) {
        // Prellenar el formulario si es una edición
        document.getElementById("product-name").value = product.nombre;
        document.getElementById("product-price").value = product.precio;
        document.getElementById("product-stock").value = product.stock;
        document.getElementById("product-category").value = product.categoria;

        // Establecer ingredientes seleccionados (suponiendo que tengas esta relación)
        const ingredientsSelect = document.getElementById("product-ingredients");
        product.ingredientes.forEach(ingredient => {
            const option = document.createElement("option");
            option.value = ingredient.id;
            option.text = ingredient.nombre;
            ingredientsSelect.appendChild(option);
        });
    }
}

// Mostrar el formulario para agregar un nuevo producto
export function addProduct() {
    showProductForm();  // Llama a la función con product = null para agregar un nuevo producto
}

// Registrar o actualizar un producto
export async function gestionarProducto(event) {
    event.preventDefault();

    const nombre = document.getElementById("product-name").value.trim();
    const precio = parseFloat(document.getElementById("product-price").value);
    const stock = parseInt(document.getElementById("product-stock").value);
    const categoria = document.getElementById("product-category").value;
    const ingredientes = Array.from(document.getElementById("product-ingredients").selectedOptions).map(option => option.value);
    const imagenFile = document.getElementById("product-image").files[0]; // Imagen seleccionada

    // Validación básica
    if (!nombre || !precio || !stock || !categoria) {
        alert("⚠️ Todos los campos son obligatorios.");
        mostrarToast("⚠️ Todos los campos son obligatorios.", "warning");
        return;
    }

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
            ingredientes,
            imagen_url: imagenURL
        };

        // Si el producto tiene un ID (editando un producto)
        if (formData.id) {
            // Actualizar el producto en la base de datos
            await updateProduct(formData);
        } else {
            // Registrar el nuevo producto en la base de datos
            await createProduct(formData);
        }

        // Limpiar el formulario y ocultarlo
        document.getElementById("product-form").reset();
        document.getElementById("product-form").style.display = "none";
    } catch (error) {
        console.error("❌ Error al guardar el producto:", error);
        mostrarToast("❌ Error al guardar el producto", "error");
    }
}

// Crear un nuevo producto en la base de datos
async function createProduct(data) {
    const { data: product, error } = await supabase
        .from("productos")
        .insert([{
            nombre: data.nombre,
            precio: data.precio,
            stock: data.stock,
            categoria: data.categoria,
            imagen_url: data.imagenURL,
        }]);

    if (error) throw error;

    // Relacionar los ingredientes con el producto
    await associateIngredientsWithProduct(product[0].id, data.ingredientes);
}

// Actualizar un producto existente en la base de datos
async function updateProduct(data) {
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
}

// Asociar ingredientes con un producto
async function associateIngredientsWithProduct(productId, ingredientIds) {
    // Primero, eliminamos las relaciones anteriores
    await supabase
        .from("productos_ingredientes")
        .delete()
        .eq("producto_id", productId);

    // Luego insertamos las nuevas relaciones
    for (let ingredientId of ingredientIds) {
        const { error } = await supabase
            .from("productos_ingredientes")
            .upsert({
                producto_id: productId,
                ingrediente_id: ingredientId
            });

        if (error) throw error;
    }
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
        ingredientsSelect.appendChild(option);
    });
}
