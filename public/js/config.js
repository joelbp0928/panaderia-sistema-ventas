// 🔹 Cargar configuración de la empresa (nombre, logo, colores)
/*export function cargarConfiguracion() {
    fetch('/api/config/empresa')
        .then(response => response.json())
        .then(data => {
            document.title = data.nombre_empresa;
            document.querySelector(".logo img").src = data.logo_url;
            document.documentElement.style.setProperty('--primary-color', data.color_principal);
        })
        .catch(error => console.error("❌ Error cargando la configuración:", error));
}*/

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
                promoElement.innerHTML = `<img src="${promo.imagen_url}" alt="${promo.nombre}" class="promo-img"/>`;
                promoContainer.appendChild(promoElement);
            });
        })
        .catch(error => console.error("❌ Error cargando promociones:", error));
}

// 🔹 Cargar productos dinámicamente
export function cargarProductos() {
    /*fetch("https://us-central1-gestor-panaderia.cloudfunctions.net/api/config/productos")
        .then(response => response.json())
        .then(data => {
            const productContainer = document.querySelector(".product-grid");
            productContainer.innerHTML = "";

            data.forEach(producto => {
                const productElement = document.createElement("div");
                productElement.classList.add("product-card");
                productElement.innerHTML = `
                    <img src="${producto.imagen_url}" alt="${producto.nombre}" />
                    <h3>${producto.nombre}</h3>
                    <p>$${producto.precio.toFixed(2)}</p>
                    <button class="add-to-cart-btn" onclick="agregarAlCarrito('${producto.nombre}', ${producto.precio}, '${producto.imagen_url}')">Agregar</button>
                `;
                productContainer.appendChild(productElement);
            });
        })
        .catch(error => console.error("❌ Error cargando productos:", error));*/
}
