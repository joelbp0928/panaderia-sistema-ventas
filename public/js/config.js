import { supabase } from './supabase-config.js'; // Importa la configuración de Supabase

// 🔹 Cargar promociones desde Firebase
export function cargarPromociones() {
    fetch("https://us-central1-gestor-panaderia.cloudfunctions.net/api/config/promociones")
        .then(response => response.json())
        .then(data => {
            const promoContainer = document.getElementById("promotions");
            promoContainer.innerHTML = "";
            data.forEach(promo => {
                const promoElement = document.createElement("div");
                promoElement.classList.add("promo-slider");
                promoElement.innerHTML = `<img src="${promo.imagen_url}" alt="${promo.nombre}" class="promo-img"/>
                <h5>Estamos trabajando 🏗🚧👷‍♂️</h5>`;
                promoContainer.appendChild(promoElement);
            });
        })
        .catch(error => console.error("❌ Error cargando promociones:", error));
}

// 🔹 Cargar productos dinámicamente
export async function cargarProductos() {
    try {
        // Obtener productos desde la base de datos
        const { data, error } = await supabase
            .from('productos') // Asegúrate de que la tabla se llama 'productos'
            .select('id, nombre, precio, imagen_url') // Los campos que deseas obtener
            .order('id', { ascending: true });

        if (error) throw error;

        // Obtener el contenedor donde se mostrarán los productos
        const productsList = document.getElementById('products-list');
        productsList.innerHTML = ''; // Limpiar el contenido existente

        // Iterar sobre los productos obtenidos y agregarlos al DOM
        data.forEach((producto) => {
            // Crear el elemento HTML para cada producto
            const productCard = document.createElement('div');
            productCard.classList.add('col-12', 'col-md-6', 'col-lg-4', 'mb-4'); // Usando clases de Bootstrap para la responsividad

            productCard.innerHTML = `
            <div class="product-card">
              <img src="${producto.imagen_url}" alt="${producto.nombre}" class="card-img-top img-fluid" />
              <div class="card-body">
                <h5 class="card-title">${producto.nombre}</h5>
                <p class="card-text">$${producto.precio}</p>
                <button class="btn btn-primary">Agregar al Carrito</button>
              </div>
            </div>
          `;

            // Añadir el producto a la lista
            productsList.appendChild(productCard);
        });

    } catch (error) {
        console.error('Error al cargar los productos:', error);
    }
}
export let configuracionGlobal = {};
export async function cargarConfiguracion() {
    try {
        // Obtenemos la configuración de la base de datos
        const { data, error } = await supabase
            .from('configuracion')
            .select('logo_url, nombre_empresa, color_primario')
            .single();

        if (error) throw error;

        configuracionGlobal = data; // Guarda los datos en una variable global accesible

        // Actualizar logo
        document.getElementById('logo-image').src = data.logo_url || ''; // Default logo if not found

        // Actualizar nombre
        document.title = data.nombre_empresa || 'Vista Cliente'; // Si no hay nombre en la DB, usa 'Vista Cliente'
        // 🔹 Actualizar el nombre de la empresa en el footer
        document.getElementById("footer-company-name").textContent = data.nombre_empresa || ""; // Usar el nombre de la empresa de la DB, si está disponible
        // Verificar si el elemento existe antes de modificar su valor
        const colorInput = document.getElementById("primary-color");

        if (colorInput) {
            // Si el elemento existe, asignamos el valor
            colorInput.value = data.color_primario || "#6c1b2d";
        }
        // Actualizar color de fondo
        aplicarColorPrimario(data.color_primario); // Aplicar el color al sitio

        console.log('Configuración cargada correctamente.');
        return data;
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
    }
}
// Función para aplicar el color primario al sitio
function aplicarColorPrimario(color) {
    // Crear un color más oscuro para el hover
    const colorHover = tinycolor(color).darken(10).toString(); // 20% más oscuro

    // Aplicar color al fondo y a los botones
    document.documentElement.style.setProperty('--primary-color', color);
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.style.backgroundColor = color;
        button.style.borderColor = color;
    });
    // Aplicar color más oscuro al hover
    document.documentElement.style.setProperty('--primary-color-obscuro', colorHover);
}

// Función para cargar las categorías desde la base de datos
async function cargarCategorias() {
    try {
        const { data, error } = await supabase
            .from("categorias")
            .select("id, nombre")
            .order("id", { ascending: true }); // Obtener las categorías en el orden de su ID

        if (error) {
            throw error;
        }

        const categoryButtonsContainer = document.getElementById("category-buttons");

        // Limpiar cualquier contenido anterior
        categoryButtonsContainer.innerHTML = "";

        // Crear un botón para cada categoría obtenida
        data.forEach((categoria) => {
            const categoryButton = document.createElement("button");
            categoryButton.classList.add("category-btn");
            categoryButton.textContent = categoria.nombre;

            // Agregar un event listener para cada botón
            categoryButton.onclick = () => {
                toggleCategory(categoria.id);
            };

            categoryButtonsContainer.appendChild(categoryButton);
        });
    } catch (error) {
        console.error("Error al cargar las categorías:", error.message);
    }
}

// Función que se llama cuando se hace clic en una categoría
async function toggleCategory(categoryId) {
    console.log("Categoría seleccionada:", categoryId);

    try {
        // Obtener los productos que pertenecen a la categoría seleccionada
        const { data: productos, error } = await supabase
            .from("productos")
            .select("id, nombre, precio, imagen_url")
            .eq("categoria_id", categoryId); // Filtrar por la categoría seleccionada

        if (error) {
            throw error;
        }

        // Mostrar los productos en la consola
        console.log("Productos de la categoría:", productos);

        // Aquí puedes agregar más código para mostrar los productos en el frontend si lo deseas
        // Ejemplo:
        // mostrarProductosEnElFrontend(productos);
    } catch (error) {
        console.error("Error al cargar los productos:", error.message);
    }
}

// Cargar categorías cuando se carga la página
document.addEventListener("DOMContentLoaded", cargarCategorias);