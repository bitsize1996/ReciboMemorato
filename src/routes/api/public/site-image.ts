import { createFileRoute } from "@tanstack/react-router";

/** Public delivery for owner-uploaded landing-page images in private storage. */
export const Route = createFileRoute("/api/public/site-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path");
        if (!path || !/^site\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("site-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const extension = path.split(".").pop();
        const type = extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : "image/webp";
        return new Response(data.stream(), { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
      },
    },
  },
});