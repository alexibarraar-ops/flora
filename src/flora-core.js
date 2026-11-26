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
 * Balance declarado para una receta con pérdida de proceso.
 * La receta lleva el consumo BRUTO; este dato describe lo que finalmente se envasa.
 * No modifica cantidades de la receta ni descuenta stock por separado.
 */
function calcularBalanceProduccion(producto, unidades) {
  if (!producto || !producto.balance) return null;
  if (!Number.isInteger(unidades) || unidades < 1) throw new Error('Unidades inválidas');
  const rendimiento = positivo(producto.rendimiento, 'rendimiento');
  const balance = producto.balance;
  const entrada = positivo(balance.entradaBase, 'entrada bruta');
  const salida = positivo(balance.salidaBase, 'salida envasada');
  if (salida > entrada) throw new Error('La salida no puede superar la entrada declarada');
  if (typeof balance.insumoId !== 'string' || !balance.insumoId ||
      typeof balance.unidad !== 'string' || !balance.unidad) {
    throw new Error('Balance sin insumo o unidad');
  }
  const receta = (producto.receta || []).filter(x => x.insumoId === balance.insumoId);
  const brutoReceta = receta.reduce((n, x) => n + (x.unidad === balance.unidad ? x.cantidad : 0), 0);
  if (!receta.length || receta.some(x => x.unidad !== balance.unidad) || Math.abs(brutoReceta - entrada) > 1e-6) {
    throw new Error('El balance no coincide con el consumo bruto de la receta');
  }
  const factor = unidades / rendimiento;
  return {
    insumoId: balance.insumoId, unidad: balance.unidad,
    entradaBruta: redondear(entrada * factor),
    salidaEnvasada: redondear(salida * factor),
    perdidaProceso: redondear((entrada - salida) * factor),
    porcentajePerdida: redondear((entrada - salida) / entrada * 100),
    nota: 'Estimación según la merma declarada en la receta validada.',
  };
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
  const balance = calcularBalanceProduccion(producto, cantidad);
  return {
    aprobada: true,
    requestId,
    movimientos: [
      ...[...requeridos].map(([id, q]) => movimiento('insumo', id, -q, requestId)),
      movimiento('producto', productoId, cantidad, requestId),
    ],
    balance,
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

const FloraCore = { planificarProduccion, planificarVenta, alertasReposicion, calcularBalanceProduccion };
if (typeof module !== 'undefined' && module.exports) module.exports = FloraCore;
