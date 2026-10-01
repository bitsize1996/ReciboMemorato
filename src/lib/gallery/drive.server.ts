const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

export function isDriveConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_DRIVE_API_KEY"]);
}

function gatewayHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["GOOGLE_DRIVE_API_KEY"]!,
  };
}

function safeId(value: string): string {
  return value.replace(/['\\]/g, "");
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number };
}

/** Streams the original file bytes through the gateway (used by the media proxy). */
export async function fetchDriveFile(fileId: string, range?: string | null): Promise<Response> {
  const headers = new Headers(gatewayHeaders());
  if (range) headers.set("Range", range); // lets videos start fast and seek
  return fetch(`${GATEWAY}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers,
  });
}

/**
 * Lists every image/GIF in a Drive folder. Used only by the owner-side sync,
 * never by public pages — nothing here reaches the browser.
 */
export async function listAllDriveFiles(
  folderId: string,
  options: { includeVideos?: boolean } = {},
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 40; page += 1) {
    const params = new URLSearchParams({
      q: `'${safeId(folderId)}' in parents and trashed = false and (mimeType contains 'image/'${
        options.includeVideos ? " or mimeType contains 'video/'" : ""
      })`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "nextPageToken, files(id, name, mimeType, imageMediaMetadata(width, height), videoMediaMetadata(width, height))",
      pageSize: "200",
      orderBy: "name",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${GATEWAY}/files?${params.toString()}`, {
      headers: gatewayHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Drive listing failed [${response.status}]: ${body}`);
      throw new Error(`drive_error_${response.status}`);
    }

    const payload = (await response.json()) as {
      files?: DriveFile[];
      nextPageToken?: string | null;
    };
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken ?? null;
    if (!pageToken) break;
  }

  return files;
}

/** Lists the sub-folders (id + name) directly inside a Drive folder. */
export async function listDriveSubfolders(
  folderId: string,
): Promise<{ id: string; name: string }[]> {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      q: `'${safeId(folderId)}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name)",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${GATEWAY}/files?${params.toString()}`, {
      headers: gatewayHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Drive folder listing failed [${response.status}]: ${body}`);
      throw new Error(`drive_error_${response.status}`);
    }
    const payload = (await response.json()) as {
      files?: { id: string; name: string }[];
      nextPageToken?: string | null;
    };
    folders.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken ?? null;
    if (!pageToken) break;
  }
  return folders;
}

/**
 * Lists a few non-image, non-folder files in a Drive folder (videos, PDFs…).
 * Used only to explain why a folder that has files shows no photos.
 */
export async function listOtherDriveFiles(
  folderId: string,
): Promise<{ name: string; mimeType: string }[]> {
  const params = new URLSearchParams({
    q: `'${safeId(folderId)}' in parents and trashed = false and not mimeType contains 'image/' and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "files(name, mimeType)",
    pageSize: "20",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`${GATEWAY}/files?${params.toString()}`, {
    headers: gatewayHeaders(),
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { files?: { name: string; mimeType: string }[] };
  return payload.files ?? [];
}
