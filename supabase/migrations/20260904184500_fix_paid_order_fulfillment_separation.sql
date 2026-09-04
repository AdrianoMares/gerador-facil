-- Tool and service fulfillment are invoked as separate RPC transactions by the backend.
-- Keeping this function tool-only prevents a service failure from rolling back entitlements.
create or replace function public.fulfill_paid_order(p_order_id uuid)
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
end;
$$;

revoke all on function public.fulfill_paid_order(uuid)
  from public, anon, authenticated;
grant execute on function public.fulfill_paid_order(uuid)
  to service_role;

-- A tool-only order is a successful no-op here and never reaches legal validation.
create or replace function public.fulfill_paid_service_order(p_order_id uuid)
returns setof public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_request public.service_requests%rowtype;
  v_has_service_items boolean;
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

  select exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and p.product_type = 'service'
      and p.fulfillment_mode = 'service_request'
  ) into v_has_service_items;

  if not v_has_service_items then
    return;
  end if;

  if (
    select count(distinct ld.document_type)
    from public.order_legal_acceptances ola
    join public.legal_acceptances la on la.id = ola.legal_acceptance_id
    join public.legal_documents ld on ld.id = la.legal_document_id
    where ola.order_id = v_order.id
      and la.user_id = v_order.user_id
      and ld.document_type in ('terms_of_use', 'privacy_policy')
  ) <> 2 then
    raise exception using errcode = 'P0001', message = 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;

  for v_item in
    select oi.id, oi.product_id, oi.product_code, oi.product_name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and p.product_type = 'service'
      and p.fulfillment_mode = 'service_request'
  loop
    insert into public.service_requests (
      user_id, order_id, order_item_id, product_id, service_code, service_name
    ) values (
      v_order.user_id, v_order.id, v_item.id, v_item.product_id, v_item.product_code, v_item.product_name
    )
    on conflict (order_item_id) do nothing;

    select * into v_request
    from public.service_requests
    where order_item_id = v_item.id;

    return next v_request;
  end loop;
end;
$$;

revoke all on function public.fulfill_paid_service_order(uuid)
  from public, anon, authenticated;
grant execute on function public.fulfill_paid_service_order(uuid)
  to service_role;
