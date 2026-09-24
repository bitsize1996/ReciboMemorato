import { Link, createFileRoute } from "@tanstack/react-router";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { useSales } from "@/lib/admin-data";
import { inRange, margin, pct, peso, saleCode, statusLabel, thisMonth } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Overview | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

export function sumSales(rows: { totals: { netRevenue: number; totalCost: number; profit: number; materials: number; expenses: number } }[]) {
  return rows.reduce(
    (a, s) => ({
      revenue: a.revenue + s.totals.netRevenue,
      cost: a.cost + s.totals.totalCost,
      profit: a.profit + s.totals.profit,
      materials: a.materials + s.totals.materials,
      expenses: a.expenses + s.totals.expenses,
    }),
    { revenue: 0, cost: 0, profit: 0, materials: 0, expenses: 0 },
  );
}

function Overview() {
  const sales = useSales();
  const { range, ui } = useRange("all");
  const all = (sales.data ?? []).filter((s) => s.payment_status !== "cancelled");
  const rows = all.filter((s) => !range.from && !range.to ? true : inRange(s.booking_date, range));
  const t = sumSales(rows);
  const m = sumSales(all.filter((s) => inRange(s.booking_date, thisMonth())));

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Overview</h1>
        {ui}
      </header>
      {sales.isPending ? <p>Loading…</p> : sales.error ? <p className="adm-error">Could not load sales.</p> : (
        <>
          <div className="adm-stats">
            <Stat label="Total sales" value={peso(t.revenue)} />
            <Stat label="Total costs" value={peso(t.cost)} />
            <Stat label="Total profit" value={peso(t.profit)} sub={`Margin ${pct(margin(t.profit, t.revenue))}`} />
            <Stat label="Number of sales" value={String(rows.length)} />
            <Stat label="This month's sales" value={peso(m.revenue)} />
            <Stat label="This month's profit" value={peso(m.profit)} />
          </div>
          <section className="adm-card">
            <h2>Recent sales</h2>
            {rows.length === 0 ? <p className="adm-empty">No sales recorded yet.</p> : (
              <table className="adm-table">
                <thead><tr><th>Sale</th><th>Customer</th><th>Date</th><th>Revenue</th><th>Profit</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td><Link to="/admin/sales/$saleId" params={{ saleId: s.id }}>{saleCode(s.sale_number)}</Link></td>
                      <td>{s.customer_name}</td>
                      <td>{s.booking_date}</td>
                      <td>{peso(s.totals.netRevenue)}</td>
                      <td>{peso(s.totals.profit)}</td>
                      <td>{statusLabel(s.payment_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
