-- Pop-up pay-per-print sales: link a sale to its event and remember how it was paid
alter table public.sales add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.sales add column if not exists payment_method text;
create index if not exists sales_event_idx on public.sales (event_id);
