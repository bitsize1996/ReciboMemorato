-- Service types, memory archive tags, made-to-order orders, proof-of-orders showcase, private previews
alter table public.packages add column if not exists service_type text not null default 'event';
alter table public.packages add column if not exists popup_available boolean not null default false;

alter table public.events add column if not exists tags text[] not null default '{}';
grant select (tags) on public.events to anon;

alter table public.inquiries add column if not exists kind text not null default 'event';
alter table public.inquiries add column if not exists quantity integer;
alter table public.inquiries add column if not exists order_details text;
alter table public.inquiries add column if not exists photos_link text;
alter table public.inquiries add column if not exists delivery_method text;
create index if not exists inquiries_kind_idx on public.inquiries (kind, status);

create table if not exists public.order_showcase (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  product text not null default 'other',
  image_url text not null,
  caption text,
  customer_label text,
  completed_on date,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_showcase_pub_idx on public.order_showcase (published, sort_order, created_at desc);
grant select on public.order_showcase to anon, authenticated;
grant insert, update, delete on public.order_showcase to authenticated;
grant all on public.order_showcase to service_role;
alter table public.order_showcase enable row level security;
drop policy if exists "Public sees published showcase" on public.order_showcase;
create policy "Public sees published showcase" on public.order_showcase for select to anon, authenticated using (published);
drop policy if exists "Admins manage showcase" on public.order_showcase;
create policy "Admins manage showcase" on public.order_showcase for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop trigger if exists order_showcase_set_updated_at on public.order_showcase;
create trigger order_showcase_set_updated_at before update on public.order_showcase
  for each row execute function public.set_updated_at();

create table if not exists public.order_previews (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  image_path text not null,
  note text,
  status text not null default 'sent',
  customer_comment text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists order_previews_inquiry_idx on public.order_previews (inquiry_id, created_at desc);
grant select, insert, update, delete on public.order_previews to authenticated;
grant all on public.order_previews to service_role;
revoke all on public.order_previews from anon;
alter table public.order_previews enable row level security;
drop policy if exists "Admins manage order previews" on public.order_previews;
create policy "Admins manage order previews" on public.order_previews for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public) values ('order-proofs', 'order-proofs', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('order-previews', 'order-previews', false) on conflict (id) do nothing;

drop policy if exists "Admins upload order proofs" on storage.objects;
create policy "Admins upload order proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-proofs' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins update order proofs" on storage.objects;
create policy "Admins update order proofs" on storage.objects for update to authenticated
  using (bucket_id = 'order-proofs' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'order-proofs' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins delete order proofs" on storage.objects;
create policy "Admins delete order proofs" on storage.objects for delete to authenticated
  using (bucket_id = 'order-proofs' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins read order previews" on storage.objects;
create policy "Admins read order previews" on storage.objects for select to authenticated
  using (bucket_id = 'order-previews' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins upload order previews" on storage.objects;
create policy "Admins upload order previews" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-previews' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins delete order previews" on storage.objects;
create policy "Admins delete order previews" on storage.objects for delete to authenticated
  using (bucket_id = 'order-previews' and public.has_role(auth.uid(), 'admin'));
