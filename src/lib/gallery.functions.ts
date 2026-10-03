import { createServerFn } from "@tanstack/react-start";

import type { GalleryEvent, MediaCategory, MediaItem, MediaPage } from "./gallery/types";

const CATEGORIES = ["digitals", "gif", "singles"] as const;
const PAGE_SIZE = 24;

const EVENT_FIELDS =
  "id, slug, name, event_date, location, cover_url, digitals_enabled, gif_enabled, singles_enabled";

interface EventRowLite {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  cover_url: string | null;
  digitals_enabled: boolean;
  gif_enabled: boolean;
  singles_enabled: boolean;
  category_id?: string | null;
}

type CategoryMap = Map<string, { name: string; sort: number }>;

/** Event categories; returns an empty map if the table isn't set up yet. */
async function loadCategories(supabase: any): Promise<CategoryMap> {
  const map: CategoryMap = new Map();
  // Category names are public, so read them server-side regardless of row-level rules.
  let client = supabase;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    client = supabaseAdmin;
  } catch {
    // fall back to the public client
  }
  const { data, error } = await client.from("event_categories").select("id, name, sort_order");
  if (error) console.error("Failed to load event categories", error);
  if (error || !data) return map;
  for (const row of data as { id: string; name: string; sort_order: number | null }[]) {
    map.set(row.id, { name: row.name, sort: row.sort_order ?? 0 });
  }
  return map;
}

/** Published events (one by slug, or all). Works with or without category_id. */
async function queryPublishedEvents(supabase: any, slug: string | null) {
  const run = (fields: string) => {
    const base = supabase.from("events").select(fields).eq("published", true);
    return slug
      ? base.eq("slug", slug).maybeSingle()
      : base.order("sort_order", { ascending: false }).order("event_date", { ascending: false });
  };
  const withCategory = await run(`${EVENT_FIELDS}, category_id`);
  return withCategory.error ? await run(EVENT_FIELDS) : withCategory;
}

function toGalleryEvent(row: EventRowLite, categories: CategoryMap = new Map()): GalleryEvent {
  const flags: Record<MediaCategory, boolean> = {
    digitals: row.digitals_enabled,
    gif: row.gif_enabled,
    singles: row.singles_enabled,
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eventDate: row.event_date,
    location: row.location,
    coverUrl: row.cover_url,
    isSample: false,
    categoryId: row.category_id ?? null,
    categoryName: (row.category_id && categories.get(row.category_id)?.name) || null,
    categorySort: (row.category_id && categories.get(row.category_id)?.sort) || 0,
    categories: CATEGORIES.filter((key) => flags[key]),
  };
}

export const listPublishedEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryEvent[]> => {
    const { publicSupabase } = await import("./gallery/events.server");

    const supabase = publicSupabase() as any;
    const { data, error } = await queryPublishedEvents(supabase, null);

    if (error) {
      console.error("Failed to load events", error);
      throw new Error("events_unavailable");
    }
    if (!data || data.length === 0) return [];
    const categories = await loadCategories(supabase);
    return (data as EventRowLite[]).map((row) => toGalleryEvent(row, categories));
  },
);

export const getPublishedEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug) }))
  .handler(async ({ data }): Promise<GalleryEvent | null> => {
    const { publicSupabase } = await import("./gallery/events.server");

    const supabase = publicSupabase() as any;
    const { data: row, error } = await queryPublishedEvents(supabase, data.slug);

    if (error) {
      console.error("Failed to load event", error);
      throw new Error("events_unavailable");
    }
    if (!row) return null;
    const categories = await loadCategories(supabase);
    return toGalleryEvent(row as EventRowLite, categories);
  });

export const listEventMedia = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; category: MediaCategory; pageToken?: string | null }) => {
    if (!CATEGORIES.includes(input.category)) throw new Error("Invalid category");
    return {
      slug: String(input.slug),
      category: input.category,
      pageToken: input.pageToken ? String(input.pageToken) : null,
    };
  })
  .handler(async ({ data }): Promise<MediaPage> => {
    const { publicSupabase } = await import("./gallery/events.server");

    const supabase = publicSupabase();
    const { data: row, error } = await supabase
      .from("events")
      .select(EVENT_FIELDS)
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) {
      console.error("Failed to load event", error);
      throw new Error("media_unavailable");
    }

    if (!row) return { items: [], nextPageToken: null, source: "drive" };

    const event = toGalleryEvent(row as EventRowLite);
    if (!event.categories.includes(data.category)) {
      return { items: [], nextPageToken: null, source: "drive" };
    }

    const offset = data.pageToken ? Number(data.pageToken) || 0 : 0;
    const { data: rows, error: mediaError } = await supabase
      .from("media_items")
      .select("id, name, thumb_url, full_url, width, height, is_gif, mime_type, download_enabled")
      .eq("event_id", event.id)
      .eq("category", data.category)
      .eq("published", true)
      .neq("source", "sample")
      .order("name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (mediaError) {
      console.error("Failed to load media", mediaError);
      throw new Error("media_unavailable");
    }

    const items: MediaItem[] = (rows ?? []).map((media) => {
      const proxy = `/api/public/memory-media?id=${encodeURIComponent(media.id)}`;
      const full = media.full_url ?? proxy;
      return {
        id: media.id,
        name: media.name,
        thumbUrl: media.thumb_url ?? full,
        fullUrl: full,
        downloadUrl: media.download_enabled ? `${proxy}&dl=1` : null,
        width: media.width,
        height: media.height,
        isGif: media.is_gif,
        isVideo: Boolean(media.mime_type?.startsWith("video/")),
      };
    });

    return {
      items,
      nextPageToken: items.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
      source: "drive",
    };
  });

export const refreshEventGallery = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug) }))
  .handler(async ({ data }): Promise<{ added: number; publishedCount: number }> => {
    const empty = { added: 0, publishedCount: 0 };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data: event, error } = await db
        .from("events")
        .select("*")
        .eq("slug", data.slug)
        .eq("published", true)
        .maybeSingle();
      if (error || !event) return empty;

      let added = 0;
      if (event.auto_sync === true) {
        const { isDriveConfigured } = await import("./gallery/drive.server");
        if (isDriveConfigured()) {
          const cutoff = new Date(Date.now() - 25_000).toISOString();
          const { data: claimed } = await db
            .from("events")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", event.id)
            .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
            .select("id");
          if (claimed && claimed.length > 0) {
            try {
              const { syncEventFromDrive } = await import("./gallery/sync.server");
              const result = await syncEventFromDrive(db, event, {
                autoPublish: event.auto_publish === true,
                autoDownloads: event.auto_downloads === true,
              });
              added = result.added;
            } catch (err) {
              console.error("Automatic Drive sync failed", err);
            }
          }
        }
      }

      const { count } = await db
        .from("media_items")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("published", true)
        .neq("source", "sample");
      return { added, publishedCount: count ?? 0 };
    } catch (err) {
      console.error("Failed to refresh gallery", err);
      return empty;
    }
  });
