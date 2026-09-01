create schema if not exists private;

revoke all on schema private from public, anon, authenticated, service_role;

create table public.document_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  service_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint document_drafts_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete restrict,
  constraint document_drafts_service_type_check
    check (service_type in ('receipt', 'resume')),
  constraint document_drafts_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint document_drafts_payload_size_check
    check (octet_length(payload::text) <= 512 * 1024),
  constraint document_drafts_payload_no_base64_photo_check
    check (
      service_type <> 'resume'
      or coalesce(payload #>> '{personal,photo}', '')
        !~* '^[[:space:]]*data:image/[^,]*;[[:space:]]*base64,'
    ),
  constraint document_drafts_status_check
    check (status in ('draft', 'ready', 'payment_pending', 'paid')),
  constraint document_drafts_schema_version_check
    check (schema_version > 0),
  constraint document_drafts_revision_check
    check (revision > 0)
);

create index document_drafts_user_service_updated_idx
  on public.document_drafts (user_id, service_type, updated_at desc);

alter table public.document_drafts enable row level security;

create function private.touch_document_draft()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.payload is distinct from old.payload
    or new.status is distinct from old.status then
    new.updated_at := statement_timestamp();
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

revoke all on function private.touch_document_draft()
from public, anon, authenticated, service_role;

create trigger document_drafts_touch_before_update
before update of payload, status
on public.document_drafts
for each row
execute function private.touch_document_draft();

revoke all on table public.document_drafts
from public, anon, authenticated, service_role;

grant select, delete
on table public.document_drafts
to authenticated;

grant insert (service_type, payload)
on table public.document_drafts
to authenticated;

grant update (payload, status)
on table public.document_drafts
to authenticated;

grant select, insert, update, delete
on table public.document_drafts
to service_role;

create policy "Document draft owners can read"
on public.document_drafts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Document draft owners can create drafts"
on public.document_drafts
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'draft'
);

create policy "Document draft owners can update editable drafts"
on public.document_drafts
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status in ('draft', 'ready')
)
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'ready')
);

create policy "Document draft owners can delete editable drafts"
on public.document_drafts
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and status in ('draft', 'ready')
);
