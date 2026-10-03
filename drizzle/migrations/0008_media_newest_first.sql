-- When a file was added to Google Drive, so galleries can show the newest first
alter table public.media_items add column if not exists drive_created_at timestamptz;
create index if not exists media_items_event_cat_created_idx
  on public.media_items (event_id, category, drive_created_at desc);
