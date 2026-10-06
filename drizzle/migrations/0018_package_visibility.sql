-- Choose which packages appear on the public website (Packages page and booking form)
alter table public.packages add column if not exists show_on_website boolean not null default true;
update public.packages set show_on_website = false where service_type = 'popup_print';
