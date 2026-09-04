alter table public.payments
  add column provider_status text,
  add column provider_verified_at timestamptz,
  add column paid_at timestamptz;

create unique index entitlements_order_product_resource_key
  on public.entitlements (order_id, product_id, resource_type, resource_id)
  where resource_id is not null;

create function public.confirm_verified_pagbank_payment(p_payment_id uuid)
returns uuid
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
  where id = v_payment.order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_payment.provider <> 'pagbank'
    or v_payment.provider_environment <> 'sandbox'
    or v_payment.payment_method <> 'pix'
    or v_payment.external_order_id is null
    or v_payment.external_payment_id is null
    or v_payment.amount_cents is distinct from v_order.total_cents
    or v_payment.currency is distinct from v_order.currency
    or v_payment.currency <> 'BRL'
    or v_order.currency <> 'BRL' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;

  if v_order.status not in ('pending_payment', 'paid')
    or v_payment.status not in ('pending', 'paid') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATE';
  end if;

  if v_order.status = 'paid' or v_payment.status = 'paid' then
    if v_order.status = 'paid' and v_payment.status = 'paid' then
      return v_order.id;
    end if;
    raise exception using errcode = 'P0001', message = 'INCONSISTENT_PAYMENT_STATE';
  end if;

  update public.payments
  set status = 'paid',
      provider_status = 'PAID',
      provider_verified_at = statement_timestamp(),
      paid_at = coalesce(paid_at, statement_timestamp())
  where id = v_payment.id;

  update public.orders
  set status = 'paid'
  where id = v_order.id;

  return v_order.id;
end;
$$;

revoke all on function public.confirm_verified_pagbank_payment(uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_verified_pagbank_payment(uuid)
  to service_role;

create function public.record_verified_pagbank_status(
  p_payment_id uuid,
  p_provider_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if p_provider_status is null
    or p_provider_status not in ('WAITING', 'PAID', 'DECLINED', 'CANCELED', 'IN_ANALYSIS', 'AUTHORIZED') then
    raise exception using errcode = 'P0001', message = 'INVALID_PROVIDER_STATUS';
  end if;

  if p_provider_status = 'PAID' then
    raise exception using errcode = 'P0001', message = 'PAID_REQUIRES_CONFIRMATION';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id;

  if not found
    or v_payment.provider <> 'pagbank'
    or v_payment.provider_environment <> 'sandbox'
    or v_payment.payment_method <> 'pix'
    or v_payment.external_order_id is null
    or v_payment.external_payment_id is null
    or v_payment.amount_cents is distinct from v_order.total_cents
    or v_payment.currency is distinct from v_order.currency
    or v_payment.currency <> 'BRL'
    or v_order.currency <> 'BRL' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_CONTEXT';
  end if;

  update public.payments
  set provider_status = case when status = 'paid' then 'PAID' else p_provider_status end,
      provider_verified_at = statement_timestamp(),
      status = case
        when status = 'paid' then status
        when status in ('failed', 'cancelled', 'expired', 'refunded') then status
        when p_provider_status = 'DECLINED' then 'failed'
        when p_provider_status = 'CANCELED' then 'cancelled'
        else status
      end
  where id = v_payment.id;

  return case when v_payment.status = 'paid' then 'PAID' else p_provider_status end;
end;
$$;

revoke all on function public.record_verified_pagbank_status(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_verified_pagbank_status(uuid, text)
  to service_role;

create function public.fulfill_paid_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PAID';
  end if;

  insert into public.entitlements (
    user_id, order_id, product_id, resource_type, resource_id
  )
  select
    v_order.user_id,
    v_order.id,
    oi.product_id,
    oi.resource_type,
    oi.resource_id
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id
    and p.product_type = 'tool'
    and p.fulfillment_mode = 'document_download'
    and oi.resource_type is not null
    and oi.resource_id is not null
  on conflict (order_id, product_id, resource_type, resource_id)
    where resource_id is not null
  do nothing;

  perform * from public.fulfill_paid_service_order(v_order.id);
end;
$$;

revoke all on function public.fulfill_paid_order(uuid)
  from public, anon, authenticated;
grant execute on function public.fulfill_paid_order(uuid)
  to service_role;
