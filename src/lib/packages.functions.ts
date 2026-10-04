import { createServerFn } from "@tanstack/react-start";

import type { PublicPackage } from "./product-lines";

/** Public: the packages you offer (never the costs behind them). */
export const listPublicPackages = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPackage[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const run = (fields: string) =>
        db.from("packages").select(fields).eq("active", true).order("selling_price", { ascending: true });
      let result = await run("id, name, description, included_services, selling_price, service_type, popup_available, product_line");
      if (result.error) result = await run("id, name, description, included_services, selling_price");
      if (result.error || !result.data) return [];
      return (result.data as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        includedServices: p.included_services ?? null,
        price: Number(p.selling_price) || 0,
        serviceType: p.service_type === "made_to_order" ? "made_to_order" : "event",
        productLine: p.product_line ?? null,
        popupAvailable: Boolean(p.popup_available),
      }));
    } catch (err) {
      console.error("Failed to load packages", err);
      return [];
    }
  },
);
