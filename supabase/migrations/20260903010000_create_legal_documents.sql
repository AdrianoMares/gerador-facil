create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version text not null,
  title text not null,
  content_hash text not null,
  effective_at timestamptz not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),

  constraint legal_documents_document_type_not_blank check (length(btrim(document_type)) > 0),
  constraint legal_documents_version_not_blank check (length(btrim(version)) > 0),
  constraint legal_documents_content_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint legal_documents_type_version_key unique (document_type, version)
);

create unique index legal_documents_one_active_version_idx
  on public.legal_documents (document_type)
  where active = true;

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  legal_document_id uuid not null references public.legal_documents (id) on delete restrict,
  document_type text not null,
  document_version text not null,
  content_hash text not null,
  accepted_at timestamptz not null default now(),

  constraint legal_acceptances_document_type_not_blank check (length(btrim(document_type)) > 0),
  constraint legal_acceptances_document_version_not_blank check (length(btrim(document_version)) > 0),
  constraint legal_acceptances_content_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint legal_acceptances_user_document_key unique (user_id, legal_document_id)
);

create index legal_acceptances_user_accepted_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_documents, public.legal_acceptances from public, anon, authenticated;
grant select on public.legal_documents to authenticated;
grant select on public.legal_acceptances to authenticated;
grant select, insert, update, delete on public.legal_documents, public.legal_acceptances to service_role;

create policy "Active legal documents are visible"
on public.legal_documents for select to authenticated
using (active = true and effective_at <= statement_timestamp());

create policy "Users can read their legal acceptances"
on public.legal_acceptances for select to authenticated
using ((select auth.uid()) = user_id);

insert into public.legal_documents (document_type, version, title, content_hash, effective_at, active)
values
  ('terms_of_use', '1.0', 'Termos de Uso', 'aa8b1c508bf483ea0e3fc1b11fd7a2d05b7dcad461f2a57668a2e4ba8187bffb', '2026-09-03T00:00:00Z', true),
  ('privacy_policy', '1.0', 'Política de Privacidade', '0dac27a0fc8b23345f547d2185bae200c19d730794003f87911c3fe6ee3e5e1c', '2026-09-03T00:00:00Z', true);

create function public.record_legal_acceptance(p_document_type text)
returns public.legal_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.legal_documents%rowtype;
  v_acceptance public.legal_acceptances%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  select * into v_document
  from public.legal_documents
  where document_type = p_document_type
    and active = true
    and effective_at <= statement_timestamp();

  if not found then
    raise exception using errcode = 'P0001', message = 'LEGAL_DOCUMENT_NOT_AVAILABLE';
  end if;

  insert into public.legal_acceptances (
    user_id, legal_document_id, document_type, document_version, content_hash
  ) values (
    v_user_id, v_document.id, v_document.document_type, v_document.version, v_document.content_hash
  )
  on conflict (user_id, legal_document_id) do update
  set accepted_at = public.legal_acceptances.accepted_at
  returning * into v_acceptance;

  return v_acceptance;
end;
$$;

revoke all on function public.record_legal_acceptance(text) from public, anon;
grant execute on function public.record_legal_acceptance(text) to authenticated;
