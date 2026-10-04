-- Sample photos shown on the public Packages page (stored in the public order-proofs bucket)
create table if not exists public.package_photos (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists package_photos_pkg_idx on public.package_photos (package_id, sort_order);
grant select, insert, update, delete on public.package_photos to authenticated;
grant all on public.package_photos to service_role;
revoke all on public.package_photos from anon;
alter table public.package_photos enable row level security;
drop policy if exists "Admins manage package photos" on public.package_photos;
create policy "Admins manage package photos" on public.package_photos for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
