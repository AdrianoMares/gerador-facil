import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalLegalDocument, legalDocuments } from '../src/legal/legalDocuments.js';
import { siteIdentity } from '../src/config/siteIdentity.js';

const migration = readFileSync(new URL('../supabase/migrations/20260903010000_create_legal_documents.sql', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/app/router.jsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/app/layout/Footer.jsx', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

test('documentos jurídicos possuem identificadores, caminhos e versões iniciais únicos', () => {
  assert.deepEqual(legalDocuments.map((document) => document.version), ['1.0', '1.0']);
  assert.equal(new Set(legalDocuments.map((document) => document.type)).size, legalDocuments.length);
  assert.equal(new Set(legalDocuments.map((document) => document.path)).size, legalDocuments.length);
});

test('hashes SHA-256 correspondem ao conteúdo canônico de cada documento', () => {
  for (const document of legalDocuments) {
    const hash = createHash('sha256').update(canonicalLegalDocument(document), 'utf8').digest('hex');
    assert.equal(hash, document.contentHash);
  }
});

test('migration usa exatamente os hashes do registry e protege o aceite no backend', () => {
  for (const document of legalDocuments) assert.match(migration, new RegExp(document.contentHash));
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on function public\.record_legal_acceptance\(text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.record_legal_acceptance\(text\) to authenticated/);
  assert.doesNotMatch(migration, /record_legal_acceptance\(p_document_type text,\s*(user_id|version|content_hash|accepted_at)/);
});

test('rotas, sitemap e rodapé publicam os documentos legais e a identificação centralizada', () => {
  assert.match(router, /path: 'termos-de-uso'/);
  assert.match(router, /path: 'politica-de-privacidade'/);
  assert.match(sitemap, /https:\/\/resodi\.com\.br\/termos-de-uso/);
  assert.match(sitemap, /https:\/\/resodi\.com\.br\/politica-de-privacidade/);
  assert.match(footer, /to="\/termos-de-uso">Termos de Uso/);
  assert.match(footer, /to="\/politica-de-privacidade">Política de Privacidade/);
  assert.match(footer, /siteIdentity\.cnpj/);
  assert.match(footer, /Todos os direitos reservados/);
  assert.equal(footer.includes(siteIdentity.cnpj), false);
});
