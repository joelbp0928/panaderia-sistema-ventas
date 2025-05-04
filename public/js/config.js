import { supabase } from './supabase-config.js'; // Importa la configuración de Supabase
import { getClienteActivo } from './estado.js';

// 🔹 Variable global para la categoría seleccionada
let categoriaSeleccionada = null;
export let configuracionGlobal = {};
// Variable global para saber si hay cliente logueado

window.onload = async function () {
    await verificarSesionCliente();  // primero verificar si hay cliente
    cargarPromociones();
}

// Por esto:
document.addEventListener('DOMContentLoaded', function () {
    cargarPromociones();
    cargarCategorias();

    // Escuchar cambios en tiempo real del input
    const inputBusqueda = document.getElementById("busqueda-productos");
    inputBusqueda.addEventListener("input", async function () {
        const termino = inputBusqueda.value.trim().toLowerCase();
        buscarProductos(termino);
    });
});

async function cargarPromociones() {
    try {
        // Verificar si el elemento existe antes de continuar
        const promoSlider = document.getElementById("promo-slider");
        if (!promoSlider) {
            console.log("Elemento promo-slider no encontrado - omitiendo carga de promociones");
            return;
        }
        // Consulta para obtener solo promociones activas
        const { data, error } = await supabase
            .from('promociones')
            .select('id, nombre, imagen_url, activa')
            .eq('activa', true) // Filtrar solo las promociones activas
            .order('fecha_inicio', { ascending: false }); // Ordenar por fecha de inicio

        if (error) throw error;

        promoSlider.innerHTML = ''; // Limpiar el carrusel antes de cargar las nuevas promociones

        if (data.length === 0) {
            promoSlider.innerHTML = "<p>No hay promociones activas.</p>";
            return;
        }

        // Crear las slides para el carrusel
        data.forEach((promocion, index) => {
            const slide = document.createElement("div");
            slide.classList.add("carousel-item");
            if (index === 0) slide.classList.add("active"); // Agregar clase active al primer item

            slide.innerHTML = `
          <img src="${promocion.imagen_url}" class="d-block w-100 promo-image" alt="${promocion.nombre}" loading="lazy">
          <div class="carousel-caption d-none d-md-block">
        <!--    <h5>${promocion.nombre}</h5>
            <p>${promocion.descripcion}</p>-->
          </div>
        `;

            promoSlider.appendChild(slide);
        });
    } catch (error) {
        console.error("Error al cargar las promociones:", error);
    }
}

// 🔹 Cargar productos dinámicamente
export async function cargarProductos() {
    try {
        const { data, error } = await supabase
            .from("productos")
            .select(`
          id,
          nombre,
          precio,
          imagen_url,
          categoria_id,
          categorias (
            visible_cliente
          ),
          productos_ingredientes (
            cantidad_usada,
            ingrediente_id,
            ingredientes:ingrediente_id (
              nombre,
              medida
            )
          ),
          inventario_productos (
            stock_actual
          )
        `)
            .order("id", { ascending: true });


        if (error) throw error;

        const productosVisibles = data.filter(producto =>
            producto.categorias?.visible_cliente === true
        );

        renderizarProductos(productosVisibles);

    } catch (error) {
        console.error("Error al cargar los productos:", error);
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
    const categoryButtonsContainer = document.getElementById("category-buttons");
    if (!categoryButtonsContainer) {
        console.log("Elemento category-buttons no encontrado - omitiendo carga de Categorias");
        return;
    }
    try {
        const { data, error } = await supabase
            .from("categorias")
            .select("id, nombre")
            .eq("visible_cliente", true) // 🔍 Solo las visibles para el cliente
            .order("orden", { ascending: true }); // O puedes seguir ordenando por id


        if (error) {
            throw error;
        }

        // Limpiar cualquier contenido anterior
        categoryButtonsContainer.innerHTML = "";

        // Botón "Todas"
        const allButton = document.createElement("button");
        allButton.classList.add("category-btn", "active"); // Activo por defecto
        allButton.textContent = "Todas";
        allButton.onclick = (event) => {
            // Remover active de todos los botones
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            // Agregar active al botón clickeado
            event.target.classList.add('active');
            cargarProductos();
        };
        categoryButtonsContainer.appendChild(allButton);

        // Botones de categorías
        data.forEach((categoria) => {
            const categoryButton = document.createElement("button");
            categoryButton.classList.add("category-btn");
            categoryButton.textContent = categoria.nombre;

            categoryButton.onclick = (event) => {
                // Remover active de todos los botones
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                // Agregar active al botón clickeado
                event.target.classList.add('active');
                // Cargar productos de la categoría
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
    try {
        const { data: productos, error } = await supabase
            .from("productos")
            .select(`
              id,
              nombre,
              precio,
              imagen_url,
              productos_ingredientes (
                cantidad_usada,
                ingrediente_id,
                ingredientes:ingrediente_id (
                  nombre,
                  medida
                )
              ),
              inventario_productos (
                stock_actual
              )
            `)
            .eq("categoria_id", categoryId); // Aquí ya filtras por categoría

        if (error) throw error;

        renderizarProductos(productos);
    } catch (error) {
        console.error("Error al cargar los productos:", error.message);
    }
}

function renderizarProductos(productos) {
    const productsList = document.getElementById('products-list');
    productsList.innerHTML = '';

    if (!productos || productos.length === 0) {
        productsList.innerHTML = "<p>No hay productos en esta categoría.</p>";
        return;
    }

    productos.forEach((producto, index) => {
        const stock = producto.inventario_productos?.[0]?.stock_actual ?? 0;
        let badgeStock = '';
        if (stock > 7) {
            badgeStock = `<span class="badge bg-success mb-2"><i class="fas fa-check-circle me-1"></i> Disponible: ${stock}</span>`;
        } else if (stock > 0) {
            badgeStock = `<span class="badge bg-warning text-dark mb-2"><i class="fas fa-exclamation-circle me-1"></i> Bajo stock: ${stock}</span>`;
        } else {
            badgeStock = `<span class="badge bg-danger mb-2"><i class="fas fa-times-circle me-1"></i> Agotado</span>`;
        }

        const agregarDisabled = stock <= 0 ? 'disabled' : '';

        const activo = getClienteActivo();
        const mostrarCantidad = activo && stock > 0 ? '' : 'd-none';
        const mostrarAgregar = activo && stock > 0 ? '' : 'd-none';
        const mostrarMensajeLogin = !activo ? '' : 'd-none';
        const mostrarStock = activo ? badgeStock : '';
        document.getElementById("seccion-sugerencias")?.classList.toggle("d-none", !activo);

        const productCard = document.createElement('div');
        productCard.classList.add('col-6', 'col-md-4', 'col-lg-2', 'mb-4');

        productCard.innerHTML = `
        <div class="card product-card shadow-sm h-100">
            <img src="${producto.imagen_url}" class="card-img-top img-fluid rounded-top" alt="${producto.nombre}" loading="lazy">
            <div class="card-body d-flex flex-column justify-content-between">
                <h5 class="card-title nombre-producto nombre-producto" title="${producto.nombre}">${producto.nombre}</h5>
               <p class="card-text fw-bold text-success">$${producto.precio}</p>
                ${mostrarStock}

                <div class="d-flex align-items-center justify-content-center mb-2 ${mostrarCantidad}">
                <button class="btn btn-outline-secondary btn-sm me-2 cantidad-btn" data-index="${index}" data-action="restar">
                    <i class="fas fa-minus"></i>
                </button>
                <span id="cantidad-${index}" class="mx-2">1</span>
                <button class="btn btn-outline-secondary btn-sm ms-2 cantidad-btn" data-index="${index}" data-action="sumar">
                    <i class="fas fa-plus"></i>
                </button>
                </div>

                <div class="acciones-producto mt-auto">
                <button class="btn btn-primary w-100 mb-2 ${mostrarAgregar}" ${agregarDisabled}>
                    <i class="fas fa-cart-plus me-2"></i>Agregar
                </button>
                <div class="alert alert-warning text-center py-1 mb-2 ${mostrarMensajeLogin}" style="font-size: 0.85rem;">
                    Inicia sesión para comprar
                </div>
                <button class="btn btn-outline-secondary btn-sm ver-detalles" data-index="${index}">
                    <i class="fas fa-eye me-1"></i> Ver detalles
                </button>
                </div>
            </div>
        </div>
        `;

        productsList.appendChild(productCard);
    });

    document.querySelectorAll('.cantidad-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.currentTarget.dataset.index;
            const spanCantidad = document.getElementById(`cantidad-${index}`);
            let cantidad = parseInt(spanCantidad.textContent);

            if (e.currentTarget.dataset.action === 'sumar') {
                cantidad++;
            } else if (cantidad > 1) {
                cantidad--;
            }

            spanCantidad.textContent = cantidad;
        });
    });

    document.querySelectorAll('.ver-detalles').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.currentTarget.dataset.index;
            const producto = productos[index];

            document.getElementById("modalNombreProducto").textContent = producto.nombre;
            document.getElementById("modalImagenProducto").src = producto.imagen_url;
            document.getElementById("modalPrecioProducto").textContent = `$${producto.precio}`;

            const ulIngredientes = document.getElementById("modalIngredientes");
            ulIngredientes.innerHTML = producto.productos_ingredientes?.map(pi => {
                const ing = pi.ingredientes;
                return `<li class="list-group-item">${ing.nombre}</li>`;
            }).join('') || '<li class="list-group-item">Sin ingredientes</li>';

            const modal = new bootstrap.Modal(document.getElementById('modalDetallesProducto'));
            modal.show();
        });
    });
}

async function buscarProductos(termino) {
    try {
        const { data, error } = await supabase
            .from("productos")
            .select(`
                    id,
                    nombre,
                    precio,
                    imagen_url,
                    categoria_id,
                    categorias (
                    visible_cliente
                    ),
                    productos_ingredientes (
                    cantidad_usada,
                    ingrediente_id,
                    ingredientes:ingrediente_id (
                        nombre,
                        medida
                    )
                    ),
                    inventario_productos (
                    stock_actual
                    )
                `);

        if (error) throw error;

        const productosVisibles = data.filter(producto =>
            producto.categorias?.visible_cliente === true
        );
        // 🔍 Aplica búsqueda
        const resultados = productosVisibles.filter(producto => {
            const nombreProducto = producto.nombre.toLowerCase();
            const matchNombre = nombreProducto.includes(termino);

            const matchIngrediente = producto.productos_ingredientes?.some(pi =>
                pi.ingredientes?.nombre?.toLowerCase().includes(termino)
            );

            return matchNombre || matchIngrediente;
        });

        // 🔹 Ocultar promociones y sugerencias al buscar
        const seccionesOcultar = ["promotions", "titulo-recomendacion", "tarjeta-sugerencia"];
        seccionesOcultar.forEach(id => document.getElementById(id)?.classList.add("d-none"));

        // 🔹 Mostrar mensaje si no hay coincidencias
        const productsList = document.getElementById("products-list");
        if (resultados.length === 0) {
            productsList.innerHTML = `
              <div class="col-12 text-center animate__animated animate__fadeIn">
                <p class="text-muted fs-5 mt-4"><i class="fas fa-search-minus me-2"></i>No hay coincidencias con "<strong>${termino}</strong>"</p>
              </div>`;
            return;
        }

        // 🔹 Resaltado visual del término buscado en el nombre del producto
        resultados.forEach(producto => {
            const regex = new RegExp(`(${termino})`, 'gi');
            producto.nombre = producto.nombre.replace(regex, '<mark>$1</mark>');
        });

        renderizarProductos(resultados);

        // 🔹 Scroll suave a productos
        document.getElementById("products").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        console.error("Error al buscar productos:", error.message);
    }
}

