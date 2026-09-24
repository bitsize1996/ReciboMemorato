import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { useSales } from "@/lib/admin-data";
import { inRange, margin, pct, peso } from "@/lib/finance";
import { sumSales } from "./admin.index";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const sales = useSales();
  const { range, ui } = useRange("year");
  const rows = (sales.data ?? [])
    .filter((s) => s.payment_status !== "cancelled")
    .filter((s) => (!range.from && !range.to) || inRange(s.booking_date, range));
  const t = sumSales(rows);
  const gross = rows.reduce((a, s) => a + Number(s.selling_price), 0);

  const months = new Map<string, { month: string; Revenue: number; Costs: number; Profit: number }>();
  for (const s of [...rows].reverse()) {
    const k = s.booking_date.slice(0, 7);
    const m = months.get(k) ?? { month: k, Revenue: 0, Costs: 0, Profit: 0 };
    m.Revenue += s.totals.netRevenue; m.Costs += s.totals.totalCost; m.Profit += s.totals.profit;
    months.set(k, m);
  }
  const chart = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="adm-page">
      <header className="adm-head"><h1>Reports</h1>{ui}</header>
      {sales.isPending ? <p>Loading…</p> : !rows.length ? <section className="adm-card"><p className="adm-empty">No sales recorded yet.</p></section> : (
        <>
          <h2>Sales</h2>
          <div className="adm-stats">
            <Stat label="Total sales (net)" value={peso(t.revenue)} />
            <Stat label="Bookings" value={String(rows.length)} />
            <Stat label="Average sale" value={peso(t.revenue / rows.length)} />
            <Stat label="Gross revenue" value={peso(gross)} sub={`Discounts ${peso(gross - t.revenue)}`} />
          </div>
          <h2>Costs</h2>
          <div className="adm-stats">
            <Stat label="Material costs" value={peso(t.materials)} />
            <Stat label="Other expenses" value={peso(t.expenses)} />
            <Stat label="Total costs" value={peso(t.cost)} />
          </div>
          <h2>Profit</h2>
          <div className="adm-stats">
            <Stat label="Net revenue" value={peso(t.revenue)} />
            <Stat label="Net profit" value={peso(t.profit)} />
            <Stat label="Profit margin" value={pct(margin(t.profit, t.revenue))} />
          </div>
          <section className="adm-card">
            <h2>By month</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => peso(v)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="var(--adm-c1)" />
                  <Bar dataKey="Costs" fill="var(--adm-c2)" />
                  <Bar dataKey="Profit" fill="var(--adm-c3)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
