-- Rolls back "DRAFT - intake_screen_views (3 Oct 2026).sql" (D12).
-- The counts table goes with the function: they are anonymous day totals only.
drop function if exists public.increment_intake_view(date, text[]);
drop table if exists public.intake_screen_views;
comment on column public.leads.tenure is null;
