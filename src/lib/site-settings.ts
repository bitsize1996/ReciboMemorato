// Client-safe site customization types and defaults.
// The live values come from the site_settings table (see src/lib/site.functions.ts).

export interface SiteSettings {
  brandLine1: string;
  brandLine2: string;
  brandSub: string;
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  heroDescription: string;
  ctaLabel: string;
  messengerUrl: string;
  finalTitle: string;
  finalTagline: string;
  colorAccent: string;
  colorPaper: string;
  colorInk: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brandLine1: "RECIBO",
  brandLine2: "MEMORATO",
  brandSub: "by the bitsize sibs",
  heroEyebrow: "Photobooth & keepsakes",
  heroTitle: "Your memories deserve more than a *camera roll.*",
  heroLead: "Turn your favorite moments into something you can actually keep.",
  heroDescription:
    "From receipt-inspired photobooths to high-angle shots, Sintra Board prints, and Original Instax prints — Recibo Memorato makes memories tangible.",
  ctaLabel: "Send us a message",
  messengerUrl: "https://m.me/",
  finalTitle: "Don't let your favorite moments live only in your camera roll.",
  finalTagline: "Because memories need proofs.",
  // Hex equivalents of the original OKLCH tokens in src/styles.css.
  colorAccent: "#d40e14",
  colorPaper: "#f9f7f0",
  colorInk: "#150f0c",
};

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Renders text where *stars* become italic (em) — matches the site's
 * editorial emphasis style. Everything else stays plain text.
 */
export function richText(text: string): { em: boolean; part: string }[] {
  return text
    .split(/\*([^*]+)\*/g)
    .filter((part) => part !== "")
    .map((part, i) => ({ em: i % 2 === 1, part }));
}
