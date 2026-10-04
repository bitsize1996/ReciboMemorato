import {
  driveFolderIsReachable,
  fetchDriveFileSize,
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
  const excluded = new Map<string, Set<string>>();
  for (const row of await fetchAllForEvent(db, "media_exclusions", eventId)) {
    seen.add(`${row.category}:${row.drive_file_id}`);
    if (!excluded.has(row.category)) excluded.set(row.category, new Set());
    excluded.get(row.category)!.add(row.drive_file_id);
  }

  const inserts: Record<string, unknown>[] = [];
  const backfill: Record<string, unknown>[] = [];
  const toRemove: { category: string; ids: string[] }[] = [];
  let removed = 0;
  const report: string[] = [];
  const learned: Record<string, string> = {};

  const mainFolder = (event.drive_folder_id as string | null) || null;
  // The sub-folder lookup is shared by the three scans below, so it runs once.
  let subfolderPromise: Promise<{ id: string; name: string }[]> | null = null;
  const findFolder = async (category: MediaCategory): Promise<string | null> => {
    if (!mainFolder) return null;
    if (!subfolderPromise) subfolderPromise = listDriveSubfolders(mainFolder);
    let subfolders;
    try {
      subfolders = await subfolderPromise;
    } catch (e) {
      throw new Error(driveErrorMessage(e));
    }
    const match = subfolders.find((folder) => {
      const name = normalizeName(folder.name);
      return FOLDER_KEYWORDS[category].some((word) => name.includes(word));
    });
    return match?.id ?? null;
  };

  // Look at the three Drive folders at the same time instead of one after another.
  const scan = async (category: MediaCategory) => {
    let folderId = (event[FOLDER_COLUMN[category]] as string | null) || null;
    let files: Awaited<ReturnType<typeof listAllDriveFiles>> | null = null;
    let learnedId: string | null = null;
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
        learnedId = folderId;
      }
    }

    // An empty answer is only trusted when the folder itself answers normally.
    let trustedEmpty = false;
    if (folderId && files && files.length === 0) trustedEmpty = await driveFolderIsReachable(folderId);
    return { category, folderId, files, learnedId, trustedEmpty };
  };

  const scans = await Promise.all(CATEGORIES.map((category) => scan(category)));

  let foldersFound = 0;
  const tidy: { category: string; ids: string[] }[] = [];

  for (const { category, folderId, files, learnedId, trustedEmpty } of scans) {
    const label = LABEL[category];
    if (learnedId) learned[FOLDER_COLUMN[category]] = learnedId;

    if (!folderId || !files) {
      report.push(`${label}: folder not found`);
      continue;
    }
    foldersFound += 1;

    // Files that were deleted (or moved out) in Drive no longer belong in the gallery.
    // An empty folder counts only if it answered normally, and a huge gallery is never
    // emptied in one go, so a Drive hiccup can't wipe it.
    const listed = new Set(files.map((file) => file.id));
    const present = inGallery.get(category) ?? new Set<string>();
    let gone: string[] = [];
    if (files.length > 0 || (trustedEmpty && present.size <= 150)) {
      gone = [...present].filter((id) => !listed.has(id));
      if (gone.length > 0) {
        toRemove.push({ category, ids: gone });
        removed += gone.length;
      }
      // Files that vanished from Drive no longer need to be remembered as "removed".
      const stale = [...(excluded.get(category) ?? [])].filter((id) => !listed.has(id));
      if (stale.length > 0) tidy.push({ category, ids: stale });
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
        width: null,
        height: null,
        is_gif: file.mimeType === "image/gif",
        source: "drive",
        drive_created_at: file.createdTime ?? null,
        published: options.autoPublish === true,
        download_enabled: options.autoPublish === true && options.autoDownloads === true,
      });
    }

    if (files.length === 0) {
      if (trustedEmpty) {
        report.push(
          gone.length > 0
            ? `${label}: folder is now empty (${gone.length} removed)`
            : present.size > 150
              ? `${label}: Drive shows an empty folder but ${present.size} photos are in the gallery, so nothing was changed. If you really emptied it, use "Remove all" on that tab.`
              : `${label}: folder found but it is empty`,
        );
      } else {
        const others = await listOtherDriveFiles(folderId);
        report.push(
          others.length > 0
            ? `${label}: no photos or videos, but ${others.length} other file${others.length === 1 ? "" : "s"} found (for example "${others[0]!.name}"). Only images (JPG, PNG, GIF, WebP) and, in Animated, videos can be shown.`
            : `${label}: folder could not be checked, so nothing was changed`,
        );
      }
    } else {
      report.push(
        `${label}: ${files.length} file${files.length === 1 ? "" : "s"} found (${added} new${gone.length > 0 ? `, ${gone.length} removed` : ""})`,
      );
    }
  }

  // Picture sizes for the new files only (a few at a time), so the grid doesn't jump around.
  const sizeTargets = inserts.slice(0, 60);
  for (let i = 0; i < sizeTargets.length; i += 10) {
    await Promise.all(
      sizeTargets.slice(i, i + 10).map(async (row) => {
        const size = await fetchDriveFileSize(row["drive_file_id"] as string);
        row["width"] = size.width;
        row["height"] = size.height;
      }),
    );
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

  for (const { category, ids } of tidy) {
    for (let i = 0; i < ids.length; i += 100) {
      await db
        .from("media_exclusions")
        .delete()
        .eq("event_id", eventId)
        .eq("category", category)
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
