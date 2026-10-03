import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAddons, useMaterials } from "@/lib/admin-data";
import { brandName, copyText, gmailComposeUrl, invoiceMessage, useBusinessInfo } from "@/lib/messages";
import { siteSettingsQuery } from "@/lib/site.functions";
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES, n, pct, peso, saleCode, saleTotals, statusLabel } from "@/lib/finance";
import { useServerFn } from "@tanstack/react-start";
import { syncSaleToGoogle } from "@/lib/calendar.functions";

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
      const run = (fields: string) =>
        (supabase as any).from("sales").select(fields).eq("id", saleId).maybeSingle();
      // Add-ons and event details need their database setup; fall back without them.
      let result = await run("*, packages(name), sale_materials(*), sale_expenses(*), sale_addons(*)");
      if (result.error) result = await run("*, packages(name), sale_materials(*), sale_expenses(*)");
      if (result.error) throw result.error;
      return result.data as (Database["public"]["Tables"]["sales"]["Row"] & {
        packages: { name: string } | null;
        sale_materials: Database["public"]["Tables"]["sale_materials"]["Row"][];
        sale_expenses: Database["public"]["Tables"]["sale_expenses"]["Row"][];
        sale_addons?: { id: string; name_snapshot: string; unit_price_snapshot: number; quantity: number; total_price: number }[];
        event_theme?: string | null;
        event_venue?: string | null;
      }) | null;
    },
  });
  const [exp, setExp] = useState<null | { description: string; category: string; amount: string; expense_date: string; notes: string }>(null);
  const materials = useMaterials();
  const addonCatalog = useAddons();
  const [addonPick, setAddonPick] = useState<null | { addon_id: string; quantity: string }>(null);
  const biz = useBusinessInfo();
  const site = useQuery(siteSettingsQuery);
  const [mat, setMat] = useState<null | { material_id: string; quantity: string }>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const syncFn = useServerFn(syncSaleToGoogle);
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] });

  if (sale.isPending) return <div className="adm-page"><p>Loading…</p></div>;
  if (!sale.data) return <div className="adm-page"><p>Sale not found.</p><Link to="/admin/sales">Back to sales</Link></div>;
  const s = sale.data;
  const t = saleTotals(s);
  const invoiceMsg = invoiceMessage(s as never, brandName(site.data), biz.data?.paymentInstructions ?? "");
  const mailUrl = gmailComposeUrl({
    from: biz.data?.email, to: s.customer_email ?? "", subject: invoiceMsg.subject, body: invoiceMsg.body,
  });
  const share = (amount: number) => (t.netRevenue > 0 ? (amount / t.netRevenue) * 100 : 0);
  const expenseByCategory = s.sale_expenses.reduce<Record<string, number>>(
    (a, x) => ({ ...a, [x.category]: (a[x.category] ?? 0) + n(x.amount) }), {});

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

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!mat) return;
    const m = materials.data?.find((x) => x.id === mat.material_id);
    if (!m || n(mat.quantity) <= 0) return setErr("Choose a material and a quantity.");
    const { error } = await supabase.from("sale_materials").insert({
      sale_id: s.id, material_id: m.id, material_name_snapshot: m.name,
      quantity: n(mat.quantity), unit_cost_snapshot: n(m.current_unit_cost),
    });
    if (error) return setErr(error.message);
    setMat(null); setErr(null); refresh();
  }

  async function addAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!addonPick) return;
    const a = addonCatalog.data?.rows.find((x) => x.id === addonPick.addon_id);
    if (!a || n(addonPick.quantity) <= 0) return setErr("Choose an add-on and a quantity.");
    const { error } = await (supabase as any).from("sale_addons").insert({
      sale_id: s.id, addon_id: a.id, name_snapshot: a.name,
      unit_price_snapshot: n(a.price), quantity: n(addonPick.quantity),
    });
    if (error) return setErr(error.message);
    setAddonPick(null); setErr(null); refresh();
  }

  async function update(patch: { payment_status?: typeof s.payment_status; amount_paid?: number }) {
    const { error } = await supabase.from("sales").update(patch).eq("id", s.id);
    if (error) return setErr(error.message);
    refresh();
  }

  async function del(table: "sale_expenses" | "sale_materials" | "sale_addons", id: string) {
    await supabase.from(table).delete().eq("id", id);
    refresh();
  }

  async function deleteSale() {
    if (!window.confirm("Delete this sale and its cost records?")) return;
    await supabase.from("sales").delete().eq("id", s.id);
    refresh();
    navigate({ to: "/admin/sales" });
  }

  async function syncCal() {
    setMsg("Sending to Google Calendar…");
    try {
      const r = await syncFn({ data: { saleId: s.id } });
      setMsg(r.message);
      refresh();
    } catch {
      setMsg("Could not reach Google Calendar. Try again shortly.");
    }
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div><Link to="/admin/sales">← Sales</Link><h1>Sale {saleCode(s.sale_number)}</h1></div>
        <div className="adm-row">
          <Link to="/admin/sales/$saleId/invoice" params={{ saleId: s.id }}><Button variant="outline">Invoice</Button></Link>
          <Button asChild variant="outline"><a href={mailUrl} target="_blank" rel="noreferrer">Email invoice</a></Button>
          <Button variant="outline" onClick={async () => setMsg((await copyText(invoiceMsg.body)) ? "Invoice text copied. Paste it into Messenger or any chat." : "Could not copy automatically.")}>Copy invoice text</Button>
          <Button variant="outline" onClick={syncCal}>{s.gcal_event_id ? "Update Google Calendar" : "Add to Google Calendar"}</Button>
          <Button variant="outline" onClick={deleteSale}>Delete sale</Button>
        </div>
      </header>
      {err && <p className="adm-error">{err}</p>}
      {msg && <p className="adm-hint">{msg}</p>}
      {biz.data?.ready && !biz.data.email ? (
        <p className="adm-hint">Tip: add your Recibo Memorato Gmail in <Link to="/admin/settings">Settings</Link> so "Email invoice" opens from the right account.</p>
      ) : null}
      <div className="adm-grid">
        <section className="adm-card">
          <h2>Details</h2>
          <dl className="adm-dl">
            <dt>Customer</dt><dd>{s.customer_name}</dd>
            <dt>Contact</dt><dd>{s.customer_contact ?? "—"}</dd>
            <dt>Email</dt><dd>{s.customer_email ?? "—"}</dd>
            <dt>Event</dt><dd>{s.event_name ?? "—"}</dd>
            {s.event_theme ? <><dt>Theme</dt><dd>{s.event_theme}</dd></> : null}
            {s.event_venue ? <><dt>Location</dt><dd>{s.event_venue}</dd></> : null}
            <dt>Event date</dt><dd>{s.event_date ?? "—"}{s.event_time ? ` · ${s.event_time}` : ""}</dd>
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
          <dt>Package</dt><dd>{peso(s.selling_price)}</dd>
          {(s.sale_addons?.length ?? 0) > 0 && <><dt>Add-ons</dt><dd>+ {peso(t.addons)}</dd></>}
          <dt>Discount</dt><dd>− {peso(s.discount)}</dd>
          <dt><strong>Net revenue</strong></dt><dd><strong>{peso(t.netRevenue)}</strong></dd>
        </dl>
      </section>

      <section className="adm-card">
        <div className="adm-head"><h2>Add-ons</h2>
          <Button size="sm" onClick={() => setAddonPick({ addon_id: "", quantity: "1" })}>+ Add add-on</Button>
        </div>
        {addonPick && (
          <form className="adm-form" onSubmit={addAddon}>
            <label>Add-on
              <select required value={addonPick.addon_id} onChange={(e) => setAddonPick({ ...addonPick, addon_id: e.target.value })}>
                <option value="">Choose add-on…</option>
                {(addonCatalog.data?.rows ?? []).filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {peso(a.price)}</option>
                ))}
              </select>
            </label>
            <label>Quantity<input type="number" step="1" min="1" value={addonPick.quantity} onChange={(e) => setAddonPick({ ...addonPick, quantity: e.target.value })} /></label>
            <div className="adm-row"><Button type="submit">Add to sale</Button><Button type="button" variant="outline" onClick={() => setAddonPick(null)}>Cancel</Button></div>
          </form>
        )}
        {!(s.sale_addons?.length) ? <p className="adm-empty">No add-ons on this booking.</p> : (
          <table className="adm-table">
            <thead><tr><th>Add-on</th><th>Qty</th><th>Price</th><th>Total</th><th /></tr></thead>
            <tbody>{s.sale_addons!.map((a) => (
              <tr key={a.id}><td>{a.name_snapshot}</td><td>{n(a.quantity)}</td><td>{peso(a.unit_price_snapshot)}</td><td>{peso(a.total_price)}</td>
                <td className="adm-actions"><button onClick={() => del("sale_addons", a.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
        <p><strong>Total add-ons: {peso(t.addons)}</strong></p>
      </section>

      <section className="adm-card">
        <div className="adm-head"><h2>Material costs</h2>
          <Button size="sm" onClick={() => setMat({ material_id: "", quantity: "1" })}>+ Add material</Button>
        </div>
        {mat && (
          <form className="adm-form" onSubmit={addMaterial}>
            <label>Material
              <select required value={mat.material_id} onChange={(e) => setMat({ ...mat, material_id: e.target.value })}>
                <option value="">Choose material…</option>
                {(materials.data ?? []).filter((m) => m.active).map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {peso(m.current_unit_cost)}/{m.unit} ({n(m.current_stock)} in stock)</option>
                ))}
              </select>
            </label>
            <label>Quantity<input type="number" step="0.01" min="0" value={mat.quantity} onChange={(e) => setMat({ ...mat, quantity: e.target.value })} /></label>
            <div className="adm-row"><Button type="submit">Add to sale</Button><Button type="button" variant="outline" onClick={() => setMat(null)}>Cancel</Button></div>
          </form>
        )}
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
        <p className="adm-hint">The materials used here are taken out of your inventory automatically. Removing one, or cancelling the sale, puts it back.</p>
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

      <section className="adm-card">
        <h2>Where the money goes</h2>
        {t.netRevenue <= 0 ? (
          <p className="adm-empty">Add a selling price to see the breakdown.</p>
        ) : (
          <>
            <div
              role="img"
              aria-label={`Materials ${share(t.materials).toFixed(0)}%, other expenses ${share(t.expenses).toFixed(0)}%, profit ${Math.max(100 - share(t.totalCost), 0).toFixed(0)}%`}
              style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", background: "#e2e8f0", margin: "8px 0" }}
            >
              <div style={{ width: `${Math.min(share(t.materials), 100)}%`, background: "#b7791f" }} />
              <div style={{ width: `${Math.min(share(t.expenses), Math.max(100 - share(t.materials), 0))}%`, background: "#2b6cb0" }} />
              <div style={{ width: `${Math.max(100 - share(t.totalCost), 0)}%`, background: "#2f855a" }} />
            </div>
            <p className="adm-hint">
              <span style={{ color: "#b7791f" }}>■</span> Materials &nbsp;
              <span style={{ color: "#2b6cb0" }}>■</span> Other expenses &nbsp;
              <span style={{ color: "#2f855a" }}>■</span> Profit
            </p>
            <table className="adm-table">
              <thead><tr><th>Where it goes</th><th>Amount</th><th>Share of net revenue</th></tr></thead>
              <tbody>
                <tr><td><strong>Net revenue</strong></td><td><strong>{peso(t.netRevenue)}</strong></td><td>100%</td></tr>
                <tr><td><strong>Materials</strong></td><td>{peso(t.materials)}</td><td>{share(t.materials).toFixed(1)}%</td></tr>
                {s.sale_materials.map((m) => (
                  <tr key={m.id}><td>&nbsp;&nbsp;↳ {m.material_name_snapshot} ({n(m.quantity)} × {peso(m.unit_cost_snapshot)})</td><td>{peso(m.total_cost)}</td><td>{share(n(m.total_cost)).toFixed(1)}%</td></tr>
                ))}
                <tr><td><strong>Other expenses</strong></td><td>{peso(t.expenses)}</td><td>{share(t.expenses).toFixed(1)}%</td></tr>
                {Object.entries(expenseByCategory).map(([category, amount]) => (
                  <tr key={category}><td>&nbsp;&nbsp;↳ {category}</td><td>{peso(amount)}</td><td>{share(amount).toFixed(1)}%</td></tr>
                ))}
                <tr><td><strong>Net profit</strong></td><td className={t.profit < 0 ? "adm-neg" : ""}><strong>{peso(t.profit)}</strong></td><td>{share(t.profit).toFixed(1)}%</td></tr>
              </tbody>
            </table>
          </>
        )}
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
