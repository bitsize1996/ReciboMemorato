-- Hours of service and start time, so a booking carries everything the agreement needs
alter table public.packages add column if not exists service_hours numeric(5,2);
alter table public.addons add column if not exists extra_hours numeric(5,2);
alter table public.inquiries add column if not exists event_time text;
alter table public.inquiries add column if not exists service_hours numeric(5,2);
alter table public.sales add column if not exists service_hours numeric(5,2);
