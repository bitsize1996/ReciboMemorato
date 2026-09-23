import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaCategory } from "./gallery/types";

const CATEGORIES = ["print", "digitals", "gif", "singles"] as const;

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

const FOLDER_COLUMN: Record<MediaCategory, string> = {
  print: "print_folder_id",
  digitals: "digitals_folder_id",
  gif: "gif_folder_id",
  singles: "singles_folder_id",
};

export const adminGetEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: eventRow, error } = await (context.supabase as any)      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !event) throw new Error("Event not found");

    const { data: rows, error: mediaError } = await (context.supabase as any)      .from("media_items")
      .select("category, published, download_enabled")
      .eq("event_id", data.eventId);
    if (mediaError) throw new Error("Could not load gallery");

    const stats = {
      total: rows?.length ?? 0,
      published: 0,
      unpublished: 0,
      downloadsOn: 0,
      downloadsOff: 0,
      byCategory: { print: 0, digitals: 0, gif: 0, singles: 0 } as Record<MediaCategory, number>,
    };
    for (const row of rows ?? []) {
      if (row.published) stats.published += 1;
      else stats.unpublished += 1;
      if (row.download_enabled) stats.downloadsOn += 1;
      else stats.downloadsOff += 1;
      stats.byCategory[row.category as MediaCategory] += 1;
    }

    const { isDriveConfigured } = await import("./gallery/drive.server");
    return { event, stats, driveConnected: isDriveConfigured() };
  });

export const adminListMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; category: MediaCategory }) => ({
    eventId: String(input.eventId),
    category: categoryOf(input.category),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: rows, error } = await (context.supabase as any)      .from("media_items")
      .select("id, name, thumb_url, full_url, is_gif, source, published, download_enabled, created_at")
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
 * until the owner says so. When Drive is not connected yet, clearly marked
 * sample files are created instead.
 */
export const syncEventMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);

    const { data: eventRow, error } = await (context.supabase as any)      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !event) throw new Error("Event not found");

    const { isDriveConfigured, listAllDriveFiles } = await import("./gallery/drive.server");
    const { buildMockFiles } = await import("./gallery/mock.server");
    const driveConnected = isDriveConfigured();

    const { data: existing } = await (context.supabase as any)      .from("media_items")
      .select("category, drive_file_id")
      .eq("event_id", data.eventId);
    const seen = new Set(
      (existing ?? []).map((row: any) => `${row.category}:${row.drive_file_id}`),
    );

    const inserts: Record<string, unknown>[] = [];
    let usedSamples = false;

    for (const category of CATEGORIES) {
      const folderId = event[FOLDER_COLUMN[category]] as string | null;

      if (driveConnected && folderId) {
        let files;
        try {
          files = await listAllDriveFiles(folderId);
        } catch {
          throw new Error("Could not reach Google Drive. Please try again shortly.");
        }
        for (const file of files) {
          if (seen.has(`${category}:${file.id}`)) continue;
          inserts.push({
            event_id: data.eventId,
            category,
            drive_file_id: file.id,
            name: file.name,
            mime_type: file.mimeType,
            width: file.imageMediaMetadata?.width ?? null,
            height: file.imageMediaMetadata?.height ?? null,
            is_gif: file.mimeType === "image/gif",
            source: "drive",
          });
        }
      } else {
        usedSamples = true;
        for (const file of buildMockFiles(data.eventId, category)) {
          if (seen.has(`${category}:${file.drive_file_id}`)) continue;
          inserts.push({
            event_id: data.eventId,
            category,
            drive_file_id: file.drive_file_id,
            name: file.name,
            mime_type: file.mime_type,
            width: file.width,
            height: file.height,
            thumb_url: file.thumb_url,
            full_url: file.full_url,
            is_gif: file.mime_type === "image/gif",
            source: "sample",
          });
        }
      }
    }

    if (inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += 500) {
        const { error: insertError } = await (context.supabase as any)          .from("media_items")
          .insert(inserts.slice(i, i + 500));
        if (insertError) throw new Error(insertError.message);
      }
    }

    return { added: inserts.length, driveConnected, usedSamples };
  });

export const setMediaFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; published?: boolean; downloadEnabled?: boolean }) => ({
    ids: (input.ids ?? []).map(String),
    published: typeof input.published === "boolean" ? input.published : undefined,
    downloadEnabled:
      typeof input.downloadEnabled === "boolean" ? input.downloadEnabled : undefined,
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

    const { error } = await (context.supabase as any)      .from("media_items")
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

    const { error } = await (context.supabase as any)      .from("media_items")
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
    const { error } = await (context.supabase as any)      .from("events")
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
    const { error } = await (context.supabase as any)      .from("events")
      .update({ published: data.published })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
