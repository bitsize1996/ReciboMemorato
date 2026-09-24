import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { useExpenses } from "@/lib/admin-data";
import { inRange, n, peso, saleCode } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  head: () => ({ meta: [{ title: "Expenses | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const expenses = useExpenses();
  const { range, ui } = useRange("all");
  const [cat, setCat] = useState("");
  const cats = [...new Set((expenses.data ?? []).map((e) => e.category))].sort();
  const rows = (expenses.data ?? [])
    .filter((e) => (!range.from && !range.to) || inRange(e.expense_date, range))
    .filter((e) => !cat || e.category === cat);
  const byCat = rows.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + n(e.amount) }), {});

  return (
    <div className="adm-page">
      <header className="adm-head"><h1>Expenses</h1>
        <div className="adm-filters">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}
          </select>{ui}
        </div>
      </header>
      <p className="adm-hint">Expenses are added on each sale's page, so every cost stays tied to a booking.</p>
      <div className="adm-stats">
        <Stat label="Total other expenses" value={peso(rows.reduce((a, e) => a + n(e.amount), 0))} />
        {Object.entries(byCat).map(([k, v]) => <Stat key={k} label={k} value={peso(v)} />)}
      </div>
      <section className="adm-card adm-scroll">
        {expenses.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">No expenses recorded yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Sale</th><th>Amount</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}><td>{e.expense_date}</td><td>{e.description}</td><td>{e.category}</td>
                <td>{e.sales ? <Link to="/admin/sales/$saleId" params={{ saleId: e.sales.id }}>{saleCode(e.sales.sale_number)} · {e.sales.customer_name}</Link> : "—"}</td>
                <td>{peso(e.amount)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
