import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddons, useMaterials, usePackages } from "@/lib/admin-data";
import { margin, n, pct, peso } from "@/lib/finance";
import { analyzePrice, opCostAt, opsFromSaved, suggestPrice, type MarginMode, type OpCost } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  head: () => ({ meta: [{ title: "Packages | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: PackagesPage,
});

type Line = { material_id: string; quantity: string };
type Form = {
  id?: string; name: string; description: string; selling_price: string; estimated_other_costs: string;
  included_services: string; notes: string; active: boolean; lines: Line[];
  service_type: string; popup_available: boolean;
  ops: OpCost[]; margin_mode: MarginMode; target_margin: string; round_to: string;
};
const OP_SUGGESTIONS = ["Labor", "Transport", "Electricity", "Equipment wear", "Packaging", "Payment fee", "Marketing", "Rent share"];
const EMPTY: Form = { name: "", description: "", selling_price: "0", estimated_other_costs: "0", included_services: "", notes: "", active: true, lines: [], service_type: "event", popup_available: false, ops: [], margin_mode: "margin", target_margin: "40", round_to: "0" };

type AddonForm = { id?: string; name: string; description: string; price: string; sort_order: string; active: boolean };
const EMPTY_ADDON: AddonForm = { name: "", description: "", price: "0", sort_order: "0", active: true };

function AddonsSection() {
  const qc = useQueryClient();
  const addons = useAddons();
  const [form, setForm] = useState<AddonForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = addons.data?.rows ?? [];
  const set = (k: keyof AddonForm, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      price: n(form.price), sort_order: Math.round(n(form.sort_order)), active: form.active,
    };
    const table = (supabase as any).from("addons");
    const { error } = form.id ? await table.update(payload).eq("id", form.id) : await table.insert(payload);
    if (error) return setErr(error.message);
    setForm(null); setErr(null);
    qc.invalidateQueries({ queryKey: ["biz", "addons"] });
    qc.invalidateQueries({ queryKey: ["booking-options"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this add-on? Past bookings keep it.")) return;
    const { error } = await (supabase as any).from("addons").delete().eq("id", id);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["biz", "addons"] });
    qc.invalidateQueries({ queryKey: ["booking-options"] });
  }

  return (
    <section className="adm-card">
      <div className="adm-head">
        <div>
          <h2>Add-ons</h2>
          <p className="adm-hint">Extras customers can tick on the booking form, such as an extra hour or more prints. Each shows its price and is added to their booking.</p>
        </div>
        <Button size="sm" onClick={() => setForm(EMPTY_ADDON)}>+ Add add-on</Button>
      </div>
      {err && <p className="adm-error">{err}</p>}
      {addons.data && !addons.data.ready && (
        <p className="adm-error">Add-ons need a one-time database setup before they can be used. Once it has been run, reload this page.</p>
      )}
      {form && (
        <form className="adm-form" onSubmit={save}>
          <label>Add-on name<input required value={form.name} placeholder="Extra hour, 20 extra prints…" onChange={(e) => set("name", e.target.value)} /></label>
          <label>Price (₱)<input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} /></label>
          <label className="adm-wide">What it includes<textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label>Order on the form (lower shows first)<input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></label>
          <label className="adm-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Show on the booking form</label>
          <div className="adm-row"><Button type="submit">Save</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>
      )}
      {addons.data?.ready && !rows.length && !form ? <p className="adm-empty">No add-ons yet.</p> : null}
      {rows.length > 0 && (
        <table className="adm-table">
          <thead><tr><th>Add-on</th><th>Price</th><th>Shown</th><th /></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id}>
              <td>{a.name}{a.description ? <small className="adm-hint"> — {a.description}</small> : null}</td>
              <td>{peso(a.price)}</td>
              <td>{a.active ? "Yes" : "Hidden"}</td>
              <td className="adm-actions">
                <button onClick={() => setForm({ id: a.id, name: a.name, description: a.description ?? "", price: String(a.price), sort_order: String(a.sort_order), active: a.active })}>Edit</button>
                <button onClick={() => remove(a.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function PackagesPage() {
  const qc = useQueryClient();
  const packages = usePackages();
  const materials = useMaterials();
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const matById = new Map((materials.data ?? []).map((m) => [m.id, m]));

  const formMaterialCost = (form?.lines ?? []).reduce(
    (a, l) => a + n(l.quantity) * n(matById.get(l.material_id)?.current_unit_cost), 0);

  // Price calculator: what the materials and operation costs add up to, and the price that reaches the target.
  const calc = (() => {
    if (!form) return null;
    const suggestion = suggestPrice({
      materialCost: formMaterialCost, ops: form.ops, targetPercent: n(form.target_margin),
      mode: form.margin_mode, roundTo: n(form.round_to),
    });
    const atSelling = analyzePrice(n(form.selling_price), formMaterialCost, form.ops);
    const atSuggested = suggestion.price != null ? analyzePrice(suggestion.price, formMaterialCost, form.ops) : null;
    return { suggestion, atSelling, atSuggested };
  })();

  const [newMat, setNewMat] = useState<null | { name: string; unit: string; price: string }>(null);

  async function createMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!newMat || !newMat.name.trim()) return;
    const { data, error } = await supabase.from("materials")
      .insert({ name: newMat.name.trim(), unit: newMat.unit.trim() || "pc", current_unit_cost: n(newMat.price) })
      .select("id").single();
    if (error) return setErr(error.message);
    setNewMat(null); setErr(null);
    await qc.invalidateQueries({ queryKey: ["biz"] });
    setForm((f) => (f ? { ...f, lines: [...f.lines, { material_id: data.id, quantity: "1" }] } : f));
  }

  async function changeMaterialPrice(materialId: string) {
    const m = matById.get(materialId);
    if (!m) return;
    const answer = window.prompt(
      `New price per ${m.unit} for ${m.name}?\n\nThis changes the price everywhere (other packages too). Past sales keep their old cost.`,
      String(m.current_unit_cost),
    );
    if (answer === null) return;
    const price = Number(answer);
    if (!Number.isFinite(price) || price < 0) return setErr("Please enter a valid price.");
    const { error } = await supabase.from("materials").update({ current_unit_cost: price }).eq("id", materialId);
    if (error) return setErr(error.message);
    setErr(null);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(), description: form.description || null,
      selling_price: n(form.selling_price),
      // Total operation cost at the chosen selling price, so every profit figure stays in step.
      estimated_other_costs: Math.round(opCostAt(form.ops, n(form.selling_price)) * 100) / 100,
      included_services: form.included_services || null, notes: form.notes || null, active: form.active,
      service_type: form.service_type, popup_available: form.service_type === "made_to_order" && form.popup_available,
    };
    const calculatorFields = {
      operation_costs: form.ops
        .filter((op) => op.label.trim() || n(op.amount) > 0)
        .map((op) => ({ label: op.label.trim(), amount: n(op.amount), percent: op.percent })),
      target_margin: form.target_margin === "" ? null : n(form.target_margin),
      margin_mode: form.margin_mode,
    };
    const writePackage = (body: object) =>
      form.id
        ? supabase.from("packages").update(body as never).eq("id", form.id)
        : supabase.from("packages").insert(body as never).select("id").single();
    let id = form.id;
    let { data: saved, error: saveError } = await writePackage({ ...payload, ...calculatorFields });
    // Older databases may not have the calculator columns yet; still save the package itself.
    if (saveError && /operation_costs|target_margin|margin_mode/i.test(saveError.message)) {
      ({ data: saved, error: saveError } = await writePackage(payload));
    }
    if (saveError) return setErr(saveError.message);
    if (id) await supabase.from("package_materials").delete().eq("package_id", id);
    else id = (saved as { id: string }).id;
    const lines = form.lines.filter((l) => l.material_id && n(l.quantity) > 0);
    if (lines.length) {
      const { error } = await supabase.from("package_materials").insert(
        lines.map((l) => ({ package_id: id!, material_id: l.material_id, quantity: n(l.quantity) })));
      if (error) return setErr(error.message);
    }
    setForm(null); setErr(null);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this package? Past sales keep their saved details.")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  const set = (k: keyof Form, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setLine = (i: number, patch: Partial<Line>) =>
    setForm((f) => (f ? { ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : f));

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Packages</h1>
        <Button onClick={() => setForm(EMPTY)}>+ Add package</Button>
      </header>
      {err && <p className="adm-error">{err}</p>}
      {form && (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2>{form.id ? "Edit package" : "New package"}</h2>
          <label>Package name<input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>Selling price (₱)<input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} /></label>
          <label className="adm-wide">Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="adm-wide">Included services<textarea value={form.included_services} onChange={(e) => set("included_services", e.target.value)} placeholder="e.g. 3 hours, 50 prints, all digital photos" /></label>
          <label>Type of service
            <select value={form.service_type} onChange={(e) => set("service_type", e.target.value)}>
              <option value="event">Event service (photobooth, booked for an event)</option>
              <option value="made_to_order">Made to order (Sintra board, Instax prints…)</option>
            </select>
          </label>
          {form.service_type === "made_to_order" && (
            <label className="adm-check"><input type="checkbox" checked={form.popup_available} onChange={(e) => set("popup_available", e.target.checked)} /> Also sold at pop-up events</label>
          )}
          <label className="adm-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <div className="adm-wide" style={{ display: "grid", gap: 14, padding: 14, border: "1px solid var(--adm-line)", borderRadius: 8 }}>
            <h3 style={{ margin: 0 }}>Price calculator</h3>
            <p className="adm-hint" style={{ margin: 0 }}>
              Add the materials this package uses and your operation costs. Choose the margin you want and the calculator suggests a selling price.
            </p>

            <div>
              <strong>1. Materials (net material cost)</strong>
              {form.lines.map((l, i) => {
                const m = matById.get(l.material_id);
                const lineCost = n(l.quantity) * n(m?.current_unit_cost);
                return (
                  <div className="adm-line" key={i}>
                    <select value={l.material_id} onChange={(e) => setLine(i, { material_id: e.target.value })} aria-label="Material">
                      <option value="">Choose material…</option>
                      {(materials.data ?? []).filter((x) => x.active || x.id === l.material_id).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    <input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Pieces" title="Pieces used" />
                    <span>{m ? `× ${peso(m.current_unit_cost)}/${m.unit}` : ""}</span>
                    <span>{peso(lineCost)}{formMaterialCost > 0 && lineCost > 0 ? <small className="adm-hint"> ({((lineCost / formMaterialCost) * 100).toFixed(0)}%)</small> : null}</span>
                    {m ? <button type="button" onClick={() => changeMaterialPrice(l.material_id)}>Change price</button> : null}
                    <button type="button" onClick={() => set("lines", form.lines.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => set("lines", [...form.lines, { material_id: "", quantity: "1" }])}>+ Add material</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setNewMat({ name: "", unit: "pc", price: "0" })}>+ New material (not in my list yet)</Button>
              </div>
              {newMat && (
                <div className="adm-line" style={{ marginTop: 8 }}>
                  <input placeholder="Material name" value={newMat.name} onChange={(e) => setNewMat({ ...newMat, name: e.target.value })} aria-label="New material name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createMaterial(e as never); } }} />
                  <input placeholder="Unit (pc, sheet…)" value={newMat.unit} onChange={(e) => setNewMat({ ...newMat, unit: e.target.value })} aria-label="Unit" style={{ width: 110 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createMaterial(e as never); } }} />
                  <input type="number" step="0.01" min="0" placeholder="Price per unit" value={newMat.price} onChange={(e) => setNewMat({ ...newMat, price: e.target.value })} aria-label="Price per unit" style={{ width: 120 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createMaterial(e as never); } }} />
                  <button type="button" onClick={(e) => createMaterial(e as never)}>Create &amp; add</button>
                  <button type="button" onClick={() => setNewMat(null)}>Cancel</button>
                </div>
              )}
              <p><strong>Net material cost: {peso(formMaterialCost)}</strong></p>
            </div>

            <div>
              <strong>2. Operation costs</strong>
              <p className="adm-hint" style={{ margin: "2px 0 6px" }}>Labor, transport, electricity, packaging… Tick "% of price" for fees that depend on the price, such as a payment fee.</p>
              <datalist id="op-suggestions">{OP_SUGGESTIONS.map((x) => <option key={x} value={x} />)}</datalist>
              {form.ops.map((op, i) => (
                <div className="adm-line" key={i}>
                  <input list="op-suggestions" placeholder="e.g. Labor" value={op.label} onChange={(e) => set("ops", form.ops.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))} aria-label="Cost name" />
                  <input type="number" step="0.01" min="0" value={op.amount} onChange={(e) => set("ops", form.ops.map((o, j) => (j === i ? { ...o, amount: e.target.value } : o)))} aria-label="Amount" />
                  <label className="adm-check"><input type="checkbox" checked={op.percent} onChange={(e) => set("ops", form.ops.map((o, j) => (j === i ? { ...o, percent: e.target.checked } : o)))} /> % of price</label>
                  <span>{peso(opCostAt([op], n(form.selling_price)))}</span>
                  <button type="button" onClick={() => set("ops", form.ops.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("ops", [...form.ops, { label: "", amount: "0", percent: false }])}>+ Add operation cost</Button>
              <p><strong>Operation costs at your selling price: {peso(calc?.atSelling.operations ?? 0)}</strong></p>
            </div>

            <div>
              <strong>3. Your target</strong>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  I want a
                  <select value={form.margin_mode} onChange={(e) => set("margin_mode", e.target.value)}>
                    <option value="margin">margin (profit as % of the price)</option>
                    <option value="markup">markup (profit as % of the cost)</option>
                  </select>
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  of
                  <input type="number" step="0.1" min="0" style={{ width: 80 }} value={form.target_margin} onChange={(e) => set("target_margin", e.target.value)} aria-label="Target percent" />%
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  Round the price up to
                  <select value={form.round_to} onChange={(e) => set("round_to", e.target.value)}>
                    <option value="0">exact</option>
                    <option value="5">₱5</option>
                    <option value="10">₱10</option>
                    <option value="50">₱50</option>
                    <option value="100">₱100</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6, padding: 12, background: "var(--adm-soft, rgba(0,0,0,.04))", borderRadius: 6 }}>
              <strong>Result</strong>
              {calc?.suggestion.price != null ? (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <span>Suggested selling price: <strong style={{ fontSize: 18 }}>{peso(calc.suggestion.price)}</strong></span>
                    <Button type="button" size="sm" onClick={() => set("selling_price", String(calc.suggestion.price))}>Use this price</Button>
                  </div>
                  {calc.atSuggested ? (
                    <small className="adm-hint">
                      At that price: total cost {peso(calc.atSuggested.totalCost)}, profit {peso(calc.atSuggested.profit)},
                      margin {calc.atSuggested.marginPercent.toFixed(1)}%, markup {calc.atSuggested.markupPercent.toFixed(1)}%.
                    </small>
                  ) : null}
                </>
              ) : (
                <small className="adm-hint">{calc?.suggestion.problem ?? "Add materials or costs to see a suggested price."}</small>
              )}
              <hr style={{ border: 0, borderTop: "1px dashed var(--adm-line)", width: "100%" }} />
              <span>At your current selling price of <strong>{peso(form.selling_price)}</strong>:</span>
              <dl className="adm-dl" style={{ margin: 0 }}>
                <dt>Net material cost</dt><dd>{peso(calc?.atSelling.materials ?? 0)}</dd>
                <dt>Operation costs</dt><dd>{peso(calc?.atSelling.operations ?? 0)}</dd>
                <dt>Total cost</dt><dd>{peso(calc?.atSelling.totalCost ?? 0)}</dd>
                <dt>Profit</dt><dd className={(calc?.atSelling.profit ?? 0) < 0 ? "adm-neg" : ""}>{peso(calc?.atSelling.profit ?? 0)}</dd>
                <dt>Margin / markup</dt><dd>{(calc?.atSelling.marginPercent ?? 0).toFixed(1)}% / {(calc?.atSelling.markupPercent ?? 0).toFixed(1)}%</dd>
                <dt>Break-even price</dt><dd>{calc?.atSelling.breakEven != null ? peso(calc.atSelling.breakEven) : "—"}</dd>
              </dl>
            </div>
          </div>
          <label className="adm-wide">Notes<textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          <div className="adm-row"><Button type="submit">Save</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>
      )}
      {packages.isPending ? <p>Loading…</p> : !packages.data?.length ? <section className="adm-card"><p className="adm-empty">No packages yet.</p></section> : (
        <div className="adm-grid">
          {packages.data.map((p) => {
            const mat = p.package_materials.reduce((a, pm) => a + n(pm.quantity) * n(pm.materials?.current_unit_cost), 0);
            const other = n(p.estimated_other_costs);
            const profit = n(p.selling_price) - mat - other;
            // How many bookings the current stock could cover, and what runs out first.
            const limits = p.package_materials
              .filter((pm) => n(pm.quantity) > 0)
              .map((pm) => ({
                name: pm.materials?.name ?? "Material",
                bookings: Math.floor(Math.max(n(pm.materials?.current_stock), 0) / n(pm.quantity)),
              }));
            const tightest = limits.length ? limits.reduce((a, b) => (b.bookings < a.bookings ? b : a)) : null;
            return (
              <article className="adm-card" key={p.id}>
                <h2>{p.name} {!p.active && <small>(inactive)</small>}</h2>
                <p className="adm-hint">
                  {(p as { service_type?: string }).service_type === "made_to_order" ? "Made to order" : "Event service"}
                  {(p as { popup_available?: boolean }).popup_available ? " · also at pop-ups" : ""}
                </p>
                {p.description && <p>{p.description}</p>}
                {p.included_services && <p className="adm-hint">{p.included_services}</p>}
                <dl className="adm-dl">
                  <dt>Selling price</dt><dd>{peso(p.selling_price)}</dd>
                  <dt>Net material cost</dt><dd>{peso(mat)}</dd>
                  <dt>Operation costs</dt><dd>{peso(other)}</dd>
                  <dt>Estimated profit</dt><dd className={profit < 0 ? "adm-neg" : ""}>{peso(profit)}</dd>
                  <dt>Estimated margin</dt><dd>{pct(margin(profit, n(p.selling_price)))}</dd>
                </dl>
                {p.package_materials.length > 0 && (
                  <table className="adm-table">
                    <thead><tr><th>Material</th><th>Per booking</th><th>Cost</th><th>In stock</th></tr></thead>
                    <tbody>{p.package_materials.map((pm) => (
                      <tr key={pm.id}>
                        <td>{pm.materials?.name ?? "—"}</td>
                        <td>{n(pm.quantity)} {pm.materials?.unit}</td>
                        <td>{peso(n(pm.quantity) * n(pm.materials?.current_unit_cost))}</td>
                        <td className={n(pm.materials?.current_stock) < n(pm.quantity) ? "adm-neg" : ""}>{n(pm.materials?.current_stock)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
                {tightest && (
                  <p className={tightest.bookings === 0 ? "adm-neg" : "adm-hint"}>
                    {tightest.bookings === 0
                      ? `Not enough ${tightest.name} in stock for even one booking.`
                      : `Your stock covers about ${tightest.bookings} booking${tightest.bookings === 1 ? "" : "s"} (${tightest.name} runs out first).`}
                  </p>
                )}
                <p className="adm-hint">Estimates use today's material costs.</p>
                <div className="adm-actions">
                  <button onClick={() => setForm({
                    id: p.id, name: p.name, description: p.description ?? "", selling_price: String(p.selling_price),
                    estimated_other_costs: String(p.estimated_other_costs), included_services: p.included_services ?? "",
                    notes: p.notes ?? "", active: p.active,
                    ops: opsFromSaved((p as { operation_costs?: unknown }).operation_costs, p.estimated_other_costs),
                    margin_mode: ((p as { margin_mode?: string }).margin_mode === "markup" ? "markup" : "margin") as MarginMode,
                    target_margin: String((p as { target_margin?: number | null }).target_margin ?? "40"),
                    round_to: "0",
                    service_type: (p as { service_type?: string }).service_type ?? "event",
                    popup_available: Boolean((p as { popup_available?: boolean }).popup_available),
                    lines: p.package_materials.map((pm) => ({ material_id: pm.material_id, quantity: String(pm.quantity) })),
                  })}>Edit</button>
                  <button onClick={() => remove(p.id)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <AddonsSection />
    </div>
  );
}
