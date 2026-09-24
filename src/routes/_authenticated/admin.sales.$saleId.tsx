import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES, n, pct, peso, saleCode, saleTotals, statusLabel } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/sales/$saleId")({
  head: () => ({ meta: [{ title: "Sale | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: SaleDetail,
});

function SaleDetail() {
  const { saleId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sale = useQuery({
    queryKey: ["biz", "sale", saleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales")
        .select("*, packages(name), sale_materials(*), sale_expenses(*)").eq("id", saleId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [exp, setExp] = useState<null | { description: string; category: string; amount: string; expense_date: string; notes: string }>(null);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] });

  if (sale.isPending) return <div className="adm-page"><p>Loading…</p></div>;
  if (!sale.data) return <div className="adm-page"><p>Sale not found.</p><Link to="/admin/sales">Back to sales</Link></div>;
  const s = sale.data;
  const t = saleTotals(s);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!exp) return;
    const { error } = await supabase.from("sale_expenses").insert({
      sale_id: s.id, description: exp.description.trim(), category: exp.category.trim() || "Miscellaneous",
      amount: n(exp.amount), expense_date: exp.expense_date, notes: exp.notes || null,
    });
    if (error) return setErr(error.message);
    setExp(null); refresh();
  }

  async function update(patch: { payment_status?: typeof s.payment_status; amount_paid?: number }) {
    const { error } = await supabase.from("sales").update(patch).eq("id", s.id);
    if (error) return setErr(error.message);
    refresh();
  }

  async function del(table: "sale_expenses" | "sale_materials", id: string) {
    await supabase.from(table).delete().eq("id", id);
    refresh();
  }

  async function deleteSale() {
    if (!window.confirm("Delete this sale and its cost records?")) return;
    await supabase.from("sales").delete().eq("id", s.id);
    refresh();
    navigate({ to: "/admin/sales" });
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div><Link to="/admin/sales">← Sales</Link><h1>Sale {saleCode(s.sale_number)}</h1></div>
        <Button variant="outline" onClick={deleteSale}>Delete sale</Button>
      </header>
      {err && <p className="adm-error">{err}</p>}
      <div className="adm-grid">
        <section className="adm-card">
          <h2>Details</h2>
          <dl className="adm-dl">
            <dt>Customer</dt><dd>{s.customer_name}</dd>
            <dt>Contact</dt><dd>{s.customer_contact ?? "—"}</dd>
            <dt>Event</dt><dd>{s.event_name ?? "—"}</dd>
            <dt>Event date</dt><dd>{s.event_date ?? "—"}</dd>
            <dt>Booking date</dt><dd>{s.booking_date}</dd>
            <dt>Package</dt><dd>{s.packages?.name ?? s.package_name_snapshot ?? "—"}</dd>
            <dt>Quantity</dt><dd>{s.quantity}</dd>
          </dl>
          {s.notes && <p className="adm-hint">{s.notes}</p>}
        </section>
        <section className="adm-card">
          <h2>Payment</h2>
          <dl className="adm-dl">
            <dt>Amount paid</dt><dd>{peso(s.amount_paid)}</dd>
            <dt>Balance</dt><dd>{peso(t.netRevenue - n(s.amount_paid))}</dd>
          </dl>
          <label className="adm-inline">Status
            <select value={s.payment_status} onChange={(e) => update({ payment_status: e.target.value as typeof s.payment_status })}>
              {PAYMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="adm-inline">Update amount paid
            <input type="number" step="0.01" defaultValue={String(s.amount_paid)} onBlur={(e) => n(e.target.value) !== n(s.amount_paid) && update({ amount_paid: n(e.target.value) })} />
          </label>
          <p className="adm-hint">Current: {statusLabel(s.payment_status)}</p>
        </section>
      </div>

      <section className="adm-card">
        <h2>Revenue</h2>
        <dl className="adm-dl">
          <dt>Selling price</dt><dd>{peso(s.selling_price)}</dd>
          <dt>Discount</dt><dd>− {peso(s.discount)}</dd>
          <dt><strong>Net revenue</strong></dt><dd><strong>{peso(t.netRevenue)}</strong></dd>
        </dl>
      </section>

      <section className="adm-card">
        <h2>Material costs</h2>
        {!s.sale_materials.length ? <p className="adm-empty">No materials recorded.</p> : (
          <table className="adm-table">
            <thead><tr><th>Material</th><th>Qty</th><th>Cost/unit (saved)</th><th>Total</th><th /></tr></thead>
            <tbody>{s.sale_materials.map((m) => (
              <tr key={m.id}><td>{m.material_name_snapshot}</td><td>{m.quantity}</td><td>{peso(m.unit_cost_snapshot)}</td><td>{peso(m.total_cost)}</td>
                <td className="adm-actions"><button onClick={() => del("sale_materials", m.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
        <p><strong>Total materials: {peso(t.materials)}</strong></p>
      </section>

      <section className="adm-card">
        <div className="adm-head"><h2>Other expenses</h2>
          <Button size="sm" onClick={() => setExp({ description: "", category: "Transportation", amount: "0", expense_date: new Date().toISOString().slice(0, 10), notes: "" })}>+ Add expense</Button>
        </div>
        {exp && (
          <form className="adm-form" onSubmit={addExpense}>
            <label>Expense name<input required value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} /></label>
            <label>Category<input list="exp-cats" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} /></label>
            <datalist id="exp-cats">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            <label>Amount (₱)<input type="number" step="0.01" min="0" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} /></label>
            <label>Date<input type="date" value={exp.expense_date} onChange={(e) => setExp({ ...exp, expense_date: e.target.value })} /></label>
            <label className="adm-wide">Notes<input value={exp.notes} onChange={(e) => setExp({ ...exp, notes: e.target.value })} /></label>
            <div className="adm-row"><Button type="submit">Save expense</Button><Button type="button" variant="outline" onClick={() => setExp(null)}>Cancel</Button></div>
          </form>
        )}
        {!s.sale_expenses.length ? <p className="adm-empty">No other expenses recorded.</p> : (
          <table className="adm-table">
            <thead><tr><th>Expense</th><th>Category</th><th>Date</th><th>Amount</th><th /></tr></thead>
            <tbody>{s.sale_expenses.map((x) => (
              <tr key={x.id}><td>{x.description}{x.notes ? <small className="adm-hint"> — {x.notes}</small> : null}</td><td>{x.category}</td><td>{x.expense_date}</td><td>{peso(x.amount)}</td>
                <td className="adm-actions"><button onClick={() => del("sale_expenses", x.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
        <p><strong>Total other expenses: {peso(t.expenses)}</strong></p>
      </section>

      <section className="adm-card adm-profit">
        <h2>Profit</h2>
        <dl className="adm-dl">
          <dt>Net revenue</dt><dd>{peso(t.netRevenue)}</dd>
          <dt>Less materials</dt><dd>− {peso(t.materials)}</dd>
          <dt>Less other expenses</dt><dd>− {peso(t.expenses)}</dd>
          <dt>Total costs</dt><dd>{peso(t.totalCost)}</dd>
          <dt><strong>Net profit</strong></dt><dd className={t.profit < 0 ? "adm-neg" : ""}><strong>{peso(t.profit)}</strong></dd>
          <dt>Profit margin</dt><dd>{pct(t.margin)}</dd>
        </dl>
      </section>
    </div>
  );
}
