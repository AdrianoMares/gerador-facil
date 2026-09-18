insert into public.products (
  code, name, description, product_type, fulfillment_mode, resource_kind,
  price_cents, currency, active
) values
  (
    'declaracao_imposto_renda',
    'Declaração de Imposto de Renda',
    'Atendimento online para preparar, conferir e transmitir a Declaração de Imposto de Renda.',
    'service', 'service_request', null, 10000, 'BRL', true
  ),
  (
    'malha_fina_ir',
    'Malha Fina do Imposto de Renda',
    'Análise e regularização de pendências do Imposto de Renda.',
    'service', 'service_request', null, 10000, 'BRL', true
  ),
  (
    'abertura_mei',
    'Abertura de MEI',
    'Atendimento online para orientar e auxiliar na formalização do MEI.',
    'service', 'service_request', null, 10000, 'BRL', true
  ),
  (
    'regularizacao_mei',
    'Regularização do MEI',
    'Análise e orientação para regularizar pendências, débitos e parcelamentos do MEI.',
    'service', 'service_request', null, 10000, 'BRL', true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  product_type = excluded.product_type,
  fulfillment_mode = excluded.fulfillment_mode,
  resource_kind = excluded.resource_kind,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();
