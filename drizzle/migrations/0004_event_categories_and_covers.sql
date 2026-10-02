-- Event categories (Birthday, Wedding, ...) managed by the admin,
-- plus a public storage bucket for event cover photos.

create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists event_categories_name_key
  on public.event_categories (lower(name));

grant select on public.event_categories to anon, authenticated;
grant insert, update, delete on public.event_categories to authenticated;
grant all on public.event_categories to service_role;

alter table public.event_categories enable row level security;

drop policy if exists "Event categories are publicly readable" on public.event_categories;
create policy "Event categories are publicly readable"
  on public.event_categories for select to anon, authenticated using (true);

drop policy if exists "Admins manage event categories" on public.event_categories;
create policy "Admins manage event categories"
  on public.event_categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

alter table public.events
  add column if not exists category_id uuid references public.event_categories(id) on delete set null;

create index if not exists events_category_idx on public.events (category_id);

insert into public.event_categories (name, sort_order)
values ('Birthday', 10), ('Wedding', 20)
on conflict do nothing;

-- Cover photos
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

drop policy if exists "Event covers are publicly readable" on storage.objects;
create policy "Event covers are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'event-covers');

drop policy if exists "Admins upload event covers" on storage.objects;
create policy "Admins upload event covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update event covers" on storage.objects;
create policy "Admins update event covers"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'event-covers' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins delete event covers" on storage.objects;
create policy "Admins delete event covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and public.has_role(auth.uid(), 'admin'));
