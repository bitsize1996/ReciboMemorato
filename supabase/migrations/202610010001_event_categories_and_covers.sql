-- Event categories and uploaded cover images for Recibo Memorato

create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_categories enable row level security;

create policy "Public can read event categories"
  on public.event_categories for select
  using (true);

create policy "Admins can create event categories"
  on public.event_categories for insert
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update event categories"
  on public.event_categories for update
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete event categories"
  on public.event_categories for delete
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

insert into public.event_categories (name, slug)
values ('Birthday', 'birthday'), ('Wedding', 'wedding')
on conflict (slug) do nothing;

alter table public.events
  add column if not exists category_id uuid references public.event_categories(id) on delete restrict;

create index if not exists events_category_id_idx on public.events(category_id);

insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update set public = excluded.public;

create policy "Public can view event covers"
  on storage.objects for select
  using (bucket_id = 'event-covers');

create policy "Admins can upload event covers"
  on storage.objects for insert
  with check (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update event covers"
  on storage.objects for update
  using (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete event covers"
  on storage.objects for delete
  using (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
