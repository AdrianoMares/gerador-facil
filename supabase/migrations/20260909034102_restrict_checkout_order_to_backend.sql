revoke all on function public.create_checkout_order(text, uuid) from public, anon, authenticated, service_role;
drop function public.create_checkout_order(text, uuid);

create function public.create_checkout_order_server(
  p_user_id uuid,
  p_product_code text,
  p_resource_id uuid default null
)
returns uuid
language plpgsql
security invoker
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
      pg_catalog.hashtextextended(p_user_id::text || ':' || v_product.id::text || ':' || p_resource_id::text, 0)
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = p_user_id
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
      pg_catalog.hashtextextended(p_user_id::text || ':' || v_product.id::text, 0)
    );

    select o.id into v_existing_order_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = p_user_id
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
  values (p_user_id, 'pending_payment', v_product.currency, v_product.price_cents, v_product.price_cents)
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

revoke all on function public.create_checkout_order_server(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_checkout_order_server(uuid, text, uuid) to service_role;

comment on function public.create_checkout_order_server(uuid, text, uuid)
is 'Creates checkout orders only for a user identity verified by the trusted backend.';
