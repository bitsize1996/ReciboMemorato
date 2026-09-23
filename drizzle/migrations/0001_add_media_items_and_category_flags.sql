ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS print_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digitals_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gif_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS singles_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('print','digitals','gif','singles')),
  drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  width integer,
  height integer,
  thumb_url text,
  full_url text,
  is_gif boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'drive',
  published boolean NOT NULL DEFAULT false,
  download_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, category, drive_file_id)
);

CREATE INDEX IF NOT EXISTS media_items_event_category_idx
  ON public.media_items (event_id, category, published, name);

GRANT SELECT ON public.media_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published media of published events is public"
  ON public.media_items FOR SELECT TO anon, authenticated
  USING (
    published = true
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = media_items.event_id AND e.published = true)
  );

CREATE POLICY "Admins can read all media"
  ON public.media_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert media"
  ON public.media_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update media"
  ON public.media_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete media"
  ON public.media_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER media_items_set_updated_at
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();