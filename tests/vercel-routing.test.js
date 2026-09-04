import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const fallback = config.rewrites[0];
const fallbackPattern = new RegExp(`^${fallback.source}$`);

test('fallback da SPA não captura Vercel Functions em /api', () => {
  assert.equal(fallbackPattern.test('/api/ai-document-assist'), false);
  assert.equal(fallbackPattern.test('/api/ai-transcribe'), false);
  assert.equal(fallbackPattern.test('/api/checkout/create'), false);
  assert.equal(fallbackPattern.test('/api/documents/download'), false);
  assert.equal(fallbackPattern.test('/api/payments/pagbank/pix/create'), false);
  assert.equal(fallbackPattern.test('/api/payments/pagbank/pix/status'), false);
  assert.equal(fallbackPattern.test('/api/payments/pagbank/webhook'), false);
  assert.equal(existsSync(new URL('../api/ai-document-assist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/ai-transcribe.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/checkout/create.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/documents/download.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/payments/pagbank/pix/create.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/payments/pagbank/pix/status.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../api/payments/pagbank/webhook.js', import.meta.url)), true);
});

test('arquivos de SEO não caem no fallback da SPA', () => {
  assert.equal(fallbackPattern.test('/sitemap.xml'), false);
  assert.equal(fallbackPattern.test('/robots.txt'), false);
});

test('sitemap contém XML bem formado e somente URLs públicas indexáveis', () => {
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const urls = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><\/url>/g)].map((match) => match[1]);
  const expected = [
    'https://resodi.com.br/',
    'https://resodi.com.br/ferramentas',
    'https://resodi.com.br/ferramentas/gerador-de-recibo',
    'https://resodi.com.br/ferramentas/gerador-de-curriculo',
    'https://resodi.com.br/servicos',
    'https://resodi.com.br/precos',
    'https://resodi.com.br/termos-de-uso',
    'https://resodi.com.br/politica-de-privacidade'
  ];

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<\/urlset>\s*$/);
  assert.deepEqual(urls, expected);
  assert.equal(sitemap.includes('<priority>'), false);
  assert.equal(sitemap.includes('<changefreq>'), false);
  assert.equal(sitemap.includes('<lastmod>'), false);
  assert.equal(sitemap.includes('/servicos/imposto-de-renda/'), false);
  assert.equal(sitemap.includes('/servicos/mei/'), false);
  assert.equal(sitemap.includes('/servicos/meu-inss/'), false);
});

test('fallback da SPA mantém deep links dos geradores', () => {
  assert.equal(fallbackPattern.test('/'), true);
  assert.equal(fallbackPattern.test('/ferramentas/gerador-de-recibo'), true);
  assert.equal(fallbackPattern.test('/ferramentas/gerador-de-curriculo'), true);
  assert.equal(fallbackPattern.test('/checkout/7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a'), true);
  assert.equal(fallback.destination, '/index.html');
});
