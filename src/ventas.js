/* Flora OS · Circuito comercial de demostración. Sin persistencia ni escrituras reales. */
'use strict';
(function(root){
  function entero(x){return Number.isSafeInteger(x)&&x>=0;}
  function alta(o){
    if(!o||!String(o.cliente||'').trim()||!String(o.concepto||'').trim())throw Error('Completá cliente y concepto');
    if(!entero(o.cantidad)||o.cantidad<1||o.cantidad>500||!entero(o.precio)||o.precio<1||o.precio>100000000)throw Error('Cantidad o precio inválido');
    if(!['PRODUCTO','SERVICIO','CURSO'].includes(o.rubro))throw Error('Elegí el tipo de operación');
    const total=o.cantidad*o.precio;
    if(!Number.isSafeInteger(total))throw Error('Importe demasiado grande');
    return {id:o.id,fecha:o.fecha,cliente:String(o.cliente).trim(),concepto:String(o.concepto).trim(),cantidad:o.cantidad,precio:o.precio,rubro:o.rubro,total,entregada:0,estado:o.rubro==='PRODUCTO'?'PENDIENTE':'NO_APLICA',pagos:[],vencimiento:o.vencimiento||'',observaciones:String(o.observaciones||'').trim()};
  }
  function cobrado(p){return p.pagos.reduce((n,x)=>n+x.importe,0);}
  function saldo(p){return p.total-cobrado(p);}
  function cambiarEstado(p,estado){
    if(p.rubro!=='PRODUCTO'||!((p.estado==='PENDIENTE'&&estado==='PRODUCCION')||(p.estado==='PRODUCCION'&&estado==='LISTO')))throw Error('Cambio de producción no permitido');
    return {...p,estado};
  }
  function agruparProduccion(pedidos){
    const grupos=new Map();
    for(const p of pedidos){
      if(p.rubro!=='PRODUCTO'||p.estado!=='PENDIENTE')continue;
      const clave=p.concepto.trim().toLocaleLowerCase('es-AR');
      if(!grupos.has(clave))grupos.set(clave,{concepto:p.concepto,cantidad:0,pedidos:[]});
      const g=grupos.get(clave);g.cantidad+=p.cantidad-p.entregada;g.pedidos.push(p.id);
    }
    return [...grupos.values()];
  }
  function cobrar(p,c){
    if(!entero(c.importe)||c.importe<1||c.importe>saldo(p))throw Error('El cobro debe ser positivo y no superar el saldo');
    if(!['EFECTIVO','TRANSFERENCIA','MERCADO_PAGO','OTRO'].includes(c.medio))throw Error('Medio de pago inválido');
    return {...p,pagos:[...p.pagos,{id:c.id,fecha:c.fecha,importe:c.importe,medio:c.medio}]};
  }
  function entregar(p,cantidad){
    if(p.rubro!=='PRODUCTO'||!['LISTO','PARCIAL'].includes(p.estado)||!entero(cantidad)||cantidad<1||cantidad>p.cantidad-p.entregada)throw Error('Entrega inválida');
    const entregada=p.entregada+cantidad;
    return {...p,entregada,estado:entregada===p.cantidad?'ENTREGADO':'PARCIAL'};
  }
  function cierre(pedidos,fecha){
    const nuevos=pedidos.filter(p=>p.fecha===fecha),pagos=pedidos.flatMap(p=>p.pagos.filter(c=>c.fecha===fecha).map(c=>({...c,pedidoId:p.id,pedidoFecha:p.fecha})));
    const ventas=nuevos.reduce((s,p)=>s+p.total,0),cobros=pagos.reduce((s,p)=>s+p.importe,0);
    const deudaNueva=nuevos.reduce((s,p)=>s+saldo(p),0),saldoTotal=pedidos.reduce((s,p)=>s+saldo(p),0);
    return {fecha,pedidos:nuevos.length,ventas,cobros,cobrosAnteriores:pagos.filter(p=>p.pedidoFecha!==fecha).reduce((s,p)=>s+p.importe,0),deudaNueva,saldoTotal,pendientes:pedidos.filter(p=>p.rubro==='PRODUCTO'&&p.estado!=='ENTREGADO').length};
  }
  function moneda(n){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);}
  function comprobante(p){return ['🌿 *FLORA · RESUMEN DE PEDIDO*',`N.º: *${p.id}*`,`Fecha: ${p.fecha}`,`Cliente: ${p.cliente}`,`${p.concepto} · ${p.cantidad} × ${moneda(p.precio)}`,`*Total: ${moneda(p.total)}*`,`Cobrado: ${moneda(cobrado(p))}`,`*Saldo: ${moneda(saldo(p))}*`,p.vencimiento?`Pago previsto: ${p.vencimiento}`:'',p.rubro==='PRODUCTO'?`Entregadas: ${p.entregada}/${p.cantidad}`:'','Gracias por elegir Flora 🌸'].filter(Boolean).join('\n');}
  const api={alta,cobrar,cobrado,saldo,cambiarEstado,agruparProduccion,entregar,cierre,comprobante,moneda};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FloraVentas=api;
})(typeof globalThis==='object'?globalThis:this);
