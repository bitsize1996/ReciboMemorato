import { createFileRoute } from "@tanstack/react-router";

import { SalesBoard } from "@/components/admin/SalesBoard";

function EventBookings() {
  const { add } = Route.useSearch();
  return <SalesBoard kind="event" startAdding={add} />;
}

export const Route = createFileRoute("/_authenticated/admin/sales/events")({
  head: () => ({ meta: [{ title: "Event bookings | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (search: Record<string, unknown>): { add?: boolean } => ({
    add: search["add"] === true || search["add"] === "true" || search["add"] === "1" ? true : undefined,
  }),
  component: EventBookings,
});
