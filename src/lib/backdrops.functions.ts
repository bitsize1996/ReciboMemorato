import { createServerFn } from "@tanstack/react-start";

import type { PublicBackdrop } from "./backdrops";

/** Public: the backdrops you offer for the standard photobooth. */
export const listBackdrops = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicBackdrop[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await (supabaseAdmin as any)
        .from("backdrops")
        .select("id, name, category, image_url")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category ?? null,
        imageUrl: row.image_url,
      }));
    } catch (err) {
      console.error("Failed to load backdrops", err);
      return [];
    }
  },
);
