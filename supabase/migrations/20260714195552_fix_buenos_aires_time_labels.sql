-- Keep persisted instants in UTC while rendering every time label in the
-- business timezone. Supabase sessions run in UTC by default, so bare
-- to_char(timestamptz, 'HH24:MI') otherwise exposes UTC clock time.
alter function public.build_entry_state(uuid, uuid, date)
  set timezone to 'America/Argentina/Buenos_Aires';

alter function public.get_dashboard_summary(text, uuid, date, text, text)
  set timezone to 'America/Argentina/Buenos_Aires';

alter function public.get_hours_dashboard_range(text, uuid, date, date, date, date, text)
  set timezone to 'America/Argentina/Buenos_Aires';
