import type { GalleryEvent, MediaCategory, MediaItem, MediaPage } from "./types";

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
  },
  {
    id: "sample-2",
    slug: "sample-debut-night",
    name: "Sample Debut Night",
    eventDate: "2026-08-14",
    location: "Manila",
    coverUrl: "https://picsum.photos/seed/recibo-cover-2/1200/900",
    isSample: true,
  },
  {
    id: "sample-3",
    slug: "sample-grad-hangout",
    name: "Sample Grad Hangout",
    eventDate: "2026-06-28",
    location: "Tagaytay",
    coverUrl: "https://picsum.photos/seed/recibo-cover-3/1200/900",
    isSample: true,
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

export function getMockMedia(
  eventSlug: string,
  category: MediaCategory,
  pageToken: string | null,
): MediaPage {
  const total = COUNTS[category];
  const offset = pageToken ? Number(pageToken) || 0 : 0;
  const items: MediaItem[] = [];

  for (let i = offset; i < Math.min(offset + PAGE_SIZE, total); i += 1) {
    const shape = category === "print" ? ([700, 1600] as [number, number]) : SHAPES[i % SHAPES.length]!;
    const seed = `${eventSlug}-${category}-${i}`;
    items.push({
      id: seed,
      name: `${category}-${String(i + 1).padStart(3, "0")}`,
      thumbUrl: `https://picsum.photos/seed/${seed}/${Math.round(shape[0] / 2)}/${Math.round(shape[1] / 2)}`,
      fullUrl: `https://picsum.photos/seed/${seed}/${shape[0]}/${shape[1]}`,
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
