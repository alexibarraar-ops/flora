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
  const api = { calcularIngredientes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FloraCalculadora = api;
})(typeof globalThis === 'object' ? globalThis : this);
