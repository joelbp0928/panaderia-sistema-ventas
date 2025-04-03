import { mostrarToast } from "./manageError.js";
import { cargarProductos } from "./productos.js";
import { supabase } from "./supabase-config.js";
import { showLoading, hideLoading } from "./manageError.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedCategoryRow = null;
let selectedCategoryId = null;
let categoriasOrdenadas = [];

// 🌐 EXPOSICIÓN DE FUNCIONES AL SCOPE GLOBAL
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    setupCategoryRowSelection();
    cargarCategorias();

    // Evento para agregar categoría
    document.getElementById("btn-agregar-categoria").addEventListener("click", () => {
        clearCategorySelection();
        mostrarFormularioCategoria();
    });

    // Evento para formulario
    document.getElementById("form-categoria").addEventListener("submit", (e) => {
        e.preventDefault();
        gestionarCategoria();
    });

    // Deseleccionar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tabla-categorias') && !e.target.closest('.category-actions')) {
            clearCategorySelection();
        }
    });
});

// 🧩 FUNCIONES PRINCIPALES

/**
 * 🖼️ Muestra el formulario para agregar/editar categorías
 */
export function mostrarFormularioCategoria() {
    const form = document.getElementById("form-categoria");
    const modal = new bootstrap.Modal(document.getElementById("categoriaModal"));
    form.reset();
    form.dataset.categoriaId = "";
    document.getElementById("categoriaModalLabel").textContent = "Agregar Categoría";
    document.querySelector("#form-categoria button[type='submit']").textContent = "Guardar Categoría";
    modal.show();
}

/**
 * 🔄 Gestiona el envío del formulario (crear/actualizar)
 */
async function gestionarCategoria() {
    const botonGuardar = document.querySelector("#form-categoria button[type='submit']");
    botonGuardar.disabled = true;

    const nombre = document.getElementById("categoria-nombre").value.trim();
    if (!nombre) {
        mostrarToast("El nombre de la categoría es obligatorio", "warning");
        botonGuardar.disabled = false;
        return;
    }

    const idCategoria = document.getElementById("form-categoria").dataset.categoriaId || null;

    try {
        if (idCategoria) {
            // ✏️ Actualizar categoría existente
            // Mantener el orden actual al editar
            const ordenActual = document.getElementById("form-categoria").dataset.ordenActual || 
                              categoriasOrdenadas.find(c => c.id === idCategoria)?.orden || 
                              categoriasOrdenadas.length + 1;
            await actualizarCategoria(idCategoria, nombre, ordenActual);
        } else {
            // ➕ Registrar nueva categoría
            await registrarNuevaCategoria(nombre);
        }

        // Cerrar el modal después de guardar
        const modal = bootstrap.Modal.getInstance(document.getElementById("categoriaModal")) ||
            new bootstrap.Modal(document.getElementById("categoriaModal"));
        modal.hide();

        // 🔄 Refrescar la lista
        await cargarCategorias();
        clearCategorySelection();

    } catch (error) {
        console.error("❌ Error al guardar categoría:", error);
        mostrarToast("❌ Error al guardar categoría", "error");
    } finally {
        botonGuardar.disabled = false;
    }
}

// 📋 Carga la lista de categorías
async function cargarCategorias() {
    try {
        const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('orden', { ascending: true });

        if (error) throw error;

        categoriasOrdenadas = data;
        renderizarCategorias();

      /*  const tablaCategorias = document.querySelector("#tabla-categorias tbody");
        tablaCategorias.innerHTML = "";

        data.forEach(categoria => {
            const fila = document.createElement("tr");
            fila.dataset.id = categoria.id; // Añadir data-id para selección
            fila.innerHTML = `
                <td>${categoria.nombre}</td>
            `;
            tablaCategorias.appendChild(fila);
        });*/

    } catch (error) {
        console.error("❌ Error al cargar categorías:", error);
        mostrarToast("❌ Error al cargar categorías", "error");
    }
}

// ✏️ Carga los datos de una categoría para editar
export async function editarCategoria(idCategoria) {
    try {
        // Mantener el mismo orden al editar
        const categoria = categoriasOrdenadas.find(c => c.id === idCategoria);
        if (categoria) {
            document.getElementById("form-categoria").dataset.ordenActual = categoria.orden;
        }

        if (error || !categoria) throw new Error("No se pudo cargar la categoría");

        // 🔹 Llenar el formulario con los datos
        document.getElementById("categoria-nombre").value = categoria.nombre;

        // 🔹 Configurar el formulario para edición
        const formulario = document.getElementById("form-categoria");
        formulario.dataset.categoriaId = idCategoria;
        document.getElementById("categoriaModalLabel").textContent = "Editar Categoría";
        document.querySelector("#form-categoria button[type='submit']").textContent = "Actualizar Categoría";

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById("categoriaModal"));
        modal.show();

        // Seleccionar fila
        selectCategoryRow(idCategoria);

    } catch (error) {
        console.error("❌ Error al cargar categoría:", error);
        mostrarToast("❌ Error al cargar categoría", "error");
    }
}

// 🗑️ Elimina una categoría con confirmación
export async function eliminarCategoria(idCategoria) {
    // Mostrar el modal de confirmación
    const modal = new bootstrap.Modal(document.getElementById('deleteCategoryModal'));
    modal.show();

    // Actualizar el texto del modal
    const modalBody = document.querySelector('#deleteCategoryModal .modal-body');
    modalBody.innerHTML = `⚠️ ¿Estás seguro de que deseas eliminar esta categoría? Los productos asociados quedarán sin categoría.`;

    // Manejar el evento de confirmación
    document.getElementById("confirm-delete-btn-categoria").onclick = async () => {
        try {
            // 1. Eliminar la relación de categoría en los productos
            const { error: actualizarProductosError } = await supabase
                .from("productos")
                .update({ categoria_id: null })
                .eq("categoria_id", idCategoria);

            if (actualizarProductosError) throw actualizarProductosError;

            // 2. Eliminar la categoría
            const { error } = await supabase.from("categorias").delete().eq("id", idCategoria);
            if (error) throw error;

            mostrarToast("✅ Categoría eliminada correctamente", "success");
            await cargarCategorias();
            await cargarProductos();
            clearCategorySelection();

        } catch (error) {
            console.error("❌ Error al eliminar categoría:", error);
            mostrarToast("❌ Error al eliminar categoría", "error");
        } finally {
            modal.hide();
        }
    };
}

// 🖱️ FUNCIONES DE INTERFAZ

//🖱️ Configura la selección de filas
function setupCategoryRowSelection() {
    const table = document.getElementById('tabla-categorias');
    if (!table) return;

    table.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;

        const categoryId = row.dataset.id;
        if (selectedCategoryId === categoryId) {
            clearCategorySelection();
        } else {
            selectCategoryRow(categoryId);
        }
    });

    const deleteBtn = document.getElementById('delete-category-btn');
    const editBtn = document.getElementById('edit-category-btn');

    // Evento para el botón de eliminar
    deleteBtn.addEventListener('click', () => {
        if (selectedCategoryId) {
            eliminarCategoria(selectedCategoryId);
        }
    });

    // Evento para el botón de editar
    editBtn.addEventListener('click', () => {
        if (selectedCategoryId) {
            editarCategoria(selectedCategoryId);
        }
    });
}

//🔘 Selecciona una fila de categoría
function selectCategoryRow(categoryId) {
    clearCategorySelection();

    const row = document.querySelector(`#tabla-categorias tr[data-id="${categoryId}"]`);
    if (!row) return;

    row.classList.add('selected-row');
    selectedCategoryRow = row;
    selectedCategoryId = categoryId;

    // Mostrar botones de acción
    const deleteBtn = document.getElementById('delete-category-btn');
    const editBtn = document.getElementById('edit-category-btn');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (editBtn) editBtn.style.display = 'inline-block';
}

//🧹 Limpia la selección actual
function clearCategorySelection() {
    if (selectedCategoryRow) {
        selectedCategoryRow.classList.remove('selected-row');
        selectedCategoryRow = null;
        selectedCategoryId = null;
    }

    // Ocultar botones de acción
    const deleteBtn = document.getElementById('delete-category-btn');
    const editBtn = document.getElementById('edit-category-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
}

// 📌 FUNCIONES DE DATOS

async function actualizarCategoria(idCategoria, nombre, orden) {
    const { error } = await supabase
        .from("categorias")
        .update({ nombre, orden })
        .eq("id", idCategoria);

    if (error) throw error;
    mostrarToast("✅ Categoría actualizada correctamente", "success");
}

async function registrarNuevaCategoria(nombre) {
    try {
        const orden = categoriasOrdenadas.length > 0 ? 
            Math.max(...categoriasOrdenadas.map(c => c.orden)) + 1 : 1;
        
        const { error } = await supabase
            .from("categorias")
            .insert([{ nombre, orden }]);

        if (error) throw error;
        
        mostrarToast("✅ Categoría creada correctamente", "success");
        await cargarCategorias();
        
    } catch (error) {
        console.log("❌ Error registrando nueva categoria.", "error");
    }
}


// 🖱️ Función para renderizar las categorías con capacidad de arrastre
function renderizarCategorias() {
    const container = document.getElementById("categorias-container");
    container.innerHTML = "";

    categoriasOrdenadas.forEach((categoria, index) => {
        const fila = document.createElement("tr");
        fila.dataset.id = categoria.id;
        fila.draggable = true;
        fila.classList.add("draggable");
        if (selectedCategoryId === categoria.id) {
            fila.classList.add("selected-row");
        }

        fila.innerHTML = `
            <td class="handle" style="cursor: move;">≡</td>
            <td>${categoria.nombre}</td>
        `;

        // Eventos para drag and drop
        fila.addEventListener('dragstart', handleDragStart);
        fila.addEventListener('dragover', handleDragOver);
        fila.addEventListener('drop', handleDrop);
        fila.addEventListener('dragend', handleDragEnd);

        container.appendChild(fila);
    });

    // Inicializar botones de acción
    setupCategoryRowSelection();
}

// 🖱️ Funciones para manejar el drag and drop
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(e.clientY);
    if (afterElement == null) {
        document.getElementById("categorias-container").appendChild(draggedItem);
    } else {
        document.getElementById("categorias-container").insertBefore(draggedItem, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
    return false;
}

function handleDragEnd() {
    this.classList.remove('dragging');
    actualizarOrdenCategorias();
}

function getDragAfterElement(y) {
    const draggableElements = [...document.querySelectorAll('#categorias-container tr:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 🔄 Función para actualizar el orden en Supabase
async function actualizarOrdenCategorias() {
    const filas = document.querySelectorAll('#categorias-container tr');
    const nuevosIdsOrdenados = Array.from(filas).map(fila => fila.dataset.id);
    
    try {
        showLoading();
        
        // Crear transacción para actualizar todos los órdenes
        const updates = nuevosIdsOrdenados.map((id, index) => 
            supabase.from('categorias').update({ orden: index + 1 }).eq('id', id)
        );
        
        await Promise.all(updates);
        
        // Volver a cargar para asegurar consistencia
        await cargarCategorias();
        
    } catch (error) {
        console.error("❌ Error al actualizar orden:", error);
        mostrarToast("❌ Error al actualizar orden de categorías", "error");
    } finally {
        hideLoading();
    }
}