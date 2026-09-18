alter table public.orders
  add column if not exists checkout_environment text not null default 'sandbox';

alter table public.orders
  drop constraint if exists orders_checkout_environment_check,
  add constraint orders_checkout_environment_check
    check (checkout_environment in ('sandbox', 'production'));

create index if not exists orders_user_status_environment_idx
  on public.orders (user_id, status, checkout_environment, created_at desc);

create or replace function private.create_checkout_order_for_user(
  p_user_id uuid,
  p_product_code text,
  p_resource_id uuid,
  p_checkout_environment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_draft public.document_drafts%rowtype;
  v_terms_acceptance_id uuid;
  v_privacy_acceptance_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if p_checkout_environment not in ('sandbox', 'production') then
    raise exception using errcode = 'P0001', message = 'INVALID_CHECKOUT_ENVIRONMENT';
  end if;

  select * into v_product
  from public.products
  where code = p_product_code and active = true;

  if not found or v_product.price_cents is null or v_product.price_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
  end if;

  if v_product.fulfillment_mode = 'document_download' then
    if p_resource_id is null then
      raise exception using errcode = 'P0001', message = 'INVALID_DOCUMENT_RESOURCE';
    end if;

    select * into v_draft
    from public.document_drafts
    where id = p_resource_id and user_id = p_user_id and status = 'ready';

    if not found or v_draft.service_type is distinct from v_product.resource_kind then
      raise exception using errcode = 'P0001', message = 'INVALID_DOCUMENT_RESOURCE';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_user_id::text || ':' || v_product.id::text || ':' || p_resource_id::text || ':' || p_checkout_environment,
        0
      )
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = p_user_id
      and o.status = 'pending_payment'
      and o.checkout_environment = p_checkout_environment
      and oi.product_id = v_product.id
      and oi.resource_id = p_resource_id
    order by o.created_at desc
    limit 1;

    if v_existing_order_id is not null then
      return v_existing_order_id;
    end if;
  elsif v_product.fulfillment_mode = 'service_request' then
    if v_product.product_type <> 'service' then
      raise exception using errcode = 'P0001', message = 'INVALID_FULFILLMENT';
    end if;

    select la.id into v_terms_acceptance_id
    from public.legal_documents ld
    join public.legal_acceptances la
      on la.legal_document_id = ld.id
     and la.user_id = p_user_id
    where ld.document_type = 'terms_of_use'
      and ld.active = true
      and ld.effective_at <= statement_timestamp();

    select la.id into v_privacy_acceptance_id
    from public.legal_documents ld
    join public.legal_acceptances la
      on la.legal_document_id = ld.id
     and la.user_id = p_user_id
    where ld.document_type = 'privacy_policy'
      and ld.active = true
      and ld.effective_at <= statement_timestamp();

    if v_terms_acceptance_id is null or v_privacy_acceptance_id is null then
      raise exception using errcode = 'P0001', message = 'LEGAL_ACCEPTANCE_REQUIRED';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_user_id::text || ':' || v_product.id::text || ':' || p_checkout_environment,
        0
      )
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = p_user_id
      and o.status = 'pending_payment'
      and o.checkout_environment = p_checkout_environment
      and oi.product_id = v_product.id
    order by o.created_at desc
    limit 1;

    if v_existing_order_id is not null then
      return v_existing_order_id;
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_FULFILLMENT';
  end if;

  insert into public.orders (
    user_id, status, currency, subtotal_cents, total_cents, checkout_environment
  )
  values (
    p_user_id, 'pending_payment', v_product.currency,
    v_product.price_cents, v_product.price_cents, p_checkout_environment
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_code, product_name, product_description,
    quantity, unit_price_cents, total_price_cents, resource_type, resource_id
  ) values (
    v_order_id, v_product.id, v_product.code, v_product.name, v_product.description,
    1, v_product.price_cents, v_product.price_cents,
    case when v_product.fulfillment_mode = 'document_download' then v_product.resource_kind else null end,
    case when v_product.fulfillment_mode = 'document_download' then p_resource_id else null end
  );

  if v_product.product_type = 'service' and v_product.fulfillment_mode = 'service_request' then
    insert into public.order_legal_acceptances (order_id, legal_acceptance_id)
    values
      (v_order_id, v_terms_acceptance_id),
      (v_order_id, v_privacy_acceptance_id);
  end if;

  return v_order_id;
end;
$$;

revoke all on function private.create_checkout_order_for_user(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.create_checkout_order(
  p_product_code text,
  p_resource_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return private.create_checkout_order_for_user(
    v_user_id,
    p_product_code,
    p_resource_id,
    'sandbox'
  );
end;
$$;

revoke all on function public.create_checkout_order(text, uuid) from public, anon;
grant execute on function public.create_checkout_order(text, uuid) to authenticated;

create or replace function public.create_checkout_order_for_environment(
  p_user_id uuid,
  p_product_code text,
  p_checkout_environment text,
  p_resource_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_checkout_order_for_user(
    p_user_id,
    p_product_code,
    p_resource_id,
    p_checkout_environment
  );
end;
$$;

revoke all on function public.create_checkout_order_for_environment(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_checkout_order_for_environment(uuid, text, text, uuid)
  to service_role;

create or replace function private.enforce_pagbank_payment_order_environment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout_environment text;
begin
  if new.provider = 'pagbank' and new.provider_environment is not null then
    select checkout_environment into v_checkout_environment
    from public.orders
    where id = new.order_id;

    if v_checkout_environment is null
      or new.provider_environment is distinct from v_checkout_environment then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ENVIRONMENT_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_pagbank_payment_order_environment()
  from public, anon, authenticated, service_role;

drop trigger if exists payments_pagbank_environment_guard on public.payments;
create trigger payments_pagbank_environment_guard
before insert or update of order_id, provider, provider_environment
on public.payments
for each row
execute function private.enforce_pagbank_payment_order_environment();

drop index if exists public.payments_one_pending_pagbank_card_sandbox_per_order_key;
drop index if exists public.payments_one_pending_pagbank_pix_sandbox_per_order_key;
drop index if exists public.payments_one_pending_pagbank_sandbox_per_order_key;

create unique index if not exists payments_one_pending_pagbank_per_environment_order_key
  on public.payments (order_id, provider_environment)
  where provider = 'pagbank'
    and provider_environment in ('sandbox', 'production')
    and payment_method in ('pix', 'credit_card', 'boleto')
    and status = 'pending';

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
  select coalesce((
    p_payment.order_id = p_order.id
    and p_payment.provider = 'pagbank'
    and p_payment.provider_environment in ('sandbox', 'production')
    and p_order.checkout_environment = p_payment.provider_environment
    and p_payment.currency = 'BRL'
    and p_order.currency = 'BRL'
    and p_payment.currency = p_order.currency
    and (
      (
        p_payment.payment_method = 'pix'
        and p_payment.installments is null
        and p_payment.buyer_fee_cents = 0
        and p_payment.amount_cents = p_order.total_cents
      )
      or
      (
        p_payment.payment_method = 'credit_card'
        and p_payment.installments between 1 and 5
        and p_payment.amount_cents = p_order.total_cents + p_payment.buyer_fee_cents
        and (
          (p_payment.installments = 1 and p_payment.buyer_fee_cents = 0)
          or (p_payment.installments between 2 and 5 and p_payment.buyer_fee_cents > 0)
        )
      )
      or
      (
        p_payment.payment_method = 'boleto'
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
        )
      )
    )
  ), false);
$$;

revoke all on function private.valid_pagbank_payment_context(public.payments, public.orders)
  from public, anon, authenticated, service_role;

create or replace function public.claim_pagbank_pix_submission(
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
    or v_order.user_id is distinct from p_user_id
    or not private.valid_pagbank_payment_context(v_payment, v_order) then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'pending_payment'
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

create or replace function public.prepare_pagbank_pix_payment_for_environment(
  p_order_id uuid,
  p_user_id uuid,
  p_provider_environment text,
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
  v_payment public.payments%rowtype;
begin
  if p_provider_environment not in ('sandbox', 'production') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_ENVIRONMENT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_order_id::text || ':pagbank:' || p_provider_environment || ':payment',
      0
    )
  );

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or v_order.user_id is distinct from p_user_id
    or v_order.checkout_environment is distinct from p_provider_environment then
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

  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = p_provider_environment
    and payment_method in ('pix', 'credit_card', 'boleto')
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    if v_payment.payment_method <> 'pix' then
      raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_IN_PROGRESS';
    end if;
    return v_payment.id;
  end if;

  insert into public.payments (
    order_id, provider, provider_environment, payment_method,
    provider_request_state, status, amount_cents, buyer_fee_cents, installments, currency
  ) values (
    v_order.id, 'pagbank', p_provider_environment, 'pix',
    'prepared', 'pending', v_order.total_cents, 0, null, 'BRL'
  )
  returning id into v_payment.id;

  return v_payment.id;
end;
$$;

revoke all on function public.prepare_pagbank_pix_payment_for_environment(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.prepare_pagbank_pix_payment_for_environment(
  uuid, uuid, text, text, text, text, text, text
) to service_role;

create or replace function public.prepare_pagbank_card_payment_for_environment(
  p_order_id uuid,
  p_user_id uuid,
  p_provider_environment text,
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
  if p_provider_environment not in ('sandbox', 'production') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_ENVIRONMENT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_order_id::text || ':pagbank:' || p_provider_environment || ':payment',
      0
    )
  );

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or v_order.user_id is distinct from p_user_id
    or v_order.checkout_environment is distinct from p_provider_environment then
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
  )
  on conflict (order_id) do update set
    name = excluded.name,
    email = excluded.email,
    phone_country = excluded.phone_country,
    phone_area = excluded.phone_area,
    phone_number = excluded.phone_number;

  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = p_provider_environment
    and payment_method in ('pix', 'credit_card', 'boleto')
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
    v_order.id, 'pagbank', p_provider_environment, 'credit_card',
    'prepared', 'pending', p_amount_cents, p_buyer_fee_cents, p_installments, 'BRL'
  )
  returning id into v_payment.id;

  return v_payment.id;
end;
$$;

revoke all on function public.prepare_pagbank_card_payment_for_environment(
  uuid, uuid, text, text, text, text, text, text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.prepare_pagbank_card_payment_for_environment(
  uuid, uuid, text, text, text, text, text, text, integer, integer, integer
) to service_role;

create or replace function public.prepare_pagbank_boleto_payment_for_environment(
  p_order_id uuid,
  p_user_id uuid,
  p_provider_environment text,
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
  if p_provider_environment not in ('sandbox', 'production') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_ENVIRONMENT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_order_id::text || ':pagbank:' || p_provider_environment || ':payment',
      0
    )
  );

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or v_order.user_id is distinct from p_user_id
    or v_order.checkout_environment is distinct from p_provider_environment then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING_PAYMENT';
  end if;
  if v_order.currency <> 'BRL' then
    raise exception using errcode = 'P0001', message = 'ORDER_CURRENCY_NOT_SUPPORTED';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and p.product_type = 'service'
      and p.fulfillment_mode = 'service_request'
  ) or exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and (p.product_type <> 'service' or p.fulfillment_mode <> 'service_request')
  ) then
    raise exception using errcode = 'P0001', message = 'BOLETO_NOT_AVAILABLE';
  end if;

  insert into public.order_contacts (
    order_id, name, email, phone_country, phone_area, phone_number
  ) values (
    v_order.id, p_name, p_email, null, null, null
  )
  on conflict (order_id) do update set
    name = excluded.name,
    email = excluded.email;

  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and provider = 'pagbank'
    and provider_environment = p_provider_environment
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
    v_order.id, 'pagbank', p_provider_environment, 'boleto',
    'prepared', 'pending', v_order.total_cents, 0, null, 'BRL'
  )
  returning id into v_payment.id;

  return v_payment.id;
end;
$$;

revoke all on function public.prepare_pagbank_boleto_payment_for_environment(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.prepare_pagbank_boleto_payment_for_environment(
  uuid, uuid, text, text, text
) to service_role;
