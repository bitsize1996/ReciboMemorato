import { createServerFn } from "@tanstack/react-start";

import type { GalleryEvent, MediaCategory, MediaItem, MediaPage } from "./gallery/types";

const CATEGORIES = ["digitals", "gif", "singles"] as const;
const PAGE_SIZE = 24;

const EVENT_FIELDS =
  "id, slug, name, event_date, location, cover_url, category_id, digitals_enabled, gif_enabled, singles_enabled";

interface EventRowLite {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  cover_url: string | null;
  category_id?: string | null;
  digitals_enabled: boolean;
  gif_enabled: boolean;
  singles_enabled: boolean;
}

async function loadEventsQuery(queryFactory: (fields: string) => any) {
  return queryFactory(EVENT_FIELDS);
}

function toGalleryEvent(row: EventRowLite): GalleryEvent {
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
    categoryId: row.category_id ?? null,
    isSample: false,
    categories: CATEGORIES.filter((key) => flags[key]),
  };
}

export const listPublishedEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryEvent[]> => {
    const { publicSupabase } = await import("./gallery/events.server");

    const { data, error } = await loadEventsQuery((fields) =>
      publicSupabase()
        .from("events")
        .select(fields)
        .eq("published", true)
        .order("sort_order", { ascending: false })
        .order("event_date", { ascending: false }),
    );

    if (error) {
      console.error("Failed to load events", error);
      throw new Error("events_unavailable");
    }
    if (!data || data.length === 0) return [];
    return (data as EventRowLite[]).map(toGalleryEvent);
  },
);

export const getPublishedEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug) }))
  .handler(async ({ data }): Promise<GalleryEvent | null> => {
    const { publicSupabase } = await import("./gallery/events.server");

    const { data: row, error } = await loadEventsQuery((fields) =>
      publicSupabase()
        .from("events")
        .select(fields)
        .eq("published", true)
        .eq("slug", data.slug)
        .maybeSingle(),
    );

    if (error) {
      console.error("Failed to load event", error);
      throw new Error("events_unavailable");
    }
    return row ? toGalleryEvent(row as EventRowLite) : null;
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
    const { data: row, error } = await loadEventsQuery((fields) =>
      supabase
        .from("events")
        .select(fields)
        .eq("published", true)
        .eq("slug", data.slug)
        .maybeSingle(),
    );

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
