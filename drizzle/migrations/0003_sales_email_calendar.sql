ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS event_time text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS gcal_event_id text;