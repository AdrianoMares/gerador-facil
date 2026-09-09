import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findServiceBySlugs, serviceCategories, servicesRegistry } from '../src/catalog/servicesRegistry.js';
import { isServicePurchaseEnabled } from '../src/services/servicePurchase.js';
import { buildServiceStructuredData } from '../src/services/serviceSeo.js';

test('catálogo de serviços contém as categorias iniciais e identificadores únicos', () => {
  assert.deepEqual(serviceCategories.map((category) => category.slug), ['imposto-de-renda', 'mei', 'meu-inss']);
  assert.equal(new Set(servicesRegistry.map((service) => service.slug)).size, servicesRegistry.length);
  assert.equal(new Set(servicesRegistry.map((service) => service.path)).size, servicesRegistry.length);
  assert.ok(servicesRegistry.every((service) => ['planned', 'draft', 'active'].includes(service.status)));
  assert.ok(servicesRegistry.filter((service) => service.checkout).every((service) => typeof service.checkout.ready === 'boolean'));
});

test('serviços individuais só são resolvidos quando possuem conteúdo preparado', () => {
  const draft = findServiceBySlugs('mei', 'declaracao-anual-mei');
  const aberturaMei = findServiceBySlugs('mei', 'abertura-de-mei');
  const regularizacaoMei = findServiceBySlugs('mei', 'regularizacao-mei');

  assert.equal(draft?.status, 'draft');
  assert.equal(draft?.checkout?.ready, true);
  assert.equal(draft?.detail?.technicalName, 'DASN-SIMEI');
  assert.equal(aberturaMei?.status, 'draft');
  assert.equal(aberturaMei?.priceCents, 10000);
  assert.equal(aberturaMei?.priceSuffix, 'por abertura');
  assert.equal(aberturaMei?.detail?.heroTitle, 'Abertura de MEI');
  assert.equal(aberturaMei?.checkout?.ready, false);
  assert.equal(aberturaMei?.checkout?.productCode, undefined);
  assert.equal(regularizacaoMei?.status, 'draft');
  assert.equal(regularizacaoMei?.checkout?.ready, false);
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
  assert.match(purchase, /isServiceCheckoutReady/);
  assert.match(purchase, /createCheckoutOrder/);
  assert.match(purchase, /resourceId: null/);
  assert.doesNotMatch(sitemap, /declaracao-anual-mei/);
});

test('serviço MEI preserva o checkout server-side com preço definido', () => {
  const service = findServiceBySlugs('mei', 'declaracao-anual-mei');

  assert.equal(service?.checkout?.productCode, 'declaracao_anual_mei');
  assert.equal(service?.checkout?.ready, true);
  assert.equal(service?.priceCents, 10000);
  assert.equal(service?.status, 'draft');
});

test('draft pronto pode contratar no ambiente de teste sem perder noindex', () => {
  const service = findServiceBySlugs('mei', 'declaracao-anual-mei');
  const page = readFileSync(new URL('../src/app/routes/ServiceDetailPage.jsx', import.meta.url), 'utf8');

  assert.equal(service?.status, 'draft');
  assert.equal(isServicePurchaseEnabled(service, true), true);
  assert.equal(isServicePurchaseEnabled(service, false), false);
  assert.match(page, /noindex=\{isDraft\}/);
});

test('JSON-LD omite Offer quando o checkout do ambiente está desabilitado', () => {
  const service = findServiceBySlugs('mei', 'declaracao-anual-mei');
  const common = {
    service,
    canonical: `https://www.resodi.com.br${service.path}`,
    faqItems: service.detail.faq,
    provider: { brand: 'Resodi', domain: 'https://www.resodi.com.br' }
  };
  const disabled = buildServiceStructuredData({ ...common, purchaseEnabled: false });
  const enabled = buildServiceStructuredData({ ...common, purchaseEnabled: true });

  assert.equal(disabled['@graph'][0].offers, undefined);
  assert.equal(disabled['@graph'][0]['@type'], 'Service');
  assert.equal(disabled['@graph'][1]['@type'], 'FAQPage');
  assert.equal(enabled['@graph'][0].offers?.['@type'], 'Offer');
});

test('rota e navegação agregada de serviços estão registradas', () => {
  const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/app/layout/Header.jsx', import.meta.url), 'utf8');

  assert.match(router, /path: 'servicos'/);
  assert.match(header, /to="\/servicos">Serviços/);
  assert.doesNotMatch(header, /activeTools/);
  assert.doesNotMatch(header, /tool\.shortName/);
});
