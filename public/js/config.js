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



export async function cargarConfiguracion() {
    try {
        // Obtenemos la configuración de la base de datos
        const { data, error } = await supabase
            .from('configuracion')
            .select('logo_url, nombre_empresa, color_primario')
            .single();

        if (error) throw error;

        // Actualizar logo
        document.getElementById('logo-image').src = data.logo_url || ''; // Default logo if not found

        // Actualizar nombre
        document.title = data.nombre_empresa || 'Vista Cliente'; // Si no hay nombre en la DB, usa 'Vista Cliente'
        // 🔹 Actualizar el nombre de la empresa en el footer
        document.getElementById("footer-company-name").textContent = data.nombre_empresa || ""; // Usar el nombre de la empresa de la DB, si está disponible
        // Actualizar color de fondo
        aplicarColorPrimario(data.color_primario); // Aplicar el color al sitio

        console.log('Configuración cargada correctamente.');
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
    }
}
// Función para aplicar el color primario al sitio
function aplicarColorPrimario(color) {
    // Aplicar color al fondo y a los botones
    document.documentElement.style.setProperty('--primary-color', color);
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.style.backgroundColor = color;
        button.style.borderColor = color;
    });
    // Si tienes más elementos que dependen de este color, también los puedes actualizar aquí
}