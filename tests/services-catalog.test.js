import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findServiceBySlugs, serviceCategories, servicesRegistry } from '../src/catalog/servicesRegistry.js';

test('catálogo de serviços contém as categorias iniciais e identificadores únicos', () => {
  assert.deepEqual(serviceCategories.map((category) => category.slug), ['imposto-de-renda', 'mei', 'meu-inss']);
  assert.equal(new Set(servicesRegistry.map((service) => service.slug)).size, servicesRegistry.length);
  assert.equal(new Set(servicesRegistry.map((service) => service.path)).size, servicesRegistry.length);
  assert.ok(servicesRegistry.every((service) => ['planned', 'draft', 'active'].includes(service.status)));
});

test('serviços individuais só são resolvidos quando possuem conteúdo preparado', () => {
  const draft = findServiceBySlugs('mei', 'declaracao-anual-mei');

  assert.equal(draft?.status, 'draft');
  assert.equal(draft?.detail?.technicalName, 'DASN-SIMEI');
  assert.equal(findServiceBySlugs('mei', 'abertura-de-mei'), undefined);
  assert.equal(findServiceBySlugs('categoria-inexistente', 'servico-inexistente'), undefined);
});

test('rota individual, SEO e card respeitam o status do serviço', () => {
  const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/routes/ServiceDetailPage.jsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/ServiceCard.jsx', import.meta.url), 'utf8');
  const purchase = readFileSync(new URL('../src/components/ServicePurchase.jsx', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

  assert.match(router, /servicos\/:categorySlug\/:serviceSlug/);
  assert.match(page, /noindex=\{isDraft\}/);
  assert.match(page, /return <NotFound/);
  assert.match(card, /service\.status === 'active'/);
  assert.match(purchase, /service\.status !== 'active'/);
  assert.match(purchase, /createCheckoutOrder/);
  assert.match(purchase, /resourceId: null/);
  assert.doesNotMatch(sitemap, /declaracao-anual-mei/);
});

test('serviço MEI preserva o checkout server-side com preço definido', () => {
  const service = findServiceBySlugs('mei', 'declaracao-anual-mei');

  assert.equal(service?.checkout?.productCode, 'declaracao_anual_mei');
  assert.equal(service?.priceCents, 10000);
  assert.equal(service?.status, 'draft');
});

test('rota e navegação agregada de serviços estão registradas', () => {
  const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/app/layout/Header.jsx', import.meta.url), 'utf8');

  assert.match(router, /path: 'servicos'/);
  assert.match(header, /to="\/servicos">Serviços/);
  assert.doesNotMatch(header, /activeTools/);
  assert.doesNotMatch(header, /tool\.shortName/);
});
