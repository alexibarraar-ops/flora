'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const r=require('../src/reservas.js');
const base={servicio:'tarot',fecha:'2026-12-03',hora:'16:30',nombre:'Cliente de prueba',contacto:'000000'};
test('reservas públicas reconocen categorías de sesiones y talleres',()=>{
  assert.deepEqual(r.servicios.map(s=>s.id),['tarot','astral','solar','taller']);
  assert.equal(r.validarSolicitud(base,'2026-11-26'),'');
});
test('reservas públicas rechazan datos incompletos, fechas pasadas y horarios ajenos',()=>{
  assert.match(r.validarSolicitud({...base,servicio:'inexistente'},'2026-11-26'),/servicio/);
  assert.match(r.validarSolicitud({...base,fecha:'2026-11-01'},'2026-11-26'),/fecha/);
  assert.match(r.validarSolicitud({...base,hora:'21:30'},'2026-11-26'),/horario/);
  assert.match(r.validarSolicitud({...base,nombre:'  '},'2026-11-26'),/nombre/);
  assert.match(r.validarSolicitud({...base,contacto:''},'2026-11-26'),/contacto/);
});
