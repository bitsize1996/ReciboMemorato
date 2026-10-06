import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface BookingPackage {
  id: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  price: number;
}

export interface BookingAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

export interface BookingOptions {
  eventTypes: string[];
  packages: BookingPackage[];
  addons: BookingAddon[];
}

const DEFAULT_EVENT_TYPES = ["Birthday", "Wedding", "Debut", "Corporate event", "Christening"];

/** Public: choices shown on the booking form (event types, packages and add-ons). */
export const getBookingOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingOptions> => {
    let eventTypes = DEFAULT_EVENT_TYPES;
    let packages: BookingPackage[] = [];
    let addons: BookingAddon[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      // Only event services belong on the event booking form (made-to-order items get their own order form).
      const packageQuery = () =>
        db
          .from("packages")
          .select("id, name, description, included_services, selling_price")
          .eq("active", true)
          .order("selling_price", { ascending: true });
      const loadPackages = async () => {
        // Event services you chose to show on the website; fall back if a column isn't there yet.
        const shown = await packageQuery().eq("service_type", "event").eq("show_on_website", true);
        if (!shown.error) return shown;
        const filtered = await packageQuery().eq("service_type", "event");
        return filtered.error ? await packageQuery() : filtered;
      };
      const [cats, pkgs, adds] = await Promise.all([
        db.from("event_categories").select("name, sort_order").order("sort_order", { ascending: true }),
        loadPackages(),
        db
          .from("addons")
          .select("id, name, description, price")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      const names = ((cats.data ?? []) as { name: string }[]).map((c) => c.name);
      if (names.length > 0) eventTypes = names;
      packages = ((pkgs.data ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        includedServices: p.included_services ?? null,
        price: Number(p.selling_price) || 0,
      }));
      addons = ((adds.data ?? []) as any[]).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? null,
        price: Number(a.price) || 0,
      }));
    } catch (err) {
      console.error("Failed to load booking options", err);
    }
    return { eventTypes: [...eventTypes, "Other"], packages, addons };
  },
);

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  contact: z.string().trim().min(5, "Please enter a mobile number or Messenger name").max(120),
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(160)]),
  contactMethod: z.enum(["messenger", "call_text", "email"]),
  eventType: z.string().trim().max(60),
  theme: z.string().trim().max(120),
  eventDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  venue: z.string().trim().max(200),
  guests: z.union([z.literal(""), z.string().regex(/^\d{1,6}$/)]),
  packageId: z.union([z.literal(""), z.string().uuid()]),
  addons: z
    .array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .max(30),
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

    const payload = {
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
    };
    const insertInquiry = (body: Record<string, unknown>) =>
      db.from("inquiries").insert(body).select("id, inquiry_number").single();
    let { data: row, error } = await insertInquiry({ ...payload, theme: data.theme || null });
    if (error && /theme/i.test(error.message)) {
      // The theme column only exists after its database setup; keep the theme in the notes until then.
      ({ data: row, error } = await insertInquiry({
        ...payload,
        message: [data.theme ? `Theme: ${data.theme}` : "", data.message].filter(Boolean).join("\n") || null,
      }));
    }
    if (!error && row && data.addons.length > 0) {
      // Names and prices come from the database, never from the browser.
      const { data: catalog } = await db
        .from("addons")
        .select("id, name, price")
        .eq("active", true)
        .in("id", data.addons.map((a) => a.id));
      const byId = new Map(((catalog ?? []) as { id: string; name: string; price: number }[]).map((a) => [a.id, a]));
      const lines = data.addons
        .filter((a) => byId.has(a.id))
        .map((a) => ({
          inquiry_id: row.id,
          addon_id: a.id,
          name_snapshot: byId.get(a.id)!.name,
          price_snapshot: Number(byId.get(a.id)!.price) || 0,
          quantity: a.quantity,
        }));
      if (lines.length > 0) await db.from("inquiry_addons").insert(lines);
    }
    if (error || !row) {
      console.error("Failed to save inquiry", error);
      throw new Error("We couldn't send your inquiry. Please try again or message us directly.");
    }
    return { ok: true, reference: `INQ-${String(row.inquiry_number).padStart(4, "0")}` };
  });
