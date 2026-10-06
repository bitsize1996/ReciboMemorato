import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Stat } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePackages, useSales } from "@/lib/admin-data";
import { adminListEvents } from "@/lib/events.functions";
import { n, peso } from "@/lib/finance";
import { saleExpensesFromPackage } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/popup")({
  head: () => ({
    meta: [{ title: "Pop-up sales | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: PopupSalesPage,
});

const METHODS = [
  ["cash", "Cash"],
  ["gcash", "GCash"],
  ["other", "Other"],
] as const;

const QUICK_COUNTS = [1, 2, 3, 4, 5, 10];

const today = () => new Date().toISOString().slice(0, 10);
const timeOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

function PopupSalesPage() {
  const qc = useQueryClient();
  const packages = usePackages();
  const sales = useSales();
  const events = useQuery({ queryKey: ["admin-events"], queryFn: () => adminListEvents() });

  const [eventId, setEventId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [packageId, setPackageId] = useState("");
  const [prints, setPrints] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [received, setReceived] = useState("");
  const [customer, setCustomer] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const products = (packages.data ?? []).filter(
    (p) => p.active && (p as { service_type?: string }).service_type === "popup_print",
  );
  const product = products.find((p) => p.id === packageId) ?? (products.length === 1 ? products[0] : undefined);
  const eventList = (events.data ?? []) as { id: string; name: string; tags?: string[] | null; event_date: string | null }[];
  const popupEvents = eventList.filter((e) => e.tags?.includes("popup"));
  const otherEvents = eventList.filter((e) => !e.tags?.includes("popup"));
  const chosenEvent = eventList.find((e) => e.id === eventId);
  const eventLabel = chosenEvent?.name ?? (otherName.trim() || "Pop-up");

  const qty = Math.max(1, Math.round(n(prints)) || 1);
  const unit = unitPrice === "" ? n(product?.selling_price) : n(unitPrice);
  const total = unit * qty;
  const paid = received === "" ? total : n(received);
  const change = Math.max(paid - total, 0);

  const pickProduct = (id: string) => {
    setPackageId(id);
    setUnitPrice("");
  };

  async function record() {
    if (!product) return setError("Choose what was sold first.");
    setBusy(true);
    setError(null);
    setMessage(null);
    const amountPaid = Math.min(paid, total);
    const status = amountPaid >= total - 0.001 ? "fully_paid" : amountPaid > 0 ? "partially_paid" : "unpaid";
    const { data, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_name: customer.trim() || "Walk-in",
        event_id: eventId || null,
        event_name: eventLabel,
        event_date: date,
        booking_date: date,
        package_id: product.id,
        package_name_snapshot: product.name,
        quantity: qty,
        selling_price: total,
        discount: 0,
        amount_paid: amountPaid,
        payment_method: method,
        sale_type: "popup",
        payment_status: status,
        notes: "Pop-up pay-per-print",
      } as never)
      .select("id")
      .single();
    if (saleError || !data) {
      setBusy(false);
      return setError(saleError?.message ?? "Could not record the sale.");
    }
    if (product.package_materials.length > 0) {
      const { error: materialError } = await supabase.from("sale_materials").insert(
        product.package_materials.map((pm) => ({
          sale_id: data.id,
          material_id: pm.material_id,
          material_name_snapshot: pm.materials?.name ?? "Material",
          quantity: n(pm.quantity) * qty,
          unit_cost_snapshot: n(pm.materials?.current_unit_cost ?? 0),
        })),
      );
      if (materialError) {
        setBusy(false);
        return setError(materialError.message);
      }
    }
    // Staff and other operation costs per print, filed as expenses of this sale.
    const expenses = saleExpensesFromPackage(product as never, qty, total);
    if (expenses.length > 0) {
      await supabase.from("sale_expenses").insert(
        expenses.map((x) => ({
          sale_id: data.id, description: x.description, category: x.category,
          amount: x.amount, expense_date: date, notes: "From package",
        })) as never,
      );
    }
    setBusy(false);
    setMessage(`Recorded ${qty} print${qty === 1 ? "" : "s"} · ${peso(total)}${change > 0 ? ` (change ${peso(change)})` : ""}`);
    setPrints("1");
    setReceived("");
    setCustomer("");
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this sale? The materials go back into stock.")) return;
    const { error: deleteError } = await supabase.from("sales").delete().eq("id", id);
    if (deleteError) return setError(deleteError.message);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  const popupSales = useMemo(
    () =>
      (sales.data ?? []).filter(
        (s) => s.packages?.service_type === "popup_print" && s.payment_status !== "cancelled",
      ),
    [sales.data],
  );
  const daySales = popupSales
    .filter((s) => s.booking_date === date)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const dayTotals = daySales.reduce(
    (acc, s) => ({
      prints: acc.prints + n(s.quantity),
      revenue: acc.revenue + s.totals.netRevenue,
      cost: acc.cost + s.totals.totalCost,
      profit: acc.profit + s.totals.profit,
      cash: acc.cash + (s.payment_method === "cash" ? n(s.amount_paid) : 0),
      gcash: acc.gcash + (s.payment_method === "gcash" ? n(s.amount_paid) : 0),
    }),
    { prints: 0, revenue: 0, cost: 0, profit: 0, cash: 0, gcash: 0 },
  );

  // Totals for every pop-up, newest first.
  const perPopup = useMemo(() => {
    const map = new Map<string, { name: string; date: string; prints: number; revenue: number; profit: number }>();
    for (const s of popupSales) {
      const key = s.event_id ?? `${s.event_name ?? "Pop-up"}|${s.booking_date}`;
      const row = map.get(key) ?? { name: s.event_name ?? "Pop-up", date: s.booking_date, prints: 0, revenue: 0, profit: 0 };
      row.prints += n(s.quantity);
      row.revenue += s.totals.netRevenue;
      row.profit += s.totals.profit;
      if (s.booking_date > row.date) row.date = s.booking_date;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [popupSales]);

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Pop-up sales</h1>
          <p className="adm-hint">
            Record pay-per-print photobooth sales at pop-up events in a few taps. Materials come out of your stock and profit is worked out for you.
          </p>
        </div>
      </header>

      {error ? <p className="adm-error">{error}</p> : null}
      {message ? <p className="adm-hint" style={{ fontWeight: 600 }}>{message}</p> : null}

      {packages.data && products.length === 0 ? (
        <section className="adm-card">
          <p className="adm-empty">
            No pay-per-print prices yet. In <Link to="/admin/packages">Packages</Link>, add a package, set its
            type to <strong>Pop-up pay-per-print</strong>, and enter the price for one print and the materials one print uses.
          </p>
        </section>
      ) : (
        <section className="adm-card adm-form">
          <h2>New sale</h2>
          <label>
            Which pop-up?
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Not in my list (type a name)</option>
              {popupEvents.length > 0 ? (
                <optgroup label="Pop-up events">
                  {popupEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ) : null}
              {otherEvents.length > 0 ? (
                <optgroup label="Other events">
                  {otherEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ) : null}
            </select>
          </label>
          {!eventId ? (
            <label>
              Pop-up name
              <input value={otherName} placeholder="e.g. Poblacion night market" onChange={(e) => setOtherName(e.target.value)} />
            </label>
          ) : null}
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            What was sold?
            <select value={product?.id ?? ""} onChange={(e) => pickProduct(e.target.value)}>
              <option value="">Choose…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {peso(p.selling_price)} per print</option>
              ))}
            </select>
          </label>

          <div className="adm-wide" style={{ display: "grid", gap: 8 }}>
            <strong>Number of prints</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button type="button" variant="outline" onClick={() => setPrints(String(Math.max(1, qty - 1)))} aria-label="One less">−</Button>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={prints}
                onChange={(e) => setPrints(e.target.value)}
                aria-label="Number of prints"
                style={{ width: 90, textAlign: "center", fontSize: 20 }}
              />
              <Button type="button" variant="outline" onClick={() => setPrints(String(qty + 1))} aria-label="One more">+</Button>
              {QUICK_COUNTS.map((count) => (
                <Button key={count} type="button" size="sm" variant={qty === count ? "default" : "outline"} onClick={() => setPrints(String(count))}>
                  {count}
                </Button>
              ))}
            </div>
          </div>

          <label>
            Price per print (₱)
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitPrice === "" ? (product ? String(n(product.selling_price)) : "") : unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
          <label>
            Paid by
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>
            Amount received (₱)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={String(total)}
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />
          </label>
          <label>
            Customer name (optional)
            <input value={customer} placeholder="Walk-in" onChange={(e) => setCustomer(e.target.value)} />
          </label>

          <div className="adm-wide" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div className="adm-hint">Total</div>
              <strong style={{ fontSize: 28 }}>{peso(total)}</strong>
              {change > 0 ? <div className="adm-hint">Change to give: {peso(change)}</div> : null}
            </div>
            <Button type="button" size="lg" disabled={busy || !product} onClick={record}>
              {busy ? "Saving…" : `Record ${qty} print${qty === 1 ? "" : "s"}`}
            </Button>
          </div>
        </section>
      )}

      <div className="adm-stats" style={{ margin: "16px 0" }}>
        <Stat label={`Prints on ${date}`} value={String(dayTotals.prints)} sub={`${daySales.length} sale${daySales.length === 1 ? "" : "s"}`} />
        <Stat label="Sales" value={peso(dayTotals.revenue)} sub={`Cash ${peso(dayTotals.cash)} · GCash ${peso(dayTotals.gcash)}`} />
        <Stat label="Materials & operation costs" value={peso(dayTotals.cost)} />
        <Stat label="Profit" value={peso(dayTotals.profit)} />
      </div>

      <section className="adm-card adm-scroll">
        <h2>Sales on {date}</h2>
        {sales.isPending ? <p>Loading…</p> : !daySales.length ? <p className="adm-empty">No pop-up sales on this date yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Time</th><th>Pop-up</th><th>Prints</th><th>Amount</th><th>Paid by</th><th /></tr></thead>
            <tbody>
              {daySales.map((s) => (
                <tr key={s.id}>
                  <td>{timeOf(s.created_at)}</td>
                  <td>{s.event_name ?? "Pop-up"}{s.customer_name && s.customer_name !== "Walk-in" ? <small className="adm-hint"> — {s.customer_name}</small> : null}</td>
                  <td>{n(s.quantity)}</td>
                  <td>{peso(s.totals.netRevenue)}</td>
                  <td>{METHODS.find(([key]) => key === s.payment_method)?.[1] ?? "—"}</td>
                  <td className="adm-actions"><button onClick={() => remove(s.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="adm-card adm-scroll" style={{ marginTop: 16 }}>
        <h2>Every pop-up</h2>
        {!perPopup.length ? <p className="adm-empty">Nothing recorded yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Pop-up</th><th>Last date</th><th>Prints</th><th>Sales</th><th>Profit</th></tr></thead>
            <tbody>
              {perPopup.map((row) => (
                <tr key={`${row.name}-${row.date}`}>
                  <td>{row.name}</td>
                  <td>{row.date}</td>
                  <td>{row.prints}</td>
                  <td>{peso(row.revenue)}</td>
                  <td className={row.profit < 0 ? "adm-neg" : ""}>{peso(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
