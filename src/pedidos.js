/* Flora OS: pedidos de prueba. Datos solo en memoria, sin ventas ni stock. */
'use strict';
(function(root){
  const ESTADOS=['PENDIENTE','PRODUCCION','LISTO','PARCIAL','ENTREGADO','CANCELADO'];
  function crearPedido(datos,id){
    const cliente=String(datos?.cliente||'').trim(),producto=String(datos?.producto||'').trim();
    const cantidad=Number(datos?.cantidad);
    if(!cliente||!producto||cliente.length>100||producto.length>150||!Number.isInteger(cantidad)||cantidad<1||cantidad>500)throw Error('Completá cliente, producto y cantidad válida (1 a 500)');
    if(!/^PRUEBA-\d+$/.test(id))throw Error('ID de prueba inválido');
    return {id,cliente,producto,cantidad,entregada:0,estado:'PENDIENTE',detalle:String(datos.detalle||'').trim().slice(0,200)};
  }
  function cambiarEstado(pedido,estado){
    if(!pedido||!ESTADOS.includes(estado))throw Error('Estado inválido');
    const permitidos={PENDIENTE:['PRODUCCION','CANCELADO'],PRODUCCION:['LISTO','CANCELADO'],LISTO:['CANCELADO'],PARCIAL:['LISTO','CANCELADO'],ENTREGADO:[],CANCELADO:[]};
    if(!permitidos[pedido.estado]?.includes(estado))throw Error('Cambio de estado no permitido');
    return {...pedido,estado};
  }
  function entregar(pedido,cantidad){
    if(!pedido||!['LISTO','PARCIAL'].includes(pedido.estado))throw Error('El pedido debe estar listo para entregar');
    if(!Number.isInteger(cantidad)||cantidad<1||cantidad>pedido.cantidad-pedido.entregada)throw Error('Cantidad de entrega inválida');
    const entregada=pedido.entregada+cantidad;
    return {...pedido,entregada,estado:entregada===pedido.cantidad?'ENTREGADO':'PARCIAL'};
  }
  function agruparPendientes(pedidos){
    if(!Array.isArray(pedidos))throw Error('Pedidos inválidos');
    const mapa=new Map();
    for(const p of pedidos){
      if(p.estado!=='PENDIENTE')continue;
      const clave=p.producto+'\u0000'+p.detalle;
      if(!mapa.has(clave))mapa.set(clave,{producto:p.producto,detalle:p.detalle,cantidad:0,pedidos:0});
      const x=mapa.get(clave);x.cantidad+=p.cantidad-p.entregada;x.pedidos++;
    }
    return [...mapa.values()];
  }
  const CODIGOS={
    'Jojoba Oil':'FL-001','Shampoo sólido rojo':'FL-002','Shampoo sólido verde':'FL-003',
    'Shampoo sólido de arroz':'FL-004','Acondicionador sólido':'FL-005','Desodorante natural':'FL-006',
    'Crema para peinar':'FL-007','Agua micelar':'FL-008','Tónico facial':'FL-009',
    'Agua herbal de canela':'FL-010','Aqua Mirabilis':'FL-011','Bálsamo de caléndula':'FL-012',
  };
  function calcularPlan(pedidos,recetas){
    if(!Array.isArray(recetas))throw Error('Las recetas no están cargadas');
    const porId=new Map(recetas.map(r=>[r.id,r]));
    const materiales=new Map(),sinReceta=[];
    for(const pedido of agruparPendientes(pedidos)){
      const id=CODIGOS[pedido.producto],receta=porId.get(id);
      if(!receta||pedido.detalle){sinReceta.push({...pedido,motivo:pedido.detalle?'Pedido personalizado: revisar receta':'Receta sin cargar'});continue;}
      for(const x of receta.ingredientes){
        const clave=x.insumoId;
        if(materiales.has(clave)&&materiales.get(clave).unidad!==x.unidad)throw Error(`Unidad incompatible en ${x.nombre}; revisar antes de continuar`);
        if(!materiales.has(clave))materiales.set(clave,{insumoId:clave,nombre:x.nombre,unidad:x.unidad,cantidad:0});
        const m=materiales.get(clave);m.cantidad=Math.round((m.cantidad+x.cantidad*pedido.cantidad)*10000)/10000;
      }
    }
    return {materiales:[...materiales.values()],sinReceta};
  }
  const api={crearPedido,cambiarEstado,entregar,agruparPendientes,calcularPlan,CODIGOS,ESTADOS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FloraPedidos=api;
})(typeof globalThis==='object'?globalThis:this);
