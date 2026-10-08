-- Backdrops customers can pick for the standard photobooth, and client reviews
create table if not exists public.backdrops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  label text,
  quote text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  image_url text,
  source text,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists backdrop text;
alter table public.sales add column if not exists backdrop text;

grant select, insert, update, delete on public.backdrops, public.testimonials to authenticated;
grant all on public.backdrops, public.testimonials to service_role;
revoke all on public.backdrops, public.testimonials from anon;

alter table public.backdrops enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "Admins manage backdrops" on public.backdrops;
create policy "Admins manage backdrops" on public.backdrops for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins manage testimonials" on public.testimonials;
create policy "Admins manage testimonials" on public.testimonials for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
