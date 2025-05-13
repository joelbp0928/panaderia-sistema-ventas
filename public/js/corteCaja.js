import { supabase } from './supabase-config.js';
import { getLocalDateString } from './dateLocalDate.js';

// Evento para activar el corte de caja
document.getElementById("corte-caja-btn").addEventListener("click", registrarCorteCaja);
// Función para registrar un nuevo corte de caja
export async function registrarCorteCaja() {
    // Obtener la fecha de hoy
    const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  
    // 1. Obtener los 'pedido_id' de los cobros realizados hoy
    const { data: cobros, error: errorCobros } = await supabase
      .from('historial_cobros')
      .select('pedido_id')
      .gte('fecha_cobro', `${today}T00:00:00`)
      .lte('fecha_cobro', `${today}T23:59:59`);
  
    if (errorCobros) {
      Swal.fire({
        icon: 'error',
        title: 'Error al obtener cobros',
        text: 'Hubo un problema al obtener los cobros realizados hoy.',
      });
      return;
    }
  
    // Extraer los 'pedido_id' de los cobros obtenidos
    const pedidoIds = cobros.map(cobro => cobro.pedido_id);
  
    // 2. Obtener los montos totales de los pedidos realizados hoy
    const { data: pedidos, error: errorPedidos } = await supabase
      .from('pedidos')
      .select('total')
      .in('id', pedidoIds);
  
    if (errorPedidos) {
      Swal.fire({
        icon: 'error',
        title: 'Error al obtener pedidos',
        text: 'Hubo un problema al obtener los montos de los pedidos realizados hoy.',
      });
      return;
    }
  
    // Sumar los montos de las ventas realizadas hoy
    const montoVentas = pedidos.reduce((total, pedido) => total + pedido.total, 0);
  
    // Mostrar el modal para registrar el corte de caja
    const { value: formValues } = await Swal.fire({
      title: 'Corte de Caja',
      html: `
        <div>
          <label for="monto-ventas">Monto de Ventas:</label>
          <input id="monto-ventas" type="text" class="swal2-input" value="$${montoVentas.toFixed(2)}" readonly>
        </div>
        <div>
          <label for="monto-efectivo">Monto en Efectivo:</label>
          <input id="monto-efectivo" type="number" class="swal2-input" placeholder="$0.00">
        </div>
        <div>
          <label for="ingresos-adicionales">Ingresos Adicionales:</label>
          <input id="ingresos-adicionales" type="number" class="swal2-input" placeholder="$0.00">
        </div>
        <div>
          <label for="salidas-caja">Salidas de Caja:</label>
          <input id="salidas-caja" type="number" class="swal2-input" placeholder="$0.00">
        </div>
        <div>
          <label for="observaciones">Observaciones:</label>
          <textarea id="observaciones" class="swal2-textarea" placeholder="Escribe tus observaciones aquí..."></textarea>
        </div>
      `,
      focusConfirm: true,
      showCancelButton: true,
      preConfirm: () => {
        return {
          montoVentas: document.getElementById('monto-ventas').value,
          montoEfectivo: document.getElementById('monto-efectivo').value,
          ingresosAdicionales: document.getElementById('ingresos-adicionales').value,
          salidasCaja: document.getElementById('salidas-caja').value,
          observaciones: document.getElementById('observaciones').value
        }
      }
    });
  
    // Si el cajero cancela o no ingresa los datos, no proceder
    if (!formValues) {
      Swal.fire({
        icon: 'error',
        title: 'Cancelado',
        text: 'No se ha ingresado ningún dato.',
      });
      return;
    }
  
    // Obtener los datos del formulario
    const montoEfectivo = parseFloat(formValues.montoEfectivo) || 0;
    const ingresosAdicionales = parseFloat(formValues.ingresosAdicionales) || 0;
    const salidasCaja = parseFloat(formValues.salidasCaja) || 0;
    const observaciones = formValues.observaciones;
  
    // Calculamos el saldo final
    const saldoFinal = montoVentas - salidasCaja;
  
    // Mostrar la confirmación de corte de caja con los detalles
    const confirmacion = await Swal.fire({
      title: "Confirmar Corte de Caja",
      html: `
        <p><strong>Total Ventas:</strong> $${montoVentas.toFixed(2)}</p>
        <p><strong>Total Efectivo:</strong> $${montoEfectivo.toFixed(2)}</p>
        <p><strong>Ingresos Adicionales:</strong> $${ingresosAdicionales.toFixed(2)}</p>
        <p><strong>Salidas de Caja:</strong> $${salidasCaja.toFixed(2)}</p>
        <p><strong>Saldo Final:</strong> $${saldoFinal.toFixed(2)}</p>
        <p><strong>Observaciones:</strong> ${observaciones}</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirmar Corte",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#28a745", // Verde para confirmar
      cancelButtonColor: "#dc3545",  // Rojo para cancelar
    });
  
    if (!confirmacion.isConfirmed) {
      // Si el usuario cancela, no hacer el corte
      Swal.fire({
        icon: "info",
        title: "Corte de caja cancelado",
        text: "El corte de caja no se ha registrado.",
      });
      return;
    }
  
    // Insertamos el corte de caja en la base de datos
    try {
      const { data, error } = await supabase
        .from("cortes_caja")
        .insert([
          {
            fecha: new Date(),
            monto_ventas: montoVentas,
            monto_efectivo: montoEfectivo,
            ingresos_adicionales: ingresosAdicionales,
            salidas_caja: salidasCaja,
            saldo_final: saldoFinal,
            empleado_id: 1, // ID del empleado actual (esto se debe obtener dinámicamente)
            observaciones: observaciones,
          },
        ]);
  
      if (error) {
        console.error("Error al registrar el corte de caja:", error);
        Swal.fire({
          icon: "error",
          title: "Error al registrar el corte",
          text: "Hubo un problema al registrar el corte de caja. Intenta nuevamente.",
        });
        return;
      }
  
      // Si todo está bien, mostrar un mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "Corte de Caja Registrado",
        text: "El corte de caja se ha registrado exitosamente.",
      });
  
    } catch (error) {
      console.error("Error al registrar el corte:", error);
      Swal.fire({
        icon: "error",
        title: "Error al registrar",
        text: "Hubo un problema al realizar el corte de caja.",
      });
    }
  }
  

// Función para cargar los cortes de caja del historial
export async function cargarHistorialCortes() {
    const desde = document.getElementById("filtro-fecha-desde").value;
    const hasta = document.getElementById("filtro-fecha-hasta").value;

    const { data, error } = await supabase
        .from("cortes_caja")
        .select("*")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false });

    if (error) {
        console.error("Error al cargar cortes de caja:", error);
        return;
    }

    const tablaCortes = document.getElementById("tabla-cortes");
    tablaCortes.innerHTML = ""; // Limpiar tabla antes de agregar datos

    data.forEach((corte) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
        <td>${new Date(corte.fecha).toLocaleString()}</td>
        <td>$${corte.monto_ventas.toFixed(2)}</td>
        <td>$${corte.saldo_final.toFixed(2)}</td>
        <td>${corte.observaciones}</td>
        <td><button class="btn btn-info" onclick="verDetalleCorte(${corte.id})">Ver Detalle</button></td>
      `;
        tablaCortes.appendChild(fila);
    });
}

// Cargar detalles del corte de caja
export async function verDetalleCorte(corteId) {
    const { data, error } = await supabase
        .from("cortes_caja")
        .select("*")
        .eq("id", corteId)
        .single();

    if (error) {
        console.error("Error al cargar detalle del corte de caja:", error);
        return;
    }

    // Mostrar el detalle del corte en el modal
    document.getElementById("detalle-fecha").textContent = new Date(data.fecha).toLocaleString();
    document.getElementById("detalle-ventas").textContent = `$${data.monto_ventas.toFixed(2)}`;
    document.getElementById("detalle-efectivo").textContent = `$${data.monto_efectivo.toFixed(2)}`;
    document.getElementById("detalle-saldo").textContent = `$${data.saldo_final.toFixed(2)}`;
    document.getElementById("detalle-observaciones").textContent = data.observaciones;

    // Mostrar modal con los detalles
    $('#detalleCorteModal').modal('show');
}
/*
// Añadir evento para registrar corte de caja
document.getElementById("registrar-corte-btn").addEventListener("click", registrarCorteCaja);

// Añadir evento para cargar historial de cortes
document.getElementById("ver-historial-btn").addEventListener("click", cargarHistorialCortes);
*/