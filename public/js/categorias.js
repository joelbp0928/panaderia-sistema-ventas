import { mostrarToast } from "./manageError.js";
import { cargarProductos } from "./productos.js";

window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;

import { supabase } from "./supabase-config.js"; // Importamos la configuración de Supabase

// Función para cargar todas las categorías en el front-end
async function cargarCategorias() {
    try {
        const { data, error } = await supabase.from('categorias').select('*');

        if (error) {
            console.error("Error al cargar categorías:", error.message);
            return;
        }

        const tablaCategorias = document.querySelector("#tabla-categorias tbody");
        tablaCategorias.innerHTML = ""; // Limpiar la tabla antes de insertar los nuevos registros

        data.forEach(categoria => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${categoria.nombre}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarCategoria(${categoria.id}, '${categoria.nombre}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarCategoria(${categoria.id})">Eliminar</button>
                </td>
            `;
            tablaCategorias.appendChild(fila);
        });
    } catch (error) {
        console.error("Error al cargar categorías:", error);
    }
}

// Función para abrir el modal y editar una categoría
function editarCategoria(id, nombre) {
    const modal = new bootstrap.Modal(document.getElementById("categoriaModal"));
    modal.show();
    document.getElementById("categoria-nombre").value = nombre;

    // Cambiar el título y preparar el formulario para actualizar
    document.getElementById("categoriaModalLabel").textContent = "Editar Categoría";
    const formulario = document.getElementById("form-categoria");
    formulario.onsubmit = (e) => {
        e.preventDefault();
        actualizarCategoria(id);
    };
}

// Función para agregar o actualizar la categoría
async function actualizarCategoria(id = null) {
    const nombre = document.getElementById("categoria-nombre").value;

    if (!nombre) {
        alert("El nombre de la categoría es obligatorio.");
        return;
    }

    try {
        const categoria = { nombre };

        if (id) {
            // Actualizar categoría
            const { error } = await supabase.from("categorias").update(categoria).eq("id", id);
            if (error) throw error;
        } else {
            // Crear nueva categoría
            const { error } = await supabase.from("categorias").insert([categoria]);
            if (error) throw error;
        }

        cargarCategorias(); // Recargar categorías
        cargarProductos();
        const modal = bootstrap.Modal.getInstance(document.getElementById("categoriaModal"));
        modal.hide(); // Cerrar el modal
    } catch (error) {
        console.error("Error al actualizar categoría:", error.message);
        alert("Error al guardar la categoría");
    }
}

// Función para eliminar una categoría sin afectar los productos
async function eliminarCategoria(id) {
    if (confirm("¿Estás seguro de que deseas eliminar esta categoría? Esta acción no puede deshacerse.")) {
        try {
            // 1. Eliminar la relación de categoría en los productos
            const { error: actualizarProductosError } = await supabase
                .from("productos")
                .update({ categoria_id: null }) // Establecemos el campo 'categoria_id' como NULL
                .eq("categoria_id", id); // Solo actualizamos los productos que tienen esta categoría

            if (actualizarProductosError) throw actualizarProductosError;

            // 2. Eliminar la categoría
            const { error } = await supabase.from("categorias").delete().eq("id", id);
            if (error) throw error;

            cargarCategorias(); // Recargar categorías
            cargarProductos();
        } catch (error) {
            console.error("Error al eliminar categoría:", error.message);
            alert("Error al eliminar la categoría");
        }
    }
}


// Cargar las categorías al inicio
document.addEventListener("DOMContentLoaded", cargarCategorias);

// Asignar la función al botón de agregar categoría
document.getElementById("btn-agregar-categoria").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("categoriaModal"));
    modal.show();
    document.getElementById("form-categoria").reset();
    document.getElementById("categoriaModalLabel").textContent = "Agregar Categoría";
    const formulario = document.getElementById("form-categoria");
    formulario.onsubmit = (e) => {
        e.preventDefault();
        actualizarCategoria(); // Llamamos a la misma función para agregar
    };
});
