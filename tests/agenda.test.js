'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../src/agenda.js');

test('agenda visual calcula el inicio de la semana en lunes',()=>{
  assert.equal(a.diaISO(a.inicioSemana(new Date(2026,10,26))),'2026-11-23');
  assert.equal(a.diaISO(a.sumarDias(new Date(2026,10,26),7)),'2026-12-03');
});
test('agenda visual detecta conflictos y permite turnos consecutivos',()=>{
  const turnos=[{fecha:'2026-11-26',hora:'16:00',duracion:60}];
  assert.equal(a.sinConflicto(turnos,{fecha:'2026-11-26',hora:'16:30',duracion:60}),false);
  assert.equal(a.sinConflicto(turnos,{fecha:'2026-11-26',hora:'17:00',duracion:60}),true);
  assert.equal(a.sinConflicto(turnos,{fecha:'2026-11-27',hora:'16:30',duracion:60}),true);
  assert.equal(a.sinConflicto(turnos,{fecha:'2026-11-26',hora:'23:30',duracion:60}),false);
});
