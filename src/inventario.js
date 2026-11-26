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
  function consolidarListas(listas){
    if(!Array.isArray(listas)||!listas.length)throw Error('Todavía no agregaste producciones');
    const total=new Map();
    for(const lista of listas){
      if(!Array.isArray(lista)||!lista.length)throw Error('Producción sin ingredientes');
      for(const item of lista){
        if(!item.nombre||!item.unidad||typeof item.cantidad!=='number'||!Number.isFinite(item.cantidad)||item.cantidad<=0)throw Error('Ingrediente inválido');
        const clave=item.nombre.trim().toLocaleLowerCase('es')+'|'+item.unidad;
        for(const anterior of total.values()){
          if(anterior.nombre.trim().toLocaleLowerCase('es')===item.nombre.trim().toLocaleLowerCase('es')&&anterior.unidad!==item.unidad)throw Error(`Unidades incompatibles para ${item.nombre}: ${anterior.unidad} y ${item.unidad}. Revisar receta antes de sumar.`);
        }
        if(total.has(clave))total.get(clave).cantidad=redondear(total.get(clave).cantidad+item.cantidad);
        else total.set(clave,{nombre:item.nombre,cantidad:item.cantidad,unidad:item.unidad});
      }
    }
    return [...total.values()];
  }
  function listaCompras(evaluados){return evaluados.filter(x=>x.estado==='FALTANTE').map(x=>({nombre:x.nombre,cantidad:x.faltante,unidad:x.unidad}));}
  const api={leerLista,consolidarListas,evaluar,listaCompras};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FloraInventario=api;
})(typeof globalThis==='object'?globalThis:this);
