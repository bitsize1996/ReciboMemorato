import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SETTINGS, HEX_RE, type SiteSettings } from "./site-settings";

const ROW_FIELDS =
  "brand_line1, brand_line2, brand_sub, hero_eyebrow, hero_title, hero_lead, hero_description, cta_label, messenger_url, final_title, final_tagline, color_accent, color_paper, color_ink";

interface SettingsRow {
  brand_line1: string;
  brand_line2: string;
  brand_sub: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_lead: string;
  hero_description: string;
  cta_label: string;
  messenger_url: string;
  final_title: string;
  final_tagline: string;
  color_accent: string;
  color_paper: string;
  color_ink: string;
}

function toSettings(row: SettingsRow): SiteSettings {
  return {
    brandLine1: row.brand_line1,
    brandLine2: row.brand_line2,
    brandSub: row.brand_sub,
    heroEyebrow: row.hero_eyebrow,
    heroTitle: row.hero_title,
    heroLead: row.hero_lead,
    heroDescription: row.hero_description,
    ctaLabel: row.cta_label,
    messengerUrl: row.messenger_url,
    finalTitle: row.final_title,
    finalTagline: row.final_tagline,
    colorAccent: row.color_accent,
    colorPaper: row.color_paper,
    colorInk: row.color_ink,
  };
}

/** Public: the whole website reads these. Never throws — falls back to defaults. */
export const getSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    try {
      const { publicSupabase } = await import("./gallery/events.server");
      const { data, error } = await (publicSupabase() as any)
        .from("site_settings")
        .select(ROW_FIELDS)
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return DEFAULT_SETTINGS;
      return toSettings(data as SettingsRow);
    } catch (err) {
      console.error("Failed to load site settings", err);
      return DEFAULT_SETTINGS;
    }
  },
);

const schema = z.object({
  brandLine1: z.string().min(1).max(40),
  brandLine2: z.string().min(1).max(40),
  brandSub: z.string().max(80),
  heroEyebrow: z.string().max(80),
  heroTitle: z.string().min(1).max(200),
  heroLead: z.string().max(200),
  heroDescription: z.string().max(500),
  ctaLabel: z.string().min(1).max(60),
  messengerUrl: z.string().max(300),
  finalTitle: z.string().max(200),
  finalTagline: z.string().max(120),
  colorAccent: z.string().regex(HEX_RE),
  colorPaper: z.string().regex(HEX_RE),
  colorInk: z.string().regex(HEX_RE),
});

/** Admin only: saves the customization from the admin Customize page. */
export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleData, error: roleError } = await (context.supabase as any).rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !roleData) throw new Error("Forbidden");

    const { error } = await (context.supabase as any)
      .from("site_settings")
      .update({
        brand_line1: data.brandLine1,
        brand_line2: data.brandLine2,
        brand_sub: data.brandSub,
        hero_eyebrow: data.heroEyebrow,
        hero_title: data.heroTitle,
        hero_lead: data.heroLead,
        hero_description: data.heroDescription,
        cta_label: data.ctaLabel,
        messenger_url: data.messengerUrl,
        final_title: data.finalTitle,
        final_tagline: data.finalTagline,
        color_accent: data.colorAccent,
        color_paper: data.colorPaper,
        color_ink: data.colorInk,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error("Could not save settings");
    return { ok: true };
  });

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: () => getSiteSettings(),
});
