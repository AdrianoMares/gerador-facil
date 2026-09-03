import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20260903020000_create_service_requests.sql', import.meta.url), 'utf8');

test('núcleo separa estado financeiro de solicitações operacionais e protege tabelas com RLS', () => {
  assert.match(migration, /create table public\.order_legal_acceptances/);
  assert.match(migration, /unique \(order_id, legal_acceptance_id\)/);
  assert.match(migration, /alter table public\.order_legal_acceptances enable row level security/);
  assert.match(migration, /revoke all on table public\.order_legal_acceptances from public, anon, authenticated/);
  assert.match(migration, /on public\.order_legal_acceptances for select to authenticated/);
  assert.match(migration, /where o\.id = order_id\s+and o\.user_id = \(select auth\.uid\(\)\)/);

  assert.match(migration, /create table public\.service_requests/);
  for (const status of ['received', 'awaiting_documents', 'in_analysis', 'in_progress', 'awaiting_user', 'completed', 'cancelled']) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.match(migration, /constraint service_requests_order_item_key unique \(order_item_id\)/);
  assert.doesNotMatch(migration, /unique \(order_id\)/);
  assert.match(migration, /alter table public\.service_requests enable row level security/);
  assert.match(migration, /revoke all on table public\.service_requests from public, anon, authenticated/);
  assert.match(migration, /on public\.service_requests for select to authenticated/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /private\.touch_commerce_updated_at\(\)/);
});

test('checkout de serviços resolve aceites jurídicos no banco e preserva o snapshot no pedido', () => {
  assert.match(migration, /create or replace function public\.create_checkout_order\(p_product_code text, p_resource_id uuid default null\)/);
  assert.match(migration, /ld\.document_type = 'terms_of_use'/);
  assert.match(migration, /ld\.document_type = 'privacy_policy'/);
  assert.match(migration, /ld\.active = true/);
  assert.match(migration, /ld\.effective_at <= statement_timestamp\(\)/);
  assert.match(migration, /la\.legal_document_id = ld\.id/);
  assert.match(migration, /message = 'LEGAL_ACCEPTANCE_REQUIRED'/);
  assert.match(migration, /insert into public\.order_legal_acceptances/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /o\.status = 'pending_payment'/);
  assert.doesNotMatch(migration, /p_(?:document_version|content_hash|legal_document_id|legal_acceptance_id)/);
});

test('fulfillment é interno, pago, juridicamente vinculado e idempotente por item', () => {
  assert.match(migration, /create function public\.fulfill_paid_service_order\(p_order_id uuid\)/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /if v_order\.status <> 'paid'/);
  assert.match(migration, /message = 'ORDER_NOT_PAID'/);
  assert.match(migration, /p\.product_type = 'service'/);
  assert.match(migration, /p\.fulfillment_mode = 'service_request'/);
  assert.doesNotMatch(migration, /p\.active/);
  assert.match(migration, /v_order\.user_id, v_order\.id, v_item\.id, v_item\.product_id, v_item\.product_code, v_item\.product_name/);
  assert.match(migration, /on conflict \(order_item_id\) do nothing/);
  assert.match(migration, /revoke all on function public\.fulfill_paid_service_order\(uuid\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.fulfill_paid_service_order\(uuid\) to service_role/);
});
