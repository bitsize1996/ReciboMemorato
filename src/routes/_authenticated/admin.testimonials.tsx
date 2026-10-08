import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resizeToJpeg } from "@/lib/images";
import { REVIEW_SOURCES, stars } from "@/lib/testimonials";

export const Route = createFileRoute("/_authenticated/admin/testimonials")({
  head: () => ({
    meta: [{ title: "Reviews | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: TestimonialsPage,
});

interface Row {
  id: string;
  name: string;
  label: string | null;
  quote: string;
  rating: number;
  image_url: string | null;
  source: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

type Form = { id?: string; name: string; label: string; quote: string; rating: string; source: string; featured: boolean; published: boolean; image_url: string };
const EMPTY: Form = { name: "", label: "", quote: "", rating: "5", source: "Facebook", featured: false, published: true, image_url: "" };

function TestimonialsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reviews = useQuery({
    queryKey: ["biz", "testimonials"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("testimonials")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) return { ready: false, rows: [] as Row[] };
      return { ready: true, rows: (data ?? []) as Row[] };
    },
  });
  const rows = reviews.data?.rows ?? [];
  const set = (key: keyof Form, value: string | boolean) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["biz", "testimonials"] });
    qc.invalidateQueries({ queryKey: ["testimonials"] });
  };

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await resizeToJpeg(file);
      const path = `reviews/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("order-proofs").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      set("image_url", supabase.storage.from("order-proofs").getPublicUrl(path).data.publicUrl);
    } catch {
      setMessage("That photo could not be added. Please use a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(),
      label: form.label.trim() || null,
      quote: form.quote.trim(),
      rating: Math.max(1, Math.min(5, Number(form.rating) || 5)),
      source: form.source.trim() || null,
      featured: form.featured,
      published: form.published,
      image_url: form.image_url || null,
    };
    const table = (supabase as any).from("testimonials");
    const { error } = form.id ? await table.update(payload).eq("id", form.id) : await table.insert(payload);
    if (error) return setMessage(error.message);
    setForm(null);
    setMessage(null);
    refresh();
  }

  async function patch(id: string, values: Partial<Row>) {
    const { error } = await (supabase as any).from("testimonials").update(values).eq("id", id);
    if (error) return setMessage(error.message);
    refresh();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete the review from ${row.name}?`)) return;
    const { error } = await (supabase as any).from("testimonials").delete().eq("id", row.id);
    if (error) return setMessage(error.message);
    refresh();
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Reviews</h1>
          <p className="adm-hint">
            Add what clients said about you. They show on your <a href="/reviews" target="_blank" rel="noreferrer">Reviews page</a>,
            and the ones marked Featured also show on the homepage.
          </p>
        </div>
        <Button onClick={() => setForm(EMPTY)}>+ Add review</Button>
      </header>
      {message ? <p className="adm-error">{message}</p> : null}
      {reviews.data && !reviews.data.ready ? (
        <section className="adm-card"><p className="adm-error">Reviews need a one-time database setup. Once it has been run, reload this page.</p></section>
      ) : null}

      {form && (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2>{form.id ? "Edit review" : "New review"}</h2>
          <label>Client name<input required value={form.name} placeholder="e.g. Maria S." onChange={(e) => set("name", e.target.value)} /></label>
          <label>About them (optional)<input value={form.label} placeholder="e.g. Debut, Biñan" onChange={(e) => set("label", e.target.value)} /></label>
          <label className="adm-wide">What they said<textarea required rows={4} value={form.quote} onChange={(e) => set("quote", e.target.value)} /></label>
          <label>Stars
            <select value={form.rating} onChange={(e) => set("rating", e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </label>
          <label>Where it was posted
            <input list="review-sources" value={form.source} onChange={(e) => set("source", e.target.value)} />
            <datalist id="review-sources">{REVIEW_SOURCES.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
          <label className="adm-wide">Screenshot or photo (optional, for example a Facebook review)
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {form.image_url ? (
            <div className="adm-wide">
              <img src={form.image_url} alt="" style={{ maxWidth: 220, maxHeight: 220, objectFit: "contain", border: "1px solid var(--adm-line)" }} />
              <button type="button" className="admin-link" onClick={() => set("image_url", "")}>Remove picture</button>
            </div>
          ) : null}
          <label className="adm-check"><input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured on the homepage</label>
          <label className="adm-check"><input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} /> Show on the website</label>
          <p className="adm-hint adm-wide">Only add reviews that are real, and ask permission before showing a client's name or screenshot.</p>
          <div className="adm-row">
            <Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Save review"}</Button>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <section className="adm-card adm-scroll">
        {reviews.isPending ? <p>Loading…</p> : !rows.length ? <p className="adm-empty">No reviews yet. Click "Add review" to add your first one.</p> : (
          <table className="adm-table">
            <thead><tr><th>Review</th><th>Featured</th><th>Shown</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong> <span aria-label={`${row.rating} stars`}>{stars(row.rating)}</span>
                    {row.source ? <small className="adm-hint"> via {row.source}</small> : null}
                    <div style={{ maxWidth: 520, whiteSpace: "pre-line" }}>{row.quote}</div>
                  </td>
                  <td><label className="adm-check"><input type="checkbox" checked={row.featured} onChange={(e) => patch(row.id, { featured: e.target.checked })} /> Yes</label></td>
                  <td><label className="adm-check"><input type="checkbox" checked={row.published} onChange={(e) => patch(row.id, { published: e.target.checked })} /> Show</label></td>
                  <td className="adm-actions">
                    <button onClick={() => setForm({ id: row.id, name: row.name, label: row.label ?? "", quote: row.quote, rating: String(row.rating), source: row.source ?? "", featured: row.featured, published: row.published, image_url: row.image_url ?? "" })}>Edit</button>
                    <button onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
