/* Flora OS: libro de movimientos en memoria, diseñado para probar reglas antes de usar Sheets. */
'use strict';

const TIPOS = new Set(['insumo', 'producto']);

function validarMovimientos(movimientos) {
  if (!Array.isArray(movimientos) || movimientos.length === 0) throw Error('Operación sin movimientos');
  for (const m of movimientos) {
    if (!TIPOS.has(m.tipo) || typeof m.id !== 'string' || !m.id ||
        !Number.isFinite(m.cantidad) || m.cantidad === 0) throw Error('Movimiento inválido');
  }
}

function saldo(movimientos, tipo, id, inicial = 0) {
  return movimientos.filter(m => m.tipo === tipo && m.id === id)
    .reduce((total, m) => Math.round((total + m.cantidad) * 1e6) / 1e6, inicial);
}

/**
 * Registrar una operación completa en el libro, solo si aún no existe el ID.
 * No es un conector de Google Sheets: la atomicidad y exclusión mutua se
 * implementarán con LockService al conectar el backend de Lucy.
 */
function registrar(libro, plan, { fecha, loteId, vencimiento } = {}) {
  if (!Array.isArray(libro)) throw Error('Libro inválido');
  if (!plan || typeof plan.requestId !== 'string' || !plan.requestId) throw Error('requestId obligatorio');
  const anteriores = libro.filter(m => m.requestId === plan.requestId);
  if (anteriores.length) return { duplicada: true, movimientos: anteriores };
  if (plan.aprobada !== true) throw Error('Solo se registran planes aprobados');
  validarMovimientos(plan.movimientos);
  if (plan.movimientos.some(m => m.referencia !== plan.requestId)) throw Error('Referencia inconsistente');
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw Error('Fecha ISO obligatoria');
  const produccion = plan.movimientos.some(m => m.tipo === 'producto' && m.cantidad > 0);
  if (produccion && (!loteId || !vencimiento || !/^\d{4}-\d{2}-\d{2}$/.test(vencimiento) || vencimiento < fecha)) {
    throw Error('La producción requiere lote y vencimiento válido');
  }
  const cambios = new Map();
  for (const m of plan.movimientos) {
    const clave = `${m.tipo}:${m.id}`;
    cambios.set(clave, { tipo: m.tipo, id: m.id, cantidad: (cambios.get(clave)?.cantidad || 0) + m.cantidad });
  }
  for (const { tipo, id, cantidad } of cambios.values()) {
    if (saldo(libro, tipo, id) + cantidad < -1e-6) throw Error(`Stock insuficiente al registrar: ${id}`);
  }
  const nuevos = plan.movimientos.map((m, i) => ({
    requestId: plan.requestId,
    secuencia: i + 1,
    fecha,
    tipo: m.tipo,
    id: m.id,
    cantidad: m.cantidad,
    loteId: produccion ? loteId : '',
    vencimiento: produccion ? vencimiento : '',
  }));
  libro.push(...nuevos);
  return { registrada: true, movimientos: nuevos };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { saldo, registrar };
