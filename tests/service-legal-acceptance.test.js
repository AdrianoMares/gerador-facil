import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findServiceBySlugs } from '../src/catalog/servicesRegistry.js';
import { readServiceCheckoutEnabled } from '../src/config/serviceCheckout.js';
import {
  canStartServicePurchase,
  isServiceCheckoutReady,
  isServicePurchaseEnabled
} from '../src/services/servicePurchase.js';

const readyDraftService = {
  status: 'draft',
  checkout: { ready: true, productCode: 'service_code' }
};

test('contratação de serviço pronto só inicia em ambiente habilitado e com os dois aceites', () => {
  assert.equal(canStartServicePurchase(readyDraftService, false, true, true), false);
  assert.equal(canStartServicePurchase(readyDraftService, true, false, false), false);
  assert.equal(canStartServicePurchase(readyDraftService, true, true, false), false);
  assert.equal(canStartServicePurchase(readyDraftService, true, false, true), false);
  assert.equal(canStartServicePurchase(readyDraftService, true, true, true), true);
});

test('flag frontend é estrita e permanece fail closed', () => {
  assert.equal(readServiceCheckoutEnabled({}), false);
  assert.equal(readServiceCheckoutEnabled({ VITE_SERVICE_CHECKOUT_ENABLED: 'false' }), false);
  assert.equal(readServiceCheckoutEnabled({ VITE_SERVICE_CHECKOUT_ENABLED: 'TRUE' }), false);
  assert.equal(readServiceCheckoutEnabled({ VITE_SERVICE_CHECKOUT_ENABLED: 'invalid' }), false);
  assert.equal(readServiceCheckoutEnabled({ VITE_SERVICE_CHECKOUT_ENABLED: 'true' }), true);
});

test('prontidão técnica é independente do status editorial', () => {
  assert.equal(isServiceCheckoutReady(readyDraftService), true);
  assert.equal(isServicePurchaseEnabled(readyDraftService, true), true);
  assert.equal(isServicePurchaseEnabled(readyDraftService, false), false);
  assert.equal(isServiceCheckoutReady({ status: 'active', checkout: { ready: false, productCode: 'service_code' } }), false);
  assert.equal(isServiceCheckoutReady({ status: 'planned', checkout: { ready: true, productCode: 'service_code' } }), false);
  assert.equal(isServiceCheckoutReady({ status: 'draft', checkout: { ready: true } }), false);
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
  assert.match(purchase, /disabled=\{!purchaseEnabled\}/);
  assert.ok(purchase.indexOf('if (!purchaseEnabled)') < purchase.indexOf('recordServiceLegalAcceptances()'));
  assert.match(detailPage, /<ServiceLegalAcceptance disabled \/>/);
});

test('Regularização do MEI continua como rascunho sem checkout ativo', () => {
  const service = findServiceBySlugs('mei', 'regularizacao-mei');
  const detail = readFileSync(new URL('../src/catalog/regularizacaoMeiDetail.js', import.meta.url), 'utf8');

  assert.equal(service?.status, 'draft');
  assert.equal(service?.priceCents, 10000);
  assert.equal(service?.priceSuffix, 'por MEI/regularização');
  assert.equal(service?.checkout?.productCode, 'regularizacao_mei');
  assert.equal(service?.checkout?.ready, false);
  assert.doesNotMatch(detail, /\/servicos\/mei\/abertura-de-mei/);
  assert.match(detail, /\/servicos\/mei\/declaracao-anual-mei/);
});
