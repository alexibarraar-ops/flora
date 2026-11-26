'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularIngredientes, calcularBalance } = require('../src/calculadora');

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
test('muestra bruto, envasado y pérdida a partir de cantidades ficticias declaradas',()=>{
  const ejemplo={rendimiento:2,ingredientes:[{nombre:'Infusión ficticia',cantidad:100,unidad:'ml'},{nombre:'Envases',cantidad:2,unidad:'unidad'}],balance:{ingrediente:'Infusión ficticia',entradaBase:100,salidaBase:70,unidad:'ml'}};
  assert.deepEqual(calcularBalance(ejemplo,5),{ingrediente:'Infusión ficticia',unidad:'ml',utilizado:250,envasado:175,merma:75});
  assert.equal(calcularIngredientes(ejemplo,5)[0].cantidad,250);
  assert.equal(calcularBalance(receta,5),null);
});
test('rechaza una pérdida declarada que no corresponda a la receta',()=>{
  const ejemplo={rendimiento:1,ingredientes:[{nombre:'Extracto ficticio',cantidad:50,unidad:'ml'}],balance:{ingrediente:'Extracto ficticio',entradaBase:45,salidaBase:35,unidad:'ml'}};
  assert.throws(()=>calcularBalance(ejemplo,5),/no coincide/);
  ejemplo.balance.entradaBase=50;ejemplo.balance.salidaBase=60;
  assert.throws(()=>calcularBalance(ejemplo,5),/inválido/);
});
