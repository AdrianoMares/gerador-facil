create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  product_type text not null,
  fulfillment_mode text not null,
  resource_kind text,
  price_cents integer,
  currency text not null default 'BRL',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_code_not_blank check (length(btrim(code)) > 0),
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_type_check check (product_type in ('tool', 'service')),
  constraint products_fulfillment_check check (fulfillment_mode in ('document_download', 'service_request')),
  constraint products_currency_check check (currency = 'BRL'),
  constraint products_price_check check (price_cents is null or price_cents > 0),
  constraint products_active_requires_price check (not active or price_cents is not null),
  constraint products_document_resource_check check (
    (fulfillment_mode = 'document_download' and resource_kind is not null)
    or (fulfillment_mode = 'service_request' and resource_kind is null)
  )
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  status text not null,
  currency text not null,
  subtotal_cents integer not null,
  total_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_status_check check (status in ('pending_payment', 'paid', 'cancelled', 'expired', 'refunded')),
  constraint orders_currency_check check (currency = 'BRL'),
  constraint orders_subtotal_check check (subtotal_cents >= 0),
  constraint orders_total_check check (total_cents >= 0)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_code text not null,
  product_name text not null,
  product_description text,
  quantity integer not null default 1,
  unit_price_cents integer not null,
  total_price_cents integer not null,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),

  constraint order_items_quantity_check check (quantity = 1),
  constraint order_items_unit_price_check check (unit_price_cents > 0),
  constraint order_items_total_check check (total_price_cents = quantity * unit_price_cents)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  status text not null,
  amount_cents integer not null,
  currency text not null,
  external_customer_id text,
  external_order_id text,
  external_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_status_check check (status in ('pending', 'authorized', 'approved', 'paid', 'failed', 'cancelled', 'expired', 'refunded')),
  constraint payments_amount_check check (amount_cents > 0),
  constraint payments_currency_check check (currency = 'BRL')
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  resource_type text,
  resource_id uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_pending_resource_idx on public.order_items (product_id, resource_id, order_id);
create index payments_order_idx on public.payments (order_id);
create index entitlements_user_idx on public.entitlements (user_id);

create function private.touch_commerce_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.touch_commerce_updated_at() from public, anon, authenticated, service_role;

create trigger products_touch_before_update
before update on public.products
for each row execute function private.touch_commerce_updated_at();

create trigger orders_touch_before_update
before update on public.orders
for each row execute function private.touch_commerce_updated_at();

create trigger payments_touch_before_update
before update on public.payments
for each row execute function private.touch_commerce_updated_at();

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;

revoke all on table public.products, public.orders, public.order_items, public.payments, public.entitlements from public, anon, authenticated;
grant select on public.products, public.orders, public.order_items, public.payments, public.entitlements to authenticated;
grant select, insert, update, delete on public.products, public.orders, public.order_items, public.payments, public.entitlements to service_role;

create policy "Active products are visible"
on public.products for select to authenticated
using (active = true);

create policy "Order owners can read"
on public.orders for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Order item owners can read"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.user_id = (select auth.uid())
));

create policy "Payment owners can read"
on public.payments for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.user_id = (select auth.uid())
));

create policy "Entitlement owners can read"
on public.entitlements for select to authenticated
using ((select auth.uid()) = user_id);

insert into public.products (code, name, product_type, fulfillment_mode, resource_kind, price_cents, active)
values
  ('receipt_pdf', 'Recibo em PDF', 'tool', 'document_download', 'receipt', null, false),
  ('resume_pdf', 'Currículo em PDF', 'tool', 'document_download', 'resume', null, false)
on conflict (code) do nothing;

create function public.create_checkout_order(p_product_code text, p_resource_id uuid default null)
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
  elsif v_product.fulfillment_mode <> 'service_request' then
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

  return v_order_id;
end;
$$;

revoke all on function public.create_checkout_order(text, uuid) from public, anon;
grant execute on function public.create_checkout_order(text, uuid) to authenticated;
