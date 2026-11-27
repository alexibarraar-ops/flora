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
    if (anterior) return {duplicada:true, registrada:true, pedidoId:String(anterior[2]), requestId:orden.requestId};
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

/** Consulta privada desde los eventos oficiales; no modifica nada. */
function FLORA_consultarPedidos() {
  var filas = FLORA_pedidosEventos_().filas;
  var pedidos = [];
  filas.forEach(function(r) {
    if (String(r[4]) !== 'ALTA_PEDIDO') return;
    var p = JSON.parse(String(r[8]));
    if (p.pedidoId !== String(r[2])) throw new Error('Evento de pedido inconsistente');
    pedidos.push({pedidoId:p.pedidoId,clienteNombre:p.clienteNombre,clienteId:p.clienteId,
      canal:p.canal,fechaEntrega:p.fechaEntrega,estado:p.estado,observaciones:p.observaciones,items:p.items});
  });
  return {pedidos:pedidos,cantidad:pedidos.length,modo:'SOLO_LECTURA',
    aviso:'Solo altas registradas. Cambios de estado y entregas todavía no están conectados.'};
}
