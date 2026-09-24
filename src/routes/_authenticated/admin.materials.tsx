import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials } from "@/lib/admin-data";
import { peso } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  head: () => ({ meta: [{ title: "Materials | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: MaterialsPage,
});

type Form = {
  id?: string; name: string; category: string; unit: string; current_unit_cost: string;
  supplier: string; current_stock: string; min_stock: string; active: boolean;
};
const EMPTY: Form = { name: "", category: "", unit: "pc", current_unit_cost: "0", supplier: "", current_stock: "", min_stock: "", active: true };

function MaterialsPage() {
  const qc = useQueryClient();
  const materials = useMaterials();
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(), category: form.category || null, unit: form.unit || "pc",
      current_unit_cost: Number(form.current_unit_cost) || 0, supplier: form.supplier || null,
      current_stock: form.current_stock === "" ? null : Number(form.current_stock),
      min_stock: form.min_stock === "" ? null : Number(form.min_stock), active: form.active,
    };
    const { error } = form.id
      ? await supabase.from("materials").update(payload).eq("id", form.id)
      : await supabase.from("materials").insert(payload);
    if (error) return setErr(error.message);
    setForm(null); setErr(null);
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this material? Past sales keep their saved costs.")) return;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) return setErr("This material is used in a package. Remove it there first, or mark it inactive.");
    qc.invalidateQueries({ queryKey: ["biz"] });
  }

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Materials</h1>
        <Button onClick={() => setForm(EMPTY)}>+ Add material</Button>
      </header>
      {err && <p className="adm-error">{err}</p>}
      {form && (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2>{form.id ? "Edit material" : "New material"}</h2>
          <label>Name<input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>Category<input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Paper, Film…" /></label>
          <label>Unit<input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="sheet, pack, pc" /></label>
          <label>Cost per unit (₱)<input type="number" step="0.01" min="0" value={form.current_unit_cost} onChange={(e) => set("current_unit_cost", e.target.value)} /></label>
          <label>Supplier<input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} /></label>
          <label>Current stock (optional)<input type="number" step="0.01" value={form.current_stock} onChange={(e) => set("current_stock", e.target.value)} /></label>
          <label>Minimum stock (optional)<input type="number" step="0.01" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} /></label>
          <label className="adm-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <div className="adm-row"><Button type="submit">Save</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
          <p className="adm-hint">Changing the cost only affects package estimates and new sales. Past sales keep the cost saved when they were recorded.</p>
        </form>
      )}
      <section className="adm-card">
        {materials.isPending ? <p>Loading…</p> : !materials.data?.length ? <p className="adm-empty">No materials yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Cost/unit</th><th>Supplier</th><th>Stock</th><th>Status</th><th /></tr></thead>
            <tbody>
              {materials.data.map((m) => {
                const low = m.current_stock !== null && m.min_stock !== null && Number(m.current_stock) <= Number(m.min_stock);
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td><td>{m.category ?? "—"}</td><td>{m.unit}</td><td>{peso(m.current_unit_cost)}</td>
                    <td>{m.supplier ?? "—"}</td>
                    <td className={low ? "adm-neg" : ""}>{m.current_stock ?? "—"}{low ? " (low)" : ""}</td>
                    <td>{m.active ? "Active" : "Inactive"}</td>
                    <td className="adm-actions">
                      <button onClick={() => setForm({
                        id: m.id, name: m.name, category: m.category ?? "", unit: m.unit,
                        current_unit_cost: String(m.current_unit_cost), supplier: m.supplier ?? "",
                        current_stock: m.current_stock === null ? "" : String(m.current_stock),
                        min_stock: m.min_stock === null ? "" : String(m.min_stock), active: m.active,
                      })}>Edit</button>
                      <button onClick={() => remove(m.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
