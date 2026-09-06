alter table public.order_contacts
  alter column phone_country drop not null,
  alter column phone_area drop not null,
  alter column phone_number drop not null;

alter table public.payments
  add column boleto_due_date date,
  add column boleto_barcode text,
  add column boleto_formatted_barcode text,
  add column boleto_url text,
  drop constraint payments_method_amount_shape_check,
  add constraint payments_method_amount_shape_check check (
    payment_method is null
    or (payment_method = 'pix' and installments is null and buyer_fee_cents = 0)
    or (payment_method = 'credit_card' and installments is not null
      and ((installments = 1 and buyer_fee_cents = 0)
        or (installments between 2 and 5 and buyer_fee_cents > 0)))
    or (payment_method = 'boleto' and installments is null and buyer_fee_cents = 0)
  ),
  add constraint payments_boleto_fields_check check (
    payment_method <> 'boleto'
    or (provider_request_state in ('prepared', 'submitting', 'uncertain', 'failed')
      and boleto_due_date is null
      and boleto_barcode is null
      and boleto_formatted_barcode is null
      and boleto_url is null)
    or (provider_request_state = 'created'
      and boleto_due_date is not null
      and boleto_barcode ~ '^[0-9]{44,60}$'
      and boleto_formatted_barcode ~ '^[0-9. ]{44,80}$'
      and boleto_url ~ '^https://boleto[.]pagseguro[.]com[.]br/[A-Za-z0-9/_-]+[.]pdf$')
  );

drop index public.payments_one_pending_pagbank_sandbox_per_order_key;
create unique index payments_one_pending_pagbank_sandbox_per_order_key
  on public.payments (order_id)
  where provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method in ('pix', 'credit_card', 'boleto')
    and status = 'pending';

create table public.order_public_access_tokens (
  token_hash text primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint order_public_access_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint order_public_access_tokens_order_payment_key unique (order_id, payment_id, token_hash)
);

create index order_public_access_tokens_order_idx
  on public.order_public_access_tokens (order_id, created_at desc);
create index order_public_access_tokens_payment_idx
  on public.order_public_access_tokens (payment_id);

alter table public.order_public_access_tokens enable row level security;
revoke all on table public.order_public_access_tokens from public, anon, authenticated;
grant select, insert on public.order_public_access_tokens to service_role;

create table public.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  email_type text not null,
  status text not null default 'sending',
  attempts integer not null default 1,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactional_email_type_check check (
    email_type in ('boleto_generated', 'service_payment_confirmed')
  ),
  constraint transactional_email_status_check check (status in ('sending', 'sent', 'failed')),
  constraint transactional_email_attempts_check check (attempts between 1 and 10),
  constraint transactional_email_error_code_check check (
    last_error_code is null or last_error_code ~ '^[A-Z0-9_]{1,80}$'
  ),
  constraint transactional_email_order_type_key unique (order_id, email_type)
);

create trigger transactional_email_deliveries_touch_before_update
before update on public.transactional_email_deliveries
for each row execute function private.touch_commerce_updated_at();

alter table public.transactional_email_deliveries enable row level security;
revoke all on table public.transactional_email_deliveries from public, anon, authenticated;
grant select, insert, update on public.transactional_email_deliveries to service_role;

create or replace function private.valid_pagbank_payment_context(
  p_payment public.payments,
  p_order public.orders
)
returns boolean
language sql
stable
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
      or
      (p_payment.payment_method = 'boleto'
        and p_payment.installments is null
        and p_payment.buyer_fee_cents = 0
        and p_payment.amount_cents = p_order.total_cents
        and exists (
          select 1
          from public.order_items oi
          join public.products p on p.id = oi.product_id
          where oi.order_id = p_order.id
            and p.product_type = 'service'
            and p.fulfillment_mode = 'service_request'
        )
        and not exists (
          select 1
          from public.order_items oi
          join public.products p on p.id = oi.product_id
          where oi.order_id = p_order.id
            and (p.product_type <> 'service' or p.fulfillment_mode <> 'service_request')
        ))
    )), false);
$$;

revoke all on function private.valid_pagbank_payment_context(public.payments, public.orders)
  from public, anon, authenticated, service_role;

create function public.prepare_pagbank_boleto_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_name text,
  p_email text
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
    pg_catalog.hashtextextended(p_order_id::text || ':pagbank:payment', 0)
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
  if not exists (
    select 1 from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id and p.product_type = 'service' and p.fulfillment_mode = 'service_request'
  ) or exists (
    select 1 from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id and (p.product_type <> 'service' or p.fulfillment_mode <> 'service_request')
  ) then
    raise exception using errcode = 'P0001', message = 'BOLETO_NOT_AVAILABLE';
  end if;

  insert into public.order_contacts (
    order_id, name, email, phone_country, phone_area, phone_number
  ) values (v_order.id, p_name, p_email, null, null, null)
  on conflict (order_id) do update set name = excluded.name, email = excluded.email;

  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method in ('pix', 'credit_card', 'boleto')
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    if v_payment.payment_method <> 'boleto' then
      raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_IN_PROGRESS';
    end if;
    return v_payment.id;
  end if;

  insert into public.payments (
    order_id, provider, provider_environment, payment_method,
    provider_request_state, status, amount_cents, buyer_fee_cents, installments, currency
  ) values (
    v_order.id, 'pagbank', 'sandbox', 'boleto',
    'prepared', 'pending', v_order.total_cents, 0, null, 'BRL'
  ) returning id into v_payment.id;
  return v_payment.id;
end;
$$;

revoke all on function public.prepare_pagbank_boleto_payment(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_pagbank_boleto_payment(uuid, uuid, text, text)
  to service_role;

create function public.claim_pagbank_boleto_submission(
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
    or v_payment.payment_method <> 'boleto' then
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

revoke all on function public.claim_pagbank_boleto_submission(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_pagbank_boleto_submission(uuid, uuid, uuid)
  to service_role;

create function public.record_pagbank_boleto_creation(
  p_payment_id uuid,
  p_order_id uuid,
  p_external_order_id text,
  p_external_payment_id text,
  p_due_date date,
  p_barcode text,
  p_formatted_barcode text,
  p_boleto_url text,
  p_token_hash text
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
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_barcode !~ '^[0-9]{44,60}$'
    or p_formatted_barcode !~ '^[0-9. ]{44,80}$'
    or p_boleto_url !~ '^https://boleto[.]pagseguro[.]com[.]br/[A-Za-z0-9/_-]+[.]pdf$' then
    raise exception using errcode = 'P0001', message = 'INVALID_BOLETO_DATA';
  end if;
  perform public.adopt_verified_pagbank_payment_ids(
    p_payment_id, p_order_id, p_external_order_id, p_external_payment_id
  );
  select * into v_payment from public.payments where id = p_payment_id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_payment.payment_method <> 'boleto'
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  if v_order.status <> 'pending_payment' or v_payment.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATE';
  end if;
  update public.payments set
    provider_request_state = 'created',
    provider_status = 'WAITING',
    boleto_due_date = p_due_date,
    boleto_barcode = p_barcode,
    boleto_formatted_barcode = p_formatted_barcode,
    boleto_url = p_boleto_url
  where id = v_payment.id;
  insert into public.order_public_access_tokens (token_hash, order_id, payment_id)
  values (p_token_hash, v_order.id, v_payment.id)
  on conflict (token_hash) do nothing;
  return v_payment.id;
end;
$$;

revoke all on function public.record_pagbank_boleto_creation(uuid, uuid, text, text, date, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_pagbank_boleto_creation(uuid, uuid, text, text, date, text, text, text, text)
  to service_role;

create function public.register_pagbank_boleto_access_token(
  p_payment_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_token_hash text
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
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PUBLIC_TOKEN';
  end if;
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is distinct from p_user_id
    or v_payment.order_id is distinct from v_order.id
    or v_payment.payment_method <> 'boleto'
    or v_payment.provider_request_state <> 'created'
    or v_payment.external_order_id is null or v_payment.external_payment_id is null
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;
  insert into public.order_public_access_tokens (token_hash, order_id, payment_id)
  values (p_token_hash, v_order.id, v_payment.id)
  on conflict (token_hash) do nothing;
  return true;
end;
$$;

revoke all on function public.register_pagbank_boleto_access_token(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.register_pagbank_boleto_access_token(uuid, uuid, uuid, text)
  to service_role;

create function public.claim_transactional_email(p_order_id uuid, p_email_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.transactional_email_deliveries%rowtype;
begin
  if p_email_type not in ('boleto_generated', 'service_payment_confirmed') then
    raise exception using errcode = 'P0001', message = 'INVALID_EMAIL_TYPE';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_order_id::text || ':email:' || p_email_type, 0)
  );
  if p_email_type = 'boleto_generated' and not exists (
    select 1 from public.payments p
    join public.order_public_access_tokens t on t.payment_id = p.id and t.order_id = p.order_id
    where p.order_id = p_order_id and p.payment_method = 'boleto'
      and p.provider_request_state = 'created' and p.provider_status = 'WAITING'
  ) then
    raise exception using errcode = 'P0001', message = 'EMAIL_NOT_READY';
  end if;
  if p_email_type = 'service_payment_confirmed' and not exists (
    select 1 from public.orders o join public.service_requests sr on sr.order_id = o.id
    where o.id = p_order_id and o.status = 'paid'
  ) then
    raise exception using errcode = 'P0001', message = 'EMAIL_NOT_READY';
  end if;
  select * into v_delivery from public.transactional_email_deliveries
  where order_id = p_order_id and email_type = p_email_type for update;
  if found then
    if v_delivery.status = 'sent' or v_delivery.attempts >= 10
      or (v_delivery.status = 'sending' and v_delivery.updated_at > statement_timestamp() - interval '5 minutes') then
      return false;
    end if;
    update public.transactional_email_deliveries
    set status = 'sending', attempts = attempts + 1, last_error_code = null
    where id = v_delivery.id;
    return true;
  end if;
  insert into public.transactional_email_deliveries (order_id, email_type)
  values (p_order_id, p_email_type);
  return true;
end;
$$;

revoke all on function public.claim_transactional_email(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_transactional_email(uuid, text)
  to service_role;

create function public.complete_transactional_email(
  p_order_id uuid,
  p_email_type text,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not p_success and (p_error_code is null or p_error_code !~ '^[A-Z0-9_]{1,80}$') then
    raise exception using errcode = 'P0001', message = 'INVALID_EMAIL_ERROR';
  end if;
  update public.transactional_email_deliveries
  set status = case when p_success then 'sent' else 'failed' end,
      last_error_code = case when p_success then null else p_error_code end,
      sent_at = case when p_success then coalesce(sent_at, statement_timestamp()) else sent_at end
  where order_id = p_order_id and email_type = p_email_type and status = 'sending';
  return found;
end;
$$;

revoke all on function public.complete_transactional_email(uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.complete_transactional_email(uuid, text, boolean, text)
  to service_role;
