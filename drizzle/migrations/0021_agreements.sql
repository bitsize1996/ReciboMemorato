-- Service agreements generated from a booking, and your saved agreement defaults and signature
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  terms jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.agreements to authenticated;
grant all on public.agreements to service_role;
revoke all on public.agreements from anon;

alter table public.agreements enable row level security;
drop policy if exists "Admins manage agreements" on public.agreements;
create policy "Admins manage agreements" on public.agreements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists agreements_set_updated_at on public.agreements;
create trigger agreements_set_updated_at before update on public.agreements
  for each row execute function public.set_updated_at();

alter table public.business_info add column if not exists agreement_defaults jsonb;
alter table public.business_info add column if not exists representative_name text;
alter table public.business_info add column if not exists signature_image text;
