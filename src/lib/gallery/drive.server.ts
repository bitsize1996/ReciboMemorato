import { createHmac, timingSafeEqual } from "node:crypto";

import type { MediaItem, MediaPage } from "./types";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const PAGE_SIZE = 40;

export function isDriveConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_DRIVE_API_KEY"]);
}

function signingSecret(): string {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_JWKS"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    "recibo-memorato-fallback"
  );
}

export function signFileId(fileId: string): string {
  return createHmac("sha256", signingSecret()).update(fileId).digest("hex").slice(0, 32);
}

export function verifyFileId(fileId: string, signature: string): boolean {
  const expected = Buffer.from(signFileId(fileId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function gatewayHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["GOOGLE_DRIVE_API_KEY"]!,
  };
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  imageMediaMetadata?: { width?: number; height?: number };
}

/** Streams the original file bytes through the gateway (used by the image proxy). */
export async function fetchDriveFile(fileId: string): Promise<Response> {
  return fetch(`${GATEWAY}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: gatewayHeaders(),
  });
}

export async function listDriveMedia(
  folderId: string,
  pageToken: string | null,
): Promise<MediaPage> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
    fields: "nextPageToken, files(id, name, mimeType, thumbnailLink, imageMediaMetadata(width, height))",
    pageSize: String(PAGE_SIZE),
    orderBy: "name",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const response = await fetch(`${GATEWAY}/files?${params.toString()}`, {
    headers: gatewayHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Drive listing failed [${response.status}]: ${body}`);
    throw new Error("drive_unavailable");
  }

  const payload = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
  const items: MediaItem[] = (payload.files ?? []).map((file) => {
    const signature = signFileId(file.id);
    const proxied = `/api/public/memory-media?id=${encodeURIComponent(file.id)}&sig=${signature}`;
    const isGif = file.mimeType === "image/gif";
    return {
      id: file.id,
      name: file.name,
      // Drive thumbnails keep grids light; GIFs use their static poster in the grid.
      thumbUrl: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+$/, "=s800") : proxied,
      fullUrl: proxied,
      width: file.imageMediaMetadata?.width ?? null,
      height: file.imageMediaMetadata?.height ?? null,
      isGif,
    };
  });

  return { items, nextPageToken: payload.nextPageToken ?? null, source: "drive" };
}

// Small in-process cache so Drive uploads appear without a rebuild,
// while repeat visits within the window stay fast.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: MediaPage }>();

export async function listDriveMediaCached(
  folderId: string,
  pageToken: string | null,
): Promise<MediaPage> {
  const key = `${folderId}::${pageToken ?? "first"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await listDriveMedia(folderId, pageToken);
  cache.set(key, { at: Date.now(), value });
  return value;
}
