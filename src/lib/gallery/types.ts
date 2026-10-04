export type MediaCategory = "digitals" | "gif" | "singles";

export const MEDIA_CATEGORIES: { key: MediaCategory; label: string }[] = [
  { key: "digitals", label: "Prints" },
  { key: "gif", label: "Animated" },
  { key: "singles", label: "Single Photos" },
];

export interface MediaItem {
  id: string;
  name: string;
  thumbUrl: string;
  fullUrl: string;
  /** Null when the owner has turned downloads off for this file. */
  downloadUrl: string | null;
  width: number | null;
  height: number | null;
  isGif: boolean;
  isVideo: boolean;
}

export interface MediaPage {
  items: MediaItem[];
  nextPageToken: string | null;
  source: "mock" | "drive";
}

export interface GalleryEvent {
  id: string;
  slug: string;
  name: string;
  eventDate: string | null;
  location: string | null;
  coverUrl: string | null;
  /** CSS object-position chosen by the owner, e.g. "50% 20%". */
  coverPosition: string | null;
  /** Services at this event: photobooth, instax, sintra, popup. */
  tags: string[];
  isSample: boolean;
  /** Event category chosen by the owner (Birthday, Wedding…), if any. */
  categoryId: string | null;
  categoryName: string | null;
  categorySort: number;
  /** Only the categories the owner has switched on for this event. */
  categories: MediaCategory[];
}

export function formatEventDate(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatReceiptDate(value: string | null): string {
  if (!value) return "--.--.--";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsed.getUTCMonth() + 1)}.${pad(parsed.getUTCDate())}.${String(parsed.getUTCFullYear()).slice(2)}`;
}

export const EVENT_TAGS: { key: string; label: string }[] = [
  { key: "photobooth", label: "Photobooth" },
  { key: "instax", label: "Instax printing" },
  { key: "sintra", label: "Sintra board" },
  { key: "popup", label: "Pop-up" },
];

export const tagLabel = (key: string) => EVENT_TAGS.find((t) => t.key === key)?.label ?? key;
