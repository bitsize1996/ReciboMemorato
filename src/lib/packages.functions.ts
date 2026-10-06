import { createServerFn } from "@tanstack/react-start";

import type { PublicPackage } from "./product-lines";

/** Public: the packages you offer (never the costs behind them). */
export const listPublicPackages = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPackage[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const run = (fields: string, visibleOnly: boolean) => {
        const query = db.from("packages").select(fields).eq("active", true).order("selling_price", { ascending: true });
        return visibleOnly ? query.eq("show_on_website", true) : query;
      };
      const fields = "id, name, description, included_services, selling_price, service_type, popup_available, product_line";
      // Newer columns only exist after their database setup, so fall back step by step.
      let result = await run(fields, true);
      if (result.error) result = await run(fields, false);
      if (result.error) result = await run("id, name, description, included_services, selling_price", false);
      if (result.error || !result.data) return [];

      // Sample photos (the table exists only after its database setup; no photos until then).
      const photosByPackage = new Map<string, { url: string; caption: string | null }[]>();
      const photoRows = await db
        .from("package_photos")
        .select("package_id, image_url, caption")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      for (const row of (photoRows.error ? [] : photoRows.data ?? []) as any[]) {
        const list = photosByPackage.get(row.package_id) ?? [];
        list.push({ url: row.image_url, caption: row.caption ?? null });
        photosByPackage.set(row.package_id, list);
      }

      return (result.data as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        includedServices: p.included_services ?? null,
        price: Number(p.selling_price) || 0,
        serviceType:
          p.service_type === "made_to_order" ? "made_to_order" : p.service_type === "popup_print" ? "popup_print" : "event",
        productLine: p.product_line ?? null,
        popupAvailable: Boolean(p.popup_available),
        photos: photosByPackage.get(p.id) ?? [],
      }));
    } catch (err) {
      console.error("Failed to load packages", err);
      return [];
    }
  },
);
