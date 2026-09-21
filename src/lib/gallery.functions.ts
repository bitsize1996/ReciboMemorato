import { createServerFn } from "@tanstack/react-start";

import type { GalleryEvent, MediaCategory, MediaPage } from "./gallery/types";

const CATEGORIES = ["print", "digitals", "gif", "singles"] as const;

function toGalleryEvent(row: {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  cover_url: string | null;
}): GalleryEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eventDate: row.event_date,
    location: row.location,
    coverUrl: row.cover_url,
    isSample: false,
  };
}

export const listPublishedEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryEvent[]> => {
    const { publicSupabase } = await import("./gallery/events.server");
    const { SAMPLE_EVENTS } = await import("./gallery/mock.server");

    const { data, error } = await publicSupabase()
      .from("events")
      .select("id, slug, name, event_date, location, cover_url")
      .eq("published", true)
      .order("sort_order", { ascending: false })
      .order("event_date", { ascending: false });

    if (error) {
      console.error("Failed to load events", error);
      throw new Error("events_unavailable");
    }
    if (!data || data.length === 0) return SAMPLE_EVENTS;
    return data.map(toGalleryEvent);
  },
);

export const getPublishedEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug) }))
  .handler(async ({ data }): Promise<GalleryEvent | null> => {
    const { publicSupabase } = await import("./gallery/events.server");
    const { SAMPLE_EVENTS } = await import("./gallery/mock.server");

    const { data: row, error } = await publicSupabase()
      .from("events")
      .select("id, slug, name, event_date, location, cover_url")
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) {
      console.error("Failed to load event", error);
      throw new Error("events_unavailable");
    }
    if (row) return toGalleryEvent(row);
    return SAMPLE_EVENTS.find((event) => event.slug === data.slug) ?? null;
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
    const { getMockMedia } = await import("./gallery/mock.server");
    const { isDriveConfigured, listDriveMediaCached } = await import("./gallery/drive.server");

    const column = {
      print: "print_folder_id",
      digitals: "digitals_folder_id",
      gif: "gif_folder_id",
      singles: "singles_folder_id",
    }[data.category];

    const { data: row } = await publicSupabase()
      .from("events")
      .select("id, print_folder_id, digitals_folder_id, gif_folder_id, singles_folder_id")
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();

    const folderId = row ? ((row as Record<string, unknown>)[column] as string | null) : null;

    if (folderId && isDriveConfigured()) {
      try {
        return await listDriveMediaCached(folderId, data.pageToken);
      } catch {
        throw new Error("media_unavailable");
      }
    }

    return getMockMedia(data.slug, data.category, data.pageToken);
  });
