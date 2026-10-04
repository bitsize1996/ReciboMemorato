import { createServerFn } from "@tanstack/react-start";

import type { ShowcaseItem } from "./showcase";

/** Public: finished made-to-order work the owner chose to show ("proof of orders"). */
export const listOrderProofs = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShowcaseItem[]> => {
    try {
      const { publicSupabase } = await import("./gallery/events.server");
      const { data, error } = await (publicSupabase() as any)
        .from("order_showcase")
        .select("id, title, product, image_url, caption, customer_label, completed_on")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error || !data) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        product: row.product,
        imageUrl: row.image_url,
        caption: row.caption ?? null,
        customerLabel: row.customer_label ?? null,
        completedOn: row.completed_on ?? null,
      }));
    } catch (err) {
      console.error("Failed to load order proofs", err);
      return [];
    }
  },
);
