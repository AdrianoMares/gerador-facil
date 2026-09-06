alter table public.payments
  drop constraint payments_boleto_fields_check,
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
      and boleto_url ~ '^https://(boleto[.]pagseguro[.]com[.]br|boleto[.]sandbox[.]pagseguro[.]com[.]br|boleto[.]digital-payments[.]pagseguro[.]com)/[A-Za-z0-9/_-]+[.]pdf$')
  );

create or replace function public.record_pagbank_boleto_creation(
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
    or p_boleto_url !~ '^https://(boleto[.]pagseguro[.]com[.]br|boleto[.]sandbox[.]pagseguro[.]com[.]br|boleto[.]digital-payments[.]pagseguro[.]com)/[A-Za-z0-9/_-]+[.]pdf$' then
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
