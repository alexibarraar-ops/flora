/* Flora OS · simulador de inventario. Sin persistencia ni operaciones remotas. */
'use strict';
(function(root){
  const redondear=n=>Math.round((n+Number.EPSILON)*10000)/10000;
  function leerLista(texto){
    if(typeof texto!=='string'||texto.length>50000)throw Error('Lista demasiado grande');
    const lineas=texto.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lineas.some(l=>/BORRADOR|DEMO|No usar para fabricar/i.test(l)))throw Error('Pegá la lista completa copiada de la calculadora de Flora');
    const items=[];
    for(const linea of lineas.slice(1)){
      if(/^(Balance:|BORRADOR|DEMO|No usar para fabricar)/i.test(linea))continue;
      const match=linea.match(/^(.+):\s*(\d+(?:[.,]\d+)?)\s+(g|kg|ml|l|gota|gotas|unidad|unidades)$/i);
      if(!match)continue;
      const nombre=match[1].trim(),cantidad=Number(match[2].replace(',','.'));
      const unidad=match[3].toLowerCase().replace(/^unidades$/,'unidad').replace(/^gotas$/,'gota');
      if(!nombre||!Number.isFinite(cantidad)||cantidad<=0)throw Error('Cantidad inválida');
      if(items.some(i=>i.nombre.toLowerCase()===nombre.toLowerCase()&&i.unidad===unidad))throw Error('Ingrediente repetido: '+nombre);
      items.push({nombre,cantidad,unidad});
    }
    if(!items.length||items.length>100)throw Error('No se encontraron ingredientes en la lista');
    return items;
  }
  function evaluar(requeridos,stocks){
    if(!Array.isArray(requeridos))throw Error('Lista inválida');
    return requeridos.map(item=>{
      const dato=stocks[item.nombre];
      if(dato===undefined||dato===null||dato==='')return {...item,estado:'SIN_CONTEO',disponible:null,faltante:null};
      const cantidad=typeof dato==='number'?dato:Number(String(dato).replace(',','.'));
      if(!Number.isFinite(cantidad)||cantidad<0)throw Error('Stock inválido para '+item.nombre);
      const faltante=redondear(Math.max(0,item.cantidad-cantidad));
      return {...item,estado:faltante>0?'FALTANTE':'SUFICIENTE',disponible:cantidad,faltante};
    });
  }
  function listaCompras(evaluados){return evaluados.filter(x=>x.estado==='FALTANTE').map(x=>({nombre:x.nombre,cantidad:x.faltante,unidad:x.unidad}));}
  const api={leerLista,evaluar,listaCompras};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FloraInventario=api;
})(typeof globalThis==='object'?globalThis:this);
