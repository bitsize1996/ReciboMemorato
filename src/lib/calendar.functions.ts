import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

/** Creates or updates the booking in the owner's Google Calendar (primary). */
export const syncSaleToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { saleId: string }) => ({ saleId: String(input.saleId) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const calKey = process.env["GOOGLE_CALENDAR_API_KEY"];
    if (!lovableKey || !calKey) return { ok: false, message: "Google Calendar is not connected." };

    const { data: s, error } = await sb.from("sales").select("*").eq("id", data.saleId).maybeSingle();
    if (error || !s) throw new Error("Sale not found");
    if (!s.event_date) return { ok: false, message: "Add an event date first." };

    const title = `${s.event_name || "Booking"} — ${s.customer_name}`;
    const description = [
      s.package_name_snapshot && `Package: ${s.package_name_snapshot}`,
      s.customer_contact && `Contact: ${s.customer_contact}`,
      s.customer_email && `Email: ${s.customer_email}`,
      s.notes,
    ].filter(Boolean).join("\n");

    let when: Record<string, unknown>;
    if (s.event_time && /^\d{2}:\d{2}$/.test(s.event_time)) {
      const start = `${s.event_date}T${s.event_time}:00`;
      const [h, m] = s.event_time.split(":").map(Number);
      const endH = String(Math.min(h + 4, 23)).padStart(2, "0");
      when = {
        start: { dateTime: start, timeZone: "Asia/Manila" },
        end: { dateTime: `${s.event_date}T${endH}:${String(m).padStart(2, "0")}:00`, timeZone: "Asia/Manila" },
      };
    } else {
      const next = new Date(`${s.event_date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      when = { start: { date: s.event_date }, end: { date: next.toISOString().slice(0, 10) } };
    }

    const body = JSON.stringify({ summary: title, description, ...when });
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": calKey,
      "Content-Type": "application/json",
    };
    const url = s.gcal_event_id
      ? `${GATEWAY}/calendars/primary/events/${encodeURIComponent(s.gcal_event_id)}`
      : `${GATEWAY}/calendars/primary/events`;
    const res = await fetch(url, { method: s.gcal_event_id ? "PATCH" : "POST", headers, body });
    if (!res.ok) {
      console.error(`Google Calendar failed [${res.status}]: ${await res.text()}`);
      return { ok: false, message: "Could not reach Google Calendar. Try again shortly." };
    }
    const ev = (await res.json()) as { id: string };
    await sb.from("sales").update({ gcal_event_id: ev.id }).eq("id", s.id);
    return { ok: true, message: s.gcal_event_id ? "Updated in Google Calendar." : "Added to Google Calendar." };
  });
