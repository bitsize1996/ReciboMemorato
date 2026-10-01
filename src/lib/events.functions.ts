import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify access");
  if (!data) throw new Error("Forbidden");
}

/**
 * Optional safety net for the first-owner claim. When ADMIN_EMAIL is set,
 * only the account with that email may claim owner access; when it is not
 * set, behaviour is unchanged (first signed-in account can claim).
 */
function mayClaimAdmin(claims: unknown): boolean {
  const allowed = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
  if (!allowed) return true;
  const email = (claims as { email?: string } | undefined)?.email?.trim().toLowerCase();
  return email === allowed;
}

export interface EventInput {
  id?: string | null;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  cover_url: string | null;
  drive_folder_id: string | null;
  digitals_folder_id: string | null;
  gif_folder_id: string | null;
  singles_folder_id: string | null;
  published: boolean;
  sort_order: number;
  category_id?: string | null;
}

export const listEventCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("event_categories")
    .select("id, name, slug")
    .order("name", { ascending: true });
  if (error) throw new Error("Could not load event categories");
  return data ?? [];
});

export const saveEventCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string | null; name: string }) => ({
    id: input.id ? String(input.id) : null,
    name: String(input.name).trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (!data.name) throw new Error("Category name is required");
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) throw new Error("Category name is invalid");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = data.id
      ? supabaseAdmin.from("event_categories").update({ name: data.name, slug }).eq("id", data.id)
      : supabaseAdmin.from("event_categories").insert({ name: data.name, slug });
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEventCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error("Move the events out of this category before deleting it.");
    const { error } = await supabaseAdmin.from("event_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadEventCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; fileName: string; contentType: string; base64: string }) => ({
    eventId: String(input.eventId),
    fileName: String(input.fileName),
    contentType: String(input.contentType),
    base64: String(input.base64),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.contentType)) {
      throw new Error("Cover photo must be JPG, PNG, or WebP.");
    }
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Cover photo must be 8 MB or smaller.");
    const ext = data.contentType === "image/jpeg" ? "jpg" : data.contentType.split("/")[1];
    const path = `${data.eventId}/cover-${Date.now()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("event-covers").upload(path, bytes, {
      contentType: data.contentType,
      upsert: true,
      cacheControl: "3600",
    });
    if (error) throw new Error(error.message);
    const { data: publicUrl } = supabaseAdmin.storage.from("event-covers").getPublicUrl(path);
    return { url: publicUrl.publicUrl };
  });

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (data) return { isAdmin: true, canClaim: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    return {
      isAdmin: false,
      canClaim: (count ?? 0) === 0 && mayClaimAdmin((context as any).claims),
    };
  });

/** The very first signed-in account may claim owner access while none exists. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!mayClaimAdmin((context as any).claims)) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error("Could not grant access");
    return { ok: true };
  });

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("events")
      .select("*")
      .order("sort_order", { ascending: false })
      .order("event_date", { ascending: false });
    if (error) throw new Error("Could not load events");
    return data ?? [];
  });

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EventInput) => {
    if (!input.name?.trim()) throw new Error("Event name is required");
    if (!input.slug?.trim()) throw new Error("Event link is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const payload = {
      slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
      name: data.name.trim(),
      event_date: data.event_date || null,
      location: data.location || null,
      cover_url: data.cover_url || null,
      drive_folder_id: data.drive_folder_id || null,
      digitals_folder_id: data.digitals_folder_id || null,
      gif_folder_id: data.gif_folder_id || null,
      singles_folder_id: data.singles_folder_id || null,
      published: data.published,
      sort_order: Number(data.sort_order) || 0,
      category_id: data.category_id || null,
    };

    const query = data.id
      ? context.supabase.from("events").update(payload).eq("id", data.id)
      : context.supabase.from("events").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
