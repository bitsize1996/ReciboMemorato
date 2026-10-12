import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAddons, useMaterials } from "@/lib/admin-data";
import { brandName, copyText, gmailComposeUrl, invoiceMessage, useBusinessInfo } from "@/lib/messages";
import { agreementStatusLabel } from "@/lib/agreement";
import { downloadInvoicePdf, invoiceDataFromSale } from "@/lib/invoice-pdf";
import { computeSaleEdit } from "@/lib/sale-edit";
import { saleExpensesFromPackage } from "@/lib/pricing";
import { usePackages } from "@/lib/admin-data";
import { siteSettingsQuery } from "@/lib/site.functions";
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES, n, pct, peso, saleCode, saleTotals, statusLabel, saleTypeLabel, SALE_TYPES, saleTypeOfPackage } from "@/lib/finance";
import { useServerFn } from "@tanstack/react-start";
import { syncSaleToGoogle } from "@/lib/calendar.functions";

type EditForm = {
  customer_name: string; customer_contact: string; customer_email: string; sale_type: string; booking_date: string;
  event_name: string; event_theme: string; event_venue: string; backdrop: string; event_date: string; event_time: string;
  service_hours: string; package_id: string; quantity: string; selling_price: string; discount: string; notes: string;
  reprice: boolean; rescale: boolean; resetFromPackage: boolean;
};

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
        backdrop?: string | null;
        service_hours?: number | null;
      }) | null;
    },
  });
  const [exp, setExp] = useState<null | { description: string; category: string; amount: string; expense_date: string; notes: string }>(null);
  const childMatches = useChildMatches();
  const agreementStatus = useQuery({
    queryKey: ["biz", "agreement-status", saleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agreements").select("status").eq("sale_id", saleId).maybeSingle();
      return error ? null : ((data?.status ?? null) as string | null);
    },
  });
  const materials = useMaterials();
  const allPackages = usePackages();
  const addonCatalog = useAddons();
  const [addonPick, setAddonPick] = useState<null | { addon_id: string; quantity: string }>(null);
  const biz = useBusinessInfo();
  const site = useQuery(siteSettingsQuery);
  const [mat, setMat] = useState<null | { material_id: string; quantity: string }>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const syncFn = useServerFn(syncSaleToGoogle);
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] });

  // The invoice is a page inside this one. Without this line the address changed but the invoice never showed.
  if (childMatches.length > 0) return <Outlet />;
  if (sale.isPending) return <div className="adm-page"><p>Loading…</p></div>;
  if (!sale.data) return <div className="adm-page"><p>Sale not found.</p><Link to="/admin/sales">Back to sales</Link></div>;
  const s = sale.data;
  const t = saleTotals(s);
  const isEventSale = (s.sale_type ?? "event") === "event";
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

  function startEdit() {
    setErr(null);
    setEdit({
      customer_name: s.customer_name,
      customer_contact: s.customer_contact ?? "",
      customer_email: s.customer_email ?? "",
      sale_type: ((s.sale_type ?? "event") as string),
      booking_date: s.booking_date,
      event_name: s.event_name ?? "",
      event_theme: s.event_theme ?? "",
      event_venue: s.event_venue ?? "",
      backdrop: s.backdrop ?? "",
      event_date: s.event_date ?? "",
      event_time: s.event_time ?? "",
      service_hours: s.service_hours ? String(s.service_hours) : "",
      package_id: s.package_id ?? "",
      quantity: String(s.quantity ?? 1),
      selling_price: String(s.selling_price ?? 0),
      discount: String(s.discount ?? 0),
      notes: s.notes ?? "",
      reprice: true,
      rescale: true,
      resetFromPackage: false,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setErr(null);
    const pkg = allPackages.data?.find((x) => x.id === edit.package_id);
    const packageChanged = (edit.package_id || null) !== (s.package_id || null);
    const reset = packageChanged && edit.resetFromPackage && Boolean(pkg);
    const result = computeSaleEdit({
      old: s,
      next: edit,
      resetPackagePrice: reset && pkg ? n(pkg.selling_price) : null,
      reprice: edit.reprice,
      addonsTotal: t.addons,
    });
    const oldQty = n(s.quantity) || 1;
    const newQty = result.quantity;
    const price = result.price;

    const isEvent = edit.sale_type === "event";
    const isPopup = edit.sale_type === "popup";
    const patch: Record<string, unknown> = {
      customer_name: edit.customer_name.trim() || s.customer_name,
      customer_contact: edit.customer_contact.trim() || null,
      customer_email: edit.customer_email.trim() || null,
      sale_type: edit.sale_type,
      booking_date: edit.booking_date || s.booking_date,
      package_id: edit.package_id || null,
      package_name_snapshot: pkg ? pkg.name : packageChanged ? null : s.package_name_snapshot,
      quantity: newQty,
      selling_price: price,
      discount: n(edit.discount),
      notes: edit.notes.trim() || null,
      event_name: isEvent || isPopup ? edit.event_name.trim() || null : null,
      event_theme: isEvent ? edit.event_theme.trim() || null : null,
      event_venue: isEvent ? edit.event_venue.trim() || null : null,
      backdrop: isEvent ? edit.backdrop.trim() || null : null,
      event_date: isEvent ? edit.event_date || null : null,
      event_time: isEvent ? edit.event_time || null : null,
      service_hours: isEvent && n(edit.service_hours) > 0 ? n(edit.service_hours) : null,
    };

    patch["payment_status"] = result.paymentStatus;

    const { error } = await supabase.from("sales").update(patch as never).eq("id", s.id);
    if (error) return setErr(error.message);

    if (reset && pkg) {
      // Start the materials and package costs again from the new package.
      await supabase.from("sale_materials").delete().eq("sale_id", s.id);
      await supabase.from("sale_expenses").delete().eq("sale_id", s.id).like("notes", "From package%");
      if (pkg.package_materials.length > 0) {
        await supabase.from("sale_materials").insert(
          pkg.package_materials.map((pm) => ({
            sale_id: s.id,
            material_id: pm.material_id,
            material_name_snapshot: pm.materials?.name ?? "Material",
            quantity: n(pm.quantity) * newQty,
            unit_cost_snapshot: n(pm.materials?.current_unit_cost ?? 0),
          })),
        );
      }
      const costs = saleExpensesFromPackage(pkg as never, newQty, price);
      if (costs.length > 0) {
        await supabase.from("sale_expenses").insert(
          costs.map((x) => ({
            sale_id: s.id, description: x.description, category: x.category, amount: x.amount,
            expense_date: edit.event_date || edit.booking_date || s.booking_date, notes: "From package",
          })) as never,
        );
      }
    } else if (newQty !== oldQty && edit.rescale) {
      const ratio = result.ratio;
      await Promise.all([
        ...s.sale_materials.map((m) =>
          supabase.from("sale_materials").update({ quantity: Math.round(n(m.quantity) * ratio * 100) / 100 }).eq("id", m.id),
        ),
        ...s.sale_expenses
          .filter((x) => (x.notes ?? "").startsWith("From package"))
          .map((x) => supabase.from("sale_expenses").update({ amount: Math.round(n(x.amount) * ratio * 100) / 100 }).eq("id", x.id)),
      ]);
    }

    const eventTouched =
      isEvent &&
      (edit.event_name !== (s.event_name ?? "") || edit.event_date !== (s.event_date ?? "") ||
        edit.event_time !== (s.event_time ?? "") || edit.event_venue !== (s.event_venue ?? ""));
    setEdit(null);
    setMsg("Saved your changes.");
    refresh();
    if (eventTouched && s.gcal_event_id) void syncCal();
  }

  async function updateLine(table: "sale_materials" | "sale_expenses" | "sale_addons", id: string, values: Record<string, number>) {
    const { error } = await supabase.from(table).update(values as never).eq("id", id);
    if (error) return setErr(error.message);
    setErr(null);
    refresh();
  }

  async function addPackageCosts() {
    const pkg = allPackages.data?.find((x) => x.id === s.package_id);
    if (!pkg) return;
    const rows = saleExpensesFromPackage(pkg as never, n(s.quantity) || 1, n(s.selling_price));
    if (rows.length === 0) return;
    const { error } = await supabase.from("sale_expenses").insert(
      rows.map((x) => ({
        sale_id: s.id, description: x.description, category: x.category, amount: x.amount,
        expense_date: s.event_date ?? s.booking_date, notes: "From package",
      })) as never,
    );
    if (error) return setErr(error.message);
    setErr(null); refresh();
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
        <div>
          {(s.sale_type ?? "event") === "made_to_order" ? (
            <Link to="/admin/sales/orders">← Made-to-order sales</Link>
          ) : (s.sale_type ?? "event") === "popup" ? (
            <Link to="/admin/popup">← Pop-up sales</Link>
          ) : (
            <Link to="/admin/sales/events">← Event bookings</Link>
          )}
          <h1>Sale {saleCode(s.sale_number)}</h1>
        </div>
        <div className="adm-row">
          <Button asChild variant="outline">
            <Link to="/admin/sales/$saleId/invoice" params={{ saleId: s.id }}>Invoice</Link>
          </Button>
          {isEventSale ? (
            <Button asChild variant="outline">
              <Link to="/admin/sales/$saleId/agreement" params={{ saleId: s.id }}>
                Service agreement{agreementStatus.data ? ` · ${agreementStatusLabel(agreementStatus.data)}` : ""}
              </Link>
            </Button>
          ) : null}
          <Button
            onClick={() =>
              downloadInvoicePdf(
                invoiceDataFromSale(s as never, {
                  brand: [site.data?.brandLine1 ?? "RECIBO", site.data?.brandLine2 ?? "MEMORATO"].join(" "),
                  tagline: (site.data?.brandSub ?? "by the bitsize sibs").toLowerCase(),
                  paymentInstructions: biz.data?.paymentInstructions ?? "",
                }),
              )
            }
          >
            Download invoice PDF
          </Button>
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
      {edit && (
        <form className="adm-card adm-form" onSubmit={saveEdit}>
          <h2>Edit sale details</h2>
          <label>Customer name<input required value={edit.customer_name} onChange={(e) => setEdit({ ...edit, customer_name: e.target.value })} /></label>
          <label>Contact (phone or Messenger)<input value={edit.customer_contact} onChange={(e) => setEdit({ ...edit, customer_contact: e.target.value })} /></label>
          <label>Email<input type="email" value={edit.customer_email} onChange={(e) => setEdit({ ...edit, customer_email: e.target.value })} /></label>
          <label>Kind of sale
            <select value={edit.sale_type} onChange={(e) => setEdit({ ...edit, sale_type: e.target.value })}>
              {SALE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {edit.sale_type === "event" && (
            <>
              <label>Event name<input value={edit.event_name} onChange={(e) => setEdit({ ...edit, event_name: e.target.value })} /></label>
              <label>Theme<input value={edit.event_theme} onChange={(e) => setEdit({ ...edit, event_theme: e.target.value })} /></label>
              <label>Location / venue<input value={edit.event_venue} onChange={(e) => setEdit({ ...edit, event_venue: e.target.value })} /></label>
              <label>Backdrop<input value={edit.backdrop} onChange={(e) => setEdit({ ...edit, backdrop: e.target.value })} /></label>
              <label>Event date<input type="date" value={edit.event_date} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} /></label>
              <label>Event start time<input type="time" value={edit.event_time} onChange={(e) => setEdit({ ...edit, event_time: e.target.value })} /></label>
              <label>Hours of service<input type="number" step="0.5" min="0" value={edit.service_hours} onChange={(e) => setEdit({ ...edit, service_hours: e.target.value })} /></label>
            </>
          )}
          {edit.sale_type === "popup" && (
            <label>Pop-up name<input value={edit.event_name} onChange={(e) => setEdit({ ...edit, event_name: e.target.value })} /></label>
          )}
          <label>{edit.sale_type === "event" ? "Booking date" : "Date of sale"}<input type="date" required value={edit.booking_date} onChange={(e) => setEdit({ ...edit, booking_date: e.target.value })} /></label>
          <label>Package
            <select value={edit.package_id} onChange={(e) => setEdit({ ...edit, package_id: e.target.value })}>
              <option value="">No package / custom</option>
              {(allPackages.data ?? []).filter((p) => p.active || p.id === s.package_id).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {peso(p.selling_price)}</option>
              ))}
            </select>
          </label>
          <label>Quantity<input type="number" min="1" step="1" value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></label>
          <label>Price for the package (₱, total for the quantity)<input type="number" step="0.01" min="0" value={edit.selling_price} onChange={(e) => setEdit({ ...edit, selling_price: e.target.value })} /></label>
          <label>Discount (₱)<input type="number" step="0.01" min="0" value={edit.discount} onChange={(e) => setEdit({ ...edit, discount: e.target.value })} /></label>
          <label className="adm-wide">Notes<textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>

          {(Math.max(1, Math.round(n(edit.quantity)) || 1) !== (n(s.quantity) || 1)) && (
            <div className="adm-wide" style={{ display: "grid", gap: 6 }}>
              <label className="adm-check">
                <input type="checkbox" checked={edit.reprice} onChange={(e) => setEdit({ ...edit, reprice: e.target.checked })} />
                Change the price to match the new quantity (unless you typed a price above)
              </label>
              <label className="adm-check">
                <input type="checkbox" checked={edit.rescale} onChange={(e) => setEdit({ ...edit, rescale: e.target.checked })} />
                Change the materials and package costs to match the new quantity
              </label>
            </div>
          )}
          {(edit.package_id || null) !== (s.package_id || null) && edit.package_id && (
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={edit.resetFromPackage} onChange={(e) => setEdit({ ...edit, resetFromPackage: e.target.checked })} />
              Replace the price, materials and package costs with the new package's
            </label>
          )}
          <p className="adm-hint adm-wide">
            Materials are taken from or put back into your stock as they change. If this sale is on your Google Calendar, it is updated
            when the event details change. A saved service agreement will tell you when the booking details no longer match it.
          </p>
          <div className="adm-row adm-wide">
            <Button type="submit">Save changes</Button>
            <Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
          </div>
        </form>
      )}
      <div className="adm-grid">
        <section className="adm-card">
          <div className="adm-head"><h2>Details</h2><Button size="sm" variant="outline" onClick={startEdit}>Edit details</Button></div>
          <dl className="adm-dl">
            <dt>Customer</dt><dd>{s.customer_name}</dd>
            <dt>Contact</dt><dd>{s.customer_contact ?? "—"}</dd>
            <dt>Email</dt><dd>{s.customer_email ?? "—"}</dd>
            <dt>Type</dt><dd>{saleTypeLabel(s.sale_type)}</dd>
            {isEventSale || s.event_name ? <><dt>{isEventSale ? "Event" : "Pop-up"}</dt><dd>{s.event_name ?? "—"}</dd></> : null}
            {s.event_theme ? <><dt>Theme</dt><dd>{s.event_theme}</dd></> : null}
            {s.event_venue ? <><dt>Location</dt><dd>{s.event_venue}</dd></> : null}
            {s.backdrop ? <><dt>Backdrop</dt><dd>{s.backdrop}</dd></> : null}
            {isEventSale ? <><dt>Event date</dt><dd>{s.event_date ?? "—"}{s.event_time ? ` · ${s.event_time}` : ""}</dd></> : null}
            {isEventSale && n(s.service_hours) > 0 ? <><dt>Service hours</dt><dd>{n(s.service_hours)}</dd></> : null}
            <dt>{isEventSale ? "Booking date" : "Date of sale"}</dt><dd>{s.booking_date}</dd>
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
              <tr key={a.id}><td>{a.name_snapshot}</td><td><input type="number" step="1" min="1" style={{ width: 70 }} defaultValue={n(a.quantity)} aria-label="Quantity" onBlur={(e) => n(e.target.value) > 0 && n(e.target.value) !== n(a.quantity) && updateLine("sale_addons", a.id, { quantity: n(e.target.value) })} /></td><td>{peso(a.unit_price_snapshot)}</td><td>{peso(a.total_price)}</td>
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
              <tr key={m.id}><td>{m.material_name_snapshot}</td><td><input type="number" step="0.01" min="0" style={{ width: 80 }} defaultValue={n(m.quantity)} aria-label="Quantity" onBlur={(e) => n(e.target.value) >= 0 && n(e.target.value) !== n(m.quantity) && updateLine("sale_materials", m.id, { quantity: n(e.target.value) })} /></td><td>{peso(m.unit_cost_snapshot)}</td><td>{peso(m.total_cost)}</td>
                <td className="adm-actions"><button onClick={() => del("sale_materials", m.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
        <p><strong>Total materials: {peso(t.materials)}</strong></p>
        <p className="adm-hint">The materials used here are taken out of your inventory automatically. Removing one, or cancelling the sale, puts it back.</p>
      </section>

      <section className="adm-card">
        <div className="adm-head"><h2>Operation costs &amp; other expenses</h2>
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
        {!s.sale_expenses.length ? <p className="adm-empty">No operation costs or expenses recorded yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Expense</th><th>Category</th><th>Date</th><th>Amount</th><th /></tr></thead>
            <tbody>{s.sale_expenses.map((x) => (
              <tr key={x.id}><td>{x.description}{x.notes ? <small className="adm-hint"> — {x.notes}</small> : null}</td><td>{x.category}</td><td>{x.expense_date}</td><td><input type="number" step="0.01" min="0" style={{ width: 100 }} defaultValue={n(x.amount)} aria-label="Amount" onBlur={(e) => n(e.target.value) >= 0 && n(e.target.value) !== n(x.amount) && updateLine("sale_expenses", x.id, { amount: n(e.target.value) })} /></td>
                <td className="adm-actions"><button onClick={() => del("sale_expenses", x.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
        {(() => {
          const pkg = allPackages.data?.find((x) => x.id === s.package_id);
          const fromPackage = pkg ? saleExpensesFromPackage(pkg as never, n(s.quantity) || 1, n(s.selling_price)) : [];
          const alreadyAdded = s.sale_expenses.some((x) => (x.notes ?? "").startsWith("From package"));
          return fromPackage.length > 0 && !alreadyAdded ? (
            <div style={{ margin: "8px 0" }}>
              <Button type="button" size="sm" variant="outline" onClick={addPackageCosts}>
                Add this package's operation costs ({peso(fromPackage.reduce((a, x) => a + x.amount, 0))})
              </Button>
              <p className="adm-hint">Adds {fromPackage.map((x) => x.description).join(", ")} from the package, so they count as expenses on this sale.</p>
            </div>
          ) : null;
        })()}
        <p><strong>Total operation costs &amp; expenses: {peso(t.expenses)}</strong></p>
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
              <span style={{ color: "#2b6cb0" }}>■</span> Operation costs (staff…) &nbsp;
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
                <tr><td><strong>Operation costs &amp; expenses</strong></td><td>{peso(t.expenses)}</td><td>{share(t.expenses).toFixed(1)}%</td></tr>
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
          <dt>Less operation costs &amp; expenses</dt><dd>− {peso(t.expenses)}</dd>
          <dt>Total costs</dt><dd>{peso(t.totalCost)}</dd>
          <dt><strong>Net profit</strong></dt><dd className={t.profit < 0 ? "adm-neg" : ""}><strong>{peso(t.profit)}</strong></dd>
          <dt>Profit margin</dt><dd>{pct(t.margin)}</dd>
        </dl>
      </section>
    </div>
  );
}
