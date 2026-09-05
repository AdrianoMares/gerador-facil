alter table public.payments
  add column installments integer,
  add column buyer_fee_cents integer not null default 0,
  add constraint payments_installments_check check (
    installments is null or installments between 1 and 5
  ),
  add constraint payments_buyer_fee_check check (buyer_fee_cents >= 0),
  add constraint payments_method_amount_shape_check check (
    payment_method is null
    or (payment_method = 'pix' and installments is null and buyer_fee_cents = 0)
    or (payment_method = 'credit_card' and installments is not null
      and ((installments = 1 and buyer_fee_cents = 0)
        or (installments between 2 and 5 and buyer_fee_cents > 0)))
    or payment_method = 'boleto'
  );

create unique index payments_one_pending_pagbank_card_sandbox_per_order_key
  on public.payments (order_id)
  where provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method = 'credit_card'
    and status = 'pending';

create unique index payments_one_pending_pagbank_sandbox_per_order_key
  on public.payments (order_id)
  where provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method in ('pix', 'credit_card')
    and status = 'pending';

create function private.valid_pagbank_payment_context(
  p_payment public.payments,
  p_order public.orders
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((p_payment.order_id = p_order.id
    and p_payment.provider = 'pagbank'
    and p_payment.provider_environment = 'sandbox'
    and p_payment.currency = 'BRL'
    and p_order.currency = 'BRL'
    and p_payment.currency = p_order.currency
    and (
      (p_payment.payment_method = 'pix'
        and p_payment.installments is null
        and p_payment.buyer_fee_cents = 0
        and p_payment.amount_cents = p_order.total_cents)
      or
      (p_payment.payment_method = 'credit_card'
        and p_payment.installments between 1 and 5
        and p_payment.amount_cents = p_order.total_cents + p_payment.buyer_fee_cents
        and ((p_payment.installments = 1 and p_payment.buyer_fee_cents = 0)
          or (p_payment.installments between 2 and 5 and p_payment.buyer_fee_cents > 0)))
    )), false);
$$;

revoke all on function private.valid_pagbank_payment_context(public.payments, public.orders)
  from public, anon, authenticated, service_role;

create function public.prepare_pagbank_card_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone_country text,
  p_phone_area text,
  p_phone_number text,
  p_amount_cents integer,
  p_buyer_fee_cents integer,
  p_installments integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_order_id::text || ':pagbank:credit_card', 0)
  );

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id is distinct from p_user_id then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING_PAYMENT';
  end if;
  if v_order.currency <> 'BRL' then
    raise exception using errcode = 'P0001', message = 'ORDER_CURRENCY_NOT_SUPPORTED';
  end if;
  if p_installments is null or p_amount_cents is null or p_buyer_fee_cents is null
    or p_installments not between 1 and 5
    or p_amount_cents is distinct from v_order.total_cents + p_buyer_fee_cents
    or p_buyer_fee_cents < 0
    or (p_installments = 1 and p_buyer_fee_cents <> 0)
    or (p_installments > 1 and p_buyer_fee_cents <= 0) then
    raise exception using errcode = 'P0001', message = 'INVALID_CARD_PLAN';
  end if;

  insert into public.order_contacts (
    order_id, name, email, phone_country, phone_area, phone_number
  ) values (
    v_order.id, p_name, p_email, p_phone_country, p_phone_area, p_phone_number
  ) on conflict (order_id) do update set
    name = excluded.name,
    email = excluded.email,
    phone_country = excluded.phone_country,
    phone_area = excluded.phone_area,
    phone_number = excluded.phone_number;

  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method in ('pix', 'credit_card')
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    if v_payment.payment_method <> 'credit_card' then
      raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_IN_PROGRESS';
    end if;
    if v_payment.amount_cents <> p_amount_cents
      or v_payment.buyer_fee_cents <> p_buyer_fee_cents
      or v_payment.installments <> p_installments then
      raise exception using errcode = 'P0001', message = 'CARD_PAYMENT_IN_PROGRESS';
    end if;
    return v_payment.id;
  end if;

  insert into public.payments (
    order_id, provider, provider_environment, payment_method,
    provider_request_state, status, amount_cents, buyer_fee_cents, installments, currency
  ) values (
    v_order.id, 'pagbank', 'sandbox', 'credit_card',
    'prepared', 'pending', p_amount_cents, p_buyer_fee_cents, p_installments, 'BRL'
  ) returning id into v_payment.id;
  return v_payment.id;
end;
$$;

revoke all on function public.prepare_pagbank_card_payment(uuid, uuid, text, text, text, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.prepare_pagbank_card_payment(uuid, uuid, text, text, text, text, text, integer, integer, integer)
  to service_role;

create function public.claim_pagbank_card_submission(
  p_payment_id uuid,
  p_order_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is distinct from p_user_id
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'pending_payment' or v_payment.status <> 'pending'
    or v_payment.payment_method <> 'credit_card' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_ATTEMPT';
  end if;
  if v_payment.external_order_id is not null or v_payment.external_payment_id is not null
    or v_payment.provider_request_state is distinct from 'prepared' then return false; end if;
  update public.payments
  set provider_request_state = 'submitting', provider_request_started_at = statement_timestamp()
  where id = v_payment.id and provider_request_state = 'prepared'
    and external_order_id is null and external_payment_id is null;
  return found;
end;
$$;

revoke all on function public.claim_pagbank_card_submission(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_pagbank_card_submission(uuid, uuid, uuid)
  to service_role;

create or replace function public.adopt_verified_pagbank_payment_ids(
  p_payment_id uuid,
  p_order_id uuid,
  p_external_order_id text,
  p_external_payment_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_external_order_id !~ '^ORDE_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_external_payment_id !~ '^CHAR_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_EXTERNAL_PAYMENT_ID';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  if not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if (v_payment.external_order_id is not null and v_payment.external_order_id <> p_external_order_id)
    or (v_payment.external_payment_id is not null and v_payment.external_payment_id <> p_external_payment_id) then
    raise exception using errcode = 'P0001', message = 'EXTERNAL_PAYMENT_ID_MISMATCH';
  end if;
  update public.payments set
    external_order_id = coalesce(external_order_id, p_external_order_id),
    external_payment_id = coalesce(external_payment_id, p_external_payment_id)
  where id = v_payment.id;
  return v_payment.id;
end;
$$;

revoke all on function public.adopt_verified_pagbank_payment_ids(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.adopt_verified_pagbank_payment_ids(uuid, uuid, text, text)
  to service_role;

create function public.record_pagbank_card_creation(
  p_payment_id uuid,
  p_order_id uuid,
  p_external_order_id text,
  p_external_payment_id text,
  p_provider_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_provider_status not in ('WAITING', 'PAID', 'DECLINED', 'IN_ANALYSIS', 'AUTHORIZED') then
    raise exception using errcode = 'P0001', message = 'INVALID_PROVIDER_STATUS';
  end if;
  perform public.adopt_verified_pagbank_payment_ids(
    p_payment_id, p_order_id, p_external_order_id, p_external_payment_id
  );
  select * into v_payment from public.payments where id = p_payment_id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_payment.payment_method <> 'credit_card'
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if v_order.status <> 'pending_payment' or v_payment.status not in ('pending', 'failed') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATE';
  end if;
  update public.payments set
    provider_request_state = case when p_provider_status = 'DECLINED' then 'failed' else 'created' end,
    provider_status = p_provider_status,
    status = case when p_provider_status = 'DECLINED' then 'failed' else status end
  where id = v_payment.id;
  return v_payment.id;
end;
$$;

revoke all on function public.record_pagbank_card_creation(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_pagbank_card_creation(uuid, uuid, text, text, text)
  to service_role;

create or replace function public.confirm_verified_pagbank_payment(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  if v_payment.external_order_id is null or v_payment.external_payment_id is null
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if v_order.status not in ('pending_payment', 'paid') or v_payment.status not in ('pending', 'paid') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATE';
  end if;
  if v_order.status = 'paid' or v_payment.status = 'paid' then
    if v_order.status = 'paid' and v_payment.status = 'paid' then return v_order.id; end if;
    raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
  end if;
  update public.payments set status = 'paid', provider_status = 'PAID',
    provider_verified_at = statement_timestamp(), paid_at = coalesce(paid_at, statement_timestamp())
  where id = v_payment.id;
  update public.orders set status = 'paid' where id = v_order.id;
  return v_order.id;
end;
$$;

revoke all on function public.confirm_verified_pagbank_payment(uuid) from public, anon, authenticated;
grant execute on function public.confirm_verified_pagbank_payment(uuid) to service_role;

create or replace function public.record_verified_pagbank_status(p_payment_id uuid, p_provider_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_provider_status not in ('WAITING', 'DECLINED', 'CANCELED', 'IN_ANALYSIS', 'AUTHORIZED') then
    raise exception using errcode = 'P0001', message = 'INVALID_PROVIDER_STATUS';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_payment.external_order_id is null or v_payment.external_payment_id is null
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if v_order.status = 'refunded' or v_payment.status = 'refunded' then
    raise exception using errcode = 'P0001', message = 'REFUNDED_PAYMENT_CANNOT_REGRESS';
  end if;
  if v_order.status = 'paid' or v_payment.status = 'paid' then
    if v_order.status <> 'paid' or v_payment.status <> 'paid' then
      raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
    end if;
  elsif v_order.status <> 'pending_payment'
    or v_payment.status not in ('pending', 'failed', 'cancelled', 'expired') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATE';
  end if;
  update public.payments set provider_status = p_provider_status,
    provider_verified_at = statement_timestamp(),
    status = case when status in ('paid', 'failed', 'cancelled', 'expired', 'refunded') then status
      when p_provider_status = 'DECLINED' then 'failed'
      when p_provider_status = 'CANCELED' then 'cancelled' else status end
  where id = v_payment.id;
  return p_provider_status;
end;
$$;

revoke all on function public.record_verified_pagbank_status(uuid, text) from public, anon, authenticated;
grant execute on function public.record_verified_pagbank_status(uuid, text) to service_role;

create or replace function public.record_verified_pagbank_partial_refund(
  p_payment_id uuid, p_refunded_amount_cents integer, p_provider_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_provider_status <> 'PAID' then raise exception using errcode = 'P0001', message = 'INVALID_PROVIDER_STATUS'; end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_payment.external_order_id is null or v_payment.external_payment_id is null
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if p_refunded_amount_cents <= 0 or p_refunded_amount_cents >= v_payment.amount_cents then
    raise exception using errcode = 'P0001', message = 'INVALID_PARTIAL_REFUND_AMOUNT';
  end if;
  if p_refunded_amount_cents < v_payment.refunded_amount_cents then
    raise exception using errcode = 'P0001', message = 'REFUNDED_AMOUNT_CANNOT_REGRESS';
  end if;
  if v_order.status <> 'paid' or v_payment.status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
  end if;
  update public.payments set provider_status = p_provider_status,
    provider_verified_at = statement_timestamp(), refunded_amount_cents = p_refunded_amount_cents
  where id = v_payment.id;
  return v_order.id;
end;
$$;

revoke all on function public.record_verified_pagbank_partial_refund(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.record_verified_pagbank_partial_refund(uuid, integer, text) to service_role;

create or replace function public.refund_verified_pagbank_payment(
  p_payment_id uuid, p_refunded_amount_cents integer, p_provider_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_provider_status <> 'CANCELED' then raise exception using errcode = 'P0001', message = 'INVALID_PROVIDER_STATUS'; end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_payment.external_order_id is null or v_payment.external_payment_id is null
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if p_refunded_amount_cents <> v_payment.amount_cents then
    raise exception using errcode = 'P0001', message = 'INVALID_FULL_REFUND_AMOUNT';
  end if;
  if v_order.status = 'refunded' or v_payment.status = 'refunded' then
    if v_order.status <> 'refunded' or v_payment.status <> 'refunded' then
      raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
    end if;
  elsif not ((v_order.status = 'paid' and v_payment.status = 'paid')
    or (v_order.status = 'pending_payment' and v_payment.status = 'pending')) then
    raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
  end if;
  update public.payments set status = 'refunded', provider_status = p_provider_status,
    provider_verified_at = statement_timestamp(), refunded_amount_cents = p_refunded_amount_cents
  where id = v_payment.id;
  update public.orders set status = 'refunded' where id = v_order.id;
  update public.entitlements e set revoked_at = coalesce(e.revoked_at, statement_timestamp())
  where e.order_id = v_order.id and e.revoked_at is null and exists (
    select 1 from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id and oi.product_id = e.product_id
      and oi.resource_type is not distinct from e.resource_type
      and oi.resource_id is not distinct from e.resource_id
      and p.product_type = 'tool' and p.fulfillment_mode = 'document_download'
  );
  return v_order.id;
end;
$$;

revoke all on function public.refund_verified_pagbank_payment(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.refund_verified_pagbank_payment(uuid, integer, text) to service_role;
