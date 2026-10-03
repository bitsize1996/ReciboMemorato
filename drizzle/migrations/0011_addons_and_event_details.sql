-- Event details on inquiries and sales, plus add-ons for the booking form
alter table public.inquiries add column if not exists theme text;
alter table public.sales add column if not exists event_theme text;
alter table public.sales add column if not exists event_venue text;

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiry_addons (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  addon_id uuid references public.addons(id) on delete set null,
  name_snapshot text not null,
  price_snapshot numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_addons (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  addon_id uuid references public.addons(id) on delete set null,
  name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  total_price numeric(12,2) generated always as (quantity * unit_price_snapshot) stored,
  created_at timestamptz not null default now()
);

create index if not exists inquiry_addons_inquiry_idx on public.inquiry_addons (inquiry_id);
create index if not exists sale_addons_sale_idx on public.sale_addons (sale_id);

grant select, insert, update, delete on public.addons, public.inquiry_addons, public.sale_addons to authenticated;
grant all on public.addons, public.inquiry_addons, public.sale_addons to service_role;
revoke all on public.addons, public.inquiry_addons, public.sale_addons from anon;

alter table public.addons enable row level security;
alter table public.inquiry_addons enable row level security;
alter table public.sale_addons enable row level security;

drop policy if exists "Admins manage addons" on public.addons;
create policy "Admins manage addons" on public.addons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins manage inquiry addons" on public.inquiry_addons;
create policy "Admins manage inquiry addons" on public.inquiry_addons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins manage sale addons" on public.sale_addons;
create policy "Admins manage sale addons" on public.sale_addons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists addons_set_updated_at on public.addons;
create trigger addons_set_updated_at before update on public.addons
  for each row execute function public.set_updated_at();
