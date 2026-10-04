-- Which of your services each package belongs to (receipt, standard, high_angle, sintra, instax)
alter table public.packages add column if not exists product_line text;

update public.packages set product_line = case
  when name ilike '%sintra%' then 'sintra'
  when name ilike '%instax%' then 'instax'
  when name ilike '%receipt%' then 'receipt'
  when name ilike '%high%angle%' or name ilike '%high-angle%' then 'high_angle'
  when name ilike '%standard%' or name ilike '%classic%' then 'standard'
  else null end
where product_line is null;
