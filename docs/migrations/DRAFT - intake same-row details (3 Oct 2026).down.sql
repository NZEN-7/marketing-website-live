-- Rolls back "DRAFT - intake same-row details (3 Oct 2026).sql".
-- pgcrypto stays: the up migration only ensured it, and other code may use it.
drop function if exists public.update_intake_details(text, text, jsonb);
alter table public.leads drop column if exists intake_resume_hash;
