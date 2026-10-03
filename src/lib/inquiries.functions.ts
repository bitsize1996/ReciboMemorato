import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface BookingOptions {
  eventTypes: string[];
  packages: { id: string; name: string }[];
}

const DEFAULT_EVENT_TYPES = ["Birthday", "Wedding", "Debut", "Corporate event", "Christening"];

/** Public: choices shown on the booking form (event types and active packages). */
export const getBookingOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingOptions> => {
    let eventTypes = DEFAULT_EVENT_TYPES;
    let packages: { id: string; name: string }[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const [cats, pkgs] = await Promise.all([
        db.from("event_categories").select("name, sort_order").order("sort_order", { ascending: true }),
        db.from("packages").select("id, name").eq("active", true).order("name", { ascending: true }),
      ]);
      const names = ((cats.data ?? []) as { name: string }[]).map((c) => c.name);
      if (names.length > 0) eventTypes = names;
      packages = (pkgs.data ?? []) as { id: string; name: string }[];
    } catch (err) {
      console.error("Failed to load booking options", err);
    }
    return { eventTypes: [...eventTypes, "Other"], packages };
  },
);

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  contact: z.string().trim().min(5, "Please enter a mobile number or Messenger name").max(120),
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(160)]),
  contactMethod: z.enum(["messenger", "call_text", "email"]),
  eventType: z.string().trim().max(60),
  eventDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  venue: z.string().trim().max(200),
  guests: z.union([z.literal(""), z.string().regex(/^\d{1,6}$/)]),
  packageId: z.union([z.literal(""), z.string().uuid()]),
  message: z.string().trim().max(2000),
  company: z.string().max(200).optional(), // hidden spam trap — real people leave it empty
});

/** Public: saves a booking inquiry from the website form. */
export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; reference: string }> => {
    // Spam trap: pretend it worked, store nothing.
    if (data.company) return { ok: true, reference: "INQ-0000" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Gentle rate limit: no more than 3 inquiries per contact in 10 minutes.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("contact", data.contact)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("You've already sent a few messages. Please wait a few minutes.");

    let packageName: string | null = null;
    if (data.packageId) {
      const { data: pkg } = await db.from("packages").select("name").eq("id", data.packageId).maybeSingle();
      packageName = pkg?.name ?? null;
    }

    const { data: row, error } = await db
      .from("inquiries")
      .insert({
        name: data.name,
        contact: data.contact,
        email: data.email || null,
        contact_method: data.contactMethod,
        event_type: data.eventType || null,
        event_date: data.eventDate || null,
        venue: data.venue || null,
        guests: data.guests ? Number(data.guests) : null,
        package_id: data.packageId || null,
        package_interest: packageName,
        message: data.message || null,
        source: "website",
        status: "new",
      })
      .select("inquiry_number")
      .single();
    if (error || !row) {
      console.error("Failed to save inquiry", error);
      throw new Error("We couldn't send your inquiry. Please try again or message us directly.");
    }
    return { ok: true, reference: `INQ-${String(row.inquiry_number).padStart(4, "0")}` };
  });
