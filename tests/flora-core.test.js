'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planificarProduccion, planificarVenta, alertasReposicion } = require('../src/flora-core');

const estado = () => ({
  productos: { crema: { nombre: 'Crema ficticia', rendimiento: 5, receta: [
    { insumoId: 'aceite', cantidad: 100, unidad: 'ml' },
    { insumoId: 'frasco', cantidad: 5, unidad: 'unidad' },
    { insumoId: 'etiqueta', cantidad: 5, unidad: 'unidad' },
  ] } },
  insumos: {
    aceite: { unidad: 'ml', minimo: 50 },
    frasco: { unidad: 'unidad', minimo: 3 },
    etiqueta: { unidad: 'unidad', minimo: 2 },
  },
  stockInsumos: { aceite: 150, frasco: 10, etiqueta: 10 },
  stockProductos: { crema: 7 },
  operacionesProcesadas: {},
});

test('calcula producción proporcional y consume también envases y etiquetas', () => {
  const r = planificarProduccion(estado(), { requestId: 'p1', productoId: 'crema', cantidad: 3 });
  assert.equal(r.aprobada, true);
  assert.deepEqual(r.movimientos.map((m) => m.cantidad), [-60, -3, -3, 3]);
});

test('no autoriza producción si faltan insumos', () => {
  const r = planificarProduccion(estado(), { requestId: 'p2', productoId: 'crema', cantidad: 10 });
  assert.equal(r.aprobada, false);
  assert.equal(r.faltantes[0].falta, 50);
});

test('no duplica órdenes ya procesadas', () => {
  const s = estado();
  s.operacionesProcesadas.p1 = { confirmado: true };
  assert.deepEqual(planificarProduccion(s, { requestId: 'p1', productoId: 'crema', cantidad: 5 }),
    { duplicada: true, resultadoAnterior: { confirmado: true } });
});

test('rechaza unidades incompatibles', () => {
  const s = estado();
  s.productos.crema.receta[0].unidad = 'gramos';
  assert.throws(() => planificarProduccion(s, { requestId: 'p3', productoId: 'crema', cantidad: 5 }), /Unidad incompatible/);
});

test('planifica venta sin permitir stock negativo', () => {
  assert.equal(planificarVenta(estado(), { requestId: 'v1', productoId: 'crema', cantidad: 8 }).aprobada, false);
  assert.equal(planificarVenta(estado(), { requestId: 'v2', productoId: 'crema', cantidad: 2 }).movimientos[0].cantidad, -2);
});

test('avisa reposición cuando el stock alcanza o baja del mínimo', () => {
  const s = estado();
  s.stockInsumos.frasco = 3;
  assert.deepEqual(alertasReposicion(s), [{ insumoId: 'frasco', disponible: 3, minimo: 3 }]);
});

test('no acepta cantidades inválidas', () => {
  assert.throws(() => planificarVenta(estado(), { requestId: 'v3', productoId: 'crema', cantidad: -1 }), /positivo/);
  assert.throws(() => planificarProduccion(estado(), { productoId: 'crema', cantidad: 5 }), /requestId/);
});
