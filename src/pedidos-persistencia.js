/* Flora OS · contrato de pedidos para Google Sheets. Solo planificación, sin escrituras. */
'use strict';
const reqIdOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(v);
function planificarAltaPedido(orden,idsExistentes=[],requestsProcesados=[]){
  if(!orden||orden.confirmado!==true)throw Error('Se requiere confirmación del pedido');
  if(!reqIdOk(orden.requestId))throw Error('REQUEST_ID inválido');
  if(requestsProcesados.includes(orden.requestId))return {duplicada:true,requestId:orden.requestId};
  if(typeof orden.pedidoId!=='string'||!/^FLP-[A-Za-z0-9-]{4,40}$/.test(orden.pedidoId)||idsExistentes.includes(orden.pedidoId))throw Error('PEDIDO_ID inválido o duplicado');
  if(typeof orden.clienteNombre!=='string'||!orden.clienteNombre.trim()||orden.clienteNombre.length>100)throw Error('Cliente obligatorio');
  if(!Array.isArray(orden.items)||!orden.items.length||orden.items.length>50)throw Error('Pedido sin productos válidos');
  const itemIds=new Set(),productos=orden.items.map((x,i)=>{
    if(!x||typeof x.productoId!=='string'||!/^FL-\d{3}$/.test(x.productoId)||!Number.isInteger(x.cantidad)||x.cantidad<1||x.cantidad>500)throw Error('Ítem de pedido inválido');
    const id=orden.pedidoId+'-'+String(i+1).padStart(2,'0');if(itemIds.has(id))throw Error('Ítem duplicado');itemIds.add(id);
    return [id,orden.pedidoId,x.productoId,String(x.descripcion||'').slice(0,150),String(x.variante||'').slice(0,120),x.cantidad,0,'PENDIENTE',String(x.observaciones||'').slice(0,250)];
  });
  const cabecera=[orden.pedidoId,String(orden.fecha||''),String(orden.clienteId||''),orden.clienteNombre.trim(),String(orden.canal||'').slice(0,60),String(orden.fechaEntrega||''),'PENDIENTE',String(orden.observaciones||'').slice(0,250),orden.requestId];
  const evento=[orden.requestId,String(orden.fecha||''),orden.pedidoId,'','ALTA_PEDIDO','',orden.requestId,'Alta confirmada: '+productos.length+' ítems'];
  return {duplicada:false,requestId:orden.requestId,pedido:cabecera,items:productos,evento,aviso:'Plan sin escribir en Sheets. Registrar bajo bloqueo, con evento e idempotencia.'};
}
module.exports={planificarAltaPedido};
