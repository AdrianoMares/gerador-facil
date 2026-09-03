create table public.order_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  legal_acceptance_id uuid not null references public.legal_acceptances (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint order_legal_acceptances_order_acceptance_key unique (order_id, legal_acceptance_id)
);

create index order_legal_acceptances_order_idx
  on public.order_legal_acceptances (order_id);

alter table public.order_legal_acceptances enable row level security;

revoke all on table public.order_legal_acceptances from public, anon, authenticated;
grant select, insert, update, delete on public.order_legal_acceptances to service_role;

create policy "Order legal acceptance owners can read"
on public.order_legal_acceptances for select to authenticated
using (exists (
  select 1
  from public.orders o
  where o.id = order_id
    and o.user_id = (select auth.uid())
));

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  service_code text not null,
  service_name text not null,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_requests_service_code_not_blank check (length(btrim(service_code)) > 0),
  constraint service_requests_service_name_not_blank check (length(btrim(service_name)) > 0),
  constraint service_requests_status_check check (status in (
    'received',
    'awaiting_documents',
    'in_analysis',
    'in_progress',
    'awaiting_user',
    'completed',
    'cancelled'
  )),
  constraint service_requests_order_item_key unique (order_item_id)
);

create index service_requests_user_created_idx
  on public.service_requests (user_id, created_at desc);

create trigger service_requests_touch_before_update
before update on public.service_requests
for each row execute function private.touch_commerce_updated_at();

alter table public.service_requests enable row level security;

revoke all on table public.service_requests from public, anon, authenticated;
grant select, insert, update, delete on public.service_requests to service_role;

create policy "Service request owners can read"
on public.service_requests for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_checkout_order(p_product_code text, p_resource_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_draft public.document_drafts%rowtype;
  v_terms_acceptance_id uuid;
  v_privacy_acceptance_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
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
    where id = p_resource_id and user_id = v_user_id and status = 'ready';

    if not found or v_draft.service_type is distinct from v_product.resource_kind then
      raise exception using errcode = 'P0001', message = 'INVALID_DOCUMENT_RESOURCE';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text || ':' || v_product.id::text || ':' || p_resource_id::text, 0)
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = v_user_id
      and o.status = 'pending_payment'
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
     and la.user_id = v_user_id
    where ld.document_type = 'terms_of_use'
      and ld.active = true
      and ld.effective_at <= statement_timestamp();

    select la.id into v_privacy_acceptance_id
    from public.legal_documents ld
    join public.legal_acceptances la
      on la.legal_document_id = ld.id
     and la.user_id = v_user_id
    where ld.document_type = 'privacy_policy'
      and ld.active = true
      and ld.effective_at <= statement_timestamp();

    if v_terms_acceptance_id is null or v_privacy_acceptance_id is null then
      raise exception using errcode = 'P0001', message = 'LEGAL_ACCEPTANCE_REQUIRED';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text || ':' || v_product.id::text, 0)
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = v_user_id
      and o.status = 'pending_payment'
      and oi.product_id = v_product.id
    order by o.created_at desc
    limit 1;

    if v_existing_order_id is not null then
      return v_existing_order_id;
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_FULFILLMENT';
  end if;

  insert into public.orders (user_id, status, currency, subtotal_cents, total_cents)
  values (v_user_id, 'pending_payment', v_product.currency, v_product.price_cents, v_product.price_cents)
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

revoke all on function public.create_checkout_order(text, uuid) from public, anon;
grant execute on function public.create_checkout_order(text, uuid) to authenticated;

create function public.fulfill_paid_service_order(p_order_id uuid)
returns setof public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_request public.service_requests%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PAID';
  end if;

  if (
    select count(distinct ld.document_type)
    from public.order_legal_acceptances ola
    join public.legal_acceptances la on la.id = ola.legal_acceptance_id
    join public.legal_documents ld on ld.id = la.legal_document_id
    where ola.order_id = v_order.id
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

revoke all on function public.fulfill_paid_service_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_paid_service_order(uuid) to service_role;
