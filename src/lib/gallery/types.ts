export type MediaCategory = "digitals" | "gif" | "singles";

export const MEDIA_CATEGORIES: { key: MediaCategory; label: string }[] = [
  { key: "digitals", label: "Digitals" },
  { key: "gif", label: "GIF" },
  { key: "singles", label: "Singles" },
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
  isSample: boolean;
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
