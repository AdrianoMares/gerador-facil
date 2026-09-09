import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findServiceBySlugs, serviceCategories, servicesRegistry } from '../src/catalog/servicesRegistry.js';
import { buildDeclaracaoImpostoRendaDetail } from '../src/catalog/declaracaoImpostoRendaDetail.js';
import { getImpostoRendaAnnualConfig } from '../src/catalog/impostoRendaAnnualConfig.js';
import { currentYear } from '../src/config/currentYear.js';

test('catálogo de serviços contém as categorias iniciais e identificadores únicos', () => {
  assert.deepEqual(serviceCategories.map((category) => category.slug), ['imposto-de-renda', 'mei', 'meu-inss']);
  assert.equal(new Set(servicesRegistry.map((service) => service.slug)).size, servicesRegistry.length);
  assert.equal(new Set(servicesRegistry.map((service) => service.path)).size, servicesRegistry.length);
  assert.ok(servicesRegistry.every((service) => ['planned', 'draft', 'active'].includes(service.status)));
});

test('serviços individuais só são resolvidos quando possuem conteúdo preparado', () => {
  const meiDeclaration = findServiceBySlugs('mei', 'declaracao-anual-mei');
  const aberturaMei = findServiceBySlugs('mei', 'abertura-de-mei');

  assert.equal(meiDeclaration?.status, 'active');
  assert.equal(meiDeclaration?.detail?.technicalName, 'DASN-SIMEI');
  assert.equal(aberturaMei?.status, 'draft');
  assert.equal(aberturaMei?.priceCents, 10000);
  assert.equal(aberturaMei?.priceSuffix, 'por abertura');
  assert.equal(aberturaMei?.detail?.heroTitle, 'Abertura de MEI');
  assert.equal(aberturaMei?.checkout, undefined);
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
  assert.equal(service?.status, 'active');
});

test('Declaração de Imposto de Renda usa o ano atual e permanece draft sem checkout', () => {
  const service = findServiceBySlugs('imposto-de-renda', 'declaracao-imposto-de-renda');

  assert.equal(service?.name, `Declaração de Imposto de Renda ${currentYear}`);
  assert.equal(service?.detail?.heroTitle, `Declaração de Imposto de Renda ${currentYear}`);
  assert.match(service?.seo?.title || '', new RegExp(String(currentYear)));
  assert.equal(service?.path, '/servicos/imposto-de-renda/declaracao-imposto-de-renda');
  assert.equal(service?.priceCents, 10000);
  assert.equal(service?.priceSuffix, 'por declaração/ano');
  assert.equal(service?.status, 'draft');
  assert.equal(service?.checkout, undefined);
});

test('regras anuais só aparecem quando o exercício corresponde ao ano solicitado', () => {
  const config2026 = getImpostoRendaAnnualConfig(2026);
  const futureDetail = buildDeclaracaoImpostoRendaDetail(2027);
  const futureContent = JSON.stringify(futureDetail);

  assert.equal(config2026?.exerciseYear, 2026);
  assert.equal(config2026?.calendarYear, 2025);
  assert.equal(getImpostoRendaAnnualConfig(2027), null);
  assert.match(futureContent, /regras, os limites e os prazos específicos/);
  assert.doesNotMatch(futureContent, /35\.584,00|177\.920,00|16\.754,34|29 de maio de 2026/);
});

test('rota e navegação agregada de serviços estão registradas', () => {
  const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/app/layout/Header.jsx', import.meta.url), 'utf8');

  assert.match(router, /path: 'servicos'/);
  assert.match(header, /to="\/servicos">Serviços/);
  assert.doesNotMatch(header, /activeTools/);
  assert.doesNotMatch(header, /tool\.shortName/);
});
