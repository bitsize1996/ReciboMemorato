import {
  listAllDriveFiles,
  listDriveSubfolders,
  listOtherDriveFiles,
} from "./drive.server";
import type { MediaCategory } from "./types";

// Reads an event's Google Drive folders and records files we haven't seen.
// Used by the admin "Check for new files" button, by the automatic refresh
// that runs while people view a gallery, and by the optional scheduled job.

const CATEGORIES: MediaCategory[] = ["gif", "digitals", "singles"];

const FOLDER_COLUMN: Record<MediaCategory, string> = {
  digitals: "digitals_folder_id",
  singles: "singles_folder_id",
  gif: "gif_folder_id",
};

// Words that identify each tab's Drive sub-folder (matched anywhere in the name).
const FOLDER_KEYWORDS: Record<MediaCategory, string[]> = {
  gif: ["animat", "gif"],
  digitals: ["print", "digital"],
  singles: ["single"],
};

const LABEL: Record<MediaCategory, string> = {
  gif: "Animated",
  digitals: "Prints",
  singles: "Single Photos",
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function driveErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  if (code === "drive_error_401") {
    return "The Google Drive connection needs to be renewed. Reconnect Google Drive, then try again.";
  }
  if (["drive_error_400", "drive_error_403", "drive_error_404"].includes(code)) {
    return "Google Drive can't open that folder. Make sure the link is for a folder in the Google account connected to this site (or shared with it), then try again.";
  }
  return "Could not reach Google Drive. Please try again shortly.";
}

const isFolderAccessError = (e: unknown) =>
  e instanceof Error && ["drive_error_400", "drive_error_403", "drive_error_404"].includes(e.message);

/** Reads every row of a small table for one event (the API returns 1000 rows at a time). */
async function fetchAllForEvent(db: any, table: string, eventId: string, extra = "") {
  const rows: {
    category: string;
    drive_file_id: string;
    drive_created_at?: string | null;
    source?: string | null;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(`category, drive_file_id${extra}`)
      .eq("event_id", eventId)
      .range(from, from + 999);
    if (error || !data) break; // e.g. the table doesn't exist yet
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export interface SyncOptions {
  /** Publish new files immediately instead of leaving them hidden. */
  autoPublish?: boolean;
  /** When publishing automatically, also allow downloads. */
  autoDownloads?: boolean;
}

export interface SyncResult {
  added: number;
  removed: number;
  foldersFound: number;
  report: string[];
}

export async function syncEventFromDrive(
  db: any,
  event: any,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const eventId = event.id as string;

  const seen = new Set<string>();
  // Files already in the gallery that don't yet know when they were added to Drive.
  const undated = new Set<string>();
  // Drive-sourced files currently in the gallery, per category (to spot ones deleted from Drive).
  const inGallery = new Map<string, Set<string>>();
  for (const row of await fetchAllForEvent(db, "media_items", eventId, ", drive_created_at, source")) {
    const key = `${row.category}:${row.drive_file_id}`;
    seen.add(key);
    if (!row.drive_created_at) undated.add(key);
    if ((row.source ?? "drive") === "drive") {
      if (!inGallery.has(row.category)) inGallery.set(row.category, new Set());
      inGallery.get(row.category)!.add(row.drive_file_id);
    }
  }
  // Files the owner removed from the gallery must not come back.
  for (const row of await fetchAllForEvent(db, "media_exclusions", eventId)) {
    seen.add(`${row.category}:${row.drive_file_id}`);
  }

  const inserts: Record<string, unknown>[] = [];
  const backfill: Record<string, unknown>[] = [];
  const toRemove: { category: string; ids: string[] }[] = [];
  let removed = 0;
  const report: string[] = [];
  const learned: Record<string, string> = {};

  const mainFolder = (event.drive_folder_id as string | null) || null;
  let subfolderCache: { id: string; name: string }[] | null = null;
  const findFolder = async (category: MediaCategory): Promise<string | null> => {
    if (!mainFolder) return null;
    if (!subfolderCache) {
      try {
        subfolderCache = await listDriveSubfolders(mainFolder);
      } catch (e) {
        throw new Error(driveErrorMessage(e));
      }
    }
    const match = subfolderCache.find((folder) => {
      const name = normalizeName(folder.name);
      return FOLDER_KEYWORDS[category].some((word) => name.includes(word));
    });
    return match?.id ?? null;
  };

  let foldersFound = 0;

  for (const category of CATEGORIES) {
    const label = LABEL[category];
    let folderId = (event[FOLDER_COLUMN[category]] as string | null) || null;
    let files: Awaited<ReturnType<typeof listAllDriveFiles>> | null = null;
    // The Animated tab also accepts videos (MP4, MOV…).
    const listOptions = { includeVideos: category === "gif" };

    // A saved folder link that no longer works falls back to the main folder.
    if (folderId) {
      try {
        files = await listAllDriveFiles(folderId, listOptions);
      } catch (e) {
        if (mainFolder && isFolderAccessError(e)) folderId = null;
        else throw new Error(driveErrorMessage(e));
      }
    }
    if (!folderId) {
      folderId = await findFolder(category);
      if (folderId) {
        try {
          files = await listAllDriveFiles(folderId, listOptions);
        } catch (e) {
          throw new Error(driveErrorMessage(e));
        }
        learned[FOLDER_COLUMN[category]] = folderId;
      }
    }

    if (!folderId || !files) {
      report.push(`${label}: folder not found`);
      continue;
    }
    foldersFound += 1;

    // Files that were deleted (or moved out) in Drive no longer belong in the gallery.
    // An empty listing is never trusted for this, so a Drive hiccup can't wipe a gallery.
    let gone: string[] = [];
    if (files.length > 0) {
      const listed = new Set(files.map((file) => file.id));
      gone = [...(inGallery.get(category) ?? [])].filter((id) => !listed.has(id));
      if (gone.length > 0) {
        toRemove.push({ category, ids: gone });
        removed += gone.length;
      }
    }

    let added = 0;
    for (const file of files) {
      const key = `${category}:${file.id}`;
      if (seen.has(key)) {
        if (undated.has(key) && file.createdTime) {
          undated.delete(key);
          backfill.push({
            event_id: eventId,
            category,
            drive_file_id: file.id,
            name: file.name,
            drive_created_at: file.createdTime,
          });
        }
        continue;
      }
      seen.add(key);
      added += 1;
      inserts.push({
        event_id: eventId,
        category,
        drive_file_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        width: file.imageMediaMetadata?.width ?? file.videoMediaMetadata?.width ?? null,
        height: file.imageMediaMetadata?.height ?? file.videoMediaMetadata?.height ?? null,
        is_gif: file.mimeType === "image/gif",
        source: "drive",
        drive_created_at: file.createdTime ?? null,
        published: options.autoPublish === true,
        download_enabled: options.autoPublish === true && options.autoDownloads === true,
      });
    }

    if (files.length === 0) {
      const others = await listOtherDriveFiles(folderId);
      report.push(
        others.length > 0
          ? `${label}: no photos or videos, but ${others.length} other file${others.length === 1 ? "" : "s"} found (for example "${others[0]!.name}"). Only images (JPG, PNG, GIF, WebP) and, in Animated, videos can be shown.`
          : `${label}: folder found but it is empty`,
      );
    } else {
      report.push(
        `${label}: ${files.length} file${files.length === 1 ? "" : "s"} found (${added} new${gone.length > 0 ? `, ${gone.length} removed` : ""})`,
      );
    }
  }

  if (Object.keys(learned).length > 0) {
    await db.from("events").update(learned).eq("id", eventId);
  }

  for (const { category, ids } of toRemove) {
    for (let i = 0; i < ids.length; i += 100) {
      await db
        .from("media_items")
        .delete()
        .eq("event_id", eventId)
        .eq("category", category)
        .eq("source", "drive")
        .in("drive_file_id", ids.slice(i, i + 100));
    }
  }

  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await db
      .from("media_items")
      .upsert(inserts.slice(i, i + 500), {
        onConflict: "event_id,category,drive_file_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
  }

  // Older files get their Drive date filled in once, so "newest first" is accurate.
  for (let i = 0; i < backfill.length; i += 500) {
    await db
      .from("media_items")
      .upsert(backfill.slice(i, i + 500), { onConflict: "event_id,category,drive_file_id" });
  }

  return { added: inserts.length, removed, foldersFound, report };
}
