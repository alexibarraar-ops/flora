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
    return { id: String(r[0]), tipo: String(r[2]), resultado: JSON.parse(String(r[4])) };
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
 * No factura ni manda mensajes; el clienteId se conserva para integrar CRM.
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
    if (orden.clienteId && !FLORA_filas_('CLIENTES').some(function(c) {
      return String(c.CLIENTE_ID) === orden.clienteId;
    })) throw new Error('Cliente no registrado en CRM');
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

/** Historial de compras confirmado en el libro oficial; no duplica registros. */
function FLORA_historialCliente(clienteId) {
  if (typeof clienteId !== 'string' || !clienteId.trim()) throw new Error('Cliente obligatorio');
  var cliente = FLORA_filas_('CLIENTES').filter(function(c) {
    return String(c.CLIENTE_ID) === clienteId;
  })[0];
  if (!cliente) throw new Error('Cliente no registrado en CRM');
  var datos = FLORA_asegurarEventos_().getDataRange().getValues();
  datos.shift();
  var compras = datos.filter(function(f) { return f[2] === 'VENTA' && f[4]; }).map(function(f) {
    var detalle = JSON.parse(String(f[3]));
    if (detalle.clienteId !== clienteId) return null;
    var resultado = JSON.parse(String(f[4]));
    if (resultado.registrada !== true) return null;
    return { actividadId: 'VENTA-' + String(f[0]), tipo: 'COMPRA', referenciaId: String(f[0]),
      fecha: String(f[1]), productoId: detalle.productoId, cantidad: detalle.cantidad };
  }).filter(function(c) { return c !== null; });
  var actividades = FLORA_filas_('ACTIVIDADES_CLIENTE').filter(function(a) {
    return String(a.CLIENTE_ID) === clienteId;
  }).map(function(a) {
    return { actividadId: String(a.ACTIVIDAD_ID), tipo: String(a.TIPO),
      referenciaId: String(a.REFERENCIA_ID || ''), fecha: String(a.FECHA),
      detalle: String(a.DETALLE || ''), proximoContacto: String(a.PROXIMO_CONTACTO || '') };
  }).filter(function(a) { return !compras.some(function(c) { return c.referenciaId === a.referenciaId && a.tipo === 'COMPRA'; }); });
  return { clienteId: clienteId, nombre: String(cliente.NOMBRE || ''),
    consentimientoContacto: String(cliente.CONSENTIMIENTO_CONTACTO).toUpperCase() === 'SI',
    actividades: compras.concat(actividades).sort(function(a,b) { return b.fecha.localeCompare(a.fecha); }) };
}

/** Sugerencias para revisión de Lucy: nunca envía mensajes ni escribe en Sheets. */
function FLORA_prepararReposiciones(clienteId, fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !isFinite(Date.parse(fecha + 'T00:00:00Z'))) throw new Error('Fecha inválida');
  var historial = FLORA_historialCliente(clienteId);
  if (!historial.consentimientoContacto) return { clienteId: clienteId, sugerencias: [], motivo: 'SIN_CONSENTIMIENTO' };
  var productos = {};
  FLORA_filas_('PRODUCTOS').forEach(function(p) { productos[String(p.PRODUCTO_ID)] = p; });
  var ultimas = {};
  historial.actividades.filter(function(a) { return a.tipo === 'COMPRA'; }).forEach(function(a) {
    if (!ultimas[a.productoId] || ultimas[a.productoId].fecha < a.fecha) ultimas[a.productoId] = a;
  });
  var sugerencias = Object.keys(ultimas).map(function(id) {
    var dias = Number(productos[id] && productos[id].DIAS_REPOSICION);
    if (!Number.isInteger(dias) || dias <= 0) return null;
    var compra = ultimas[id];
    var proxima = new Date(compra.fecha + 'T00:00:00Z');
    proxima.setUTCDate(proxima.getUTCDate() + dias);
    var fechaSugerida = proxima.toISOString().slice(0,10);
    return fechaSugerida <= fecha ? { productoId: id, ultimaCompra: compra.fecha, fechaSugerida: fechaSugerida } : null;
  }).filter(function(s) { return s !== null; });
  return { clienteId: clienteId, sugerencias: sugerencias, requiereAprobacion: true };
}
