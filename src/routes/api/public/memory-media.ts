import { createFileRoute } from "@tanstack/react-router";

// Streams a Google Drive image through the server so that no credentials,
// tokens or folder ids ever reach the browser. Only ids signed by this
// server (handed out by the gallery listing) are accepted.
export const Route = createFileRoute("/api/public/memory-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const sig = url.searchParams.get("sig");
        if (!id || !sig) return new Response("Not found", { status: 404 });

        const { verifyFileId, isDriveConfigured, fetchDriveFile } = await import(
          "@/lib/gallery/drive.server"
        );
        if (!isDriveConfigured() || !verifyFileId(id, sig)) {
          return new Response("Not found", { status: 404 });
        }

        const upstream = await fetchDriveFile(id);
        if (!upstream.ok || !upstream.body) {
          console.error(`Media proxy failed [${upstream.status}]`);
          return new Response("Unavailable", { status: 502 });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});
