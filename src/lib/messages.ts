import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { n, peso, saleCode, statusLabel } from "./finance";
import { inquiryCode, type InquiryRow } from "./inquiries";

/** "RECIBO" + "MEMORATO" from the settings becomes "Recibo Memorato". */
export function brandName(s?: { brandLine1?: string; brandLine2?: string } | null): string {
  const raw = [s?.brandLine1, s?.brandLine2].filter(Boolean).join(" ") || "Recibo Memorato";
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Private business details (your email, how customers pay). Empty until you fill them in. */
export function useBusinessInfo() {
  return useQuery({
    queryKey: ["biz", "business-info"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("business_info")
        .select("contact_email, payment_instructions")
        .eq("id", 1)
        .maybeSingle();
      if (error) return { ready: false, email: "", paymentInstructions: "" };
      return {
        ready: true,
        email: (data?.contact_email ?? "") as string,
        paymentInstructions: (data?.payment_instructions ?? "") as string,
      };
    },
  });
}

/**
 * Opens a ready-to-send Gmail message. `from` picks which signed-in Google
 * account to use, so it always goes out from your Recibo Memorato address.
 */
export function gmailComposeUrl(opts: { from?: string | undefined; to?: string | undefined; subject: string; body: string }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", su: opts.subject, body: opts.body });
  if (opts.to) params.set("to", opts.to);
  if (opts.from) params.set("authuser", opts.from);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

interface SaleLike {
  sale_number: number | null;
  customer_name: string;
  event_name: string | null;
  event_date: string | null;
  event_time: string | null;
  package_name_snapshot: string | null;
  quantity: number | null;
  selling_price: unknown;
  discount: unknown;
  amount_paid: unknown;
  payment_status: string;
  event_theme?: string | null;
  event_venue?: string | null;
  sale_addons?: { name_snapshot: string; quantity: unknown; total_price: unknown }[] | null;
}

export function invoiceMessage(sale: SaleLike, brand: string, paymentInstructions: string) {
  const addons = sale.sale_addons ?? [];
  const addonsTotal = addons.reduce((a, x) => a + n(x.total_price), 0);
  const total = n(sale.selling_price) + addonsTotal - n(sale.discount);
  const balance = total - n(sale.amount_paid);
  const when = [sale.event_date, sale.event_time].filter(Boolean).join(" · ");
  const lines = [
    `Hi ${sale.customer_name},`,
    "",
    `Here is your invoice ${saleCode(sale.sale_number)} from ${brand}.`,
    "",
    sale.event_name ? `Event: ${sale.event_name}${when ? ` (${when})` : ""}` : when ? `Event date: ${when}` : "",
    sale.event_theme ? `Theme: ${sale.event_theme}` : "",
    sale.event_venue ? `Location: ${sale.event_venue}` : "",
    `Package: ${sale.package_name_snapshot ?? "Photobooth service"}${n(sale.quantity) > 1 ? ` × ${n(sale.quantity)}` : ""} — ${peso(sale.selling_price)}`,
    ...(addons.length > 0
      ? ["Add-ons:", ...addons.map((a) => `  • ${a.name_snapshot}${n(a.quantity) > 1 ? ` × ${n(a.quantity)}` : ""} — ${peso(a.total_price)}`)]
      : []),
    "",
    `Total: ${peso(total)}`,
    n(sale.discount) > 0 ? `(includes a discount of ${peso(sale.discount)})` : "",
    `Paid so far: ${peso(sale.amount_paid)}`,
    `Balance due: ${peso(balance)}`,
    `Status: ${statusLabel(sale.payment_status)}`,
    paymentInstructions ? `\nHow to pay:\n${paymentInstructions}` : "",
    "",
    "Thank you! Because memories need proofs.",
    brand,
  ];
  return {
    subject: `Invoice ${saleCode(sale.sale_number)} — ${brand}`,
    body: lines.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n").trim(),
  };
}

export interface InquiryChoice {
  packageName: string | null;
  addons: { name: string; quantity: number; price: number }[];
  estimate: number;
}

export function inquiryReplyMessage(inquiry: InquiryRow, brand: string, choice?: InquiryChoice) {
  const details = [inquiry.event_type, inquiry.theme ? `theme: ${inquiry.theme}` : null, inquiry.event_date, inquiry.venue]
    .filter(Boolean)
    .join(" · ");
  const chosen =
    choice && (choice.packageName || choice.addons.length > 0)
      ? [
          "What you picked:",
          choice.packageName ? `• Package: ${choice.packageName}` : "",
          ...choice.addons.map((a) => `• Add-on: ${a.name}${a.quantity > 1 ? ` × ${a.quantity}` : ""}`),
          choice.estimate > 0 ? `Estimated total: ${peso(choice.estimate)} (we'll confirm the final quote).` : "",
          "",
        ]
      : [];
  const lines = [
    `Hi ${inquiry.name},`,
    "",
    `Thank you for your inquiry (${inquiryCode(inquiry.inquiry_number)}) with ${brand}!`,
    details ? `We received your details: ${details}.` : "",
    "",
    ...chosen,
    "We'd love to be part of your event. To prepare your quote, could you please confirm:",
    "• the event date and start time",
    "• the venue",
    "• roughly how many guests",
    "",
    "We'll reply with availability and pricing right away.",
    "",
    "Warm regards,",
    brand,
  ];
  return {
    subject: `Your inquiry ${inquiryCode(inquiry.inquiry_number)} — ${brand}`,
    body: lines.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n").trim(),
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
