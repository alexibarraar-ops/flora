'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {clientes,filtrarActividades,puedePrepararMensaje}=require('../src/clientes-demo.js');
test('ficha única reúne actividades diferentes por cliente',()=>{
  assert.deepEqual(filtrarActividades(clientes[0],'TODAS').map(a=>a.tipo),['TURNO','SESION','COMPRA']);
  assert.equal(filtrarActividades(clientes[0],'COMPRA').length,1);
  assert.equal(filtrarActividades(clientes[1],'CURSO').length,1);
});
test('no prepara mensajes para clientes sin consentimiento',()=>{
  assert.equal(puedePrepararMensaje(clientes[0]),true);
  assert.equal(puedePrepararMensaje(clientes[2]),false);
});
