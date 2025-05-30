import { mostrarToast } from "./manageError.js";
import { cargarProductos } from "./productos.js";
import { supabase } from "./supabase-config.js";
import { showLoading, hideLoading } from "./manageError.js";

// 🏷️ VARIABLES GLOBALES DE ESTADO
let selectedCategoryRow = null;
let selectedCategoryId = null;
let categoriasOrdenadas = [];
let currentModal = null; // Variable para rastrear el modal actual

// 🌐 EXPOSICIÓN DE FUNCIONES AL SCOPE GLOBAL
//window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;

// 🚀 INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", function () {
    setupCategoryRowSelection();
    setupModalEventListeners();

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

// 🔧 Configuración de listeners para modales
function setupModalEventListeners() {
    // Limpiar al cerrar modal de categoría
    const categoriaModal = document.getElementById('categoriaModal');
    if (categoriaModal) {
        categoriaModal.addEventListener('hidden.bs.modal', () => {
            cleanUpModal();
        });
    }

    // Limpiar al cerrar modal de confirmación
    const deleteModal = document.getElementById('deleteCategoryModal');
    if (deleteModal) {
        deleteModal.addEventListener('hidden.bs.modal', () => {
            cleanUpModal();
            // Limpiar el event listener del botón de confirmación
            const confirmBtn = document.getElementById("confirm-delete-btn-categoria");
            confirmBtn.onclick = null;
        });
    }
}

// 🧹 Limpieza después de cerrar modales
function cleanUpModal() {
    // Eliminar backdrop si existe
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    
    // Restaurar el scroll del body
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    currentModal = null;
}

// 🧩 FUNCIONES PRINCIPALES

//🖼️ Muestra el formulario para agregar/editar categorías
export function mostrarFormularioCategoria() {
    const form = document.getElementById("form-categoria");
    const modal = new bootstrap.Modal(document.getElementById("categoriaModal"));
    form.reset();
    form.dataset.categoriaId = "";
    document.getElementById("categoriaModalLabel").textContent = "Agregar categoría";
    document.querySelector("#form-categoria button[type='submit']").textContent = "Guardar categoría";
    modal.show();
}

//🔄 Gestiona el envío del formulario (crear/actualizar)
async function gestionarCategoria() {
    const botonGuardar = document.querySelector("#form-categoria button[type='submit']");
    botonGuardar.disabled = true;

    const nombre = document.getElementById("categoria-nombre").value.trim();
    const visible = document.getElementById("categoria-visible").checked;
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
            await actualizarCategoria(idCategoria, nombre, ordenActual, visible);
        } else {
            // ➕ Registrar nueva categoría
            await registrarNuevaCategoria(nombre, visible);
        }


        // 🔄 Refrescar la lista
        await cargarCategorias();
        clearCategorySelection();

    } catch (error) {
        console.error("❌ Error al guardar categoría:", error);
        mostrarToast("❌ Error al guardar categoría.", "error");
    } finally {
        bootstrap.Modal.getInstance(document.getElementById("categoriaModal")).hide();
        botonGuardar.disabled = false;
    }
}

// 📋 Carga la lista de categorías
export async function cargarCategorias() {
    showLoading();
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .order('orden', { ascending: true });

        if (error) throw error;
        categoriasOrdenadas = data;

        renderizarCategorias();

    } catch (error) {
        console.error("❌ Error al cargar categorías:", error);
        mostrarToast("❌ Error al cargar categorías.", "error");
    }
    hideLoading();
}

// ✏️ Carga los datos de una categoría para editar
export async function editarCategoria(idCategoria) {
    try {
        mostrarFormularioCategoria();
        // Mantener el mismo orden al editar
        console.log("Buscando categoría con id:", idCategoria);
        const categoria = categoriasOrdenadas.find(c => c.id === Number(idCategoria)); // Convierte a número
        console.log("Categoría encontrada:", categoria);
        if (!categoria) throw new Error("No se pudo cargar la categoría");
        if (categoria) {
            document.getElementById("form-categoria").dataset.ordenActual = categoria.orden;
        }

        if (!categoria) throw new Error("No se pudo cargar la categoría");

        // 🔹 Llenar el formulario con los datos
        document.getElementById("categoria-nombre").value = categoria.nombre;
        document.getElementById("categoria-visible").checked = !!categoria.visible_cliente;

        // 🔹 Configurar el formulario para edición
        const formulario = document.getElementById("form-categoria");
        formulario.dataset.categoriaId = idCategoria;
        document.getElementById("categoriaModalLabel").textContent = "Editar categoría";
        document.querySelector("#form-categoria button[type='submit']").textContent = "Actualizar categoría";



        // Seleccionar fila
        selectCategoryRow(idCategoria);

    } catch (error) {
        console.error("❌ Error al cargar categoría:", error);
        mostrarToast("❌ Error al cargar categoría.", "error");
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

            // Eliminar el backdrop manualmente si no se elimina automáticamente
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
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

async function actualizarCategoria(idCategoria, nombre, orden, visible) {
    const { error } = await supabase
        .from("categorias")
        .update({ nombre, orden, visible_cliente: visible })
        .eq("id", idCategoria);

    if (error) throw error;
    const modalElement = document.getElementById('categoriaModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }

    // Eliminar el backdrop manualmente si no se elimina automáticamente
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
        backdrop.remove();
    }
    mostrarToast("✅ Categoría actualizada correctamente", "success");
}

async function registrarNuevaCategoria(nombre, visible) {
    try {
        const orden = categoriasOrdenadas.length > 0 ?
            Math.max(...categoriasOrdenadas.map(c => c.orden)) + 1 : 1;

        const { error } = await supabase
            .from("categorias")
            .insert([{ nombre, orden, visible_cliente: visible }]);

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

    categoriasOrdenadas.forEach((categoria) => {
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
<td>
  <button 
    class="btn btn-sm ${categoria.visible_cliente ? 'btn-success' : 'btn-secondary'} toggle-visibilidad-btn"
    data-id="${categoria.id}" 
    data-visible="${categoria.visible_cliente}">
    <i class="fas ${categoria.visible_cliente ? 'fa-eye' : 'fa-eye-slash'}"></i>
  </button>
</td>

        `;
        // Eventos para drag and drop
        fila.addEventListener('dragstart', handleDragStart);
        fila.addEventListener('dragover', handleDragOver);
        fila.addEventListener('drop', handleDrop);
        fila.addEventListener('dragend', handleDragEnd);

        // La fila completa sigue siendo seleccionable
        fila.addEventListener('click', (e) => {
            if (!e.target.closest('.handle') && !e.target.closest('button')) {
                const categoryId = fila.dataset.id;
                if (selectedCategoryId === categoryId) {
                    clearCategorySelection();
                } else {
                    selectCategoryRow(categoryId);
                }
            }
        });
        // Evento del toggle de visibilidad
        fila.querySelector('.toggle-visibilidad-btn').addEventListener('click', async (e) => {
            e.stopPropagation(); // evita que se seleccione la fila
            const btn = e.currentTarget;
            const id = btn.dataset.id;
            const visibleActual = btn.dataset.visible === "true";
            const nuevoEstado = !visibleActual;

            try {
                await supabase
                    .from("categorias")
                    .update({ visible_cliente: nuevoEstado })
                    .eq("id", id);

                mostrarToast(`✅ Visibilidad ${nuevoEstado ? "activada" : "ocultada"}`, "success");
                await cargarCategorias(); // refresca la tabla

            } catch (err) {
                console.error("❌ Error al cambiar visibilidad:", err);
                mostrarToast("❌ Error al cambiar visibilidad", "error");
            }
        });

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
        mostrarToast("❌ Error al actualizar orden de categorías.", "error");
    } finally {
        hideLoading();
    }
}