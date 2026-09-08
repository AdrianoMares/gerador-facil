import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findServiceBySlugs } from '../src/catalog/servicesRegistry.js';
import { canStartServicePurchase } from '../src/services/servicePurchase.js';

test('contratação de serviço ativo só inicia com os dois aceites', () => {
  const activeService = { status: 'active' };

  assert.equal(canStartServicePurchase(activeService, false, false), false);
  assert.equal(canStartServicePurchase(activeService, true, false), false);
  assert.equal(canStartServicePurchase(activeService, false, true), false);
  assert.equal(canStartServicePurchase(activeService, true, true), true);
});

test('serviço draft nunca pode iniciar contratação', () => {
  assert.equal(canStartServicePurchase({ status: 'draft' }, true, true), false);
  assert.equal(canStartServicePurchase({ status: 'planned' }, true, true), false);
});

test('aceites jurídicos são reutilizáveis e links permanecem disponíveis em draft', () => {
  const legalAcceptance = readFileSync(new URL('../src/components/ServiceLegalAcceptance.jsx', import.meta.url), 'utf8');
  const purchase = readFileSync(new URL('../src/components/ServicePurchase.jsx', import.meta.url), 'utf8');
  const detailPage = readFileSync(new URL('../src/app/routes/ServiceDetailPage.jsx', import.meta.url), 'utf8');

  assert.match(legalAcceptance, /to="\/termos-de-uso"/);
  assert.match(legalAcceptance, /to="\/politica-de-privacidade"/);
  assert.match(legalAcceptance, /disabled=\{disabled\}/);
  assert.match(purchase, /recordServiceLegalAcceptances/);
  assert.match(purchase, /canStartServicePurchase/);
  assert.match(detailPage, /<ServiceLegalAcceptance disabled \/>/);
});

test('Regularização do MEI continua como rascunho sem checkout ativo', () => {
  const service = findServiceBySlugs('mei', 'regularizacao-mei');
  const detail = readFileSync(new URL('../src/catalog/regularizacaoMeiDetail.js', import.meta.url), 'utf8');

  assert.equal(service?.status, 'draft');
  assert.equal(service?.priceCents, 10000);
  assert.equal(service?.priceSuffix, 'por MEI/regularização');
  assert.equal(service?.checkout?.productCode, 'regularizacao_mei');
  assert.doesNotMatch(detail, /\/servicos\/mei\/abertura-de-mei/);
  assert.match(detail, /\/servicos\/mei\/declaracao-anual-mei/);
});
