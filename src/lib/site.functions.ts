import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SETTINGS, HEX_RE, type SiteSettings } from "./site-settings";
import { normalizeHome, SECTION_KEYS } from "./site-homepage";

const ROW_FIELDS =
  "brand_line1, brand_line2, brand_sub, hero_eyebrow, hero_title, hero_lead, hero_description, cta_label, messenger_url, final_title, final_tagline, color_accent, color_paper, color_ink, homepage_content";

interface SettingsRow {
  homepage_content: unknown;
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
    homepage: normalizeHome(row.homepage_content),
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
  homepage: z.object({
    sectionOrder: z.array(z.enum(SECTION_KEYS)).length(SECTION_KEYS.length),
    hiddenSections: z.array(z.enum(SECTION_KEYS)),
    logoImage: z.string().max(1000),
    heroBackImage: z.string().max(1000), heroReceiptImage: z.string().max(1000), heroFrontImage: z.string().max(1000),
    heroStamp: z.string().max(200), heroBackCaption: z.string().max(200), heroReceiptNumber: z.string().max(200), heroReceiptFooter: z.string().max(200), heroFrontCaption: z.string().max(200),
    heroSteps: z.array(z.string().max(200)).length(3),
    problemHeading: z.string().max(500), problemParagraphs: z.array(z.string().max(1500)).length(2), problemQuote: z.string().max(500), problemClosing: z.string().max(500),
    solutionEyebrow: z.string().max(200), solutionHeading: z.string().max(500), solutionParagraphs: z.array(z.string().max(1500)).length(2), solutionClosing: z.string().max(500), solutionButton: z.string().max(200),
    servicesEyebrow: z.string().max(200), servicesHeading: z.string().max(500), servicesIntro: z.string().max(1000),
    services: z.array(z.object({ title: z.string().max(200), tagline: z.string().max(300), body: z.string().max(1500), image: z.string().max(1000) })).length(5),
    storyImage: z.string().max(1000), storyEyebrow: z.string().max(200), storyHeading: z.string().max(500), storyLead: z.string().max(1000), storyPoints: z.array(z.string().max(300)).length(4), storyBody: z.string().max(1500), storyClosing: z.string().max(500), storyImageCaption: z.string().max(200),
    proofEyebrow: z.string().max(200), proofHeading: z.string().max(500), proofIntro: z.string().max(1000),
    proofImages: z.array(z.object({ image: z.string().max(1000), caption: z.string().max(200) })).length(3),
    archiveEyebrow: z.string().max(200), archiveHeading: z.string().max(500), archiveIntro: z.string().max(1000), archiveLink: z.string().max(200),
    offerEyebrow: z.string().max(200), offerHeading: z.string().max(500), offerBody: z.string().max(1500), offerReceiptHeading: z.string().max(200),
    faqEyebrow: z.string().max(200), faqHeading: z.string().max(500), faqs: z.array(z.object({ question: z.string().max(300), answer: z.string().max(2000) })).max(30),
    finalEyebrow: z.string().max(200), finalLines: z.array(z.string().max(300)).length(4), finalSmall: z.string().max(300),
    footerDescription: z.string().max(500), footerClosing: z.string().max(300),
  }),
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
        homepage_content: data.homepage,
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

/** Owner-only upload for homepage and logo photos. */
export const uploadSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().max(200),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64: z.string().max(11_000_000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await (context.supabase as any).rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (roleError || !admin) throw new Error("Forbidden");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller.");
    const ext = data.contentType === "image/jpeg" ? "jpg" : data.contentType.split("/")[1];
    const path = `site/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("site-images").upload(path, bytes, { contentType: data.contentType, cacheControl: "3600" });
    if (error) throw new Error("Could not upload image");
    return { url: `/api/public/site-image?path=${encodeURIComponent(path)}` };
  });
