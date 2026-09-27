-- Site customization: single-row settings for brand texts and colors.
-- Public read, admin-only write (has_role).
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  brand_line1 text not null default 'RECIBO',
  brand_line2 text not null default 'MEMORATO',
  brand_sub text not null default 'by the bitsize sibs',
  hero_eyebrow text not null default 'Photobooth & keepsakes',
  hero_title text not null default 'Your memories deserve more than a *camera roll.*',
  hero_lead text not null default 'Turn your favorite moments into something you can actually keep.',
  hero_description text not null default 'From receipt-inspired photobooths to high-angle shots, Sintra Board prints, and Original Instax prints — Recibo Memorato makes memories tangible.',
  cta_label text not null default 'Send us a message',
  messenger_url text not null default 'https://m.me/',
  final_title text not null default 'Don''t let your favorite moments live only in your camera roll.',
  final_tagline text not null default 'Because memories need proofs.',
  color_accent text not null default '#d40e14',
  color_paper text not null default '#f9f7f0',
  color_ink text not null default '#150f0c',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;

alter table public.site_settings enable row level security;

create policy "Public can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

create policy "Admins can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
