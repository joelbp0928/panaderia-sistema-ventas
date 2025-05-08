// Código Fetch para traer la sugerencia de pan
function obtenerSugerencia() {
  console.log("Entró a la función");

  const cliente_id = localStorage.getItem("cliente_id");
    if (!cliente_id) {
        console.error("❌ No hay cliente_id en localStorage");
        return;
    }


  fetch(`https://sarimax-panaderia-v2-dyfwgmb5ecb5gnb4.eastus-01.azurewebsites.net//?cliente_id=${cliente_id}`)  
  //fetch(`http://localhost:5000/?cliente_id=${cliente_id}`)
  .then(res => res.json())
  .then(data => {
    console.log("Usuario:", cliente_id);
    console.log("✅ Sugerencia:", data);

    document.getElementById("tarjeta-sugerencia").style.display = "flex";
    document.getElementById('imagen-pan').src = data.imagen_url;
    document.getElementById('nombre-pan').textContent = data.nombre;
    const boton = document.getElementById("btn-carrito");
    const titulo = document.getElementById("titulo-recomendacion");

       if (data.estado === "sin_historial") {
      // Mostrar mensaje 
      const tarjeta = document.getElementById("seccion-sugerencias");
  tarjeta.style.display = "flex";
  tarjeta.innerHTML = ""; // Limpia contenido previo

  const color = window.configuracionGlobal.color_primario || "#6c1b2d";
  const fondo = tinycolor(color).lighten(35).toHexString();
  const borde = tinycolor(color).darken(10).toString();
  const sombra = tinycolor(color).setAlpha(0.25).toRgbString();

  // Crear el contenedor del mensaje
  const mensaje = document.createElement("div");
  mensaje.style.cssText = `
    background: ${fondo};
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 6px 18px ${sombra};
    border: 1px solid ${borde};
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
    font-family: 'Segoe UI', sans-serif;
  `;
  mensaje.innerHTML = `
    <div style="text-align:center; padding: 25px; background-color: #dff2fb; border-radius: 15px;">
    <h2 style="margin-bottom: 10px; font-size: 1.8rem; color: #2c6580;">
      <i class="fas fa-search"></i> Aún no hay recomendaciones
    </h2>
    <p style="margin-bottom: 20px; font-size: 1rem;">
      Compra 5 productos para poder darte sugerencias deliciosas </i>
    </p>
    <i class="fas fa-bread-slice" style="font-size: 80px; color: #a67847;"></i>
  </div>
  `;

  tarjeta.appendChild(mensaje); // Lo insertas dentro de la tarjeta
  return;
}

    

     // Obtener color desde configuración global
  const color = window.configuracionGlobal.color_primario || "#6c1b2d";
  console.log(configuracionGlobal)
  const hoverColor = tinycolor(color).darken(10).toString();
  const fondoClaro = tinycolor(color).lighten(35).toHexString();
  const fondoMedio = tinycolor(color).lighten(25).toHexString();

  // Estilo de tarjeta
  const tarjeta = document.getElementById("tarjeta-sugerencia");
  if (tarjeta) {
    tarjeta.style.background = `linear-gradient(135deg, ${fondoClaro}, ${fondoMedio})`;
    tarjeta.style.border = `1px solid ${tinycolor(color).darken(5).toString()}`;
    tarjeta.style.boxShadow = `0 6px 18px ${tinycolor(color).setAlpha(0.2).toRgbString()}`;
    tarjeta.style.borderRadius = "15px";
    tarjeta.style.transition = "all 0.3s ease-in-out";
  }
  // Estilo del botón
  boton.style.backgroundColor = color;
  boton.style.borderColor = color;
  boton.style.color = "#fff";
  boton.style.padding = "10px 16px";
  boton.style.borderRadius = "10px";
  boton.style.fontWeight = "bold";
  boton.style.boxShadow = `0 4px 12px ${tinycolor(color).setAlpha(0.3).toRgbString()}`;
  boton.style.transition = "all 0.2s ease-in-out";

  document.documentElement.style.setProperty('--primary-bg-color', tinycolor(color).lighten(30).toHexString());
  document.documentElement.style.setProperty('--primary-bg-dark', tinycolor(configuracionGlobal.color_primario).darken(15).toString());
  document.getElementById("tarjeta-sugerencia").classList.add("mostrar");


  // Hover del botón
  boton.addEventListener("mouseenter", () => {
    boton.style.backgroundColor = hoverColor;
    boton.style.borderColor = hoverColor;
  });
  boton.addEventListener("mouseleave", () => {
    boton.style.backgroundColor = color;
    boton.style.borderColor = color;
  });

  // Evento click para agregar al carrito
  boton.onclick = () => {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    const index = carrito.findIndex(item => item.id === data.id);

    if (index !== -1) {
      carrito[index].cantidad += 1;
    } else {
      carrito.push({ id: data.id, nombre: data.nombre, cantidad: 1 });
    }

    localStorage.setItem("carrito", JSON.stringify(carrito));
    alert(`✅ "${data.nombre}" añadido al carrito`);
    console.log("🛒 Carrito actualizado:", carrito);
  };
});

  }

 
obtenerSugerencia();
  
