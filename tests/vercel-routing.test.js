import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const fallback = config.rewrites[0];
const fallbackPattern = new RegExp(`^${fallback.source}$`);

test('fallback da SPA não captura Vercel Functions em /api', () => {
  assert.equal(fallbackPattern.test('/api/ai-document-assist'), false);
  assert.equal(fallbackPattern.test('/api/ai-transcribe'), false);
  assert.equal(existsSync(new URL('../api/ai-document-assist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/ai-transcribe.js', import.meta.url)), true);
});

test('fallback da SPA mantém deep links dos geradores', () => {
  assert.equal(fallbackPattern.test('/'), true);
  assert.equal(fallbackPattern.test('/ferramentas/gerador-de-recibo'), true);
  assert.equal(fallbackPattern.test('/ferramentas/gerador-de-curriculo'), true);
  assert.equal(fallback.destination, '/index.html');
});
