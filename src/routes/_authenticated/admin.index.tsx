import { Link, createFileRoute } from "@tanstack/react-router";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { useExpenses, useSales } from "@/lib/admin-data";
import { useInquiries } from "@/lib/inquiries";
import {
  businessExpenseTotals,
  inRange,
  margin,
  pct,
  peso,
  saleCode,
  statusLabel,
  sumSales,
  thisMonth,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Overview | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Overview() {
  const sales = useSales();
  const expenses = useExpenses();
  const inquiries = useInquiries();
  const { range, ui } = useRange("all");
  const all = (sales.data ?? []).filter((s) => s.payment_status !== "cancelled");
  const rows = all.filter((s) => !range.from && !range.to ? true : inRange(s.booking_date, range));
  const t = sumSales(rows);
  const month = thisMonth();
  const m = sumSales(all.filter((s) => inRange(s.booking_date, month)));

  // Rent, subscriptions and other business expenses that aren't tied to one booking.
  const business = businessExpenseTotals(expenses.data ?? [], range);
  const businessMonth = businessExpenseTotals(expenses.data ?? [], month);
  const netProfit = t.profit - business.total;
  const netProfitMonth = m.profit - businessMonth.total;

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
            <Stat label="Costs of sales" value={peso(t.cost)} sub="materials + booking expenses" />
            <Stat label="Profit from sales" value={peso(t.profit)} sub={`Margin ${pct(margin(t.profit, t.revenue))}`} />
            <Stat label="Business expenses" value={peso(business.total)} sub="rent, subscriptions, equipment…" />
            <Stat label="Net profit" value={peso(netProfit)} sub={`Margin ${pct(margin(netProfit, t.revenue))} · after business expenses`} />
            <Stat label="Number of sales" value={String(rows.length)} />
            <Stat label="This month's sales" value={peso(m.revenue)} />
            <Stat label="This month's net profit" value={peso(netProfitMonth)} sub={`after ${peso(businessMonth.total)} business expenses`} />
          </div>
          {inquiries.data ? (
            <section className="adm-card">
              <h2>Inquiries</h2>
              <div className="adm-stats">
                <Stat label="New" value={String(inquiries.data.filter((i) => i.status === "new").length)} sub="waiting for a reply" />
                <Stat label="Quoted" value={String(inquiries.data.filter((i) => i.status === "quoted").length)} sub="waiting for an answer" />
                <Stat label="Booked" value={String(inquiries.data.filter((i) => i.status === "booked").length)} />
              </div>
              <p><Link to="/admin/inquiries">Open inquiries →</Link></p>
            </section>
          ) : null}
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
