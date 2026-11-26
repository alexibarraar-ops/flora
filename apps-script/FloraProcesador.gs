/**
 * Flora OS · Procesador inicial de producción.
 * Instalar bajo la cuenta de Google de Lucy. NO publicar como Web App todavía.
 * En Propiedades del script: FLORA_SPREADSHEET_ID = ID de FLORA_OS_DB.
 * Los registros reales se habilitarán solo tras validar recetas y probar el circuito.
 */

function FLORA_hoja_(nombre) {
  var id = PropertiesService.getScriptProperties().getProperty('FLORA_SPREADSHEET_ID');
  if (!id) throw new Error('Falta configurar FLORA_SPREADSHEET_ID');
  var hoja = SpreadsheetApp.openById(id).getSheetByName(nombre);
  if (!hoja) throw new Error('Falta la hoja ' + nombre);
  return hoja;
}

function FLORA_filas_(nombre) {
  var datos = FLORA_hoja_(nombre).getDataRange().getValues();
  var encabezados = datos.shift().map(String);
  return datos.filter(function(f) { return f.some(function(c) { return c !== ''; }); }).map(function(f) {
    var o = {};
    encabezados.forEach(function(h, i) { o[h] = f[i]; });
    return o;
  });
}

/** Prueba de conexión SIN escrituras ni exposición del contenido privado. */
function FLORA_verificarConexionPrivada() {
  var id = PropertiesService.getScriptProperties().getProperty('FLORA_SPREADSHEET_ID');
  if (!id) throw new Error('Falta configurar FLORA_SPREADSHEET_ID');
  var libro = SpreadsheetApp.openById(id);
  var especificacion = {
    PRODUCTOS: ['PRODUCTO_ID', 'NOMBRE', 'ACTIVO'],
    INSUMOS: ['INSUMO_ID', 'NOMBRE', 'UNIDAD'],
    RECETAS: ['PRODUCTO_ID', 'INSUMO_ID', 'CANTIDAD', 'UNIDAD', 'RENDIMIENTO'],
    CLIENTES: ['CLIENTE_ID', 'NOMBRE', 'CONSENTIMIENTO_CONTACTO'],
    VENTAS: ['VENTA_ID'],
    OPERACIONES_IA: ['REQUEST_ID'],
    REVISION_RECETAS: ['PRODUCTO_ID', 'ESTADO']
  };
  var faltantes = [];
  var encabezadosIncompletos = [];
  Object.keys(especificacion).forEach(function(nombre) {
    var hoja = libro.getSheetByName(nombre);
    if (!hoja) { faltantes.push(nombre); return; }
    var datos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);
    var columnas = especificacion[nombre].filter(function(c) { return datos.indexOf(c) === -1; });
    if (columnas.length) encabezadosIncompletos.push({ hoja: nombre, columnas: columnas });
  });
  var zona = libro.getSpreadsheetTimeZone();
  return { libro: libro.getName(), zonaHoraria: zona,
    faltanHojas: faltantes, faltanColumnas: encabezadosIncompletos,
    preparado: !faltantes.length && !encabezadosIncompletos.length && zona === 'America/Buenos_Aires',
    modo: 'SOLO_LECTURA',
    aviso: 'Este chequeo no activa registros, no publica API y no valida recetas ni stock.' };
}

function FLORA_numero_(valor, campo) {
  if (typeof valor !== 'number' || !isFinite(valor) || valor <= 0) {
    throw new Error(campo + ' debe ser positivo');
  }
  return valor;
}

function FLORA_redondear_(n) { return Math.round((n + Number.EPSILON) * 1e6) / 1e6; }

function FLORA_validarRequest_(orden) {
  if (!orden || orden.confirmado !== true) throw new Error('La operación requiere confirmación');
  if (typeof orden.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(orden.requestId)) {
    throw new Error('REQUEST_ID inválido');
  }
}

function FLORA_asegurarEventos_() {
  var id = PropertiesService.getScriptProperties().getProperty('FLORA_SPREADSHEET_ID');
  if (!id) throw new Error('Falta configurar FLORA_SPREADSHEET_ID');
  var libro = SpreadsheetApp.openById(id);
  var hoja = libro.getSheetByName('EVENTOS_STOCK');
  if (!hoja) {
    hoja = libro.insertSheet('EVENTOS_STOCK');
    hoja.getRange(1, 1, 1, 5).setValues([['REQUEST_ID', 'FECHA', 'TIPO', 'DATOS_JSON', 'RESULTADO_JSON']]);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function FLORA_eventos_(hoja) {
  var datos = hoja.getDataRange().getValues();
  datos.shift();
  return datos.filter(function(r) { return r[0] !== ''; }).map(function(r) {
    if (!r[4]) throw new Error('Evento incompleto: ' + r[0]);
    return { id: String(r[0]), fecha: String(r[1]), tipo: String(r[2]),
      datos: r[3] ? JSON.parse(String(r[3])) : {}, resultado: JSON.parse(String(r[4])) };
  });
}

function FLORA_saldos_(eventos) {
  var stock = {};
  eventos.forEach(function(e) {
    (e.resultado.movimientos || []).forEach(function(m) {
      var clave = m.tipo + ':' + m.id;
      stock[clave] = FLORA_redondear_((stock[clave] || 0) + m.cantidad);
    });
  });
  return stock;
}

/** Saldos por lote de productos terminados; conserva el vencimiento original. */
function FLORA_lotesDisponibles_(eventos, productoId, fecha) {
  var lotes = {};
  eventos.forEach(function(e) {
    (e.resultado.movimientos || []).forEach(function(m) {
      if (m.tipo !== 'producto' || m.id !== productoId) return;
      if (!m.loteId) throw new Error('Movimiento de producto sin lote');
      var lote = lotes[m.loteId];
      if (!lote) {
        if (m.cantidad < 0) throw new Error('Salida de lote desconocido');
        if (!m.vencimiento) throw new Error('Lote sin vencimiento');
        lote = { loteId: m.loteId, vencimiento: m.vencimiento, saldo: 0 };
        lotes[m.loteId] = lote;
      }
      if (m.vencimiento && m.vencimiento !== lote.vencimiento) throw new Error('Vencimiento de lote inconsistente');
      lote.saldo = FLORA_redondear_(lote.saldo + m.cantidad);
      if (lote.saldo < -1e-6) throw new Error('Stock negativo en lote ' + m.loteId);
    });
  });
  return Object.keys(lotes).map(function(id) { return lotes[id]; })
    .filter(function(l) { return l.saldo > 0 && l.vencimiento >= fecha; })
    .sort(function(a,b) { return a.vencimiento.localeCompare(b.vencimiento) || a.loteId.localeCompare(b.loteId); });
}

/** Vista previa sin escrituras. Rechaza recetas no validadas. */
function FLORA_calcularProduccion(orden) {
  if (!orden || typeof orden.productoId !== 'string') throw new Error('Producto obligatorio');
  var cantidad = FLORA_numero_(orden.cantidad, 'Cantidad');
  if (!Number.isInteger(cantidad)) throw new Error('La cantidad debe ser entera');
  var producto = FLORA_filas_('PRODUCTOS').filter(function(p) { return p.PRODUCTO_ID === orden.productoId; })[0];
  if (!producto) throw new Error('Producto inexistente');
  if (String(producto.ACTIVO).toUpperCase() !== 'SI') throw new Error('Receta pendiente de validación');
  var componentes = FLORA_filas_('RECETAS').filter(function(r) { return r.PRODUCTO_ID === orden.productoId; });
  if (!componentes.length) throw new Error('El producto no tiene receta');
  var insumos = {};
  FLORA_filas_('INSUMOS').forEach(function(i) { insumos[i.INSUMO_ID] = i; });
  var rendimiento = FLORA_numero_(componentes[0].RENDIMIENTO, 'Rendimiento');
  var agregados = {};
  componentes.forEach(function(c) {
    if (c.RENDIMIENTO !== rendimiento) throw new Error('Rendimientos inconsistentes');
    var insumo = insumos[c.INSUMO_ID];
    if (!insumo || !insumo.UNIDAD || insumo.UNIDAD !== c.UNIDAD) throw new Error('Unidad no validada: ' + c.INSUMO_ID);
    var cantidadInsumo = FLORA_redondear_(FLORA_numero_(c.CANTIDAD, 'Cantidad de receta') * cantidad / rendimiento);
    agregados[c.INSUMO_ID] = FLORA_redondear_((agregados[c.INSUMO_ID] || 0) + cantidadInsumo);
  });
  return { productoId: orden.productoId, cantidad: cantidad, consumo: Object.keys(agregados).map(function(id) {
    return { insumoId: id, cantidad: agregados[id], unidad: insumos[id].UNIDAD };
  }) };
}

/** Catálogo de fórmulas que ya superaron la validación; no publica los ingredientes. */
function FLORA_listarProductosCalculables() {
  var productos = FLORA_filas_('PRODUCTOS').filter(function(p) {
    return String(p.ACTIVO).toUpperCase() === 'SI' && String(p.TIPO || 'ELABORADO').toUpperCase() === 'ELABORADO';
  });
  var disponibles = [];
  var inconsistentes = [];
  productos.forEach(function(p) {
    try {
      FLORA_calcularProduccion({ productoId: String(p.PRODUCTO_ID), cantidad: 1 });
      disponibles.push({ productoId: String(p.PRODUCTO_ID), nombre: String(p.NOMBRE) });
    } catch (e) {
      inconsistentes.push({ productoId: String(p.PRODUCTO_ID), motivo: String(e.message) });
    }
  });
  disponibles.sort(function(a,b) { return a.nombre.localeCompare(b.nombre); });
  return { disponibles: disponibles, inconsistentes: inconsistentes };
}

/** Vista para una futura PWA autenticada: nombres, unidades y cantidades a preparar. */
function FLORA_previsualizarProduccion(orden) {
  var plan = FLORA_calcularProduccion(orden);
  var productos = FLORA_filas_('PRODUCTOS').filter(function(p) { return p.PRODUCTO_ID === plan.productoId; });
  if (productos.length !== 1) throw new Error('Producto inexistente o PRODUCTO_ID duplicado');
  var nombres = {};
  FLORA_filas_('INSUMOS').forEach(function(i) {
    if (nombres[i.INSUMO_ID]) throw new Error('INSUMO_ID duplicado');
    nombres[i.INSUMO_ID] = String(i.NOMBRE || i.INSUMO_ID);
  });
  return { productoId: plan.productoId, nombre: String(productos[0].NOMBRE), cantidad: plan.cantidad,
    ingredientes: plan.consumo.map(function(c) {
      return { insumoId: c.insumoId, nombre: nombres[c.insumoId], cantidad: c.cantidad, unidad: c.unidad };
    }),
    aviso: 'Vista previa de receta validada. No descuenta stock ni registra producción.' };
}

/**
 * Registra una tanda completa como UN evento; requiere confirmación explícita.
 * Se usa LockService para controlar concurrencia y REQUEST_ID para idempotencia.
 */
function FLORA_registrarProduccion(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.loteId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(orden.loteId)) {
    throw new Error('Lote inválido');
  }
  var fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  if (typeof orden.vencimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(orden.vencimiento) ||
      !isFinite(Date.parse(orden.vencimiento + 'T00:00:00Z')) || orden.vencimiento < fecha) {
    throw new Error('Vencimiento inválido');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    if (eventos.some(function(e) { return (e.resultado.movimientos || []).some(function(m) {
      return m.tipo === 'producto' && m.cantidad > 0 && m.loteId === orden.loteId;
    }); })) throw new Error('El LOTE_ID ya existe');
    var plan = FLORA_calcularProduccion(orden);
    var saldos = FLORA_saldos_(eventos);
    var faltantes = plan.consumo.filter(function(c) { return (saldos['insumo:' + c.insumoId] || 0) < c.cantidad; });
    if (faltantes.length) return { registrada: false, faltantes: faltantes };
    var movimientos = plan.consumo.map(function(c) { return { tipo: 'insumo', id: c.insumoId, cantidad: -c.cantidad }; });
    movimientos.push({ tipo: 'producto', id: plan.productoId, cantidad: plan.cantidad, loteId: orden.loteId, vencimiento: orden.vencimiento });
    var resultado = { registrada: true, requestId: orden.requestId, loteId: orden.loteId, vencimiento: orden.vencimiento, movimientos: movimientos };
    hoja.appendRow([orden.requestId, fecha, 'PRODUCCION', JSON.stringify({ productoId: plan.productoId, cantidad: plan.cantidad }), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ingreso controlado de materias primas: stock inicial o compra/recepción.
 * Entradas: [{insumoId, cantidad, unidad}]. No se permite inventar cantidades.
 * La primera carga inicial puede realizarse una única vez para toda la base.
 */
function FLORA_registrarIngresoInsumos_(orden, tipo) {
  FLORA_validarRequest_(orden);
  if (tipo !== 'STOCK_INICIAL' && tipo !== 'INGRESO_COMPRA') throw new Error('Tipo de ingreso inválido');
  if (!Array.isArray(orden.items) || orden.items.length === 0) throw new Error('Faltan insumos');
  var lista = {};
  FLORA_filas_('INSUMOS').forEach(function(i) { lista[i.INSUMO_ID] = i; });
  var agregados = {};
  orden.items.forEach(function(item) {
    var insumo = lista[item.insumoId];
    if (!insumo || !insumo.UNIDAD || insumo.UNIDAD !== item.unidad) {
      throw new Error('Insumo o unidad no validada: ' + item.insumoId);
    }
    var cantidad = FLORA_numero_(item.cantidad, 'Cantidad de ingreso');
    agregados[item.insumoId] = FLORA_redondear_((agregados[item.insumoId] || 0) + cantidad);
  });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    if (tipo === 'STOCK_INICIAL' && eventos.length) {
      throw new Error('El stock inicial solo puede registrarse como primer evento; usar un ajuste controlado');
    }
    var movimientos = Object.keys(agregados).map(function(id) { return { tipo: 'insumo', id: id, cantidad: agregados[id] }; });
    var resultado = { registrada: true, requestId: orden.requestId, tipo: tipo, movimientos: movimientos };
    var fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    hoja.appendRow([orden.requestId, fecha, tipo, JSON.stringify({items:orden.items}), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function FLORA_registrarStockInicial(orden) { return FLORA_registrarIngresoInsumos_(orden, 'STOCK_INICIAL'); }
function FLORA_registrarIngresoCompra(orden) { return FLORA_registrarIngresoInsumos_(orden, 'INGRESO_COMPRA'); }

/**
 * Registra ventas de productos terminados con asignación FEFO de lotes aptos.
 * No factura ni manda mensajes; valida el clienteId cuando se informa.
 */
function FLORA_registrarVenta(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.productoId !== 'string' || !orden.productoId) throw new Error('Producto obligatorio');
  var cantidad = FLORA_numero_(orden.cantidad, 'Cantidad de venta');
  if (!Number.isInteger(cantidad)) throw new Error('La venta requiere unidades enteras');
  if (orden.clienteId != null && (typeof orden.clienteId !== 'string' || !orden.clienteId.trim())) {
    throw new Error('Cliente inválido');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    if (orden.clienteId) {
      var clientes = FLORA_filas_('CLIENTES').filter(function(c) {
        return String(c.CLIENTE_ID) === orden.clienteId;
      });
      if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
    }
    var producto = FLORA_filas_('PRODUCTOS').filter(function(p) { return p.PRODUCTO_ID === orden.productoId; })[0];
    if (!producto) throw new Error('Producto inexistente');
    var fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var lotes = FLORA_lotesDisponibles_(eventos, orden.productoId, fecha);
    var disponible = FLORA_redondear_(lotes.reduce(function(n,l) { return n + l.saldo; }, 0));
    if (disponible < cantidad) return { registrada: false, motivo: 'STOCK_APTO_INSUFICIENTE', disponible: disponible, requerido: cantidad };
    var restante = cantidad;
    var movimientos = [];
    lotes.forEach(function(l) {
      if (restante <= 0) return;
      var usado = Math.min(restante, l.saldo);
      movimientos.push({ tipo: 'producto', id: orden.productoId, cantidad: -usado, loteId: l.loteId });
      restante = FLORA_redondear_(restante - usado);
    });
    var resultado = { registrada: true, requestId: orden.requestId, productoId: orden.productoId, cantidad: cantidad, movimientos: movimientos };
    hoja.appendRow([orden.requestId, fecha, 'VENTA', JSON.stringify({ productoId: orden.productoId, cantidad: cantidad, clienteId: orden.clienteId || '' }), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

/** Historial real de compras asociado al cliente; solo lectura y sin mensajes automáticos. */
function FLORA_historialCliente(clienteId) {
  if (typeof clienteId !== 'string' || !clienteId.trim()) throw new Error('Cliente inválido');
  var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === clienteId; });
  if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
  var eventos = FLORA_eventos_(FLORA_hoja_('EVENTOS_STOCK'));
  return eventos.filter(function(e) {
    return e.tipo === 'VENTA' && e.resultado.registrada === true && e.datos.clienteId === clienteId;
  }).map(function(e) {
    return { requestId: e.id, fecha: e.fecha, productoId: e.datos.productoId,
      cantidad: e.datos.cantidad };
  });
}

function FLORA_validarFechaReferencia_(fechaReferencia) {
  if (typeof fechaReferencia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaReferencia) ||
      new Date(fechaReferencia + 'T00:00:00Z').toISOString().slice(0, 10) !== fechaReferencia) {
    throw new Error('Fecha de referencia inválida');
  }
}

/** Cálculo sin escrituras para una lista de compras ya verificadas. */
function FLORA_estimarReposiciones_(historial, fechaReferencia) {
  var porProducto = {};
  historial.forEach(function(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha) || !v.productoId || v.fecha > fechaReferencia) return;
    if (!porProducto[v.productoId]) porProducto[v.productoId] = {};
    porProducto[v.productoId][v.fecha] = true;
  });
  var sugerencias = [];
  Object.keys(porProducto).forEach(function(productoId) {
    var fechas = Object.keys(porProducto[productoId]).sort();
    if (fechas.length < 2) return;
    var ultima = fechas[fechas.length - 1];
    var penultima = fechas[fechas.length - 2];
    var intervalo = Math.round((Date.parse(ultima + 'T00:00:00Z') - Date.parse(penultima + 'T00:00:00Z')) / 86400000);
    if (intervalo <= 0) return;
    var estimada = new Date(Date.parse(ultima + 'T00:00:00Z') + intervalo * 86400000).toISOString().slice(0, 10);
    sugerencias.push({ productoId: productoId, ultimaCompra: ultima, intervaloObservadoDias: intervalo,
      fechaEstimada: estimada, estado: estimada <= fechaReferencia ? 'POSIBLE_REPOSICION' : 'ESTIMACION_FUTURA' });
  });
  sugerencias.sort(function(a, b) { return a.fechaEstimada.localeCompare(b.fechaEstimada); });
  return sugerencias;
}

/** Estimaciones orientativas con dos fechas de compra distintas; nunca contacta al cliente. */
function FLORA_sugerirReposiciones(clienteId, fechaReferencia) {
  FLORA_validarFechaReferencia_(fechaReferencia);
  var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === clienteId; });
  if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
  if (String(clientes[0].CONSENTIMIENTO_CONTACTO).toUpperCase() !== 'SI') {
    return { clienteId: clienteId, estado: 'SIN_CONSENTIMIENTO', sugerencias: [] };
  }
  var sugerencias = FLORA_estimarReposiciones_(FLORA_historialCliente(clienteId), fechaReferencia);
  return { clienteId: clienteId, estado: sugerencias.length ? 'CON_ESTIMACIONES' : 'SIN_HISTORIAL_SUFICIENTE',
    sugerencias: sugerencias, aviso: 'Estimaciones basadas solo en las dos últimas fechas de compra, no en consumo confirmado.' };
}

/** Bandeja operativa de posibles reposiciones vencidas; una lectura de clientes y eventos. */
function FLORA_consultarReposicionesPendientes(fechaReferencia) {
  FLORA_validarFechaReferencia_(fechaReferencia);
  var clientes = FLORA_filas_('CLIENTES');
  var ids = {};
  clientes.forEach(function(c) {
    var id = String(c.CLIENTE_ID || '');
    if (!id || ids[id]) throw new Error('CLIENTE_ID vacío o duplicado');
    ids[id] = c;
  });
  var historial = {};
  FLORA_eventos_(FLORA_hoja_('EVENTOS_STOCK')).forEach(function(e) {
    if (e.tipo !== 'VENTA' || e.resultado.registrada !== true || !e.datos.clienteId) return;
    var id = e.datos.clienteId;
    if (!ids[id] || String(ids[id].CONSENTIMIENTO_CONTACTO).toUpperCase() !== 'SI') return;
    if (!historial[id]) historial[id] = [];
    historial[id].push({ fecha: e.fecha, productoId: e.datos.productoId });
  });
  var pendientes = [];
  clientes.forEach(function(c) {
    var id = String(c.CLIENTE_ID);
    if (String(c.CONSENTIMIENTO_CONTACTO).toUpperCase() !== 'SI') return;
    FLORA_estimarReposiciones_(historial[id] || [], fechaReferencia).forEach(function(s) {
      if (s.estado === 'POSIBLE_REPOSICION') pendientes.push({ clienteId: id,
        nombre: String(c.NOMBRE || ''), productoId: s.productoId, ultimaCompra: s.ultimaCompra,
        fechaEstimada: s.fechaEstimada, intervaloObservadoDias: s.intervaloObservadoDias });
    });
  });
  pendientes.sort(function(a, b) { return a.fechaEstimada.localeCompare(b.fechaEstimada) || a.clienteId.localeCompare(b.clienteId); });
  return { fechaReferencia: fechaReferencia, totalPendientes: pendientes.length, pendientes: pendientes,
    aviso: 'Revisar manualmente antes de contactar. Ningún mensaje fue enviado.' };
}

/** Una sesión o curso confirmado se registra como evento único, sin datos íntimos de la consulta. */
function FLORA_registrarActividadCliente(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.clienteId !== 'string' || !orden.clienteId.trim()) throw new Error('Cliente obligatorio');
  if (orden.tipo !== 'SESION' && orden.tipo !== 'CURSO') throw new Error('Tipo de actividad inválido');
  if (typeof orden.servicio !== 'string' || !orden.servicio.trim() || orden.servicio.length > 100) {
    throw new Error('Servicio obligatorio (máximo 100 caracteres)');
  }
  FLORA_validarFechaReferencia_(orden.fechaActividad);
  var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  if (orden.fechaActividad > hoy) throw new Error('Una actividad realizada no puede tener fecha futura');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === orden.clienteId; });
    if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
    var datos = { clienteId: orden.clienteId, tipo: orden.tipo, servicio: orden.servicio.trim(),
      fechaActividad: orden.fechaActividad };
    var resultado = { registrada: true, requestId: orden.requestId, tipo: orden.tipo, clienteId: orden.clienteId,
      fechaActividad: orden.fechaActividad, movimientos: [] };
    hoja.appendRow([orden.requestId, hoy, 'ACTIVIDAD_CLIENTE', JSON.stringify(datos), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

/** Vista de compras, sesiones y cursos: un único historial, sin escrituras. */
function FLORA_historialIntegralCliente(clienteId) {
  var compras = FLORA_historialCliente(clienteId).map(function(c) {
    return { requestId: c.requestId, fecha: c.fecha, tipo: 'COMPRA', referencia: c.productoId, cantidad: c.cantidad };
  });
  var actividades = FLORA_eventos_(FLORA_hoja_('EVENTOS_STOCK')).filter(function(e) {
    return e.tipo === 'ACTIVIDAD_CLIENTE' && e.resultado.registrada === true && e.datos.clienteId === clienteId;
  }).map(function(e) {
    return { requestId: e.id, fecha: e.datos.fechaActividad, tipo: e.datos.tipo,
      referencia: e.datos.servicio };
  });
  return compras.concat(actividades).sort(function(a,b) { return b.fecha.localeCompare(a.fecha); });
}

/** Mensaje listo para revisar y copiar; sin acceso a WhatsApp ni envíos. */
function FLORA_prepararBorradorMensaje(orden) {
  if (!orden || typeof orden.clienteId !== 'string') throw new Error('Cliente obligatorio');
  var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === orden.clienteId; });
  if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
  var cliente = clientes[0];
  if (String(cliente.CONSENTIMIENTO_CONTACTO).toUpperCase() !== 'SI') {
    return { disponible: false, motivo: 'SIN_CONSENTIMIENTO' };
  }
  var nombre = String(cliente.NOMBRE || '').trim().split(/\s+/)[0];
  if (!nombre) throw new Error('Cliente sin nombre para personalizar');
  var mensaje;
  if (orden.motivo === 'REPOSICION') {
    FLORA_validarFechaReferencia_(orden.fechaReferencia);
    var posible = FLORA_sugerirReposiciones(orden.clienteId, orden.fechaReferencia).sugerencias.filter(function(s) {
      return s.productoId === orden.productoId && s.estado === 'POSIBLE_REPOSICION';
    });
    if (!posible.length) throw new Error('No hay reposición estimada pendiente para ese producto');
    var productos = FLORA_filas_('PRODUCTOS').filter(function(p) { return p.PRODUCTO_ID === orden.productoId; });
    if (productos.length !== 1) throw new Error('Producto inexistente o duplicado');
    mensaje = '¡Hola, ' + nombre + '! 🌿 Soy Lucy, de Flora. Quería saber cómo te resultó ' +
      String(productos[0].NOMBRE) + ' y si necesitás reponerlo. ¡Te mando un abrazo!';
  } else if (orden.motivo === 'POST_SESION') {
    var sesion = FLORA_historialIntegralCliente(orden.clienteId).filter(function(a) {
      return a.tipo === 'SESION' && a.requestId === orden.actividadId;
    });
    if (sesion.length !== 1) throw new Error('No existe una sesión confirmada con ese identificador');
    mensaje = '¡Hola, ' + nombre + '! ✨ Soy Lucy, de Flora. Gracias por compartir la sesión de ' +
      sesion[0].referencia + ' conmigo. Espero que estés muy bien. ¡Te mando un abrazo!';
  } else {
    throw new Error('Motivo de mensaje no habilitado');
  }
  return { disponible: true, clienteId: orden.clienteId, motivo: orden.motivo,
    texto: mensaje, requiereRevision: true, enviado: false };
}

/** Convierte un horario local de Buenos Aires en minutos comparables. */
function FLORA_minutoAgenda_(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    throw new Error('Fecha y hora inválidas (AAAA-MM-DDTHH:mm)');
  }
  var partes = valor.split('T');
  FLORA_validarFechaReferencia_(partes[0]);
  var hora = Number(partes[1].slice(0,2));
  var minutos = Number(partes[1].slice(3,5));
  if (hora > 23 || minutos > 59) throw new Error('Hora inválida');
  return Date.parse(partes[0] + 'T00:00:00Z') / 60000 + hora * 60 + minutos;
}

/** Reconstruye turnos y cancelaciones desde eventos; no conecta todavía con Google Calendar. */
function FLORA_turnos_(eventos) {
  var turnos = {};
  eventos.forEach(function(e) {
    if (e.tipo === 'RESERVA_TURNO' && e.resultado.registrada === true) {
      if (turnos[e.id]) throw new Error('Turno duplicado en el historial');
      turnos[e.id] = { turnoId: e.id, clienteId: e.datos.clienteId, servicio: e.datos.servicio,
        inicio: e.datos.inicio, fin: e.datos.fin, estado: 'CONFIRMADO' };
    } else if (e.tipo === 'CANCELACION_TURNO' && e.resultado.registrada === true) {
      var turno = turnos[e.datos.turnoId];
      if (!turno || turno.estado === 'CANCELADO') throw new Error('Cancelación incoherente en historial');
      turno.estado = 'CANCELADO';
    }
  });
  return Object.keys(turnos).map(function(id) { return turnos[id]; });
}

/** Reserva bajo bloqueo; cada intervalo es [inicio, fin), para permitir turnos consecutivos. */
function FLORA_reservarTurno(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.clienteId !== 'string' || !orden.clienteId.trim()) throw new Error('Cliente obligatorio');
  if (typeof orden.servicio !== 'string' || !orden.servicio.trim() || orden.servicio.length > 100) {
    throw new Error('Servicio obligatorio (máximo 100 caracteres)');
  }
  var inicio = FLORA_minutoAgenda_(orden.inicio);
  var fin = FLORA_minutoAgenda_(orden.fin);
  if (fin <= inicio || fin - inicio > 480) throw new Error('Duración de turno inválida');
  var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  if (orden.inicio.slice(0,10) < hoy) throw new Error('No se puede reservar un día pasado');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Agenda ocupada; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === orden.clienteId; });
    if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
    var ocupado = FLORA_turnos_(eventos).some(function(t) {
      return t.estado === 'CONFIRMADO' && inicio < FLORA_minutoAgenda_(t.fin) && fin > FLORA_minutoAgenda_(t.inicio);
    });
    if (ocupado) return { registrada: false, motivo: 'HORARIO_OCUPADO' };
    var datos = { clienteId: orden.clienteId, servicio: orden.servicio.trim(), inicio: orden.inicio, fin: orden.fin };
    var resultado = { registrada: true, turnoId: orden.requestId, estado: 'CONFIRMADO', movimientos: [] };
    hoja.appendRow([orden.requestId, hoy, 'RESERVA_TURNO', JSON.stringify(datos), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally { lock.releaseLock(); }
}

function FLORA_cancelarTurno(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.turnoId !== 'string' || !orden.turnoId.trim()) throw new Error('Turno obligatorio');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Agenda ocupada; reintentar con el mismo REQUEST_ID');
  try {
    var hoja = FLORA_asegurarEventos_();
    var eventos = FLORA_eventos_(hoja);
    var existente = eventos.filter(function(e) { return e.id === orden.requestId; })[0];
    if (existente) return { duplicada: true, resultado: existente.resultado };
    var turno = FLORA_turnos_(eventos).filter(function(t) { return t.turnoId === orden.turnoId; })[0];
    if (!turno || turno.estado !== 'CONFIRMADO') throw new Error('Turno inexistente o ya cancelado');
    var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var resultado = { registrada: true, turnoId: orden.turnoId, estado: 'CANCELADO', movimientos: [] };
    hoja.appendRow([orden.requestId, hoy, 'CANCELACION_TURNO', JSON.stringify({ turnoId: orden.turnoId }), JSON.stringify(resultado)]);
    SpreadsheetApp.flush();
    return resultado;
  } finally { lock.releaseLock(); }
}

/** Consulta prevista para interfaz y voz; no escribe ni cambia turnos. */
function FLORA_consultarAgenda(desde, hasta) {
  var comienzo = FLORA_minutoAgenda_(desde);
  var final = FLORA_minutoAgenda_(hasta);
  if (final <= comienzo || final - comienzo > 31 * 1440) throw new Error('Rango de agenda inválido');
  var turnos = FLORA_turnos_(FLORA_eventos_(FLORA_hoja_('EVENTOS_STOCK'))).filter(function(t) {
    return t.estado === 'CONFIRMADO' && comienzo < FLORA_minutoAgenda_(t.fin) && final > FLORA_minutoAgenda_(t.inicio);
  });
  turnos.sort(function(a,b) { return a.inicio.localeCompare(b.inicio); });
  return { desde: desde, hasta: hasta, turnos: turnos, total: turnos.length };
}

/** Búsqueda interna para la pantalla CRM; devuelve solo identificador y nombre. */
function FLORA_buscarClientes(texto) {
  if (typeof texto !== 'string' || texto.trim().length < 2 || texto.length > 100) {
    throw new Error('Ingresá al menos dos caracteres para buscar clientes');
  }
  var clave = texto.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return FLORA_filas_('CLIENTES').filter(function(c) {
    return String(c.NOMBRE || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').indexOf(clave) !== -1;
  }).slice(0, 20).map(function(c) {
    return { clienteId: String(c.CLIENTE_ID), nombre: String(c.NOMBRE) };
  });
}

/** Vista unificada para pantalla interna o secretaria autorizada; no realiza escrituras. */
function FLORA_consultarFichaCliente(clienteId, fechaReferencia) {
  FLORA_validarFechaReferencia_(fechaReferencia);
  if (typeof clienteId !== 'string' || !clienteId.trim()) throw new Error('Cliente obligatorio');
  var clientes = FLORA_filas_('CLIENTES').filter(function(c) { return String(c.CLIENTE_ID) === clienteId; });
  if (clientes.length !== 1) throw new Error('Cliente no registrado o CLIENTE_ID duplicado');
  var cliente = clientes[0];
  var eventos = FLORA_eventos_(FLORA_hoja_('EVENTOS_STOCK'));
  var actividades = [];
  eventos.forEach(function(e) {
    if (e.resultado.registrada !== true || e.datos.clienteId !== clienteId) return;
    if (e.tipo === 'VENTA') {
      actividades.push({ fecha: e.fecha, tipo: 'COMPRA', referencia: e.datos.productoId,
        cantidad: e.datos.cantidad, requestId: e.id });
    } else if (e.tipo === 'ACTIVIDAD_CLIENTE') {
      actividades.push({ fecha: e.datos.fechaActividad, tipo: e.datos.tipo,
        referencia: e.datos.servicio, requestId: e.id });
    }
  });
  actividades.sort(function(a,b) { return b.fecha.localeCompare(a.fecha); });
  var turnos = FLORA_turnos_(eventos).filter(function(t) {
    return t.clienteId === clienteId && t.estado === 'CONFIRMADO' && t.fin.slice(0,10) >= fechaReferencia;
  }).sort(function(a,b) { return a.inicio.localeCompare(b.inicio); });
  var consentimiento = String(cliente.CONSENTIMIENTO_CONTACTO).toUpperCase() === 'SI';
  var compras = actividades.filter(function(a) { return a.tipo === 'COMPRA'; });
  var sugerencias = consentimiento ? FLORA_estimarReposiciones_(compras.map(function(c) {
    return { fecha: c.fecha, productoId: c.referencia };
  }),fechaReferencia).filter(function(s) { return s.estado === 'POSIBLE_REPOSICION'; }) : [];
  return { clienteId: clienteId, nombre: String(cliente.NOMBRE || ''), contactoAutorizado: consentimiento,
    actividades: actividades, proximosTurnos: turnos, posiblesReposiciones: sugerencias,
    aviso: 'Consulta interna, sin cambios ni mensajes enviados. No exponer sin autenticación.' };
}

/** Auditoría previa al arranque: consulta solamente, no activa productos ni inventa stock. */
function FLORA_diagnosticarArranque() {
  var productos = FLORA_filas_('PRODUCTOS');
  var insumos = FLORA_filas_('INSUMOS');
  var recetas = FLORA_filas_('RECETAS');
  var insumoPorId = {};
  var problemas = [];
  var vistos = {};
  insumos.forEach(function(i) {
    var id = String(i.INSUMO_ID || '');
    if (!id || vistos[id]) problemas.push({ tipo: 'INSUMO_ID_INVALIDO', referencia: id });
    vistos[id] = true;
    insumoPorId[id] = i;
    if (!String(i.UNIDAD || '').trim()) problemas.push({ tipo: 'UNIDAD_INSUMO_PENDIENTE', referencia: id });
  });
  var recetasPorProducto = {};
  recetas.forEach(function(r) {
    var id = String(r.PRODUCTO_ID || '');
    if (!recetasPorProducto[id]) recetasPorProducto[id] = [];
    recetasPorProducto[id].push(r);
  });
  var listos = [];
  var productosPendientes = [];
  var vistosProductos = {};
  productos.forEach(function(p) {
    var id = String(p.PRODUCTO_ID || '');
    var incidencias = [];
    if (!id || vistosProductos[id]) incidencias.push('PRODUCTO_ID_INVALIDO');
    vistosProductos[id] = true;
    if (String(p.ACTIVO).toUpperCase() !== 'SI') incidencias.push('PRODUCTO_NO_VALIDADO');
    var componentes = recetasPorProducto[id] || [];
    if (!componentes.length) incidencias.push('RECETA_AUSENTE');
    var rendimiento = componentes.length ? Number(componentes[0].RENDIMIENTO) : 0;
    if (componentes.length && (!Number.isFinite(rendimiento) || rendimiento <= 0)) incidencias.push('RENDIMIENTO_INVALIDO');
    componentes.forEach(function(c) {
      var insumo = insumoPorId[String(c.INSUMO_ID || '')];
      if (!insumo || !String(insumo.UNIDAD || '').trim() || String(insumo.UNIDAD) !== String(c.UNIDAD)) {
        incidencias.push('INSUMO_O_UNIDAD_NO_VALIDADO');
      }
      if (!Number.isFinite(Number(c.CANTIDAD)) || Number(c.CANTIDAD) <= 0 ||
          !Number.isFinite(Number(c.RENDIMIENTO)) || Number(c.RENDIMIENTO) !== rendimiento) {
        incidencias.push('CANTIDAD_O_RENDIMIENTO_INCONSISTENTE');
      }
    });
    if (incidencias.length) productosPendientes.push({ productoId: id, motivos: incidencias.filter(function(v,i,a) { return a.indexOf(v) === i; }) });
    else listos.push(id);
  });
  // EVENTOS_STOCK todavía puede no existir: se crea únicamente al registrar la primera operación autorizada.
  var propiedad = PropertiesService.getScriptProperties().getProperty('FLORA_SPREADSHEET_ID');
  var libro = SpreadsheetApp.openById(propiedad);
  var hojaEventos = libro.getSheetByName('EVENTOS_STOCK');
  var eventos = hojaEventos ? FLORA_eventos_(hojaEventos) : [];
  var tieneStockInicial = eventos.some(function(e) { return e.tipo === 'STOCK_INICIAL'; });
  return { totalProductos: productos.length, totalInsumos: insumos.length, totalRecetas: recetas.length,
    productosConRecetaValidada: listos, productosPendientes: productosPendientes,
    problemasInsumos: problemas, stockInicialRegistrado: tieneStockInicial,
    estado: productosPendientes.length || problemas.length || !tieneStockInicial ? 'PENDIENTE_VALIDACION' : 'CATALOGO_Y_STOCK_PREPARADOS',
    aviso: 'Diagnóstico de solo lectura. No habilita producción ni confirma la exactitud de cantidades físicas.' };
}
