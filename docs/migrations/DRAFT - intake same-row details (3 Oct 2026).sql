-- DRAFT ONLY. NOT APPLIED. Platform Architect review required (its item 90).
-- Web Designer, 3 Oct 2026 (CTO items 68.1 and 69).
--
-- WHAT IT'S FOR
-- Today an intake lead is one `complete` row, written when the visitor reaches the
-- match, plus a separate `details` row for Step 3 or the exit they chose. The
-- unique (intake_lead_id, intake_event) index keeps only the first `details`
-- row, so an exit followed by Step 3 loses Step 3 in the table (Nick's
-- notification still has it). This lets every later send update the lead's own
-- `complete` row instead.
--
-- THE PATH (app changes that follow once this is applied; none are built yet)
-- 1. The page makes a resume token at load: 32 random bytes as 64 hex characters
--    (crypto.getRandomValues), kept in memory only (no cookie, no storage).
-- 2. The first send (reaching the match) carries `resume_token`. The server stores
--    only its SHA-256 hash, in `intake_resume_hash`, on the `complete` row. The
--    token is never logged or stored.
-- 3. Each later send (the exit, Step 3, a phone given on the urgent screen) carries
--    the same token. In production the server calls `update_intake_details`
--    instead of inserting a `details` row. If it returns false or fails, the
--    server falls back to today's `details` insert, so no answer is ever dropped.
--    Nick's notification for each send is unchanged.
-- 4. Off production nothing is written, as now (the preview guard).
--
-- PLATFORM TO CONFIRM: the `leads` column names used below (`phone`, `comments`,
-- `rung_reached`, `ts_last`, `answers`), and that pgcrypto is in `extensions`.

create extension if not exists pgcrypto with schema extensions;

alter table public.leads add column if not exists intake_resume_hash text;
comment on column public.leads.intake_resume_hash is
  'SHA-256 hex of the intake resume token; the token itself is never stored (3 Oct 2026)';

create function public.update_intake_details(p_lead_id text, p_token text, p_details jsonb)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  n integer;
  -- Only Step 3's questions, the exit and an urgent-screen phone can change.
  allowed constant text[] := array['storeys','radiator_band','underfloor_band','built_band',
                                   'off_gas','notes','exit','phone','call_times'];
  patch jsonb;
begin
  if p_lead_id is null or p_lead_id !~ '^il-[0-9a-f]{10}$'
     or p_token is null or p_token !~ '^[0-9a-f]{64}$'
     or p_details is null or jsonb_typeof(p_details) <> 'object'
     or octet_length(p_details::text) > 20000 then
    return false;
  end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into patch
    from jsonb_each(p_details) where key = any(allowed);

  update public.leads as l set
      answers      = coalesce(l.answers, '{}'::jsonb) || (patch - 'phone' - 'notes'),
      phone        = coalesce(nullif(patch->>'phone', ''), l.phone),
      comments     = coalesce(nullif(patch->>'notes', ''), l.comments),
      rung_reached = case when p_details->>'rung_reached' = 'done' then 4 else l.rung_reached end,
      ts_last      = now()
    where l.intake_lead_id = p_lead_id
      and l.intake_event = 'complete'
      and l.intake_resume_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  get diagnostics n = row_count;
  return n = 1;
end;
$function$;

revoke all on function public.update_intake_details(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_intake_details(text, text, jsonb) to service_role;
