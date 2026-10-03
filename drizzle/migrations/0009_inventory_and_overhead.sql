-- Automatic inventory: stock follows a movement log (restocks, sales, adjustments)
update public.materials set current_stock = 0 where current_stock is null;
alter table public.materials alter column current_stock set default 0;
alter table public.materials alter column current_stock set not null;

create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  change numeric(12,2) not null,
  kind text not null default 'adjustment',
  unit_cost numeric(12,2),
  sale_id uuid,
  sale_material_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists material_movements_material_idx
  on public.material_movements (material_id, created_at desc);
create index if not exists material_movements_sale_material_idx
  on public.material_movements (sale_material_id);

grant select, insert on public.material_movements to authenticated;
grant all on public.material_movements to service_role;

alter table public.material_movements enable row level security;

drop policy if exists "Admins read material movements" on public.material_movements;
create policy "Admins read material movements"
  on public.material_movements for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins add material movements" on public.material_movements;
create policy "Admins add material movements"
  on public.material_movements for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Every movement updates the material's stock
create or replace function public.apply_material_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.materials set current_stock = current_stock + new.change where id = new.material_id;
  return new;
end $$;

drop trigger if exists material_movements_apply on public.material_movements;
create trigger material_movements_apply
  after insert on public.material_movements
  for each row execute function public.apply_material_movement();

-- Materials used by a sale come out of stock (and go back if the sale is cancelled or changed)
create or replace function public.sync_sale_material_stock(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  sm record;
  sale_status public.payment_status;
  applied numeric;
  desired numeric;
begin
  select * into sm from public.sale_materials where id = p_id;
  if not found or sm.material_id is null then return; end if;
  select payment_status into sale_status from public.sales where id = sm.sale_id;
  desired := case when sale_status = 'cancelled' then 0 else -sm.quantity end;
  select coalesce(sum(change), 0) into applied from public.material_movements where sale_material_id = p_id;
  if desired <> applied then
    insert into public.material_movements (material_id, change, kind, unit_cost, sale_id, sale_material_id, note)
    values (
      sm.material_id, desired - applied, 'sale', sm.unit_cost_snapshot, sm.sale_id, p_id,
      case when sale_status = 'cancelled' then 'Sale cancelled' else null end
    );
  end if;
end $$;

create or replace function public.sale_materials_stock_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare applied numeric;
begin
  if tg_op = 'DELETE' then
    if old.material_id is not null then
      select coalesce(sum(change), 0) into applied from public.material_movements where sale_material_id = old.id;
      if applied <> 0 then
        insert into public.material_movements (material_id, change, kind, unit_cost, sale_id, note)
        values (old.material_id, -applied, 'sale', old.unit_cost_snapshot, old.sale_id, 'Removed from sale');
      end if;
    end if;
    return old;
  end if;
  perform public.sync_sale_material_stock(new.id);
  return new;
end $$;

drop trigger if exists sale_materials_stock on public.sale_materials;
create trigger sale_materials_stock
  after insert or update of quantity on public.sale_materials
  for each row execute function public.sale_materials_stock_trg();

drop trigger if exists sale_materials_stock_del on public.sale_materials;
create trigger sale_materials_stock_del
  after delete on public.sale_materials
  for each row execute function public.sale_materials_stock_trg();

create or replace function public.sales_stock_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.payment_status is distinct from old.payment_status
     and (new.payment_status = 'cancelled' or old.payment_status = 'cancelled') then
    for r in select id from public.sale_materials where sale_id = new.id loop
      perform public.sync_sale_material_stock(r.id);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists sales_stock on public.sales;
create trigger sales_stock
  after update of payment_status on public.sales
  for each row execute function public.sales_stock_trg();

-- Business expenses that aren't tied to one booking (one-time or recurring)
alter table public.sale_expenses alter column sale_id drop not null;
alter table public.sale_expenses add column if not exists kind text not null default 'one_time';
alter table public.sale_expenses add column if not exists recurrence text;
alter table public.sale_expenses add column if not exists ends_on date;
