-- CRM: inquiries from the website booking form, Messenger, phone, etc.
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number serial unique,
  name text not null,
  contact text,
  email text,
  contact_method text not null default 'messenger',
  event_type text,
  event_date date,
  venue text,
  guests integer,
  package_id uuid references public.packages(id) on delete set null,
  package_interest text,
  message text,
  source text not null default 'website',
  status text not null default 'new',
  quoted_amount numeric(12,2),
  internal_notes text,
  sale_id uuid references public.sales(id) on delete set null,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_status_idx on public.inquiries (status, created_at desc);
create index if not exists inquiries_event_date_idx on public.inquiries (event_date);

grant select, insert, update, delete on public.inquiries to authenticated;
grant all on public.inquiries to service_role;
grant usage, select on sequence public.inquiries_inquiry_number_seq to authenticated, service_role;

alter table public.inquiries enable row level security;

drop policy if exists "Admins manage inquiries" on public.inquiries;
create policy "Admins manage inquiries"
  on public.inquiries for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Private tables are never readable with the public website key
revoke all on public.inquiries from anon;
revoke all on public.sales, public.sale_materials, public.sale_expenses, public.materials,
  public.material_movements, public.packages, public.package_materials, public.media_exclusions,
  public.user_roles from anon;
