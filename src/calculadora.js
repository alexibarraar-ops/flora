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
  const api = { calcularIngredientes, calcularBalance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FloraCalculadora = api;
})(typeof globalThis === 'object' ? globalThis : this);
