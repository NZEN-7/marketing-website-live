-- DRAFT ONLY. NOT APPLIED. Platform Architect review required.
-- UTC day buckets; no event time, identity, answers or IP are stored.
-- Supported site credentials: lead_writer JWT, or existing service_role fallback.
create table public.intake_screen_views (
  day date not null,
  question text not null,
  views integer not null default 0,
  primary key (day, question)
);
alter table public.intake_screen_views enable row level security;
revoke all on public.intake_screen_views from public, anon, authenticated, lead_writer, service_role;

create function public.increment_intake_view(day date, ids text[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  counted_day alias for $1;
  question_ids alias for $2;
begin
  if counted_day is null or counted_day <> (current_timestamp at time zone 'UTC')::date
     or cardinality(question_ids) not between 1 and 6 then
    return;
  end if;
  if exists (select 1 from unnest(question_ids) as q where q is null or q <> all(array[
    'S1','S2','S3','S4','S4b','S5','S6','S7','S8','S10','S11','S12','S13','S14','S15','S16','S17',
    'MATCH','MATCH_SHORT','URGENT','DONE','O1','N1'])) then
    return;
  end if;
  insert into public.intake_screen_views as counts (day, question, views)
    select counted_day, q, 1 from (select distinct unnest(question_ids) as q) as unique_ids
    on conflict on constraint intake_screen_views_pkey do update set views = counts.views + 1;
end;
$function$;
revoke all on function public.increment_intake_view(date, text[]) from public, anon, authenticated;
grant execute on function public.increment_intake_view(date, text[]) to lead_writer, service_role;
comment on column public.leads.tenure is 'retired 3 Oct 2026, S9 removed';
