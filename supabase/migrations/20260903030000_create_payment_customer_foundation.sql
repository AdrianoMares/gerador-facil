create table public.order_contacts (
  order_id uuid primary key references public.orders (id) on delete restrict,
  name text not null,
  email text not null,
  phone_country text not null,
  phone_area text not null,
  phone_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_contacts_name_not_blank check (length(btrim(name)) > 0),
  constraint order_contacts_email_not_blank check (length(btrim(email)) > 0),
  constraint order_contacts_phone_country_check check (phone_country ~ '^[0-9]{1,3}$'),
  constraint order_contacts_phone_area_check check (phone_area ~ '^[0-9]{2,3}$'),
  constraint order_contacts_phone_number_check check (phone_number ~ '^[0-9]{8,9}$')
);

create trigger order_contacts_touch_before_update
before update on public.order_contacts
for each row execute function private.touch_commerce_updated_at();

alter table public.order_contacts enable row level security;

revoke all on table public.order_contacts from public, anon, authenticated;
grant select on public.order_contacts to authenticated;
grant select, insert, update, delete on public.order_contacts to service_role;

create policy "Order contact owners can read"
on public.order_contacts for select to authenticated
using (exists (
  select 1
  from public.orders o
  where o.id = order_id
    and o.user_id = (select auth.uid())
));

alter table public.payments
  add column payment_method text,
  add column provider_environment text,
  add column provider_request_state text,
  add column provider_request_started_at timestamptz,
  add constraint payments_method_check check (
    payment_method is null or payment_method in ('pix', 'credit_card', 'boleto')
  ),
  add constraint payments_provider_environment_check check (
    provider_environment is null or provider_environment in ('sandbox', 'production')
  ),
  add constraint payments_provider_request_state_check check (
    provider_request_state is null
    or provider_request_state in ('prepared', 'submitting', 'created', 'uncertain', 'failed')
  );

create unique index payments_provider_external_order_key
  on public.payments (provider, provider_environment, external_order_id)
  where external_order_id is not null;

create unique index payments_provider_external_payment_key
  on public.payments (provider, provider_environment, external_payment_id)
  where external_payment_id is not null;

create unique index payments_one_pending_pagbank_pix_sandbox_per_order_key
  on public.payments (order_id)
  where provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method = 'pix'
    and status = 'pending';

create function public.prepare_pagbank_pix_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone_country text,
  p_phone_area text,
  p_phone_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_order_id::text || ':pagbank:pix', 0)
  );

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id is distinct from p_user_id then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING_PAYMENT';
  end if;

  if v_order.currency <> 'BRL' then
    raise exception using errcode = 'P0001', message = 'ORDER_CURRENCY_NOT_SUPPORTED';
  end if;

  insert into public.order_contacts (
    order_id, name, email, phone_country, phone_area, phone_number
  ) values (
    v_order.id, p_name, p_email, p_phone_country, p_phone_area, p_phone_number
  )
  on conflict (order_id) do update set
    name = excluded.name,
    email = excluded.email,
    phone_country = excluded.phone_country,
    phone_area = excluded.phone_area,
    phone_number = excluded.phone_number;

  select id into v_payment_id
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = 'sandbox'
    and payment_method = 'pix'
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_payment_id is not null then
    return v_payment_id;
  end if;

  insert into public.payments (
    order_id,
    provider,
    provider_environment,
    payment_method,
    provider_request_state,
    status,
    amount_cents,
    currency
  ) values (
    v_order.id,
    'pagbank',
    'sandbox',
    'pix',
    'prepared',
    'pending',
    v_order.total_cents,
    v_order.currency
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.prepare_pagbank_pix_payment(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_pagbank_pix_payment(uuid, uuid, text, text, text, text, text)
  to service_role;

create function public.claim_pagbank_pix_submission(
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
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found
    or v_payment.order_id is distinct from v_order.id
    or v_order.user_id is distinct from p_user_id then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING_PAYMENT';
  end if;

  if v_payment.provider <> 'pagbank'
    or v_payment.provider_environment <> 'sandbox'
    or v_payment.payment_method <> 'pix'
    or v_payment.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_ATTEMPT';
  end if;

  if v_payment.external_order_id is not null
    or v_payment.external_payment_id is not null
    or v_payment.provider_request_state is distinct from 'prepared' then
    return false;
  end if;

  update public.payments
  set provider_request_state = 'submitting',
      provider_request_started_at = statement_timestamp()
  where id = v_payment.id
    and provider_request_state = 'prepared'
    and external_order_id is null
    and external_payment_id is null;

  return found;
end;
$$;

revoke all on function public.claim_pagbank_pix_submission(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_pagbank_pix_submission(uuid, uuid, uuid)
  to service_role;
