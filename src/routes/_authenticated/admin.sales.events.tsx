import { createFileRoute } from "@tanstack/react-router";

import { SalesBoard } from "@/components/admin/SalesBoard";

export const Route = createFileRoute("/_authenticated/admin/sales/events")({
  head: () => ({ meta: [{ title: "Event bookings | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <SalesBoard kind="event" />,
});
