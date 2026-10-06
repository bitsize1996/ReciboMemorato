import { createFileRoute } from "@tanstack/react-router";

import { SalesBoard } from "@/components/admin/SalesBoard";

export const Route = createFileRoute("/_authenticated/admin/sales/orders")({
  head: () => ({ meta: [{ title: "Made-to-order sales | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <SalesBoard kind="made_to_order" />,
});
