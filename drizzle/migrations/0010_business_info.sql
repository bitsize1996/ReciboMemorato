-- Private business details used when writing emails and invoices
create table if not exists public.business_info (
  id integer primary key default 1 check (id = 1),
  contact_email text,
  payment_instructions text,
  updated_at timestamptz not null default now()
);

insert into public.business_info (id) values (1) on conflict do nothing;

grant select, insert, update on public.business_info to authenticated;
grant all on public.business_info to service_role;
revoke all on public.business_info from anon;

alter table public.business_info enable row level security;

drop policy if exists "Admins manage business info" on public.business_info;
create policy "Admins manage business info"
  on public.business_info for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
