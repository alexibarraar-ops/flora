'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planificarProduccion, planificarVenta } = require('../src/flora-core');
const { saldo, registrar } = require('../src/flora-registro');

function datos() {
  return {
    productos: { jabon: { rendimiento: 2, receta: [
      { insumoId: 'base', cantidad: 100, unidad: 'g' },
      { insumoId: 'caja', cantidad: 2, unidad: 'unidad' },
    ] } },
    insumos: { base: { unidad: 'g' }, caja: { unidad: 'unidad' } },
    stockInsumos: { base: 200, caja: 6 }, stockProductos: { jabon: 0 },
  };
}

test('producción registra ingredientes, packaging, producto, lote y vencimiento', () => {
  const s = datos();
  const plan = planificarProduccion(s, { requestId: 'prod-001', productoId: 'jabon', cantidad: 2 });
  const libro = [
    { requestId: 'inicio', tipo: 'insumo', id: 'base', cantidad: 200 },
    { requestId: 'inicio', tipo: 'insumo', id: 'caja', cantidad: 6 },
  ];
  const r = registrar(libro, plan, { fecha: '2026-11-26', loteId: 'L-001', vencimiento: '2027-02-26' });
  assert.equal(r.registrada, true);
  assert.equal(saldo(libro, 'insumo', 'base'), 100);
  assert.equal(saldo(libro, 'producto', 'jabon'), 2);
  assert.equal(r.movimientos[2].loteId, 'L-001');
  assert.equal(registrar(libro, plan, { fecha: '2026-11-26', loteId: 'L-001', vencimiento: '2027-02-26' }).duplicada, true);
  assert.equal(saldo(libro, 'producto', 'jabon'), 2);
});

test('no registra productos elaborados sin lote o vencimiento', () => {
  const plan = planificarProduccion(datos(), { requestId: 'prod-002', productoId: 'jabon', cantidad: 2 });
  assert.throws(() => registrar([], plan, { fecha: '2026-11-26' }), /lote y vencimiento/);
});

test('el registro rechaza stock insuficiente aunque la planificación sea vieja', () => {
  const s = datos();
  const plan = planificarVenta({ ...s, stockProductos: { jabon: 2 } },
    { requestId: 'venta-001', productoId: 'jabon', cantidad: 2 });
  assert.throws(() => registrar([], plan, { fecha: '2026-11-26' }), /Stock insuficiente/);
});

test('no registra planes rechazados', () => {
  assert.throws(() => registrar([], { requestId: 'no', aprobada: false }, { fecha: '2026-11-26' }), /aprobados/);
});
