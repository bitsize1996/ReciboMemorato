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

    const { count: removedCount, error: removedError } = await (context.supabase as any)
      .from("media_exclusions")
      .select("event_id", { count: "exact", head: true })
      .eq("event_id", data.eventId);

    const { isDriveConfigured } = await import("./gallery/drive.server");
    return {
      event,
      stats,
      samplesTotal: samplesTotal ?? 0,
      removedCount: removedError ? 0 : (removedCount ?? 0),
      driveConnected: isDriveConfigured(),
    };
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
      .order("drive_created_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
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

    const { isDriveConfigured } = await import("./gallery/drive.server");
    const driveConnected = isDriveConfigured();
    if (!driveConnected) {
      throw new Error("Google Drive isn't connected yet, so there is nothing to check.");
    }

    const { syncEventFromDrive } = await import("./gallery/sync.server");
    const result = await syncEventFromDrive(context.supabase, event, {
      autoPublish: event.auto_publish === true,
      autoDownloads: event.auto_downloads === true,
    });
    return { ...result, driveConnected };
  });

/** Turns automatic Drive checking / publishing on or off for an event. */
export const setEventLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { eventId: string; autoSync: boolean; autoPublish: boolean; autoDownloads: boolean }) => ({
      eventId: String(input.eventId),
      autoSync: Boolean(input.autoSync),
      autoPublish: Boolean(input.autoPublish),
      autoDownloads: Boolean(input.autoDownloads),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context.supabase as any)
      .from("events")
      .update({
        auto_sync: data.autoSync,
        auto_publish: data.autoPublish,
        auto_downloads: data.autoDownloads,
      })
      .eq("id", data.eventId);
    if (error) {
      throw new Error(
        /auto_/i.test(error.message)
          ? "Live sync needs a one-time database setup first."
          : error.message,
      );
    }
    return { ok: true };
  });

/** Lets files that were removed earlier come back the next time Drive is checked. */
export const clearRemovedFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context.supabase as any)
      .from("media_exclusions")
      .delete()
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
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

/** Remembers removed Drive files so automatic sync doesn't re-add them. */
async function rememberRemoved(
  db: any,
  rows: { event_id: string; category: string; drive_file_id: string; source?: string }[],
) {
  const exclusions = rows
    .filter((row) => !row.source || row.source === "drive")
    .map(({ event_id, category, drive_file_id }) => ({ event_id, category, drive_file_id }));
  for (let i = 0; i < exclusions.length; i += 200) {
    // Ignore errors: the table only exists once the live sync setup has been run.
    await db
      .from("media_exclusions")
      .upsert(exclusions.slice(i, i + 200), {
        onConflict: "event_id,category,drive_file_id",
        ignoreDuplicates: true,
      });
  }
}

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
      const { data: toRemove } = await (context.supabase as any)
        .from("media_items")
        .select("event_id, category, drive_file_id, source")
        .in("id", ids);
      await rememberRemoved(context.supabase, toRemove ?? []);
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
    for (let from = 0; ; from += 1000) {
      const { data: toRemove } = await (context.supabase as any)
        .from("media_items")
        .select("event_id, category, drive_file_id, source")
        .eq("event_id", data.eventId)
        .eq("category", data.category)
        .range(from, from + 999);
      if (!toRemove || toRemove.length === 0) break;
      await rememberRemoved(context.supabase, toRemove);
      if (toRemove.length < 1000) break;
    }
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
