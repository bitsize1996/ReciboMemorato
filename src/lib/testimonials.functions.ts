import { createServerFn } from "@tanstack/react-start";

import type { PublicTestimonial } from "./testimonials";

/** Public: the reviews you chose to show. */
export const listTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicTestimonial[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await (supabaseAdmin as any)
        .from("testimonials")
        .select("id, name, label, quote, rating, image_url, source, featured")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error || !data) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        label: row.label ?? null,
        quote: row.quote,
        rating: Number(row.rating) || 5,
        imageUrl: row.image_url ?? null,
        source: row.source ?? null,
        featured: Boolean(row.featured),
      }));
    } catch (err) {
      console.error("Failed to load reviews", err);
      return [];
    }
  },
);
