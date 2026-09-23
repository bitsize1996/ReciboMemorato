import type { GalleryEvent, MediaCategory, MediaItem, MediaPage } from "./types";

const ALL_CATEGORIES: MediaCategory[] = ["print", "digitals", "gif", "singles"];

// Sample content used until a real Google Drive account is connected.
// Everything here is clearly labelled as a sample in the UI.
export const SAMPLE_EVENTS: GalleryEvent[] = [
  {
    id: "sample-1",
    slug: "sample-birthday-party",
    name: "Sample Birthday Party",
    eventDate: "2026-09-20",
    location: "Quezon City",
    coverUrl: "https://picsum.photos/seed/recibo-cover-1/1200/900",
    isSample: true,
    categories: ALL_CATEGORIES,
  },
  {
    id: "sample-2",
    slug: "sample-debut-night",
    name: "Sample Debut Night",
    eventDate: "2026-08-14",
    location: "Manila",
    coverUrl: "https://picsum.photos/seed/recibo-cover-2/1200/900",
    isSample: true,
    categories: ALL_CATEGORIES,
  },
  {
    id: "sample-3",
    slug: "sample-grad-hangout",
    name: "Sample Grad Hangout",
    eventDate: "2026-06-28",
    location: "Tagaytay",
    coverUrl: "https://picsum.photos/seed/recibo-cover-3/1200/900",
    isSample: true,
    categories: ALL_CATEGORIES,
  },
];

const SHAPES: [number, number][] = [
  [900, 1200],
  [1200, 900],
  [1000, 1000],
  [800, 1200],
  [1200, 800],
];

const COUNTS: Record<MediaCategory, number> = {
  print: 14,
  digitals: 36,
  gif: 8,
  singles: 22,
};

const PAGE_SIZE = 18;

function shapeFor(category: MediaCategory, index: number): [number, number] {
  return category === "print" ? [700, 1600] : SHAPES[index % SHAPES.length]!;
}

/** Sample media used for the three demo events (no database rows involved). */
export function getMockMedia(
  eventSlug: string,
  category: MediaCategory,
  pageToken: string | null,
): MediaPage {
  const total = COUNTS[category];
  const offset = pageToken ? Number(pageToken) || 0 : 0;
  const items: MediaItem[] = [];

  for (let i = offset; i < Math.min(offset + PAGE_SIZE, total); i += 1) {
    const shape = shapeFor(category, i);
    const seed = `${eventSlug}-${category}-${i}`;
    const fullUrl = `https://picsum.photos/seed/${seed}/${shape[0]}/${shape[1]}`;
    items.push({
      id: seed,
      name: `${category}-${String(i + 1).padStart(3, "0")}`,
      thumbUrl: `https://picsum.photos/seed/${seed}/${Math.round(shape[0] / 2)}/${Math.round(shape[1] / 2)}`,
      fullUrl,
      downloadUrl: fullUrl,
      width: shape[0],
      height: shape[1],
      isGif: category === "gif",
    });
  }

  const next = offset + PAGE_SIZE;
  return {
    items,
    nextPageToken: next < total ? String(next) : null,
    source: "mock",
  };
}

export interface MockFile {
  drive_file_id: string;
  name: string;
  mime_type: string;
  width: number;
  height: number;
  thumb_url: string;
  full_url: string;
}

/**
 * Placeholder files for the owner tools while Google Drive is not connected.
 * They are stored with source = "mock" and shown as samples in the dashboard.
 */
export function buildMockFiles(eventId: string, category: MediaCategory): MockFile[] {
  const files: MockFile[] = [];
  for (let i = 0; i < COUNTS[category]; i += 1) {
    const shape = shapeFor(category, i);
    const seed = `${eventId}-${category}-${i}`;
    files.push({
      drive_file_id: `mock:${seed}`,
      name: `${category}-${String(i + 1).padStart(3, "0")}.${category === "gif" ? "gif" : "jpg"}`,
      mime_type: category === "gif" ? "image/gif" : "image/jpeg",
      width: shape[0],
      height: shape[1],
      thumb_url: `https://picsum.photos/seed/${seed}/${Math.round(shape[0] / 2)}/${Math.round(shape[1] / 2)}`,
      full_url: `https://picsum.photos/seed/${seed}/${shape[0]}/${shape[1]}`,
    });
  }
  return files;
}
