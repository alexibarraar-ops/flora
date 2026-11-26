'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularIngredientes } = require('../src/calculadora');

const receta = {
  rendimiento: 4,
  ingredientes: [
    { nombre: 'Ingrediente ficticio', cantidad: 80, unidad: 'g' },
    { nombre: 'Envases', cantidad: 4, unidad: 'unidad' },
  ],
};

test('escala una tanda a cinco unidades, incluyendo envases', () => {
  assert.deepEqual(calcularIngredientes(receta, 5), [
    { nombre: 'Ingrediente ficticio', cantidad: 100, unidad: 'g' },
    { nombre: 'Envases', cantidad: 5, unidad: 'unidad' },
  ]);
});
test('calcula también fracciones de tanda', () => {
  assert.equal(calcularIngredientes(receta, 1)[0].cantidad, 20);
});
test('rechaza cantidades y recetas inválidas', () => {
  assert.throws(() => calcularIngredientes(receta, 0), /entre 1 y 200/);
  assert.throws(() => calcularIngredientes(receta, 1.5), /entre 1 y 200/);
  assert.throws(() => calcularIngredientes({ rendimiento: 0, ingredientes: [] }, 2), /rendimiento/);
});
test('no modifica la receta de origen', () => {
  const anterior = JSON.stringify(receta);
  calcularIngredientes(receta, 10);
  assert.equal(JSON.stringify(receta), anterior);
});
