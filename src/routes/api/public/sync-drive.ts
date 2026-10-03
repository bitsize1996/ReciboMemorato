import { createFileRoute } from "@tanstack/react-router";

// Optional scheduled job: checks Google Drive for every live event, even when
// nobody has a gallery open. Called every minute by an external scheduler as
//   https://SITE/api/public/sync-drive?key=CRON_SECRET
async function run({ request }: { request: Request }): Promise<Response> {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return new Response("Not configured", { status: 503 });

  const provided =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("key");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isDriveConfigured } = await import("@/lib/gallery/drive.server");
  if (!isDriveConfigured()) return Response.json({ ok: false, reason: "drive_not_connected" });

  const db = supabaseAdmin as any;
  const { data: events, error } = await db
    .from("events")
    .select("*")
    .eq("published", true)
    .eq("auto_sync", true);
  if (error) return Response.json({ ok: false, reason: "database_not_ready" });

  const { syncEventFromDrive } = await import("@/lib/gallery/sync.server");
  let checked = 0;
  let added = 0;
  for (const event of events ?? []) {
    const cutoff = new Date(Date.now() - 20_000).toISOString();
    const { data: claimed } = await db
      .from("events")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", event.id)
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    try {
      const result = await syncEventFromDrive(db, event, {
        autoPublish: event.auto_publish === true,
        autoDownloads: event.auto_downloads === true,
      });
      checked += 1;
      added += result.added;
    } catch (err) {
      console.error(`Scheduled sync failed for ${event.slug}`, err);
    }
  }
  return Response.json({ ok: true, checked, added });
}

export const Route = createFileRoute("/api/public/sync-drive")({
  server: { handlers: { GET: run, POST: run } },
});
