import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Stat } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials } from "@/lib/admin-data";
import { MOVEMENT_LABELS, n, peso, stockValue } from "@/lib/finance";
import { MATERIAL_GROUPS, groupLabel, usedForOf } from "@/lib/materials";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  head: () => ({ meta: [{ title: "Materials & inventory | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: MaterialsPage,
});

type Form = {
  id?: string; name: string; category: string; unit: string; current_unit_cost: string;
  supplier: string; min_stock: string; opening_stock: string; active: boolean; used_for: string[];
};
const EMPTY: Form = { name: "", category: "", unit: "pc", current_unit_cost: "0", supplier: "", min_stock: "", opening_stock: "", active: true, used_for: [] };

type Panel = null | { kind: "restock" | "adjust" | "history"; id: string };

function MaterialsPage() {
  const qc = useQueryClient();
  const materials = useMaterials();
  const [form, setForm] = useState<Form | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [restock, setRestock] = useState({ qty: "", unitCost: "", note: "", updateCost: true });
  const [counted, setCounted] = useState({ value: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [group, setGroup] = useState<string>("all");

  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] });
  const allRows = materials.data ?? [];
  const inGroup = (m: (typeof allRows)[number], key: string) =>
    key === "all" ? true : key === "none" ? usedForOf(m).length === 0 : usedForOf(m).includes(key);
  const rows = allRows.filter((m) => inGroup(m, group));
  const target = panel ? rows.find((m) => m.id === panel.id) : undefined;

  const totalValue = allRows.reduce((a, m) => a + stockValue(m.current_stock, m.current_unit_cost), 0);
  const shownValue = rows.reduce((a, m) => a + stockValue(m.current_stock, m.current_unit_cost), 0);
  const isOut = (m: (typeof rows)[number]) => n(m.current_stock) <= 0;
  const isLow = (m: (typeof rows)[number]) =>
    !isOut(m) && m.min_stock !== null && n(m.current_stock) <= n(m.min_stock);
  const outCount = allRows.filter((m) => m.active && isOut(m)).length;
  const lowCount = allRows.filter((m) => m.active && isLow(m)).length;

  const movements = useQuery({
    queryKey: ["biz", "movements", panel?.id],
    enabled: panel?.kind === "history",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_movements")
        .select("*")
        .eq("material_id", panel!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as {
        id: string; change: number; kind: string; unit_cost: number | null;
        sale_id: string | null; note: string | null; created_at: string;
      }[];
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(), category: form.category || null, unit: form.unit || "pc",
      current_unit_cost: Number(form.current_unit_cost) || 0, supplier: form.supplier || null,
      min_stock: form.min_stock === "" ? null : Number(form.min_stock), active: form.active,
    };
    const withGroups = { ...payload, used_for: form.used_for };
    const write = (body: object) =>
      form.id
        ? supabase.from("materials").update(body as never).eq("id", form.id)
        : supabase.from("materials").insert(body as never).select("id").single();
    let result = await write(withGroups);
    // Older databases may not have the grouping column yet; still save the material itself.
    if (result.error && /used_for/i.test(result.error.message)) result = await write(payload);
    if (result.error) return setErr(result.error.message);
    if (!form.id) {
      const data = result.data as unknown as { id: string };
      const opening = n(form.opening_stock);
      if (opening > 0) {
        const { error: moveError } = await (supabase as any).from("material_movements").insert({
          material_id: data.id, change: opening, kind: "adjustment",
          unit_cost: payload.current_unit_cost, note: "Opening stock",
        });
        if (moveError) return setErr(moveError.message);
      }
    }
    setForm(null); setErr(null);
    refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this material? Past sales keep their saved costs.")) return;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) return setErr("This material is used in a package. Remove it there first, or mark it inactive.");
    refresh();
  }

  async function saveRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const qty = n(restock.qty);
    const paid = n(restock.unitCost);
    if (qty <= 0) return setErr("Enter how many you bought.");
    if (restock.updateCost && paid > 0) {
      const have = Math.max(n(target.current_stock), 0);
      const average = have + qty > 0 ? (have * n(target.current_unit_cost) + qty * paid) / (have + qty) : paid;
      const { error } = await supabase.from("materials")
        .update({ current_unit_cost: Math.round(average * 100) / 100 }).eq("id", target.id);
      if (error) return setErr(error.message);
    }
    const { error } = await (supabase as any).from("material_movements").insert({
      material_id: target.id, change: qty, kind: "restock", unit_cost: paid || null, note: restock.note || null,
    });
    if (error) return setErr(error.message);
    setMsg(`Added ${qty} ${target.unit} of ${target.name}.`);
    setPanel(null); setErr(null);
    refresh();
  }

  async function saveCount(e: React.FormEvent) {
    e.preventDefault();
    if (!target || counted.value === "") return;
    const change = n(counted.value) - n(target.current_stock);
    if (change === 0) { setPanel(null); return; }
    const { error } = await (supabase as any).from("material_movements").insert({
      material_id: target.id, change, kind: "adjustment", unit_cost: n(target.current_unit_cost),
      note: counted.note || "Stock count",
    });
    if (error) return setErr(error.message);
    setMsg(`${target.name} set to ${counted.value} ${target.unit}.`);
    setPanel(null); setErr(null);
    refresh();
  }

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Materials &amp; inventory</h1>
          <p className="adm-hint">Stock goes down by itself when a sale uses a material, and back up if the sale is cancelled or the material is removed from it.</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setPanel(null); }}>+ Add material</Button>
      </header>
      {err && <p className="adm-error">{err}</p>}
      {msg && <p className="adm-hint">{msg}</p>}

      <div className="adm-stats" style={{ marginBottom: 16 }}>
        <Stat label="Inventory value" value={peso(totalValue)} sub="stock on hand × cost per unit" />
        <Stat label="Materials" value={String(allRows.length)} />
        <Stat label="Low stock" value={String(lowCount)} />
        <Stat label="Out of stock" value={String(outCount)} />
      </div>

      <div className="adm-stats" style={{ marginBottom: 12 }}>
        {MATERIAL_GROUPS.map((g) => {
          const list = allRows.filter((m) => usedForOf(m).includes(g.key));
          const value = list.reduce((a, m) => a + stockValue(m.current_stock, m.current_unit_cost), 0);
          const needAttention = list.filter((m) => m.active && (isOut(m) || isLow(m))).length;
          return (
            <Stat
              key={g.key}
              label={g.label}
              value={peso(value)}
              sub={`${list.length} material${list.length === 1 ? "" : "s"}${needAttention ? ` · ${needAttention} low or out` : ""}`}
            />
          );
        })}
      </div>
      <p className="adm-hint" style={{ marginTop: -4 }}>
        A material used for several services is counted in each of them. The inventory value above counts every material once.
      </p>
      <div className="adm-filters" style={{ marginBottom: 12 }}>
        {[["all", "All"], ...MATERIAL_GROUPS.map((g) => [g.key, g.label]), ["none", "Not assigned"]].map(([key, label]) => (
          <Button key={key} size="sm" variant={group === key ? "default" : "outline"} onClick={() => setGroup(key!)}>
            {label} ({allRows.filter((m) => inGroup(m, key!)).length})
          </Button>
        ))}
      </div>

      {form && (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2>{form.id ? "Edit material" : "New material"}</h2>
          <label>Name<input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>Category<input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Paper, Film…" /></label>
          <fieldset className="adm-wide" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>
              Used for (tick every service that uses it)
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {MATERIAL_GROUPS.map((g) => (
                <label key={g.key} className="adm-check">
                  <input
                    type="checkbox"
                    checked={form.used_for.includes(g.key)}
                    onChange={(e) =>
                      setForm((f) => f && ({
                        ...f,
                        used_for: e.target.checked ? [...f.used_for, g.key] : f.used_for.filter((k) => k !== g.key),
                      }))
                    }
                  />
                  {g.label}
                </label>
              ))}
            </div>
            <small className="adm-hint">Standard and high-angle photobooths use the same supplies, so they are one choice.</small>
          </fieldset>
          <label>Unit<input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="sheet, pack, pc" /></label>
          <label>Cost per unit (₱)<input type="number" step="0.01" min="0" value={form.current_unit_cost} onChange={(e) => set("current_unit_cost", e.target.value)} /></label>
          <label>Supplier<input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} /></label>
          <label>Warn me when stock is at or below<input type="number" step="0.01" min="0" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} /></label>
          {!form.id && (
            <label>Stock you have now<input type="number" step="0.01" min="0" value={form.opening_stock} onChange={(e) => set("opening_stock", e.target.value)} /></label>
          )}
          <label className="adm-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <div className="adm-row"><Button type="submit">Save</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
          <p className="adm-hint adm-wide">
            {form.id ? "To change the amount in stock, use Restock or Adjust in the table. " : ""}
            Changing the cost only affects package estimates and new sales. Past sales keep the cost saved when they were recorded.
          </p>
        </form>
      )}

      {panel?.kind === "restock" && target && (
        <form className="adm-card adm-form" onSubmit={saveRestock}>
          <h2>Restock {target.name}</h2>
          <p className="adm-hint adm-wide">Now in stock: {n(target.current_stock)} {target.unit} · Current cost: {peso(target.current_unit_cost)} per {target.unit}</p>
          <label>Quantity bought ({target.unit})<input required type="number" step="0.01" min="0" value={restock.qty} onChange={(e) => setRestock({ ...restock, qty: e.target.value })} /></label>
          <label>Price paid per {target.unit} (₱)<input type="number" step="0.01" min="0" value={restock.unitCost} onChange={(e) => setRestock({ ...restock, unitCost: e.target.value })} /></label>
          <label className="adm-wide">Note (supplier, receipt no.)<input value={restock.note} onChange={(e) => setRestock({ ...restock, note: e.target.value })} /></label>
          <label className="adm-check adm-wide"><input type="checkbox" checked={restock.updateCost} onChange={(e) => setRestock({ ...restock, updateCost: e.target.checked })} /> Update the cost per unit to the average of old and new stock</label>
          <div className="adm-row"><Button type="submit">Add to stock</Button><Button type="button" variant="outline" onClick={() => setPanel(null)}>Cancel</Button></div>
        </form>
      )}

      {panel?.kind === "adjust" && target && (
        <form className="adm-card adm-form" onSubmit={saveCount}>
          <h2>Adjust {target.name}</h2>
          <p className="adm-hint adm-wide">The system says {n(target.current_stock)} {target.unit}. Enter what you actually counted and it will correct the difference.</p>
          <label>Counted stock ({target.unit})<input required type="number" step="0.01" value={counted.value} onChange={(e) => setCounted({ ...counted, value: e.target.value })} /></label>
          <label>Reason<input value={counted.note} placeholder="Stock count, damaged, lost…" onChange={(e) => setCounted({ ...counted, note: e.target.value })} /></label>
          <div className="adm-row"><Button type="submit">Save count</Button><Button type="button" variant="outline" onClick={() => setPanel(null)}>Cancel</Button></div>
        </form>
      )}

      {panel?.kind === "history" && target && (
        <section className="adm-card adm-scroll">
          <div className="adm-head">
            <h2>{target.name} — stock history</h2>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Close</Button>
          </div>
          {movements.isPending ? <p>Loading…</p> : !movements.data?.length ? <p className="adm-empty">No stock movements yet.</p> : (
            <table className="adm-table">
              <thead><tr><th>When</th><th>What</th><th>Change</th><th>Cost/unit</th><th>Note</th></tr></thead>
              <tbody>{movements.data.map((mv) => (
                <tr key={mv.id}>
                  <td>{new Date(mv.created_at).toLocaleString()}</td>
                  <td>{MOVEMENT_LABELS[mv.kind] ?? mv.kind}{mv.sale_id ? <> · <Link to="/admin/sales/$saleId" params={{ saleId: mv.sale_id }}>open sale</Link></> : null}</td>
                  <td className={n(mv.change) < 0 ? "adm-neg" : ""}>{n(mv.change) > 0 ? "+" : ""}{n(mv.change)}</td>
                  <td>{mv.unit_cost !== null ? peso(mv.unit_cost) : "—"}</td>
                  <td>{mv.note ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}

      <section className="adm-card adm-scroll">
        {materials.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">{allRows.length ? "No materials in this group." : "No materials yet."}</p> : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Used for</th><th>Unit</th><th>Cost/unit</th><th>In stock</th><th>Stock value</th><th>Warn at</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}{m.supplier ? <small className="adm-hint"> — {m.supplier}</small> : null}</td>
                  <td>
                    {usedForOf(m).length === 0 ? <small className="adm-hint">Not assigned</small> : (
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {usedForOf(m).map((key) => (
                          <span key={key} style={{ padding: "1px 8px", border: "1px solid var(--adm-line)", borderRadius: 999, fontSize: 11 }}>{groupLabel(key)}</span>
                        ))}
                      </span>
                    )}
                    {m.category ? <small className="adm-hint">{m.category}</small> : null}
                  </td><td>{m.unit}</td><td>{peso(m.current_unit_cost)}</td>
                  <td className={isOut(m) || isLow(m) ? "adm-neg" : ""}>
                    {n(m.current_stock)}{isOut(m) ? " (out)" : isLow(m) ? " (low)" : ""}
                  </td>
                  <td>{peso(stockValue(m.current_stock, m.current_unit_cost))}</td>
                  <td>{m.min_stock ?? "—"}</td>
                  <td>{m.active ? "Active" : "Inactive"}</td>
                  <td className="adm-actions">
                    <button onClick={() => { setPanel({ kind: "restock", id: m.id }); setForm(null); setRestock({ qty: "", unitCost: String(m.current_unit_cost), note: "", updateCost: true }); setErr(null); setMsg(null); }}>Restock</button>
                    <button onClick={() => { setPanel({ kind: "adjust", id: m.id }); setForm(null); setCounted({ value: String(n(m.current_stock)), note: "" }); setErr(null); setMsg(null); }}>Adjust</button>
                    <button onClick={() => { setPanel({ kind: "history", id: m.id }); setForm(null); }}>History</button>
                    <button onClick={() => { setPanel(null); setForm({
                      id: m.id, name: m.name, category: m.category ?? "", unit: m.unit,
                      current_unit_cost: String(m.current_unit_cost), supplier: m.supplier ?? "",
                      min_stock: m.min_stock === null ? "" : String(m.min_stock), opening_stock: "", active: m.active,
                      used_for: usedForOf(m),
                    }); }}>Edit</button>
                    <button onClick={() => remove(m.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={5}><strong>{group === "all" ? "Total inventory value" : "Value of what is shown"}</strong></td><td colSpan={4}><strong>{peso(group === "all" ? totalValue : shownValue)}</strong></td></tr></tfoot>
          </table>
        )}
      </section>
    </div>
  );
}
