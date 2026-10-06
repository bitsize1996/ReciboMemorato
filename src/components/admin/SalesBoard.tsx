import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useRange } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials, usePackages, useSales, type SaleRow } from "@/lib/admin-data";
import { PAYMENT_STATUSES, inRange, n, peso, saleCode, statusLabel, type PaymentStatus, type SaleType, SALE_TYPES, saleTypeLabel, saleTypeOfPackage } from "@/lib/finance";
import { syncSaleToGoogle } from "@/lib/calendar.functions";
import { expenseCategoryFor, saleExpensesFromPackage } from "@/lib/pricing";

type SortKey = "sale_number" | "customer_name" | "booking_date" | "event_date" | "revenue" | "profit";

const SECTION: Record<string, { title: string; hint: string; add: string; search: string; empty: string }> = {
  all: {
    title: "All sales",
    hint: "Every sale in one list. Use the sections in the menu to work on one kind at a time.",
    add: "+ Add sale",
    search: "Search customer, event, sale #",
    empty: "No sales recorded yet.",
  },
  event: {
    title: "Event bookings",
    hint: "Photobooth bookings for event dates.",
    add: "+ Add event booking",
    search: "Search customer, event, sale #",
    empty: "No event bookings recorded yet.",
  },
  made_to_order: {
    title: "Made-to-order sales",
    hint: "Sintra boards, Instax prints and other orders, listed by the date of sale.",
    add: "+ Add order",
    search: "Search customer, product, sale #",
    empty: "No made-to-order sales recorded yet.",
  },
  popup: {
    title: "Pop-up sales",
    hint: "Pay-per-print sales at pop-up events.",
    add: "+ Add sale",
    search: "Search customer, pop-up, sale #",
    empty: "No pop-up sales recorded yet.",
  },
};

/** The Sales list. With `kind` it shows one kind of sale only, with columns that suit it. */
export function SalesBoard({ kind }: { kind?: SaleType }) {
  const copy = SECTION[kind ?? "all"]!;
  const sales = useSales();
  const packages = usePackages();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pkg, setPkg] = useState("");
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const type = kind ?? typeFilter;
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: kind === "event" ? "event_date" : "booking_date",
    asc: false,
  });
  const { range, ui } = useRange("all");

  const shownPackages = (packages.data ?? []).filter(
    (p) => !kind || saleTypeOfPackage((p as { service_type?: string }).service_type) === kind,
  );

  const rows = useMemo(() => {
    const val = (s: SaleRow): string | number =>
      sort.key === "revenue" ? s.totals.netRevenue : sort.key === "profit" ? s.totals.profit : (s[sort.key] ?? "");
    return (sales.data ?? [])
      .filter((s) => (!range.from && !range.to) || inRange(s.booking_date, range))
      .filter((s) => !pkg || s.package_id === pkg)
      .filter((s) => !status || s.payment_status === status)
      .filter((s) => !type || (s.sale_type ?? "event") === type)
      .filter((s) => {
        const t = q.toLowerCase();
        return !t || [s.customer_name, s.event_name, s.package_name_snapshot, s.customer_contact, saleCode(s.sale_number)].some((x) => x?.toLowerCase().includes(t));
      })
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
      });
  }, [sales.data, range, pkg, status, type, q, sort]);

  const totals = rows
    .filter((s) => s.payment_status !== "cancelled")
    .reduce((a, s) => ({ revenue: a.revenue + s.totals.netRevenue, profit: a.profit + s.totals.profit }), { revenue: 0, profit: 0 });

  const th = (key: SortKey, label: string) => (
    <th><button className="adm-sort" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : true })}>
      {label}{sort.key === key ? (sort.asc ? " ▲" : " ▼") : ""}
    </button></th>
  );

  const inventoryOf = (s: SaleRow) => s.packages?.name ?? s.package_name_snapshot ?? "—";

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>{copy.title}</h1>
          <p className="adm-hint">{copy.hint}</p>
        </div>
        <Button onClick={() => setAdding(true)}>{copy.add}</Button>
      </header>
      {adding && <SaleForm fixedType={kind} onDone={() => setAdding(false)} />}
      <div className="adm-filters">
        <input placeholder={copy.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={pkg} onChange={(e) => setPkg(e.target.value)} aria-label={kind === "made_to_order" ? "Product" : "Package"}>
          <option value="">{kind === "made_to_order" ? "All products" : "All packages"}</option>
          {shownPackages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {!kind && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type of sale">
            <option value="">All types</option>
            {SALE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status">
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {ui}
      </div>
      {rows.length > 0 && (
        <p className="adm-hint" style={{ margin: "4px 0 10px" }}>
          {rows.length} sale{rows.length === 1 ? "" : "s"} · Revenue {peso(totals.revenue)} · Profit {peso(totals.profit)}
        </p>
      )}
      <section className="adm-card adm-scroll">
        {sales.isPending ? <p>Loading…</p> : !rows.length && !sales.data?.some((s) => !type || (s.sale_type ?? "event") === type) ? <p className="adm-empty">{copy.empty}</p> : !rows.length ? <p className="adm-empty">No sales match these filters.</p> : (
          <table className="adm-table">
            <thead><tr>
              {th("sale_number", "Sale")}{th("customer_name", "Customer")}
              {!kind && <th>Type</th>}
              {kind === "event" && <><th>Event</th>{th("event_date", "Event date")}{th("booking_date", "Booked on")}</>}
              {kind === "made_to_order" && <><th>Product</th><th>Qty</th>{th("booking_date", "Date of sale")}</>}
              {kind === "popup" && <><th>Pop-up</th><th>Prints</th>{th("booking_date", "Date")}</>}
              {!kind && <><th>Event</th>{th("booking_date", "Date")}<th>Package</th></>}
              {kind === "event" && <th>Package</th>}
              {th("revenue", "Revenue")}<th>Materials</th><th>Expenses</th>{th("profit", "Profit")}<th>Status</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to="/admin/sales/$saleId" params={{ saleId: s.id }}>{saleCode(s.sale_number)}</Link></td>
                  <td>{s.customer_name}</td>
                  {!kind && <td>{saleTypeLabel(s.sale_type)}</td>}
                  {kind === "event" && <><td>{s.event_name ?? "—"}</td><td>{s.event_date ?? "—"}</td><td>{s.booking_date}</td></>}
                  {kind === "made_to_order" && <><td>{inventoryOf(s)}</td><td>{n(s.quantity)}</td><td>{s.booking_date}</td></>}
                  {kind === "popup" && <><td>{s.event_name ?? "Pop-up"}</td><td>{n(s.quantity)}</td><td>{s.booking_date}</td></>}
                  {!kind && <><td>{s.event_name ?? "—"}</td><td>{s.booking_date}</td><td>{inventoryOf(s)}</td></>}
                  {kind === "event" && <td>{inventoryOf(s)}</td>}
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
type OpLine = { category: string; description: string; amount: string };

function SaleForm({ onDone, fixedType }: { onDone: () => void; fixedType?: SaleType }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const packages = usePackages();
  const materials = useMaterials();
  const [f, setF] = useState({
    customer_name: "", customer_contact: "", customer_email: "", event_time: "", event_name: "", event_theme: "", event_venue: "", event_date: "",
    booking_date: new Date().toISOString().slice(0, 10), package_id: "", quantity: "1",
    selling_price: "0", discount: "0", amount_paid: "0", payment_status: "unpaid" as PaymentStatus, notes: "", sale_type: (fixedType ?? "event") as SaleType,
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [opLines, setOpLines] = useState<OpLine[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const isEvent = f.sale_type === "event";
  const typeOf = (p: { service_type?: string }) => saleTypeOfPackage(p.service_type);
  const offered = (packages.data ?? []).filter(
    (p) => p.active && (f.sale_type === "other" || typeOf(p as { service_type?: string }) === f.sale_type),
  );

  function pickType(value: SaleType) {
    // A different kind of sale starts without a package from the other kind.
    setF((prev) => ({ ...prev, sale_type: value, package_id: "", selling_price: "0" }));
    setLines([]);
    setOpLines([]);
  }

  function pickPackage(id: string) {
    const p = packages.data?.find((x) => x.id === id);
    const qty = n(f.quantity) || 1;
    setF((prev) => ({ ...prev, package_id: id, selling_price: p ? String(n(p.selling_price) * qty) : prev.selling_price }));
    setOpLines(
      p
        ? saleExpensesFromPackage(p as never, qty, n(p.selling_price) * qty).map((x) => ({
            category: x.category, description: x.description, amount: String(x.amount),
          }))
        : [],
    );
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
      customer_email: f.customer_email.trim() || null, sale_type: f.sale_type,
      // Event details only belong to photobooth events; a pop-up can carry its name.
      event_time: isEvent ? f.event_time || null : null,
      event_name: isEvent || f.sale_type === "popup" ? f.event_name || null : null,
      event_theme: isEvent ? f.event_theme.trim() || null : null,
      event_venue: isEvent ? f.event_venue.trim() || null : null,
      event_date: isEvent ? f.event_date || null : null, booking_date: f.booking_date,
      package_id: f.package_id || null, package_name_snapshot: p?.name ?? null, quantity: n(f.quantity) || 1,
      selling_price: n(f.selling_price), discount: n(f.discount), amount_paid: n(f.amount_paid),
      payment_status: f.payment_status, notes: f.notes || null,
    } as never).select("id").single();
    if (error) { setBusy(false); return setErr(error.message); }
    const valid = lines.filter((l) => l.name && n(l.quantity) > 0);
    if (valid.length) {
      const { error: e2 } = await supabase.from("sale_materials").insert(valid.map((l) => ({
        sale_id: data.id, material_id: l.material_id || null, material_name_snapshot: l.name,
        quantity: n(l.quantity), unit_cost_snapshot: n(l.unit_cost),
      })));
      if (e2) { setBusy(false); return setErr(e2.message); }
    }
    const validOps = opLines.filter((x) => x.description.trim() && n(x.amount) > 0);
    if (validOps.length) {
      const { error: e3 } = await supabase.from("sale_expenses").insert(validOps.map((x) => ({
        sale_id: data.id, description: x.description.trim(), category: x.category || "Operations",
        amount: n(x.amount), expense_date: f.event_date || f.booking_date, notes: "From package",
      })) as never);
      if (e3) { setBusy(false); return setErr(e3.message); }
    }
    if (isEvent && f.event_date) await syncSaleToGoogle({ data: { saleId: data.id } }).catch(() => null);
    qc.invalidateQueries({ queryKey: ["biz"] });
    onDone();
    navigate({ to: "/admin/sales/$saleId", params: { saleId: data.id } });
  }

  return (
    <form className="adm-card adm-form" onSubmit={save}>
      <h2>{fixedType === "event" ? "New event booking" : fixedType === "made_to_order" ? "New made-to-order sale" : fixedType === "popup" ? "New pop-up sale" : "New sale"}</h2>
      {err && <p className="adm-error adm-wide">{err}</p>}
      {!fixedType && (
      <label className="adm-wide">What kind of sale is this?
        <select value={f.sale_type} onChange={(e) => pickType(e.target.value as SaleType)}>
          {SALE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <small className="adm-hint">
          {isEvent
            ? "A photobooth booking for an event date."
            : f.sale_type === "popup"
              ? "Pay-per-print at a pop-up. The Pop-up sales screen is faster for busy days."
              : "No event details needed, only the date of the sale."}
        </small>
      </label>
      )}
      <label>Customer name<input required value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></label>
      <label>Customer contact<input value={f.customer_contact} onChange={(e) => set("customer_contact", e.target.value)} /></label>
      <label>Customer email<input type="email" value={f.customer_email} onChange={(e) => set("customer_email", e.target.value)} /></label>
      {isEvent && (
        <>
          <label>Event name<input value={f.event_name} onChange={(e) => set("event_name", e.target.value)} /></label>
          <label>Theme<input value={f.event_theme} onChange={(e) => set("event_theme", e.target.value)} /></label>
          <label>Location / venue<input value={f.event_venue} onChange={(e) => set("event_venue", e.target.value)} /></label>
          <label>Event date<input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} /></label>
          <label>Event start time<input type="time" value={f.event_time} onChange={(e) => set("event_time", e.target.value)} /></label>
        </>
      )}
      {f.sale_type === "popup" && (
        <label>Pop-up name<input value={f.event_name} placeholder="e.g. Poblacion night market" onChange={(e) => set("event_name", e.target.value)} /></label>
      )}
      <label>{isEvent ? "Booking date" : "Date of sale"}<input type="date" required value={f.booking_date} onChange={(e) => set("booking_date", e.target.value)} /></label>
      <label>Package
        <select value={f.package_id} onChange={(e) => pickPackage(e.target.value)}>
          <option value="">No package / custom</option>
          {offered.map((p) => <option key={p.id} value={p.id}>{p.name} — {peso(p.selling_price)}</option>)}
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
            <span>
              {peso(n(l.quantity) * n(l.unit_cost))}
              {(() => {
                const stock = materials.data?.find((x) => x.id === l.material_id)?.current_stock;
                return l.material_id && stock !== undefined && n(stock) < n(l.quantity)
                  ? <small className="adm-neg"> · only {n(stock)} in stock</small>
                  : null;
              })()}
            </span>
            <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { material_id: "", name: "", quantity: "1", unit_cost: "0" }])}>+ Add material</Button>
        <p><strong>Total materials: {peso(matTotal)}</strong> · Net revenue: {peso(netRevenue)}</p>
      </div>
      <div className="adm-wide">
        <h3>Operation costs for this sale (staff, transport…)</h3>
        <p className="adm-hint">Filled in from the package. These count as expenses, so they are taken off before profit. You can change or remove any of them.</p>
        {opLines.map((x, i) => (
          <div className="adm-line" key={i}>
            <input value={x.description} aria-label="Cost name" placeholder="e.g. Staff salary" onChange={(e) => setOpLines(opLines.map((y, j) => j === i ? { ...y, description: e.target.value, category: expenseCategoryFor(e.target.value) } : y))} />
            <input type="number" step="0.01" min="0" value={x.amount} aria-label="Amount" onChange={(e) => setOpLines(opLines.map((y, j) => j === i ? { ...y, amount: e.target.value } : y))} />
            <span>{x.category}</span>
            <button type="button" onClick={() => setOpLines(opLines.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpLines([...opLines, { category: "Labor", description: "", amount: "0" }])}>+ Add operation cost</Button>
        <p><strong>Total operation costs: {peso(opLines.reduce((a, x) => a + n(x.amount), 0))}</strong></p>
      </div>
      <label className="adm-wide">Notes<textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      <div className="adm-row"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save sale"}</Button><Button type="button" variant="outline" onClick={onDone}>Cancel</Button></div>
      <p className="adm-hint adm-wide">You can add more expenses on the sale page after saving.</p>
    </form>
  );
}
