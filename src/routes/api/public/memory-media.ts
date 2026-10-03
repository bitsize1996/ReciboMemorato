import { createFileRoute } from "@tanstack/react-router";

// Serves a single approved media file through our own server so that no
// Google credentials, tokens or folder ids ever reach the browser.
// The database decides what is allowed: only files whose event is published,
// whose own "published" switch is on, and — for downloads — whose "allow
// download" switch is on, can be served.
export const Route = createFileRoute("/api/public/memory-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const wantsDownload = url.searchParams.get("dl") === "1";
        if (!id) return new Response("Not found", { status: 404 });

        // Looked up on the server so the public database key never needs to read Drive file ids.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: media } = await db
          .from("media_items")
          .select("id, name, drive_file_id, full_url, mime_type, source, download_enabled, event_id")
          .eq("id", id)
          .eq("published", true)
          .neq("source", "sample")
          .maybeSingle();

        if (!media) return new Response("Not found", { status: 404 });
        const { data: event } = await db
          .from("events")
          .select("published")
          .eq("id", media.event_id)
          .maybeSingle();
        if (!event?.published) return new Response("Not found", { status: 404 });
        if (wantsDownload && !media.download_enabled) {
          return new Response("Not found", { status: 404 });
        }

        // Placeholder sample media lives on a public URL already.
        if (media.source !== "drive" && media.full_url) {
          return Response.redirect(media.full_url, 302);
        }

        const { isDriveConfigured, fetchDriveFile } = await import("@/lib/gallery/drive.server");
        if (!isDriveConfigured()) return new Response("Unavailable", { status: 503 });

        const upstream = await fetchDriveFile(media.drive_file_id, request.headers.get("range"));
        if (!upstream.ok || !upstream.body) {
          console.error(`Media proxy failed [${upstream.status}]`);
          return new Response("Unavailable", { status: 502 });
        }

        const headers = new Headers({
          "content-type":
            upstream.headers.get("content-type") ?? media.mime_type ?? "image/jpeg",
          "cache-control": "public, max-age=86400",
          "accept-ranges": upstream.headers.get("accept-ranges") ?? "bytes",
        });
        for (const name of ["content-length", "content-range"]) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        if (wantsDownload) {
          const safeName = media.name.replace(/["\\]/g, "");
          headers.set("content-disposition", `attachment; filename="${safeName}"`);
        }

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
