-- Which service each material is used for (a material can belong to several)
alter table public.materials add column if not exists used_for text[] not null default '{}';
