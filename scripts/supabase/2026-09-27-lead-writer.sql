-- Keys plan, part A (CTO, 25-27 Sep 2026): an insert-only role for the website.
--
-- NOT APPLIED. A production migration, so it runs only on Nick's go, in the
-- order in scripts/supabase/README.md. Project: CRM (skyequfcoejlhzbyipwt).
--
-- What it does:
--   1. `lead_writer` can INSERT into public.leads and nothing else: no select,
--      no update, no delete, no other table. api/lead.js sends
--      `Prefer: return=minimal`, so it never asks to read the row back.
--   2. RLS stays on; one policy lets lead_writer insert.
--   3. Belt and braces: the Supabase default grants to anon and authenticated
--      on public.leads are revoked. Today RLS with no policy is the only thing
--      stopping the public anon key reading leads; after this, it is not.
--
-- Checked against the live schema on 27 Sep: lead_id is a uuid with a
-- gen_random_uuid() default (no sequence to grant), captured_at defaults to
-- now(), no triggers on leads, one foreign key (filed_to_contact_id ->
-- contacts), which the website never sets and which Postgres checks as the
-- table owner. No view or function references leads.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lead_writer') then
    create role lead_writer nologin noinherit;
  end if;
end $$;

-- PostgREST connects as `authenticator` and switches to the role named in the
-- JWT, so authenticator must be allowed to become lead_writer.
grant lead_writer to authenticator;

grant usage on schema public to lead_writer;
grant insert on table public.leads to lead_writer;

drop policy if exists leads_insert_from_website on public.leads;
create policy leads_insert_from_website
  on public.leads
  for insert
  to lead_writer
  with check (true);

-- RLS already on (checked 27 Sep); stated so a re-run cannot leave it off.
alter table public.leads enable row level security;

revoke all on table public.leads from anon, authenticated;

commit;

-- Optional, NOT part of this migration: the same revoke on the other CRM
-- tables, which also hold full default grants for anon and authenticated
-- behind RLS-with-no-policy. Nothing in this repo needs them. For the CTO and
-- the Platform Architect to decide, since other tools may use these tables:
--
--   revoke all on table public.contacts, public.installs, public.interactions,
--                       public.properties, public.subscribers
--     from anon, authenticated;

-- Verify after applying (read-only):
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'leads'
--      and grantee in ('anon', 'authenticated', 'lead_writer');
--   -- expect exactly one row: lead_writer | INSERT
--   select policyname, roles, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'leads';
--   -- expect: leads_insert_from_website | {lead_writer} | INSERT
