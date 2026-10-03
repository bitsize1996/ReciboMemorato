import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { useExpenses, useSales } from "@/lib/admin-data";
import { businessExpenseTotals, inRange, margin, pct, peso, sumSales } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: ReportsPage,
});

const pad = (v: number) => String(v).padStart(2, "0");

/** Every month key (YYYY-MM) from `from` to `to`, oldest first. */
function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [endY, endM] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  while ((y < endY || (y === endY && m <= endM)) && keys.length < 240) {
    keys.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return keys;
}

function ReportsPage() {
  const sales = useSales();
  const expenses = useExpenses();
  const { range, ui } = useRange("year");
  const rows = (sales.data ?? [])
    .filter((s) => s.payment_status !== "cancelled")
    .filter((s) => (!range.from && !range.to) || inRange(s.booking_date, range));
  const t = sumSales(rows);
  const gross = rows.reduce((a, s) => a + Number(s.selling_price) + s.totals.addons, 0);

  const expenseRows = expenses.data ?? [];
  const business = businessExpenseTotals(expenseRows, range);
  const netProfit = t.profit - business.total;

  // Month-by-month: sales, their costs, business expenses and what is left.
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const dates = [
    ...rows.map((s) => s.booking_date),
    ...expenseRows.filter((e) => !e.sale_id).map((e) => e.expense_date),
  ].sort();
  const first = range.from || dates[0] || todayIso;
  const last = range.to || todayIso;
  const months = new Map<string, { month: string; Revenue: number; Costs: number; Profit: number }>();
  for (const key of monthKeys(first, last)) months.set(key, { month: key, Revenue: 0, Costs: 0, Profit: 0 });
  for (const s of rows) {
    const m = months.get(s.booking_date.slice(0, 7));
    if (!m) continue;
    m.Revenue += s.totals.netRevenue; m.Costs += s.totals.totalCost; m.Profit += s.totals.profit;
  }
  for (const m of months.values()) {
    const [y, mo] = [Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7))];
    const lastDay = new Date(y, mo, 0).getDate();
    const monthRange = {
      from: range.from && range.from > `${m.month}-01` ? range.from : `${m.month}-01`,
      to: range.to && range.to < `${m.month}-${pad(lastDay)}` ? range.to : `${m.month}-${pad(lastDay)}`,
    };
    const overhead = businessExpenseTotals(expenseRows, monthRange).total;
    m.Costs += overhead;
    m.Profit -= overhead;
  }
  const chart = [...months.values()]
    .filter((m) => m.Revenue !== 0 || m.Costs !== 0 || m.Profit !== 0)
    .sort((a, b) => a.month.localeCompare(b.month));

  const hasData = rows.length > 0 || business.total > 0;

  return (
    <div className="adm-page">
      <header className="adm-head"><h1>Reports</h1>{ui}</header>
      {sales.isPending ? <p>Loading…</p> : !hasData ? <section className="adm-card"><p className="adm-empty">No sales or expenses recorded for this period.</p></section> : (
        <>
          <h2>Sales</h2>
          <div className="adm-stats">
            <Stat label="Total sales (net)" value={peso(t.revenue)} />
            <Stat label="Bookings" value={String(rows.length)} />
            <Stat label="Average sale" value={peso(rows.length ? t.revenue / rows.length : 0)} />
            <Stat label="Gross revenue" value={peso(gross)} sub={`Discounts ${peso(gross - t.revenue)}`} />
          </div>
          <h2>Costs</h2>
          <div className="adm-stats">
            <Stat label="Material costs" value={peso(t.materials)} />
            <Stat label="Booking expenses" value={peso(t.expenses)} sub="transport, staff… tied to a sale" />
            <Stat label="Business one-time" value={peso(business.oneTime)} />
            <Stat label="Business recurring" value={peso(business.recurring)} sub="rent, subscriptions…" />
            <Stat label="Total costs" value={peso(t.cost + business.total)} />
          </div>
          <h2>Profit</h2>
          <div className="adm-stats">
            <Stat label="Net revenue" value={peso(t.revenue)} />
            <Stat label="Profit from sales" value={peso(t.profit)} sub="after materials & booking expenses" />
            <Stat label="Business expenses" value={peso(business.total)} />
            <Stat label="Net profit" value={peso(netProfit)} sub="after business expenses" />
            <Stat label="Net profit margin" value={pct(margin(netProfit, t.revenue))} />
          </div>
          <section className="adm-card">
            <h2>By month</h2>
            <p className="adm-hint">Costs include business expenses; profit is what is left after them.</p>
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
