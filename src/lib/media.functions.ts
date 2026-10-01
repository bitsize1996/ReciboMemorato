import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaCategory } from "./gallery/types";

const CATEGORIES = ["digitals", "gif", "singles"] as const;

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await (context.supabase as any).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify access");
  if (!data) throw new Error("Forbidden");
}

function categoryOf(input: unknown): MediaCategory {
  if (!CATEGORIES.includes(input as MediaCategory)) throw new Error("Invalid category");
  return input as MediaCategory;
}

// Words that identify each tab's Drive sub-folder (matched anywhere in the name).
const FOLDER_KEYWORDS: Record<MediaCategory, string[]> = {
  gif: ["animat", "gif"],
  digitals: ["print", "digital"],
  singles: ["single"],
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function driveErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  if (code === "drive_error_401") {
    return "The Google Drive connection needs to be renewed. Reconnect Google Drive, then try again.";
  }
  if (["drive_error_400", "drive_error_403", "drive_error_404"].includes(code)) {
    return "Google Drive can't open that folder. Make sure the link is for a folder in the Google account connected to this site (or shared with it), then try again.";
  }
  return "Could not reach Google Drive. Please try again shortly.";
}

const FOLDER_COLUMN: Record<MediaCategory, string> = {
  digitals: "digitals_folder_id",
  gif: "gif_folder_id",
  singles: "singles_folder_id",
};

export const adminGetEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: event, error } = await (context.supabase as any)
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !event) throw new Error("Event not found");

    const { data: rows, error: mediaError } = await (context.supabase as any)
      .from("media_items")
      .select("category, published, download_enabled, source")
      .eq("event_id", data.eventId)
      .in("category", [...CATEGORIES]);
    if (mediaError) throw new Error("Could not load gallery");

    const stats = {
      total: rows?.length ?? 0,
      published: 0,
      unpublished: 0,
      downloadsOn: 0,
      downloadsOff: 0,
      samples: 0,
      byCategory: { digitals: 0, gif: 0, singles: 0 } as Record<MediaCategory, number>,
    };
    for (const row of rows ?? []) {
      if (row.published) stats.published += 1;
      else stats.unpublished += 1;
      if (row.download_enabled) stats.downloadsOn += 1;
      else stats.downloadsOff += 1;
      if (row.source === "sample") stats.samples += 1;
      stats.byCategory[row.category as MediaCategory] += 1;
    }

    const { count: samplesTotal } = await (context.supabase as any)
      .from("media_items")
      .select("id", { count: "exact", head: true })
      .eq("source", "sample");

    const { isDriveConfigured } = await import("./gallery/drive.server");
    return { event, stats, samplesTotal: samplesTotal ?? 0, driveConnected: isDriveConfigured() };
  });

export const adminListMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; category: MediaCategory }) => ({
    eventId: String(input.eventId),
    category: categoryOf(input.category),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: rows, error } = await (context.supabase as any)
      .from("media_items")
      .select(
        "id, name, thumb_url, full_url, is_gif, mime_type, source, published, download_enabled, created_at",
      )
      .eq("event_id", data.eventId)
      .eq("category", data.category)
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error("Could not load media");
    return rows ?? [];
  });

/**
 * Reads the connected Google Drive folders and records any file we have not
 * seen before. New files always arrive switched off — nothing becomes public
 * until the owner says so. No sample/placeholder files are ever created.
 */
export const syncEventMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);

    const { data: event, error } = await (context.supabase as any)
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !event) throw new Error("Event not found");

    const { isDriveConfigured, listAllDriveFiles, listDriveSubfolders, listOtherDriveFiles } =
      await import("./gallery/drive.server");
    const driveConnected = isDriveConfigured();
    if (!driveConnected) {
      throw new Error("Google Drive isn't connected yet, so there is nothing to check.");
    }

    const { data: existing } = await (context.supabase as any)
      .from("media_items")
      .select("category, drive_file_id")
      .eq("event_id", data.eventId);
    const seen = new Set(
      (existing ?? []).map((row: any) => `${row.category}:${row.drive_file_id}`),
    );

    const inserts: Record<string, unknown>[] = [];
    const report: string[] = [];
    const learned: Record<string, string> = {};

    const labelOf = (category: MediaCategory) =>
      category === "gif" ? "Animated" : category === "digitals" ? "Prints" : "Single Photos";
    const isFolderAccessError = (e: unknown) =>
      e instanceof Error && ["drive_error_400", "drive_error_403", "drive_error_404"].includes(e.message);

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
      const label = labelOf(category);
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

      let added = 0;
      for (const file of files) {
        if (seen.has(`${category}:${file.id}`)) continue;
        added += 1;
        inserts.push({
          event_id: data.eventId,
          category,
          drive_file_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          width: file.imageMediaMetadata?.width ?? file.videoMediaMetadata?.width ?? null,
          height: file.imageMediaMetadata?.height ?? file.videoMediaMetadata?.height ?? null,
          is_gif: file.mimeType === "image/gif",
          source: "drive",
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
        report.push(`${label}: ${files.length} file${files.length === 1 ? "" : "s"} found (${added} new)`);
      }
    }

    if (Object.keys(learned).length > 0) {
      await (context.supabase as any).from("events").update(learned).eq("id", data.eventId);
    }

    if (inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += 500) {
        const { error: insertError } = await (context.supabase as any)
          .from("media_items")
          .insert(inserts.slice(i, i + 500));
        if (insertError) throw new Error(insertError.message);
      }
    }

    return { added: inserts.length, driveConnected, foldersFound, report };
  });

export const setMediaFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; published?: boolean; downloadEnabled?: boolean }) => ({
    ids: (input.ids ?? []).map(String),
    published: typeof input.published === "boolean" ? input.published : undefined,
    downloadEnabled: typeof input.downloadEnabled === "boolean" ? input.downloadEnabled : undefined,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.ids.length === 0) return { ok: true };

    const patch: Record<string, boolean> = {};
    if (data.published !== undefined) patch["published"] = data.published;
    if (data.downloadEnabled !== undefined) patch["download_enabled"] = data.downloadEnabled;
    // A file that is not public cannot be downloadable either.
    if (data.published === false) patch["download_enabled"] = false;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await (context.supabase as any)
      .from("media_items")
      .update(patch)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCategoryMediaFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      eventId: string;
      category: MediaCategory;
      published?: boolean;
      downloadEnabled?: boolean;
    }) => ({
      eventId: String(input.eventId),
      category: categoryOf(input.category),
      published: typeof input.published === "boolean" ? input.published : undefined,
      downloadEnabled:
        typeof input.downloadEnabled === "boolean" ? input.downloadEnabled : undefined,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const patch: Record<string, boolean> = {};
    if (data.published !== undefined) patch["published"] = data.published;
    if (data.downloadEnabled !== undefined) patch["download_enabled"] = data.downloadEnabled;
    if (data.published === false) patch["download_enabled"] = false;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await (context.supabase as any)
      .from("media_items")
      .update(patch)
      .eq("event_id", data.eventId)
      .eq("category", data.category);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEventCategoryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; category: MediaCategory; enabled: boolean }) => ({
    eventId: String(input.eventId),
    category: categoryOf(input.category),
    enabled: Boolean(input.enabled),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context.supabase as any)
      .from("events")
      .update({ [`${data.category}_enabled`]: data.enabled })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEventPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; published: boolean }) => ({
    eventId: String(input.eventId),
    published: Boolean(input.published),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context.supabase as any)
      .from("events")
      .update({ published: data.published })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Removes files from the gallery (the database record only). The original
 * file in Google Drive is never touched.
 */
export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => ({ ids: (input.ids ?? []).map(String) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.ids.length === 0) return { removed: 0 };

    let removed = 0;
    for (const ids of chunk(data.ids, 100)) {
      const { data: rows, error } = await (context.supabase as any)
        .from("media_items")
        .delete()
        .in("id", ids)
        .select("id");
      if (error) throw new Error(error.message);
      removed += rows?.length ?? 0;
    }
    return { removed };
  });

/** Removes every file in one category of an event from the gallery. */
export const deleteCategoryMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; category: MediaCategory }) => ({
    eventId: String(input.eventId),
    category: categoryOf(input.category),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: rows, error } = await (context.supabase as any)
      .from("media_items")
      .delete()
      .eq("event_id", data.eventId)
      .eq("category", data.category)
      .select("id");
    if (error) throw new Error(error.message);
    return { removed: rows?.length ?? 0 };
  });

/** Removes every leftover sample/placeholder file from all events. */
export const deleteSampleMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data: rows, error } = await (context.supabase as any)
      .from("media_items")
      .delete()
      .eq("source", "sample")
      .select("id");
    if (error) throw new Error(error.message);
    return { removed: rows?.length ?? 0 };
  });
