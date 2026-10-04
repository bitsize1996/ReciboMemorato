-- Package price calculator: operation costs and the target margin are remembered per package
alter table public.packages add column if not exists operation_costs jsonb not null default '[]'::jsonb;
alter table public.packages add column if not exists target_margin numeric(6,2);
alter table public.packages add column if not exists margin_mode text not null default 'margin';
