import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resizeToJpeg } from "@/lib/images";

export const Route = createFileRoute("/_authenticated/admin/backdrops")({
  head: () => ({
    meta: [{ title: "Backdrops | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: BackdropsPage,
});

interface Row {
  id: string;
  name: string;
  category: string | null;
  image_url: string;
  active: boolean;
  sort_order: number;
}

function BackdropsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const backdrops = useQuery({
    queryKey: ["biz", "backdrops"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("backdrops")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return { ready: false, rows: [] as Row[] };
      return { ready: true, rows: (data ?? []) as Row[] };
    },
  });
  const rows = backdrops.data?.rows ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["biz", "backdrops"] });
    qc.invalidateQueries({ queryKey: ["backdrops"] });
    qc.invalidateQueries({ queryKey: ["booking-options"] });
  };

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage(null);
    let next = rows.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;
    let added = 0;
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await resizeToJpeg(file, 1400);
        const path = `backdrops/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("order-proofs")
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("order-proofs").getPublicUrl(path);
        const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Backdrop";
        const { error } = await (supabase as any).from("backdrops").insert({
          name,
          category: category.trim() || null,
          image_url: data.publicUrl,
          sort_order: next,
        });
        if (error) throw error;
        next += 1;
        added += 1;
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    setMessage(
      failed.length
        ? `${added} added. Could not add: ${failed.join(", ")} (use JPG or PNG photos).`
        : `${added} backdrop${added === 1 ? "" : "s"} added. Rename them below so clients can tell them apart.`,
    );
    refresh();
  }

  async function patch(id: string, values: Partial<Row>) {
    const { error } = await (supabase as any).from("backdrops").update(values).eq("id", id);
    if (error) return setMessage(error.message);
    refresh();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete the backdrop "${row.name}"?`)) return;
    const { error } = await (supabase as any).from("backdrops").delete().eq("id", row.id);
    if (error) return setMessage(error.message);
    const marker = "/order-proofs/";
    const at = row.image_url.indexOf(marker);
    if (at >= 0) await supabase.storage.from("order-proofs").remove([row.image_url.slice(at + marker.length)]);
    refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const other = rows[index + direction];
    if (!other) return;
    const order = rows.map((r, i) => ({ id: r.id, sort_order: i }));
    const a = order[index]!;
    const b = order[index + direction]!;
    [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
    await Promise.all(order.map((o) => (supabase as any).from("backdrops").update({ sort_order: o.sort_order }).eq("id", o.id)));
    refresh();
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Backdrops</h1>
          <p className="adm-hint">
            The backdrops clients can choose for your standard photobooth. They show on your{" "}
            <a href="/packages#backdrops" target="_blank" rel="noreferrer">Packages page</a> and as a picker on the booking form.
          </p>
        </div>
      </header>
      {message ? <p className="adm-hint">{message}</p> : null}

      {backdrops.data && !backdrops.data.ready ? (
        <section className="adm-card"><p className="adm-error">Backdrops need a one-time database setup. Once it has been run, reload this page.</p></section>
      ) : (
        <>
          <section className="adm-card adm-form">
            <h2>Add backdrops</h2>
            <label>
              Type (optional, for example Floral, Glitter, Plain)
              <input value={category} placeholder="Floral" onChange={(e) => setCategory(e.target.value)} />
            </label>
            <label className="adm-wide">
              Photos of the backdrops (choose many at once)
              <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            </label>
            {busy ? <p className="adm-hint adm-wide">Uploading… please keep this page open.</p> : null}
            <p className="adm-hint adm-wide">The file name becomes the backdrop's name. You can rename each one below.</p>
          </section>

          <section className="adm-card adm-scroll">
            <h2>Your backdrops ({rows.length})</h2>
            {backdrops.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">No backdrops yet. Add your first photos above.</p> : (
              <table className="adm-table">
                <thead><tr><th>Photo</th><th>Details</th><th>Shown</th><th /></tr></thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td><img src={row.image_url} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 4 }} /></td>
                      <td>
                        <div style={{ display: "grid", gap: 6, minWidth: 200 }}>
                          <input
                            defaultValue={row.name}
                            aria-label="Name"
                            onBlur={(e) => e.target.value.trim() && e.target.value !== row.name && patch(row.id, { name: e.target.value.trim() })}
                          />
                          <input
                            defaultValue={row.category ?? ""}
                            placeholder="Type (optional)"
                            aria-label="Type"
                            onBlur={(e) => e.target.value !== (row.category ?? "") && patch(row.id, { category: e.target.value.trim() || null })}
                          />
                        </div>
                      </td>
                      <td><label className="adm-check"><input type="checkbox" checked={row.active} onChange={(e) => patch(row.id, { active: e.target.checked })} /> Show</label></td>
                      <td className="adm-actions">
                        <button onClick={() => move(i, -1)} aria-label="Move earlier">▲</button>
                        <button onClick={() => move(i, 1)} aria-label="Move later">▼</button>
                        <button onClick={() => remove(row)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
