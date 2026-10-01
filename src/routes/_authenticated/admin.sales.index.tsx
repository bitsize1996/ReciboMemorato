import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useRange } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials, usePackages, useSales, type SaleRow } from "@/lib/admin-data";
import { PAYMENT_STATUSES, inRange, n, peso, saleCode, statusLabel, type PaymentStatus } from "@/lib/finance";
import { syncSaleToGoogle } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/admin/sales/")({
  head: () => ({ meta: [{ title: "Sales | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: SalesPage,
});

type SortKey = "sale_number" | "customer_name" | "booking_date" | "revenue" | "profit";

function SalesPage() {
  const sales = useSales();
  const packages = usePackages();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pkg, setPkg] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "booking_date", asc: false });
  const { range, ui } = useRange("all");

  const rows = useMemo(() => {
    const val = (s: SaleRow): string | number =>
      sort.key === "revenue" ? s.totals.netRevenue : sort.key === "profit" ? s.totals.profit : (s[sort.key] ?? "");
    return (sales.data ?? [])
      .filter((s) => (!range.from && !range.to) || inRange(s.booking_date, range))
      .filter((s) => !pkg || s.package_id === pkg)
      .filter((s) => !status || s.payment_status === status)
      .filter((s) => {
        const t = q.toLowerCase();
        return !t || [s.customer_name, s.event_name, s.customer_contact, saleCode(s.sale_number)].some((x) => x?.toLowerCase().includes(t));
      })
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
      });
  }, [sales.data, range, pkg, status, q, sort]);

  const th = (key: SortKey, label: string) => (
    <th><button className="adm-sort" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : true })}>
      {label}{sort.key === key ? (sort.asc ? " ▲" : " ▼") : ""}
    </button></th>
  );

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Sales</h1>
        <Button onClick={() => setAdding(true)}>+ Add sale</Button>
      </header>
      {adding && <SaleForm onDone={() => setAdding(false)} />}
      <div className="adm-filters">
        <input placeholder="Search customer, event, sale #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={pkg} onChange={(e) => setPkg(e.target.value)} aria-label="Package">
          <option value="">All packages</option>
          {(packages.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status">
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {ui}
      </div>
      <section className="adm-card adm-scroll">
        {sales.isPending ? <p>Loading…</p> : !sales.data?.length ? <p className="adm-empty">No sales recorded yet.</p> : !rows.length ? <p className="adm-empty">No sales match these filters.</p> : (
          <table className="adm-table">
            <thead><tr>
              {th("sale_number", "Sale")}{th("customer_name", "Customer")}<th>Event</th>{th("booking_date", "Date")}
              <th>Package</th>{th("revenue", "Revenue")}<th>Materials</th><th>Expenses</th>{th("profit", "Profit")}<th>Status</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to="/admin/sales/$saleId" params={{ saleId: s.id }}>{saleCode(s.sale_number)}</Link></td>
                  <td>{s.customer_name}</td><td>{s.event_name ?? "—"}</td><td>{s.booking_date}</td>
                  <td>{s.packages?.name ?? s.package_name_snapshot ?? "—"}</td>
                  <td>{peso(s.totals.netRevenue)}</td><td>{peso(s.totals.materials)}</td><td>{peso(s.totals.expenses)}</td>
                  <td className={s.totals.profit < 0 ? "adm-neg" : ""}>{peso(s.totals.profit)}</td>
                  <td>{statusLabel(s.payment_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

type Line = { material_id: string; name: string; quantity: string; unit_cost: string };

function SaleForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const packages = usePackages();
  const materials = useMaterials();
  const [f, setF] = useState({
    customer_name: "", customer_contact: "", customer_email: "", event_time: "", event_name: "", event_date: "",
    booking_date: new Date().toISOString().slice(0, 10), package_id: "", quantity: "1",
    selling_price: "0", discount: "0", amount_paid: "0", payment_status: "unpaid" as PaymentStatus, notes: "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function pickPackage(id: string) {
    const p = packages.data?.find((x) => x.id === id);
    const qty = n(f.quantity) || 1;
    setF((prev) => ({ ...prev, package_id: id, selling_price: p ? String(n(p.selling_price) * qty) : prev.selling_price }));
    setLines(p ? p.package_materials.map((pm) => ({
      material_id: pm.material_id, name: pm.materials?.name ?? "Material",
      quantity: String(n(pm.quantity) * qty), unit_cost: String(pm.materials?.current_unit_cost ?? 0),
    })) : []);
  }

  const netRevenue = n(f.selling_price) - n(f.discount);
  const matTotal = lines.reduce((a, l) => a + n(l.quantity) * n(l.unit_cost), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const p = packages.data?.find((x) => x.id === f.package_id);
    const { data, error } = await supabase.from("sales").insert({
      customer_name: f.customer_name.trim(), customer_contact: f.customer_contact || null,
      customer_email: f.customer_email.trim() || null, event_time: f.event_time || null,
      event_name: f.event_name || null, event_date: f.event_date || null, booking_date: f.booking_date,
      package_id: f.package_id || null, package_name_snapshot: p?.name ?? null, quantity: n(f.quantity) || 1,
      selling_price: n(f.selling_price), discount: n(f.discount), amount_paid: n(f.amount_paid),
      payment_status: f.payment_status, notes: f.notes || null,
    }).select("id").single();
    if (error) { setBusy(false); return setErr(error.message); }
    const valid = lines.filter((l) => l.name && n(l.quantity) > 0);
    if (valid.length) {
      const { error: e2 } = await supabase.from("sale_materials").insert(valid.map((l) => ({
        sale_id: data.id, material_id: l.material_id || null, material_name_snapshot: l.name,
        quantity: n(l.quantity), unit_cost_snapshot: n(l.unit_cost),
      })));
      if (e2) { setBusy(false); return setErr(e2.message); }
    }
    if (f.event_date) await syncSaleToGoogle({ data: { saleId: data.id } }).catch(() => null);
    qc.invalidateQueries({ queryKey: ["biz"] });
    onDone();
    navigate({ to: "/admin/sales/$saleId", params: { saleId: data.id } });
  }

  return (
    <form className="adm-card adm-form" onSubmit={save}>
      <h2>New sale</h2>
      {err && <p className="adm-error adm-wide">{err}</p>}
      <label>Customer name<input required value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></label>
      <label>Customer contact<input value={f.customer_contact} onChange={(e) => set("customer_contact", e.target.value)} /></label>
      <label>Customer email<input type="email" value={f.customer_email} onChange={(e) => set("customer_email", e.target.value)} /></label>
      <label>Event name<input value={f.event_name} onChange={(e) => set("event_name", e.target.value)} /></label>
      <label>Event date<input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} /></label>
      <label>Event start time<input type="time" value={f.event_time} onChange={(e) => set("event_time", e.target.value)} /></label>
      <label>Booking date<input type="date" required value={f.booking_date} onChange={(e) => set("booking_date", e.target.value)} /></label>
      <label>Package
        <select value={f.package_id} onChange={(e) => pickPackage(e.target.value)}>
          <option value="">No package / custom</option>
          {(packages.data ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {peso(p.selling_price)}</option>)}
        </select>
      </label>
      <label>Quantity<input type="number" min="1" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} /></label>
      <label>Selling price (₱)<input type="number" step="0.01" min="0" value={f.selling_price} onChange={(e) => set("selling_price", e.target.value)} /></label>
      <label>Discount (₱)<input type="number" step="0.01" min="0" value={f.discount} onChange={(e) => set("discount", e.target.value)} /></label>
      <label>Amount paid (₱)<input type="number" step="0.01" min="0" value={f.amount_paid} onChange={(e) => set("amount_paid", e.target.value)} /></label>
      <label>Balance<input readOnly value={peso(netRevenue - n(f.amount_paid))} /></label>
      <label>Payment status
        <select value={f.payment_status} onChange={(e) => set("payment_status", e.target.value)}>
          {PAYMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <div className="adm-wide">
        <h3>Material costs for this sale</h3>
        <p className="adm-hint">Filled in from the package using today's costs. These costs are saved with the sale and won't change later.</p>
        {lines.map((l, i) => (
          <div className="adm-line" key={i}>
            <select value={l.material_id} aria-label="Material" onChange={(e) => {
              const m = materials.data?.find((x) => x.id === e.target.value);
              setLines(lines.map((x, j) => j === i ? { ...x, material_id: e.target.value, name: m?.name ?? "", unit_cost: String(m?.current_unit_cost ?? 0) } : x));
            }}>
              <option value="">Choose material…</option>
              {(materials.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="number" step="0.01" min="0" value={l.quantity} aria-label="Quantity" onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
            <input type="number" step="0.01" min="0" value={l.unit_cost} aria-label="Cost per unit" onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_cost: e.target.value } : x))} />
            <span>{peso(n(l.quantity) * n(l.unit_cost))}</span>
            <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { material_id: "", name: "", quantity: "1", unit_cost: "0" }])}>+ Add material</Button>
        <p><strong>Total materials: {peso(matTotal)}</strong> · Net revenue: {peso(netRevenue)}</p>
      </div>
      <label className="adm-wide">Notes<textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      <div className="adm-row"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save sale"}</Button><Button type="button" variant="outline" onClick={onDone}>Cancel</Button></div>
      <p className="adm-hint adm-wide">Add other expenses (transport, staff…) on the sale page after saving.</p>
    </form>
  );
}
