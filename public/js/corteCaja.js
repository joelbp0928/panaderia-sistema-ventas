import { supabase } from './supabase-config.js';
import { getLocalDateString, getCDMXISOString } from './dateLocalDate.js';
import { configuracionGlobal } from './config.js';

// Al cargar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar spinner
  // Simplemente usa new Date() para obtener la hora local del cliente
  const fechaLocal = new Date();
  const fechaCDMX = fechaLocal.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  console.log(fechaCDMX)
  //document.getElementById("loading-spinner").style.display = "flex";
  sincronizarLocalStorageConBase();
  // Verificar caja
  const today = getLocalDateString();
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  const { data: ultimoCorte, error: errorCorte } = await supabase
    .from('cortes_caja')
    .select('id, cerrado')
    .eq('empleado_id', usuarioId)
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .order('fecha', { ascending: false })
    .limit(1);

  if (errorCorte) {
    console.error("Error al consultar cortes de caja:", errorCorte);
  } else if (!ultimoCorte || ultimoCorte.length === 0) {
    console.log("No se encontró ningún corte de caja para hoy.");
  } else {
    console.log(`Último corte encontrado: ID=${ultimoCorte[0].id}, cerrado=${ultimoCorte[0].cerrado}`);
    if (ultimoCorte[0].cerrado) {
      console.log("El último corte está CERRADO → No hay caja abierta.");
    } else {
      console.log("El último corte está ABIERTO → Hay caja abierta.");
    }
  }


  if (!ultimoCorte || ultimoCorte.length === 0 || ultimoCorte[0].cerrado) {
    // No hay caja abierta → mostrar modal de apertura
    console.log("No hay caja abierta → mostrar modal de apertura")
    // Habilitar operaciones
    /* document.querySelectorAll('.btn-cobro').forEach(btn => {
       btn.disabled = true;
     });*/
    //  await bloquearOperacionesSiCajaCerrada();
    await abrirCajaConFondo();
  }

  /*
    if (!corteHoy || corteHoy.length === 0 || corteHoy[0].cerrado) {
      const abrioCaja = await abrirCajaConFondo();
      if (!abrioCaja) {
       // await bloquearOperacionesSiCajaCerrada();
      }
    }*/

  // Actualizar botón
  await actualizarBotonCorteCaja();

  // Configurar evento del botón
  document.getElementById("corte-caja-btn").addEventListener("click", async function () {
    const today = getLocalDateString();
    const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById("menuLateral"));
    const { data: corteActual } = await supabase
      .from('cortes_caja')
      .select('id, cerrado')
      .eq('empleado_id', usuarioId)
      .gte('fecha', `${today}T00:00:00`)
      .lte('fecha', `${today}T23:59:59`)
      .order('fecha', { ascending: false })
      .limit(1);

    if (!corteActual || corteActual.length === 0 || corteActual[0].cerrado) {
      sidebar.hide();
      await abrirCajaConFondo(true);
    } else {
      const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById("menuLateral"));
      if (sidebar) sidebar.hide();
      await new Promise(resolve => setTimeout(resolve, 100));
      await registrarCorteCaja();

      // Después de cerrar, forzar apertura de nueva caja
      /* const abrioNuevaCaja = await abrirCajaConFondo(true);
       if (!abrioNuevaCaja) {
        // await bloquearOperacionesSiCajaCerrada();
       }*/
    }

    await actualizarBotonCorteCaja();
  });

  // Ocultar spinner
  document.getElementById("loading-spinner").style.display = "none";
});

// Nueva función para actualizar el texto del botón
async function actualizarBotonCorteCaja() {
  const today = getLocalDateString();
  const btn = document.getElementById("corte-caja-btn");
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  const { data: corteHoy, error } = await supabase
    .from('cortes_caja')
    .select('cerrado')
    .eq('empleado_id', usuarioId)
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .order('fecha', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error al verificar corte:", error);
    return;
  }

  if (!corteHoy || corteHoy.length === 0 || corteHoy[0].cerrado) {
    btn.innerHTML = '<i class="fas fa-cash-register"></i> Abrir Caja';
    btn.classList.remove('btn-outline-danger');
    btn.classList.add('btn-outline-success');
  } else {
    btn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Cerrar Caja';
    btn.classList.remove('btn-outline-success');
    btn.classList.add('btn-outline-danger');
  }
}

// Función para verificar estado de la caja
export async function verificarEstadoCaja() {
  // Verificar en localStorage primero para rapidez
  const cajaAbierta = localStorage.getItem('cajaAbierta') === 'true';
  console.log(cajaAbierta)
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  if (!cajaAbierta) {
    // Verificar en la base de datos por si acaso
    const today = getLocalDateString();
    const { data, error } = await supabase
      .from('cortes_caja')
      .select('id')
      .eq('empleado_id', usuarioId)
      .gte('fecha', `${today}T00:00:00`)
      .lte('fecha', `${today}T23:59:59`)
      .order('fecha', { ascending: false }) // 👈 importante
      .limit(1); // si solo quieres el más reciente

    if (error) {
      console.error("Error al verificar cortes:", error);
      return false;
    }
    if (data && data.length > 0) {
      localStorage.setItem('cajaAbierta', 'true');
      localStorage.setItem('fechaCorte', today);
      localStorage.setItem('ultimoCorteId', data[0].id); // ✅ CORRECTO
      return true;
    }

    return false;
  }
  return true;
}

// Función para bloquear operaciones si la caja está cerrada
export async function bloquearOperacionesSiCajaCerrada() {
  // Obtener fecha y hora exactas de CDMX como string
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const fechaCDMX = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value} ${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;

  // Convertir ese string a objeto Date (hora local de CDMX)
  const fechaExactaCDMX = new Date(`${fechaCDMX} GMT-0600`);
  const fechaCorte = localStorage.getItem('fechaCorte');

  // Verificar si la fecha guardada es diferente a hoy
  if (fechaCorte && fechaCorte !== fechaExactaCDMX) {
    localStorage.removeItem('cajaAbierta');
    localStorage.removeItem('ultimoCorteId');
    localStorage.removeItem('fondoInicial');
  }
  const cajaAbierta = await verificarEstadoCaja();

  if (!cajaAbierta) {
    // Modal mejorado con más opciones
    Swal.fire({
      icon: 'error',
      title: 'Caja cerrada',
      html: `
        <p>No puedes realizar operaciones sin abrir caja primero.</p>
        <div class="d-grid gap-2 mt-3">
          <button id="btn-forzar-apertura" class="btn btn-primary">
            <i class="fas fa-cash-register"></i> Abrir Caja Ahora
          </button>
          <button id="btn-recargar" class="btn btn-secondary">
            <i class="fas fa-sync-alt"></i> Recargar Página
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      didOpen: () => {
        document.getElementById('btn-forzar-apertura').addEventListener('click', async () => {
          const abrioCaja = await abrirCajaConFondo(true);
          if (abrioCaja) {
            Swal.close();
            /*  document.querySelectorAll('.btn-cobro').forEach(btn => {
                btn.disabled = false;
              });*/
          }
        });

        document.getElementById('btn-recargar').addEventListener('click', () => {
          location.reload();
        });
      }
    });

    // Deshabilitar operaciones
    /* document.querySelectorAll('.btn-cobro').forEach(btn => {
       btn.disabled = true;
     });*/

    return true;
  }
  return false;
}

// Función para abrir caja con fondo inicial
export async function abrirCajaConFondo(force = false) {
  const today = getLocalDateString();
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  // Verificar si ya hay caja abierta hoy
  const { data: corteExistente } = await supabase
    .from('cortes_caja')
    .select('id, cerrado')
    .eq('empleado_id', usuarioId)
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .order('fecha', { ascending: false })
    .limit(1);

  if (corteExistente && corteExistente.length > 0 && !corteExistente[0].cerrado && !force) {
    Swal.fire({
      icon: 'info',
      title: 'Caja ya abierta',
      text: 'Ya hay una caja abierta para hoy.',
    });
    return true; // Consideramos que la caja está abierta
  }

  // Resto de la función de apertura...
  const { value: formValues } = await Swal.fire({
    title: 'Apertura de Caja',
    html: `
      <div>
        <label for="fondo-inicial"><i class="fa-solid fa-wallet"></i> Fondo Inicial (Efectivo):</label>
        <input id="fondo-inicial" type="number" class="swal2-input" placeholder="$0.00" step="0.01" min="0" required>
      </div>
      <div>
        <label for="observaciones-apertura"><i class="fa-solid fa-comment"></i> Observaciones:</label>
        <textarea id="observaciones-apertura" class="swal2-textarea" placeholder="Notas sobre el fondo inicial..."></textarea>
      </div>
    `,
    focusConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    preConfirm: () => {
      const fondo = parseFloat(document.getElementById('fondo-inicial').value);
      if (isNaN(fondo)) {
        Swal.showValidationMessage("Debes ingresar un monto válido");
        return false;
      }
      return {
        fondoInicial: fondo,
        observaciones: document.getElementById('observaciones-apertura').value
      };
    }
  });

  if (!formValues) {
    // Mostrar aviso de cancelación
    await Swal.fire({
      icon: "info",
      title: "Corte de caja cancelado",
      text: "El corte de caja no se ha registrado.",
    });

    // Llamar al modal que bloquea operaciones si no hay caja abierta
    await new Promise(r => setTimeout(r, 300));
    await bloquearOperacionesSiCajaCerrada();

    return;
  }

  // Obtener fecha actual en zona horaria de CDMX
  const fechaCDMX = new Date().toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // Para formato 24 horas
  });

  // Convertir a formato ISO 8601 para PostgreSQL
  const partes = fechaCDMX.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
  const fechaISO = `${partes[3]}-${partes[2]}-${partes[1]}T${partes[4]}:${partes[5]}:${partes[6]}`;

  // Resto del código de inserción...
  const { data, error } = await supabase
    .from('cortes_caja')
    .insert([{
      fecha: fechaISO,
      fondo_inicial: formValues.fondoInicial,
      monto_ventas: 0,
      monto_efectivo: formValues.fondoInicial,
      ingresos_adicionales: 0,
      salidas_caja: 0,
      saldo_final: formValues.fondoInicial,
      empleado_id: usuarioId,
      observaciones: `Apertura: ${formValues.observaciones || 'Sin observaciones'}`,
      cerrado: false
    }])
    .select();

  if (error) {
    console.error("Error al abrir caja:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo registrar la apertura de caja.'
    });
    return false;
  }

  if (data && data.length > 0) {
    // 1. Obtener el nombre del empleado
    const { data: empleado, error: errorEmpleado } = await supabase
      .from('empleados')
      .select('usuario_id')
      .eq('id', usuarioId)
      .single();

    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', usuarioId)
      .single();

    const nombreEmpleado = usuario?.nombre || 'Empleado Desconocido';

    await actualizarBotonCorteCaja();
    // 2. Imprimir el ticket
    imprimirCorteDeCaja(data[0], nombreEmpleado);
  }

  // Actualizar estado en localStorage
  localStorage.setItem('cajaAbierta', 'true');
  localStorage.setItem('ultimoCorteId', data[0].id);
  localStorage.setItem('fondoInicial', formValues.fondoInicial);
  localStorage.setItem('fechaCorte', today);

  // Habilitar operaciones
  /*  document.querySelectorAll('.btn-cobro').forEach(btn => {
      btn.disabled = false;
    });*/

  return true;
}

// Función para registrar un nuevo corte de caja
export async function registrarCorteCaja() {
  // Verificar si hay caja abierta
  const today = getLocalDateString();
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }
  const { data: cortesAbiertos, error: errorCortes } = await supabase
    .from('cortes_caja')
    .select('id, fondo_inicial')
    .eq('empleado_id', usuarioId)
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .is('cerrado', false)
    .order('fecha', { ascending: false })
    .limit(1);


  const corteAbierto = cortesAbiertos?.[0];

  if (!corteAbierto) {
    Swal.fire({
      icon: 'error',
      title: 'No hay caja abierta',
      text: 'Debes abrir caja con un fondo inicial antes de poder cerrarla.',
    });
    return;
  }

  // 1. Obtener los 'pedido_id' de los cobros realizados hoy
  const { data: cobros, error: errorCobros } = await supabase
    .from('historial_cobros')
    .select('pedido_id')
    .eq('empleado_cobro_id', usuarioId)
    .gte('fecha_cobro', `${today}T00:00:00`)
    .lte('fecha_cobro', `${today}T23:59:59`);

  if (errorCobros) {
    console.error("Error al obtener cobros:", errorCobros);
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
         <label for="monto-ventas"><i class="fa-solid fa-dollar-sign"></i> Monto de Ventas:</label>
         <input id="monto-ventas" type="text" class="swal2-input" value="$${montoVentas.toFixed(2)}" readonly>
       </div>
       <div>
         <label for="monto-efectivo"><i class="fa-solid fa-cash-register"></i> Caja Final (Efectivo):</label>
         <input id="monto-efectivo" type="number" class="swal2-input" placeholder="$0.00">
       </div>
       <div>
         <label for="ingresos-adicionales"><i class="fa-solid fa-money-bill-wave"></i> Ingresos Adicionales:</label>
         <input id="ingresos-adicionales" type="number" class="swal2-input" placeholder="$0.00">
       </div>
       <div>
         <label for="salidas-caja"><i class="fa-solid fa-cash-register"></i> Salidas de Caja:</label>
         <input id="salidas-caja" type="number" class="swal2-input" placeholder="$0.00">
       </div>
       <div>
         <label for="observaciones"><i class="fa-solid fa-comment"></i> Observaciones:</label>
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
        observaciones: document.getElementById('observaciones').value,
        empleadoId: usuarioId // Pasamos el empleado_id
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
  const cajaEsperada = corteAbierto.fondo_inicial + montoVentas + ingresosAdicionales - salidasCaja;
  const diferencia = montoEfectivo - cajaEsperada;

  // Mostrar la confirmación de corte de caja con los detalles
  const confirmacion = await Swal.fire({
    title: "Confirmar Corte de Caja",
    html: `
      <p><strong>Total Ventas:</strong> $${montoVentas.toFixed(2)}</p>
      <p><strong>Ingresos Adicionales:</strong> $${ingresosAdicionales.toFixed(2)}</p>
      <p><strong>Salidas de Caja:</strong> $${salidasCaja.toFixed(2)}</p>
      <p><strong>Saldo Final (calculado):</strong> $${saldoFinal.toFixed(2)}</p>
      <p><strong>Caja Esperada:</strong> $${cajaEsperada.toFixed(2)}</p>
      <p><strong>Caja Reportada:</strong> $${montoEfectivo.toFixed(2)}</p>
      <p><strong>Verificación:</strong> ${diferencia === 0 ? '✅ Coincide' : `❌ Diferencia de $${diferencia.toFixed(2)}`}</p>
      <p><strong>Observaciones:</strong> ${observaciones || 'Sin observaciones'}</p>
    `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Confirmar Corte",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#28a745",
    cancelButtonColor: "#dc3545"
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
  // Obtener fecha actual en zona horaria de CDMX
  const fechaCDMX = new Date().toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // Para formato 24 horas
  });

  // Convertir a formato ISO 8601 para PostgreSQL
  const partes = fechaCDMX.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
  const fechaISO = `${partes[3]}-${partes[2]}-${partes[1]}T${partes[4]}:${partes[5]}:${partes[6]}`;
  // Insertamos el corte de caja en la base de datos
  try {
    const { data, error } = await supabase
      .from("cortes_caja")
      .insert([{
        fecha: fechaISO,
        fondo_inicial: corteAbierto.fondo_inicial, // conservar el mismo fondo de apertura
        monto_ventas: montoVentas,
        monto_efectivo: montoEfectivo,
        ingresos_adicionales: ingresosAdicionales,
        salidas_caja: salidasCaja,
        saldo_final: saldoFinal,
        empleado_id: usuarioId,
        observaciones: `Cierre: ${observaciones || 'Sin observaciones'}`,
        cerrado: true
      }])
      .select();

    // Verificamos si hay un error al insertar
    if (error) {
      console.error("Error al registrar el corte de caja:", error);
      Swal.fire({
        icon: "error",
        title: "Error al registrar el corte",
        text: "Hubo un problema al registrar el corte de caja. Intenta nuevamente.",
      });
      return;
    }

    // Mostrar los datos para depurar
    console.log("Corte de caja registrado:", data);

    // Si todo está bien, mostrar un mensaje de éxito
    Swal.fire({
      icon: "success",
      title: "Corte de Caja Registrado",
      text: "El corte de caja se ha registrado exitosamente.",
    });

    // Llamar a la función de impresión
    if (data && data.length > 0) {
      // 1. Obtener el nombre del empleado
      const { data: empleado, error: errorEmpleado } = await supabase
        .from('empleados')
        .select('usuario_id')
        .eq('id', usuarioId)
        .limit(1);;

      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', usuarioId)
        .limit(1);;

      const nombreEmpleado = usuario?.nombre || 'Empleado Desconocido';

      // 2. Imprimir el ticket
      imprimirCorteDeCaja(data[0], nombreEmpleado);

    } else {
      console.error("No se recibieron datos del corte insertado");
    }

    // Limpiar localStorage al cerrar caja
    localStorage.removeItem('cajaAbierta');
    localStorage.removeItem('ultimoCorteId');
    localStorage.removeItem('fondoInicial');

    // await bloquearOperacionesSiCajaCerrada();
    // Mostrar modal para abrir nueva caja inmediatamente
    setTimeout(async () => {
      const abrioCaja = await abrirCajaConFondo(true);
      if (!abrioCaja) {
        await bloquearOperacionesSiCajaCerrada();
      }
    }, 1500); // Pequeño retraso para mejor UX

  } catch (error) {
    console.error("Error al registrar el corte:", error);
    Swal.fire({
      icon: "error",
      title: "Error al registrar",
      text: "Hubo un problema al realizar el corte de caja.",
    });
  }
}

function imprimirCorteDeCaja(corte, nombreEmpleado) {
  const htmlCorte = generarHTMLCorteDeCaja(corte, nombreEmpleado);

  // Crear una ventana nueva para imprimir
  const ventanaImpresion = window.open('', '', 'width=600,height=400');
  ventanaImpresion.document.open();
  ventanaImpresion.document.write(htmlCorte);
  ventanaImpresion.document.close();

  // Esperar un poco para que el contenido cargue completamente
  setTimeout(() => {
    ventanaImpresion.focus();  // Asegurarse de que la ventana esté activa
    ventanaImpresion.print();  // Iniciar la impresión
    ventanaImpresion.close();  // Cerrar la ventana después de la impresión
  }, 1000); // Espera 1 segundo para que el contenido se cargue
}

function generarHTMLCorteDeCaja(corte, nombreEmpleado) {
  const fecha = getCDMXISOString();

  const tipoCorte = corte.cerrado ? 'CIERRE DE CAJA' : 'APERTURA DE CAJA';
  const cajaEsperada = corte.fondo_inicial + corte.monto_ventas + corte.ingresos_adicionales - corte.salidas_caja;
  const diferencia = corte.monto_efectivo - cajaEsperada;

  return `
    <html>
      <head>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 3mm; }
          .header { text-align: center; margin-bottom: 5mm; }
          .title { font-weight: bold; font-size: 1.2em; }
          .tipo-corte { 
            font-weight: bold; 
            font-size: 1.1em;
            text-align: center;
            margin: 3mm 0;
            padding: 2mm;
            background: ${corte.cerrado ? '#f8d7da' : '#d4edda'};
            border-radius: 5px;
          }
          .detail { display: flex; justify-content: space-between; margin: 2mm 0; }
          .divider { border-top: 1px dashed #000; margin: 3mm 0; }
          .footer { font-size: 0.8em; text-align: center; margin-top: 5mm; }
          .text-right { text-align: right; }
          .text-bold { font-weight: bold; }
          .total-box { 
            border: 2px solid #000;
            padding: 3mm;
            margin-top: 4mm;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${configuracionGlobal.nombre_empresa || 'Mi Negocio'}</div>
          <div>Corte #${corte.id}</div>
          <div>${fecha}</div>
        </div>

        <div class="tipo-corte">
          ${tipoCorte}
        </div>

        <div class="detail">
          <span>Fondo Inicial:</span>
          <span>$${corte.fondo_inicial?.toFixed(2) || '0.00'}</span>
        </div>

        ${corte.cerrado ? `
          <div class="detail">
            <span>Ventas Totales:</span>
            <span>$${corte.monto_ventas.toFixed(2)}</span>
          </div>
          <div class="detail">
            <span>Ingresos Adicionales:</span>
            <span>+ $${corte.ingresos_adicionales.toFixed(2)}</span>
          </div>
          <div class="detail">
            <span>Salidas de Caja:</span>
            <span>- $${corte.salidas_caja.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
                  <div class="detail text-bold">
          <span>Efectivo Reportado:</span>
          <span>$${corte.monto_efectivo.toFixed(2)}</span>
        </div>
        <div class="detail">
          <span>Caja Esperada:</span>
          <span>$${cajaEsperada.toFixed(2)}</span>
        </div>
        <div class="detail">
          <span>Verificación:</span>
          <span>${diferencia === 0 ? '<i class="fa-solid fa-check fa-lg"></i> Coincide' : `<i class="fa-solid fa-xmark fa-lg"></i> Diferencia de $${diferencia.toFixed(2)}`}</span>
        </div>

          <div class="total-box">
            <div class="detail text-bold">
              <span>SALDO FINAL:</span>
              <span>$${corte.saldo_final.toFixed(2)}</span>
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <div>Responsable: ${nombreEmpleado}</div>
          <div>${corte.observaciones || 'Sin observaciones'}</div>
          <div>--------------------------------</div>
          <div>Este ticket es un comprobante digital</div>
        </div>
      </body>
    </html>
  `;
}

export async function sincronizarLocalStorageConBase() {
  const today = getLocalDateString();
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  const { data, error } = await supabase
    .from('cortes_caja')
    .select('id, cerrado')
    .eq('empleado_id', usuarioId)
    .gte('fecha', `${today}T00:00:00`)
    .lte('fecha', `${today}T23:59:59`)
    .order('fecha', { ascending: false })
    .limit(1);

  if (data && data.length > 0 && !data[0].cerrado) {
    localStorage.setItem('cajaAbierta', 'true');
    localStorage.setItem('fechaCorte', today);
    localStorage.setItem('ultimoCorteId', data[0].id);
  } else {
    limpiarEstadoCajaLocal(); // Si no hay caja abierta, limpia
  }
}
export function limpiarEstadoCajaLocal() {
  localStorage.removeItem('cajaAbierta');
  localStorage.removeItem('ultimoCorteId');
  localStorage.removeItem('fondoInicial');
  localStorage.removeItem('fechaCorte');
}

document.getElementById("open-history-cortes-btn").addEventListener("click", async () => {
  await cargarHistorialCortes();
  const historial = new bootstrap.Offcanvas(document.getElementById("historialCortesOffcanvas"));
  historial.show();
});

// Función para cargar los cortes de caja del historial
export async function cargarHistorialCortes() {
  // Obtener el ID del empleado actual desde la sesión ANTES de consultar cobros
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const usuarioId = sessionData?.session?.user?.id;

  if (sessionError || !usuarioId) {
    Swal.fire({
      icon: 'error',
      title: 'Error al obtener el empleado',
      text: 'Hubo un problema al obtener el ID del empleado. Por favor, verifica tu sesión.',
    });
    return;
  }

  const { data, error } = await supabase
    .from("cortes_caja")
    .select("*")
    .eq('empleado_id', usuarioId)
    .order("fecha", { ascending: false })
    .limit(30); // 🔢 limitar resultados

  if (error) {
    console.error("Error al cargar cortes:", error);
    return;
  }

  const contenedor = document.getElementById('contenedorHistorialCortes');
  contenedor.innerHTML = ''; // Limpiar antes de mostrar

  if (!data || data.length === 0) {
    // Mostrar mensaje cuando no hay cortes
    contenedor.innerHTML = `
      <div class="alert alert-info text-center my-4">
        <i class="fas fa-info-circle me-2"></i>
        No se encontraron cortes de caja para tu usuario.
      </div>
    `;
    return;
  }

  // Si hay cortes, los mostramos
  data.forEach(corte => {
    const card = document.createElement('div');
    card.className = 'col-12';
    card.innerHTML = `
      <div class="card shadow-sm rounded-4 p-3 bg-light historal-corte-card" style="cursor:pointer" data-id="${corte.id}">
        <div class="d-flex justify-content-between">
          <div>
            <div class="fw-bold">${new Date(corte.fecha).toLocaleString()}</div>
            <div class="text-muted">${corte.cerrado ? '🟥 Cierre de Caja' : '🟩 Apertura de Caja'}</div>
          </div>
          <div class="text-end">
            <div><i class="fa-solid fa-coins"></i> $${corte.saldo_final.toFixed(2)}</div>
            <div><i class="fa-solid fa-sack-dollar"></i> $${corte.monto_ventas.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
    card.querySelector('.historal-corte-card').addEventListener('click', () => verDetalleCorte(corte.id));
    contenedor.appendChild(card);
  });
}

// Cargar detalles del corte de caja
window.verDetalleCorte = async function (corteId) {
  const { data, error } = await supabase
    .from("cortes_caja")
    .select("*")
    .eq("id", corteId)
   // .eq('empleado_id', usuarioId)
    .single();

  if (error) {
    console.error("Error al cargar detalle del corte de caja:", error);
    return;
  }

  document.getElementById("detalle-fecha").textContent = new Date(data.fecha).toLocaleString();
  document.getElementById("detalle-ventas").textContent = `$${data.monto_ventas.toFixed(2)}`;
  document.getElementById("detalle-efectivo").textContent = `$${data.monto_efectivo.toFixed(2)}`;
  document.getElementById("detalle-saldo").textContent = `$${data.saldo_final.toFixed(2)}`;
  document.getElementById("detalle-observaciones").textContent = data.observaciones;

  const modal = new bootstrap.Modal(document.getElementById("detalleCorteModal"));
  modal.show();
}
