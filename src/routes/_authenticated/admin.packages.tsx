import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddons, useMaterials, usePackages } from "@/lib/admin-data";
import { margin, n, pct, peso } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  head: () => ({ meta: [{ title: "Packages | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: PackagesPage,
});

type Line = { material_id: string; quantity: string };
type Form = {
  id?: string; name: string; description: string; selling_price: string; estimated_other_costs: string;
  included_services: string; notes: string; active: boolean; lines: Line[];
};
const EMPTY: Form = { name: "", description: "", selling_price: "0", estimated_other_costs: "0", included_services: "", notes: "", active: true, lines: [] };

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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(), description: form.description || null,
      selling_price: n(form.selling_price), estimated_other_costs: n(form.estimated_other_costs),
      included_services: form.included_services || null, notes: form.notes || null, active: form.active,
    };
    let id = form.id;
    if (id) {
      const { error } = await supabase.from("packages").update(payload).eq("id", id);
      if (error) return setErr(error.message);
      await supabase.from("package_materials").delete().eq("package_id", id);
    } else {
      const { data, error } = await supabase.from("packages").insert(payload).select("id").single();
      if (error) return setErr(error.message);
      id = data.id;
    }
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
          <label>Estimated other costs (₱)<input type="number" step="0.01" min="0" value={form.estimated_other_costs} onChange={(e) => set("estimated_other_costs", e.target.value)} /></label>
          <label className="adm-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <div className="adm-wide">
            <h3>Materials used</h3>
            {form.lines.map((l, i) => {
              const m = matById.get(l.material_id);
              return (
                <div className="adm-line" key={i}>
                  <select value={l.material_id} onChange={(e) => setLine(i, { material_id: e.target.value })} aria-label="Material">
                    <option value="">Choose material…</option>
                    {(materials.data ?? []).filter((x) => x.active || x.id === l.material_id).map((x) => (
                      <option key={x.id} value={x.id}>{x.name} ({peso(x.current_unit_cost)}/{x.unit})</option>
                    ))}
                  </select>
                  <input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Quantity" />
                  <span>{peso(n(l.quantity) * n(m?.current_unit_cost))}</span>
                  <button type="button" onClick={() => set("lines", form.lines.filter((_, j) => j !== i))}>Remove</button>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => set("lines", [...form.lines, { material_id: "", quantity: "1" }])}>+ Add material</Button>
            <p><strong>Total material cost: {peso(formMaterialCost)}</strong></p>
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
                {p.description && <p>{p.description}</p>}
                {p.included_services && <p className="adm-hint">{p.included_services}</p>}
                <dl className="adm-dl">
                  <dt>Selling price</dt><dd>{peso(p.selling_price)}</dd>
                  <dt>Estimated materials</dt><dd>{peso(mat)}</dd>
                  <dt>Estimated other costs</dt><dd>{peso(other)}</dd>
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
