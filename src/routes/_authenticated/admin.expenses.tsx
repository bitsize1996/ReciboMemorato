import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Stat, useRange } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses, useSales } from "@/lib/admin-data";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  RECURRENCES,
  expenseOccurrences,
  inRange,
  n,
  peso,
  recurrenceLabel,
  saleCode,
  sumSales,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  head: () => ({ meta: [{ title: "Expenses | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: ExpensesPage,
});

type Form = {
  description: string; category: string; amount: string; expense_date: string;
  kind: string; recurrence: string; ends_on: string; notes: string;
};
const emptyForm = (): Form => ({
  description: "", category: "Rental", amount: "0", expense_date: new Date().toISOString().slice(0, 10),
  kind: "one_time", recurrence: "monthly", ends_on: "", notes: "",
});

function ExpensesPage() {
  const qc = useQueryClient();
  const expenses = useExpenses();
  const sales = useSales();
  const { range, ui } = useRange("all");
  const [cat, setCat] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const all = expenses.data ?? [];
  const cats = [...new Set(all.map((e) => e.category))].sort();
  const rows = all
    .filter((e) => !cat || e.category === cat)
    .map((e) => ({ ...e, times: expenseOccurrences(e as never, range) }))
    .filter((e) => e.times > 0);

  const total = (r: typeof rows) => r.reduce((a, e) => a + n(e.amount) * e.times, 0);
  const tied = rows.filter((e) => e.sale_id);
  const business = rows.filter((e) => !e.sale_id);
  const oneTime = business.filter((e) => e.kind !== "recurring");
  const recurring = business.filter((e) => e.kind === "recurring");
  const monthlyRecurring = all
    .filter((e) => !e.sale_id && e.kind === "recurring")
    .reduce((a, e) => a + (e.recurrence === "weekly" ? (n(e.amount) * 52) / 12 : e.recurrence === "yearly" ? n(e.amount) / 12 : n(e.amount)), 0);

  const salesInRange = (sales.data ?? [])
    .filter((s) => s.payment_status !== "cancelled")
    .filter((s) => (!range.from && !range.to) || inRange(s.booking_date, range));
  const saleProfit = sumSales(salesInRange).profit;
  const afterOverhead = saleProfit - total(business);

  const byCat = rows.reduce<Record<string, number>>(
    (a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + n(e.amount) * e.times }), {});

  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const recurring = form.kind === "recurring";
    const { error } = await supabase.from("sale_expenses").insert({
      sale_id: null, description: form.description.trim(), category: form.category.trim() || "Miscellaneous",
      amount: n(form.amount), expense_date: form.expense_date, notes: form.notes || null,
      kind: form.kind, recurrence: recurring ? form.recurrence : null,
      ends_on: recurring && form.ends_on ? form.ends_on : null,
    } as never);
    if (error) return setErr(error.message);
    setForm(null); setErr(null);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const { error } = await supabase.from("sale_expenses").delete().eq("id", id);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  return (
    <div className="adm-page">
      <header className="adm-head"><h1>Expenses</h1>
        <div className="adm-filters">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}
          </select>{ui}
          <Button onClick={() => setForm(emptyForm())}>+ Add business expense</Button>
        </div>
      </header>
      <p className="adm-hint">
        Costs for one booking (transport, staff…) are added on that sale's page and reduce that sale's profit.
        Business expenses here — rent, subscriptions, equipment — are separate, and can repeat every week, month or year.
      </p>
      {err && <p className="adm-error">{err}</p>}

      {form && (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2>New business expense</h2>
          <label>Expense name<input required value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Studio rent, Canva, new camera…" /></label>
          <label>Category<input list="biz-exp-cats" value={form.category} onChange={(e) => set("category", e.target.value)} /></label>
          <datalist id="biz-exp-cats">{[...EXPENSE_CATEGORIES, "Subscription", "Marketing", "Utilities"].map((c) => <option key={c} value={c} />)}</datalist>
          <label>Amount (₱)<input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></label>
          <label>Type
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {EXPENSE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label>{form.kind === "recurring" ? "Starts on" : "Date"}<input type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} /></label>
          {form.kind === "recurring" && (
            <>
              <label>Repeats
                <select value={form.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
                  {RECURRENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label>Stops on (optional)<input type="date" value={form.ends_on} onChange={(e) => set("ends_on", e.target.value)} /></label>
            </>
          )}
          <label className="adm-wide">Notes<input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          <div className="adm-row"><Button type="submit">Save expense</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>
      )}

      <div className="adm-stats">
        <Stat label="Total expenses" value={peso(total(rows))} sub="in the selected period" />
        <Stat label="Tied to bookings" value={peso(total(tied))} />
        <Stat label="Business one-time" value={peso(total(oneTime))} />
        <Stat label="Business recurring" value={peso(total(recurring))} sub={`about ${peso(monthlyRecurring)} a month`} />
        <Stat label="Profit from sales" value={peso(saleProfit)} sub="after materials & booking costs" />
        <Stat label="Profit after business expenses" value={peso(afterOverhead)} />
      </div>
      <div className="adm-stats" style={{ marginTop: 12 }}>
        {Object.entries(byCat).map(([k, v]) => <Stat key={k} label={k} value={peso(v)} />)}
      </div>

      <section className="adm-card adm-scroll" style={{ marginTop: 16 }}>
        {expenses.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">No expenses recorded for this period.</p> : (
          <table className="adm-table">
            <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Type</th><th>Booking</th><th>Amount</th><th /></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}>
                <td>{e.expense_date}</td>
                <td>{e.description}{e.notes ? <small className="adm-hint"> — {e.notes}</small> : null}</td>
                <td>{e.category}</td>
                <td>{e.kind === "recurring" ? `${recurrenceLabel(e.recurrence)}${e.times > 1 ? ` · ${e.times}× in period` : ""}` : "One-time"}</td>
                <td>{e.sales ? <Link to="/admin/sales/$saleId" params={{ saleId: e.sales.id }}>{saleCode(e.sales.sale_number)} · {e.sales.customer_name}</Link> : "Business"}</td>
                <td>{peso(n(e.amount) * e.times)}</td>
                <td className="adm-actions">{!e.sale_id ? <button onClick={() => remove(e.id)}>Delete</button> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
