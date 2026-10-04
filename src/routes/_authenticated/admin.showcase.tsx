import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resizeToJpeg } from "@/lib/images";
import { PRODUCT_TAGS, productLabel } from "@/lib/showcase";

export const Route = createFileRoute("/_authenticated/admin/showcase")({
  head: () => ({
    meta: [{ title: "Proof of orders | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: ShowcasePage,
});

interface Row {
  id: string;
  title: string;
  product: string;
  image_url: string;
  caption: string | null;
  customer_label: string | null;
  completed_on: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
}

function ShowcasePage() {
  const qc = useQueryClient();
  const [product, setProduct] = useState("sintra");
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const items = useQuery({
    queryKey: ["biz", "showcase"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_showcase")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) return { ready: false, rows: [] as Row[] };
      return { ready: true, rows: (data ?? []) as Row[] };
    },
  });
  const rows = (items.data?.rows ?? []).filter((r) => filter === "all" || r.product === filter);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["biz", "showcase"] });
    qc.invalidateQueries({ queryKey: ["order-proofs"] });
  };

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage(null);
    let added = 0;
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await resizeToJpeg(file);
        const path = `proofs/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("order-proofs")
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("order-proofs").getPublicUrl(path);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || productLabel(product);
        const { error } = await (supabase as any).from("order_showcase").insert({
          title,
          product,
          image_url: data.publicUrl,
          caption: caption.trim() || null,
          customer_label: label.trim() || null,
          published: true,
        });
        if (error) throw error;
        added += 1;
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    setMessage(
      failed.length
        ? `${added} added. These could not be added (use JPG or PNG photos): ${failed.join(", ")}`
        : `${added} photo${added === 1 ? "" : "s"} added and showing on your Proof of orders page.`,
    );
    refresh();
  }

  async function patch(id: string, values: Partial<Row>) {
    const { error } = await (supabase as any).from("order_showcase").update(values).eq("id", id);
    if (error) return setMessage(error.message);
    refresh();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete "${row.title}" from Proof of orders?`)) return;
    const { error } = await (supabase as any).from("order_showcase").delete().eq("id", row.id);
    if (error) return setMessage(error.message);
    const marker = "/order-proofs/";
    const at = row.image_url.indexOf(marker);
    if (at >= 0) await supabase.storage.from("order-proofs").remove([row.image_url.slice(at + marker.length)]);
    refresh();
  }

  async function move(row: Row, direction: -1 | 1) {
    const list = items.data?.rows ?? [];
    const index = list.findIndex((r) => r.id === row.id);
    const other = list[index + direction];
    if (!other) return;
    // Give every row a clear position, then swap the two neighbours.
    const order = list.map((r, i) => ({ id: r.id, sort_order: i }));
    const a = order[index]!;
    const b = order[index + direction]!;
    [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
    await Promise.all(order.map((o) => (supabase as any).from("order_showcase").update({ sort_order: o.sort_order }).eq("id", o.id)));
    refresh();
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Proof of orders</h1>
          <p className="adm-hint">
            Photos of your finished made-to-order work. They show on your website's{" "}
            <a href="/proofs" target="_blank" rel="noreferrer">Proof of orders page</a>.
          </p>
        </div>
      </header>

      {items.data && !items.data.ready ? (
        <section className="adm-card">
          <p className="adm-error">Proof of orders needs a one-time database setup. Once it has been run, reload this page.</p>
        </section>
      ) : (
        <>
          <section className="adm-card">
            <h2>Add finished orders</h2>
            <div className="adm-form">
              <label>
                What is it?
                <select value={product} onChange={(e) => setProduct(e.target.value)}>
                  {PRODUCT_TAGS.map((tag) => (
                    <option key={tag.key} value={tag.key}>{tag.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Caption (optional, applies to all photos you add now)
                <input value={caption} placeholder="e.g. 16x20 Sintra board, birthday collage" onChange={(e) => setCaption(e.target.value)} />
              </label>
              <label>
                Customer name to show (optional)
                <input value={label} placeholder="e.g. Maria S." onChange={(e) => setLabel(e.target.value)} />
              </label>
              <label className="adm-wide">
                Photos (you can choose many at once)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {busy ? <p className="adm-hint adm-wide">Uploading… please keep this page open.</p> : null}
              {message ? <p className="adm-hint adm-wide">{message}</p> : null}
              <p className="adm-hint adm-wide">Only add photos your customer is happy to have shown. Photos are shrunk automatically so they load fast.</p>
            </div>
          </section>

          <section className="adm-card adm-scroll">
            <div className="adm-head">
              <h2>Your orders ({items.data?.rows.length ?? 0})</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
                <option value="all">All</option>
                {PRODUCT_TAGS.map((tag) => (
                  <option key={tag.key} value={tag.key}>{tag.label}</option>
                ))}
              </select>
            </div>
            {items.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">Nothing here yet. Add your first finished order above.</p> : (
              <table className="adm-table">
                <thead><tr><th>Photo</th><th>Details</th><th>Shown</th><th /></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <img src={row.image_url} alt="" loading="lazy" style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 4 }} />
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                          <input
                            defaultValue={row.title}
                            aria-label="Title"
                            onBlur={(e) => e.target.value.trim() && e.target.value !== row.title && patch(row.id, { title: e.target.value.trim() })}
                          />
                          <input
                            defaultValue={row.caption ?? ""}
                            placeholder="Caption"
                            aria-label="Caption"
                            onBlur={(e) => e.target.value !== (row.caption ?? "") && patch(row.id, { caption: e.target.value.trim() || null })}
                          />
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <select value={row.product} aria-label="Product" onChange={(e) => patch(row.id, { product: e.target.value })}>
                              {PRODUCT_TAGS.map((tag) => (
                                <option key={tag.key} value={tag.key}>{tag.label}</option>
                              ))}
                            </select>
                            <input
                              defaultValue={row.customer_label ?? ""}
                              placeholder="Customer name"
                              aria-label="Customer name"
                              onBlur={(e) => e.target.value !== (row.customer_label ?? "") && patch(row.id, { customer_label: e.target.value.trim() || null })}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <label className="adm-check">
                          <input type="checkbox" checked={row.published} onChange={(e) => patch(row.id, { published: e.target.checked })} /> Show
                        </label>
                      </td>
                      <td className="adm-actions">
                        <button onClick={() => move(row, -1)} aria-label="Move up">▲</button>
                        <button onClick={() => move(row, 1)} aria-label="Move down">▼</button>
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
