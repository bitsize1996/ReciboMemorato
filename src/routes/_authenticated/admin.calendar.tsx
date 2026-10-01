import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useSales } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({ meta: [{ title: "Calendar | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: CalendarPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarPage() {
  const sales = useSales();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const first = new Date(ym.y, ym.m, 1);
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const key = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const byDay = new Map<string, NonNullable<typeof sales.data>>();
  for (const s of sales.data ?? []) {
    if (!s.event_date || s.payment_status === "cancelled") continue;
    byDay.set(s.event_date, [...(byDay.get(s.event_date) ?? []), s]);
  }
  const move = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const today = now.toISOString().slice(0, 10);

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Bookings calendar</h1>
        <Link to="/admin/sales"><Button>+ Add booking</Button></Link>
      </header>
      <div className="adm-row">
        <Button variant="outline" size="sm" onClick={() => move(-1)}>←</Button>
        <strong>{first.toLocaleString("en-PH", { month: "long", year: "numeric" })}</strong>
        <Button variant="outline" size="sm" onClick={() => move(1)}>→</Button>
      </div>
      <p className="adm-hint">Bookings are your sales with an event date. Each one can also be sent to your Google Calendar from its sale page.</p>
      <div className="cal-grid">
        {DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => d === null ? <div key={i} className="cal-cell cal-empty" /> : (
          <div key={i} className={`cal-cell${key(d) === today ? " cal-today" : ""}`}>
            <span className="cal-num">{d}</span>
            {(byDay.get(key(d)) ?? []).map((s) => (
              <Link key={s.id} to="/admin/sales/$saleId" params={{ saleId: s.id }} className="cal-item">
                {s.event_time ? `${s.event_time} ` : ""}{s.event_name || s.customer_name}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
