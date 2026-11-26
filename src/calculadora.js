/* Flora OS: cálculo proporcional, sin efectos en inventario. */
'use strict';
(function (root) {
  function calcularIngredientes(receta, cantidad) {
    if (!receta || !Number.isInteger(receta.rendimiento) || receta.rendimiento < 1) {
      throw new Error('La receta necesita un rendimiento válido');
    }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 200) {
      throw new Error('Elegí entre 1 y 200 unidades');
    }
    if (!Array.isArray(receta.ingredientes) || receta.ingredientes.length === 0) {
      throw new Error('Faltan ingredientes');
    }
    return receta.ingredientes.map(item => {
      if (!item.nombre || !item.unidad || typeof item.cantidad !== 'number' || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
        throw new Error('Ingrediente incompleto');
      }
      return {
        nombre: item.nombre,
        cantidad: Math.round((item.cantidad * cantidad / receta.rendimiento + Number.EPSILON) * 1e4) / 1e4,
        unidad: item.unidad,
      };
    });
  }
  function calcularBalance(receta, cantidad) {
    calcularIngredientes(receta, cantidad);
    if (!receta.balance) return null;
    const b = receta.balance;
    if (!b.ingrediente || !b.unidad || typeof b.entradaBase !== 'number' || !Number.isFinite(b.entradaBase) || b.entradaBase <= 0 ||
        typeof b.salidaBase !== 'number' || !Number.isFinite(b.salidaBase) || b.salidaBase <= 0 || b.salidaBase > b.entradaBase) {
      throw new Error('Balance de elaboración inválido');
    }
    const componentes = receta.ingredientes.filter(i => i.nombre === b.ingrediente);
    if (!componentes.length || componentes.some(i => i.unidad !== b.unidad) ||
        Math.abs(componentes.reduce((n,i)=>n+i.cantidad,0)-b.entradaBase)>1e-6) {
      throw new Error('El balance no coincide con los ingredientes de la receta');
    }
    const factor = cantidad / receta.rendimiento;
    const redondear=n=>Math.round((n+Number.EPSILON)*1e4)/1e4;
    return {ingrediente:b.ingrediente,unidad:b.unidad,
      utilizado:redondear(b.entradaBase*factor),
      envasado:redondear(b.salidaBase*factor),
      merma:redondear((b.entradaBase-b.salidaBase)*factor)};
  }
  function importarBorradores(texto) {
    if (typeof texto !== 'string' || texto.length > 250000) throw new Error('La tabla es demasiado grande');
    const filas = texto.trim().split(/\r?\n/).map(l => l.split('\t'));
    const cabecera = ['PRODUCTO_ID','INSUMO_ID','INSUMO','CANTIDAD_POR_UNIDAD','UNIDAD','RENDIMIENTO_UNIDADES','ESTADO'];
    if (!filas.length || cabecera.some((v,i)=>filas[0][i]?.trim()!==v)) throw new Error('Copiá el rango completo de BORRADOR_RECETAS, incluyendo los títulos');
    const grupos = new Map();
    for (const fila of filas.slice(1)) {
      if (fila.every(v=>!v.trim())) continue;
      const [id,insumoId,nombre,cant,unidad,rendimiento,estado,observacion=''] = fila.map(v=>v.trim());
      const cantidad = Number(cant.replace(',','.'));
      const base = Number(rendimiento.replace(',','.'));
      if (!/^FL-\d{3}$/.test(id) || !/^IN-\d{3}$/.test(insumoId) || !nombre || !unidad || !Number.isFinite(cantidad) || cantidad<=0 || !Number.isInteger(base) || base<1 || estado!=='PENDIENTE') throw new Error(`Fila inválida de borradores: ${id||'sin producto'}`);
      if (!grupos.has(id)) grupos.set(id,{id,rendimiento:1,ingredientes:[],advertencias:[]});
      const grupo=grupos.get(id);
      if (grupo.ingredientes.some(x=>x.insumoId===insumoId)) throw new Error(`Insumo repetido en ${id}: ${insumoId}`);
      grupo.ingredientes.push({insumoId,nombre,cantidad,unidad});
      if (observacion) grupo.advertencias.push(`${nombre}: ${observacion}`);
    }
    if (!grupos.size || grupos.size>100 || filas.length>500) throw new Error('No se encontraron recetas válidas');
    return [...grupos.values()];
  }
  const api = { calcularIngredientes, calcularBalance, importarBorradores };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FloraCalculadora = api;
})(typeof globalThis === 'object' ? globalThis : this);
