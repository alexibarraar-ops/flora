/**
 * Flora OS · Registro privado de pedidos (etapa preparada, NO instalada).
 * Requiere FloraProcesador.gs en el mismo proyecto y la propiedad FLORA_SPREADSHEET_ID.
 * ÚNICA escritura por alta: un evento en PEDIDO_EVENTOS. Las pestañas PEDIDOS
 * y PEDIDO_ITEMS son vistas futuras, no se escriben parcialmente.
 * No crea ventas, producciones ni movimientos de stock.
 */
function FLORA_pedidosEventos_() {
  var hoja = FLORA_hoja_('PEDIDO_EVENTOS');
  var datos = hoja.getDataRange().getValues();
  var esperado = ['EVENTO_ID','FECHA_HORA','PEDIDO_ID','ITEM_ID','TIPO','CANTIDAD','REQUEST_ID','OBSERVACIONES','DATOS_JSON'];
  if (!datos.length || esperado.some(function(h,i) { return String(datos[0][i]) !== h; })) {
    throw new Error('Esquema de PEDIDO_EVENTOS incompleto');
  }
  return { hoja: hoja, filas: datos.slice(1).filter(function(r) { return r[0] !== ''; }) };
}

function FLORA_validarAltaPedido_(orden) {
  FLORA_validarRequest_(orden);
  if (typeof orden.pedidoId !== 'string' || !/^FLP-[A-Za-z0-9-]{4,40}$/.test(orden.pedidoId)) throw new Error('PEDIDO_ID inválido');
  if (typeof orden.clienteNombre !== 'string' || !orden.clienteNombre.trim() || orden.clienteNombre.length > 100) throw new Error('Cliente obligatorio');
  if (!Array.isArray(orden.items) || !orden.items.length || orden.items.length > 50) throw new Error('Faltan productos');
  var productos = {};
  FLORA_filas_('PRODUCTOS').forEach(function(p) { productos[String(p.PRODUCTO_ID)] = true; });
  var items = orden.items.map(function(item) {
    if (!item || typeof item.productoId !== 'string' || !productos[item.productoId] ||
        !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 500) throw new Error('Ítem inválido');
    return {productoId:item.productoId, cantidad:item.cantidad,
      variante:String(item.variante || '').slice(0,120),
      observaciones:String(item.observaciones || '').slice(0,250)};
  });
  return {pedidoId:orden.pedidoId,clienteNombre:orden.clienteNombre.trim(),
    clienteId:String(orden.clienteId || ''),canal:String(orden.canal || '').slice(0,60),
    fechaEntrega:String(orden.fechaEntrega || ''),observaciones:String(orden.observaciones || '').slice(0,250),
    items:items,estado:'PENDIENTE'};
}

function FLORA_registrarPedido(orden) {
  // Validar antes de obtener el bloqueo: ninguna escritura ni creación implícita.
  var pedido = FLORA_validarAltaPedido_(orden);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var datos = FLORA_pedidosEventos_();
    var anterior = datos.filas.filter(function(r) { return String(r[6]) === orden.requestId; })[0];
    if (anterior) {
      if (String(anterior[4]) !== 'ALTA_PEDIDO' || String(anterior[2]) !== pedido.pedidoId ||
          JSON.stringify(JSON.parse(String(anterior[8]))) !== JSON.stringify(pedido)) throw new Error('REQUEST_ID reutilizado para otra operación');
      return {duplicada:true, registrada:true, pedidoId:pedido.pedidoId, requestId:orden.requestId};
    }
    if (datos.filas.some(function(r) { return String(r[2]) === pedido.pedidoId && String(r[4]) === 'ALTA_PEDIDO'; })) throw new Error('PEDIDO_ID ya existente');
    var fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', "yyyy-MM-dd'T'HH:mm:ss");
    datos.hoja.appendRow([orden.requestId,fecha,pedido.pedidoId,'','ALTA_PEDIDO','',orden.requestId,'',JSON.stringify(pedido)]);
    SpreadsheetApp.flush();
    // Releer tras grabar; no afirmar éxito si no quedó exactamente un evento.
    var guardados = FLORA_pedidosEventos_().filas.filter(function(r) { return String(r[6]) === orden.requestId; });
    if (guardados.length !== 1 || String(guardados[0][2]) !== pedido.pedidoId) throw new Error('No se pudo verificar el registro del pedido');
    return {registrada:true,duplicada:false,pedidoId:pedido.pedidoId,requestId:orden.requestId,estado:'PENDIENTE',items:pedido.items.length};
  } finally { lock.releaseLock(); }
}

/** Reconstrucción determinista: el evento es la única fuente oficial. */
function FLORA_reconstruirPedidos_(filas) {
  var mapa = {}, orden = [];
  filas.forEach(function(r) {
    var id = String(r[2]), tipo = String(r[4]), dato = JSON.parse(String(r[8]));
    if (tipo === 'ALTA_PEDIDO') {
      if (mapa[id] || dato.pedidoId !== id) throw new Error('Alta de pedido inconsistente');
      var p = JSON.parse(JSON.stringify(dato));
      p.items.forEach(function(it) { it.entregada = 0; });
      mapa[id] = p; orden.push(id);
    } else {
      var actual = mapa[id];
      if (!actual) throw new Error('Evento sin pedido previo');
      if (tipo === 'ESTADO_PEDIDO') {
        if (actual.estado !== dato.desde || !FLORA_transicionPedido_(actual.estado,dato.estado)) throw new Error('Cambio de estado inconsistente');
        actual.estado = dato.estado;
      } else if (tipo === 'ENTREGA_PEDIDO') {
        var item = actual.items[dato.itemIndex];
        if (!item || !Number.isInteger(dato.cantidad) || dato.cantidad < 1 ||
            item.entregada + dato.cantidad > item.cantidad ||
            (actual.estado !== 'LISTO' && actual.estado !== 'PARCIAL')) throw new Error('Entrega inconsistente');
        item.entregada += dato.cantidad;
        var todo = actual.items.every(function(it) { return it.entregada === it.cantidad; });
        actual.estado = todo ? 'ENTREGADO' : 'PARCIAL';
      } else throw new Error('Tipo de evento desconocido');
    }
  });
  return orden.map(function(id) { return mapa[id]; });
}

function FLORA_transicionPedido_(desde, hacia) {
  return (desde === 'PENDIENTE' && (hacia === 'PRODUCCION' || hacia === 'CANCELADO')) ||
    (desde === 'PRODUCCION' && (hacia === 'LISTO' || hacia === 'CANCELADO')) ||
    (desde === 'LISTO' && hacia === 'CANCELADO');
}

function FLORA_guardarEventoPedido_(op, tipo, validar) {
  FLORA_validarRequest_(op);
  if (typeof op.pedidoId !== 'string' || !/^FLP-[A-Za-z0-9-]{4,40}$/.test(op.pedidoId)) throw new Error('PEDIDO_ID inválido');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Procesador ocupado; reintentar con el mismo REQUEST_ID');
  try {
    var datos = FLORA_pedidosEventos_();
    var anterior = datos.filas.filter(function(r) { return String(r[6]) === op.requestId; })[0];
    if (anterior) {
      var viejo = JSON.parse(String(anterior[8]));
      if (String(anterior[4]) !== tipo || String(anterior[2]) !== op.pedidoId ||
          viejo.requestId !== op.requestId || viejo.pedidoId !== op.pedidoId ||
          (tipo === 'ESTADO_PEDIDO' && viejo.estado !== op.estado) ||
          (tipo === 'ENTREGA_PEDIDO' && (viejo.itemIndex !== op.itemIndex || viejo.cantidad !== op.cantidad))) {
        throw new Error('REQUEST_ID reutilizado para otra operación');
      }
      return {registrada:true,duplicada:true,pedidoId:op.pedidoId,requestId:op.requestId,estado:viejo.resultado};
    }
    var pedidos = FLORA_reconstruirPedidos_(datos.filas);
    var pedido = pedidos.filter(function(p) { return p.pedidoId === op.pedidoId; })[0];
    if (!pedido) throw new Error('Pedido inexistente');
    var evento = validar(op,pedido);
    evento.pedidoId = op.pedidoId;
    evento.requestId = op.requestId;
    var fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', "yyyy-MM-dd'T'HH:mm:ss");
    datos.hoja.appendRow([op.requestId,fecha,op.pedidoId,
      tipo === 'ENTREGA_PEDIDO' ? String(op.itemIndex) : '',tipo,
      tipo === 'ENTREGA_PEDIDO' ? op.cantidad : '',op.requestId,'',JSON.stringify(evento)]);
    SpreadsheetApp.flush();
    var guardados = FLORA_pedidosEventos_().filas.filter(function(r) { return String(r[6]) === op.requestId; });
    if (guardados.length !== 1 || String(guardados[0][4]) !== tipo) throw new Error('No se pudo verificar el evento');
    return {registrada:true,duplicada:false,pedidoId:op.pedidoId,requestId:op.requestId,estado:evento.resultado};
  } finally { lock.releaseLock(); }
}

/** Cambia solo PENDIENTE→PRODUCCION→LISTO, o cancela antes de entregar. */
function FLORA_cambiarEstadoPedido(op) {
  return FLORA_guardarEventoPedido_(op,'ESTADO_PEDIDO',function(orden,pedido) {
    if (!FLORA_transicionPedido_(pedido.estado,orden.estado)) throw new Error('Transición de estado no permitida');
    return {desde:pedido.estado,estado:orden.estado,resultado:orden.estado};
  });
}

/** Entrega parcial o total. No descuenta stock ni registra una venta. */
function FLORA_registrarEntregaPedido(op) {
  return FLORA_guardarEventoPedido_(op,'ENTREGA_PEDIDO',function(orden,pedido) {
    var item = pedido.items[orden.itemIndex];
    if ((pedido.estado !== 'LISTO' && pedido.estado !== 'PARCIAL') ||
        !Number.isInteger(orden.itemIndex) || !item || !Number.isInteger(orden.cantidad) ||
        orden.cantidad < 1 || orden.cantidad > item.cantidad - item.entregada) throw new Error('Entrega inválida o excedida');
    var total = pedido.items.every(function(it,i) {return it.entregada + (i === orden.itemIndex ? orden.cantidad : 0) === it.cantidad;});
    return {itemIndex:orden.itemIndex,cantidad:orden.cantidad,resultado:total ? 'ENTREGADO' : 'PARCIAL'};
  });
}

/** Consulta privada desde los eventos oficiales; no modifica nada. */
function FLORA_consultarPedidos() {
  var pedidos = FLORA_reconstruirPedidos_(FLORA_pedidosEventos_().filas);
  return {pedidos:pedidos,cantidad:pedidos.length,modo:'SOLO_LECTURA'};
}

function FLORA_consultarPedidosPendientes() {
  var pedidos = FLORA_consultarPedidos().pedidos.filter(function(p) {
    return p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO';
  });
  return {pedidos:pedidos,cantidad:pedidos.length,modo:'SOLO_LECTURA'};
}

/** Ficha de producción tentativa: solo pedidos todavía PENDIENTES. */
function FLORA_consultarProduccionAgrupada() {
  var mapa = {}, grupos = [];
  FLORA_consultarPedidosPendientes().pedidos.forEach(function(p) {
    if (p.estado !== 'PENDIENTE') return;
    p.items.forEach(function(item) {
      var clave = JSON.stringify([item.productoId,item.variante]);
      if (!mapa[clave]) {
        mapa[clave] = {productoId:item.productoId,variante:item.variante,cantidad:0,pedidos:[]};
        grupos.push(mapa[clave]);
      }
      mapa[clave].cantidad += item.cantidad - item.entregada;
      if (mapa[clave].pedidos.indexOf(p.pedidoId) < 0) mapa[clave].pedidos.push(p.pedidoId);
    });
  });
  return {grupos:grupos,cantidad:grupos.length,modo:'SOLO_LECTURA',
    aviso:'Agrupado tentativo; no calcula recetas, insumos ni descuenta stock.'};
}
