import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { serviceCategories, servicesRegistry } from '../src/catalog/servicesRegistry.js';

test('catálogo de serviços contém as categorias iniciais e identificadores únicos', () => {
  assert.deepEqual(serviceCategories.map((category) => category.slug), ['imposto-de-renda', 'mei', 'meu-inss']);
  assert.equal(new Set(servicesRegistry.map((service) => service.slug)).size, servicesRegistry.length);
  assert.equal(new Set(servicesRegistry.map((service) => service.path)).size, servicesRegistry.length);
  assert.ok(servicesRegistry.every((service) => service.status === 'planned'));
});

test('rota e navegação agregada de serviços estão registradas', () => {
  const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/app/layout/Header.jsx', import.meta.url), 'utf8');

  assert.match(router, /path: 'servicos'/);
  assert.match(header, /to="\/servicos">Serviços/);
  assert.doesNotMatch(header, /activeTools/);
  assert.doesNotMatch(header, /tool\.shortName/);
});
