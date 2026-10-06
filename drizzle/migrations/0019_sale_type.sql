-- What kind of sale each one is: photobooth event, made to order, pop-up or other
alter table public.sales add column if not exists sale_type text not null default 'event';

update public.sales s set sale_type = case p.service_type
    when 'made_to_order' then 'made_to_order'
    when 'popup_print' then 'popup'
    else 'event' end
from public.packages p
where s.package_id = p.id;
