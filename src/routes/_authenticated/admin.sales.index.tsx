import { createFileRoute } from "@tanstack/react-router";

import { SalesBoard } from "@/components/admin/SalesBoard";

export const Route = createFileRoute("/_authenticated/admin/sales/")({
  head: () => ({ meta: [{ title: "All sales | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <SalesBoard />,
});
