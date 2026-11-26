/* Flora OS: reglas de inventario sin acceso a datos ni servicios externos. */
'use strict';

const PRECISION = 1e6;
const redondear = (n) => Math.round((n + Number.EPSILON) * PRECISION) / PRECISION;

function positivo(n, campo) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(`${campo} debe ser un número positivo`);
  }
  return n;
}

function obtener(registros, id, tipo) {
  const valor = registros[id];
  if (!valor) throw new Error(`${tipo} no encontrado: ${id}`);
  return valor;
}

function movimiento(tipo, id, cantidad, referencia) {
  return { tipo, id, cantidad: redondear(cantidad), referencia };
}

/**
 * Estado esperado:
 * productos: { id: { nombre, rendimiento, receta: [{ insumoId, cantidad, unidad }] } }
 * insumos: { id: { nombre, unidad, minimo } }
 * stockInsumos: { id: cantidad }; stockProductos: { id: cantidad }
 * operacionesProcesadas: { requestId: resultado } (persistir externamente).
 *
 * Los movimientos devueltos son una propuesta, NO se aplican al estado.
 * El adaptador de persistencia debe grabar resultado + movimientos de forma atómica.
 */
function planificarProduccion(estado, orden) {
  const { requestId, productoId } = orden;
  validarOrden(estado, orden);
  if (estado.operacionesProcesadas?.[requestId]) {
    return { duplicada: true, resultadoAnterior: estado.operacionesProcesadas[requestId] };
  }
  const producto = obtener(estado.productos, productoId, 'Producto');
  const cantidad = positivo(orden.cantidad, 'cantidad');
  const rendimiento = positivo(producto.rendimiento, 'rendimiento');
  if (!Array.isArray(producto.receta) || !producto.receta.length) {
    throw new Error('El producto no tiene receta registrada');
  }
  const requeridos = new Map();
  for (const componente of producto.receta) {
    const insumo = obtener(estado.insumos, componente.insumoId, 'Insumo');
    if (insumo.unidad !== componente.unidad) {
      throw new Error(`Unidad incompatible para ${componente.insumoId}`);
    }
    const requerido = redondear(positivo(componente.cantidad, 'cantidad de receta') * cantidad / rendimiento);
    requeridos.set(componente.insumoId, redondear((requeridos.get(componente.insumoId) || 0) + requerido));
  }
  const faltantes = [];
  for (const [id, requerido] of requeridos) {
    const disponible = estado.stockInsumos[id] || 0;
    if (disponible < requerido) {
      faltantes.push({ insumoId: id, requerido, disponible, falta: redondear(requerido - disponible) });
    }
  }
  if (faltantes.length) return { aprobada: false, requestId, faltantes };
  return {
    aprobada: true,
    requestId,
    movimientos: [
      ...[...requeridos].map(([id, q]) => movimiento('insumo', id, -q, requestId)),
      movimiento('producto', productoId, cantidad, requestId),
    ],
    aviso: 'Registrar lote, fecha de elaboración y vencimiento en la capa de persistencia.',
  };
}

function planificarVenta(estado, orden) {
  validarOrden(estado, orden);
  const { requestId, productoId } = orden;
  if (estado.operacionesProcesadas?.[requestId]) {
    return { duplicada: true, resultadoAnterior: estado.operacionesProcesadas[requestId] };
  }
  obtener(estado.productos, productoId, 'Producto');
  const cantidad = positivo(orden.cantidad, 'cantidad');
  const disponible = estado.stockProductos[productoId] || 0;
  if (disponible < cantidad) {
    return { aprobada: false, requestId, faltantes: [{ productoId, requerido: cantidad, disponible }] };
  }
  return { aprobada: true, requestId, movimientos: [movimiento('producto', productoId, -cantidad, requestId)] };
}

function alertasReposicion(estado) {
  return Object.entries(estado.insumos)
    .filter(([, insumo]) => typeof insumo.minimo === 'number' && Number.isFinite(insumo.minimo))
    .filter(([id, insumo]) => (estado.stockInsumos[id] || 0) <= insumo.minimo)
    .map(([id, insumo]) => ({ insumoId: id, disponible: estado.stockInsumos[id] || 0, minimo: insumo.minimo }));
}

function validarOrden(estado, orden) {
  if (!estado || !orden || !orden.requestId || typeof orden.requestId !== 'string') {
    throw new Error('Se requiere requestId único para evitar duplicados');
  }
  if (!orden.productoId || typeof orden.productoId !== 'string') {
    throw new Error('Se requiere productoId');
  }
}

const FloraCore = { planificarProduccion, planificarVenta, alertasReposicion };
if (typeof module !== 'undefined' && module.exports) module.exports = FloraCore;
