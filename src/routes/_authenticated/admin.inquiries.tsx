import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Stat } from "@/components/admin/RangeFilter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddons, usePackages, useSales } from "@/lib/admin-data";
import { saleExpensesFromPackage } from "@/lib/pricing";
import { syncSaleToGoogle } from "@/lib/calendar.functions";
import { n, peso, saleCode } from "@/lib/finance";
import { siteSettingsQuery } from "@/lib/site.functions";
import { PAGE_INBOX_URL, brandName, copyText, gmailComposeUrl, inquiryReplyMessage, messengerProfileUrl, useBusinessInfo } from "@/lib/messages";
import {
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  inquiryCode,
  sourceName,
  statusName,
  useInquiries,
  type InquiryRow,
  type InquiryStatus,
} from "@/lib/inquiries";

export const Route = createFileRoute("/_authenticated/admin/inquiries")({
  head: () => ({
    meta: [{ title: "Inquiries | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: InquiriesPage,
});

const STATUS_COLOR: Record<string, string> = {
  new: "#d40e14",
  contacted: "#b7791f",
  quoted: "#2b6cb0",
  booked: "#2f855a",
  completed: "#4a5568",
  lost: "#a0aec0",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        background: STATUS_COLOR[status] ?? "#4a5568",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {statusName(status)}
    </span>
  );
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function InquiriesPage() {
  const inquiries = useInquiries();
  const [filter, setFilter] = useState<"all" | InquiryStatus>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const all = inquiries.data ?? [];
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of all) map[row.status] = (map[row.status] ?? 0) + 1;
    return map;
  }, [all]);

  const rows = all
    .filter((row) => filter === "all" || row.status === filter)
    .filter((row) => {
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return [row.name, row.contact, row.email, row.event_type, row.venue, inquiryCode(row.inquiry_number)]
        .some((value) => value?.toLowerCase().includes(term));
    });

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Inquiries</h1>
          <p className="adm-hint">
            Everyone who asks about a booking — from the website form, Messenger, calls or
            referrals — in one place.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Add inquiry</Button>
      </header>

      {inquiries.error ? (
        <section className="adm-card">
          <p className="adm-error">
            Inquiries aren't set up yet. Run the one-time database setup, then reload this page.
          </p>
        </section>
      ) : (
        <>
          {adding ? <AddInquiry onDone={() => setAdding(false)} /> : null}

          <div className="adm-stats" style={{ marginBottom: 16 }}>
            <Stat label="New" value={String(counts["new"] ?? 0)} sub="waiting for a reply" />
            <Stat label="Contacted" value={String(counts["contacted"] ?? 0)} />
            <Stat label="Quoted" value={String(counts["quoted"] ?? 0)} sub="waiting for an answer" />
            <Stat label="Booked" value={String(counts["booked"] ?? 0)} />
          </div>

          <div className="adm-filters" style={{ marginBottom: 12 }}>
            <input
              placeholder="Search name, contact, event, INQ #"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search inquiries"
            />
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All ({all.length})
            </Button>
            {INQUIRY_STATUSES.map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label} ({counts[key] ?? 0})
              </Button>
            ))}
          </div>

          <section className="adm-card">
            {inquiries.isPending ? <p>Loading…</p> : null}
            {!inquiries.isPending && all.length === 0 ? (
              <p className="adm-empty">
                No inquiries yet. Share your booking page (<Link to="/book">/book</Link>) and they
                will appear here.
              </p>
            ) : null}
            {!inquiries.isPending && all.length > 0 && rows.length === 0 ? (
              <p className="adm-empty">No inquiries match.</p>
            ) : null}
            {rows.map((row) => (
              <div key={row.id} style={{ borderBottom: "1px solid var(--adm-line)" }}>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === row.id ? null : row.id)}
                  style={{
                    display: "flex",
                    width: "100%",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: "12px 4px",
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                  aria-expanded={openId === row.id}
                >
                  <strong style={{ minWidth: 70 }}>{inquiryCode(row.inquiry_number)}</strong>
                  <span style={{ flex: 1, minWidth: 140 }}>
                    <strong>{row.name}</strong>
                    <br />
                    <small>
                      {[row.event_type, row.event_date, row.venue].filter(Boolean).join(" · ") ||
                        "No event details"}
                    </small>
                  </span>
                  <small>{sourceName(row.source)}</small>
                  <Badge status={row.status} />
                  <small style={{ minWidth: 64, textAlign: "right" }}>{ago(row.created_at)}</small>
                </button>
                {openId === row.id ? <Detail row={row} /> : null}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Detail({ row }: { row: InquiryRow }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const packages = usePackages();
  const sales = useSales();
  const biz = useBusinessInfo();
  const site = useQuery(siteSettingsQuery);
  const addons = useAddons();
  const [addonPick, setAddonPick] = useState({ id: "", qty: "1" });
  const chosen = useQuery({
    queryKey: ["biz", "inquiry-addons", row.id],
    queryFn: async () => {
      const { data, error: dbError } = await (supabase as any)
        .from("inquiry_addons")
        .select("*")
        .eq("inquiry_id", row.id)
        .order("created_at", { ascending: true });
      if (dbError) return [];
      return data as { id: string; addon_id: string | null; name_snapshot: string; price_snapshot: number; quantity: number }[];
    },
  });
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(row.internal_notes ?? "");
  const [quoted, setQuoted] = useState(row.quoted_amount != null ? String(row.quoted_amount) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error: dbError } = await (supabase as any)
        .from("inquiries")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e: { message?: string }) => setError(e.message ?? "Could not save"),
  });

  const setStatus = (status: InquiryStatus) =>
    update.mutate({
      status,
      ...(status === "contacted" ? { last_contact_at: new Date().toISOString() } : {}),
    });

  const chosenAddons = chosen.data ?? [];
  const chosenPackage = packages.data?.find((p) => p.id === row.package_id);
  const addonsTotal = chosenAddons.reduce((a, x) => a + n(x.price_snapshot) * n(x.quantity), 0);
  const estimate = n(chosenPackage?.selling_price) + addonsTotal;

  const refreshAddons = () => qc.invalidateQueries({ queryKey: ["biz", "inquiry-addons", row.id] });

  async function changePackage(packageId: string) {
    const pkg = packages.data?.find((p) => p.id === packageId);
    update.mutate({ package_id: packageId || null, package_interest: pkg?.name ?? null });
  }

  async function addChosenAddon() {
    const addon = addons.data?.rows.find((a) => a.id === addonPick.id);
    if (!addon) return;
    const { error: dbError } = await (supabase as any).from("inquiry_addons").insert({
      inquiry_id: row.id, addon_id: addon.id, name_snapshot: addon.name,
      price_snapshot: n(addon.price), quantity: Math.max(1, n(addonPick.qty) || 1),
    });
    if (dbError) return setError(dbError.message);
    setAddonPick({ id: "", qty: "1" });
    refreshAddons();
  }

  async function removeChosenAddon(id: string) {
    await (supabase as any).from("inquiry_addons").delete().eq("id", id);
    refreshAddons();
  }

  // Hours of service: what the package includes plus any extra-hour add-ons they chose.
  const addonCatalog = addons.data?.rows ?? [];
  const serviceHours =
    n((chosenPackage as { service_hours?: number | null } | undefined)?.service_hours) +
    chosenAddons.reduce((sum, a) => sum + n(addonCatalog.find((x) => x.id === a.addon_id)?.extra_hours) * n(a.quantity), 0);

  const sameDay = (sales.data ?? []).filter(
    (s) => row.event_date && s.event_date === row.event_date && s.payment_status !== "cancelled",
  );
  const linkedSale = (sales.data ?? []).find((s) => s.id === row.sale_id);

  async function convert() {
    setBusy(true);
    setError(null);
    const pkg = packages.data?.find((p) => p.id === row.package_id);
    const price = pkg ? n(pkg.selling_price) : Math.max(n(quoted || row.quoted_amount) - addonsTotal, 0);
    const { data, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_name: row.name,
        customer_contact: row.contact,
        customer_email: row.email,
        event_name: `${row.event_type ?? "Event"} – ${row.name}`,
        event_theme: row.theme,
        backdrop: row.backdrop,
        event_time: row.event_time,
        service_hours: serviceHours > 0 ? serviceHours : null,
        event_venue: row.venue,
        event_date: row.event_date,
        package_id: pkg?.id ?? null,
        package_name_snapshot: pkg?.name ?? row.package_interest ?? null,
        quantity: 1,
        selling_price: price,
        discount: 0,
        amount_paid: 0,
        payment_status: "unpaid",
        notes: `From inquiry ${inquiryCode(row.inquiry_number)}.${row.venue ? ` Venue: ${row.venue}.` : ""}${row.message ? `\n${row.message}` : ""}`,
      } as any)
      .select("id")
      .single();
    if (saleError || !data) {
      setBusy(false);
      return setError(saleError?.message ?? "Could not create the booking");
    }
    if (pkg && pkg.package_materials.length > 0) {
      await supabase.from("sale_materials").insert(
        pkg.package_materials.map((pm) => ({
          sale_id: data.id,
          material_id: pm.material_id,
          material_name_snapshot: pm.materials?.name ?? "Material",
          quantity: n(pm.quantity),
          unit_cost_snapshot: n(pm.materials?.current_unit_cost ?? 0),
        })),
      );
    }
    if (pkg) {
      const expenses = saleExpensesFromPackage(pkg as never, 1, price);
      if (expenses.length > 0) {
        await supabase.from("sale_expenses").insert(
          expenses.map((x) => ({
            sale_id: data.id, description: x.description, category: x.category, amount: x.amount,
            expense_date: row.event_date ?? new Date().toISOString().slice(0, 10), notes: "From package",
          })) as never,
        );
      }
    }
    if (chosenAddons.length > 0) {
      await (supabase as any).from("sale_addons").insert(
        chosenAddons.map((a) => ({
          sale_id: data.id, addon_id: a.addon_id, name_snapshot: a.name_snapshot,
          unit_price_snapshot: n(a.price_snapshot), quantity: n(a.quantity),
        })),
      );
    }
    await (supabase as any)
      .from("inquiries")
      .update({ status: "booked", sale_id: data.id, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (row.event_date) await syncSaleToGoogle({ data: { saleId: data.id } }).catch(() => null);
    refresh();
    setBusy(false);
    navigate({ to: "/admin/sales/$saleId", params: { saleId: data.id } });
  }

  async function remove() {
    if (!window.confirm(`Delete ${inquiryCode(row.inquiry_number)} (${row.name})? This can't be undone.`)) return;
    const { error: dbError } = await (supabase as any).from("inquiries").delete().eq("id", row.id);
    if (dbError) return setError(dbError.message);
    refresh();
  }

  const reply = inquiryReplyMessage(row, brandName(site.data), {
    packageName: chosenPackage?.name ?? row.package_interest,
    addons: chosenAddons.map((a) => ({ name: a.name_snapshot, quantity: n(a.quantity), price: n(a.price_snapshot) })),
    estimate,
  });
  const replyUrl = gmailComposeUrl({ from: biz.data?.email, to: row.email ?? "", subject: reply.subject, body: reply.body });

  const messengerUrl = messengerProfileUrl(row.contact);

  const phone = row.contact && /^[+\d][\d\s()-]{6,}$/.test(row.contact) ? row.contact.replace(/[^\d+]/g, "") : null;

  return (
    <div style={{ display: "grid", gap: 14, padding: "4px 4px 18px" }}>
      {error ? <p className="adm-error">{error}</p> : null}

      <div style={{ display: "grid", gap: 6 }}>
        <div>
          <strong>Contact:</strong> {row.contact ?? "—"}
          {phone ? (
            <>
              {" "}
              · <a href={`tel:${phone}`}>Call</a> · <a href={`sms:${phone}`}>Text</a>
            </>
          ) : null}
          {row.email ? (
            <>
              {" "}
              · <a href={`mailto:${row.email}`}>{row.email}</a>
            </>
          ) : null}
        </div>
        {row.contact_method === "messenger" || messengerUrl ? (
          <div style={{ display: "grid", gap: 4 }}>
            <div>
              {messengerUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={messengerUrl} target="_blank" rel="noreferrer">Open in Messenger</a>
                </Button>
              ) : null}{" "}
              <Button asChild size="sm" variant="outline">
                <a href={PAGE_INBOX_URL} target="_blank" rel="noreferrer">Open Page inbox</a>
              </Button>
            </div>
            <small className="adm-hint">
              {messengerUrl
                ? "Opens a chat with the profile they gave. Use Copy reply below to paste your message."
                : `No profile link was given. Search "${row.contact ?? ""}" in your Page inbox, or ask them to message your Page with reference ${inquiryCode(row.inquiry_number)}.`}
            </small>
          </div>
        ) : null}
        <div>
          <strong>Prefers:</strong>{" "}
          {row.contact_method === "call_text" ? "Call / text" : row.contact_method === "email" ? "Email" : "Messenger"}
          {" · "}
          <strong>Source:</strong> {sourceName(row.source)}
        </div>
        <div>
          <strong>Event:</strong>{" "}
          {[row.event_type, row.event_date, row.venue, row.guests ? `${row.guests} guests` : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </div>
        {row.theme ? (
          <div>
            <strong>Theme:</strong> {row.theme}
          </div>
        ) : null}
        {row.backdrop ? (
          <div>
            <strong>Preferred backdrop:</strong> {row.backdrop}
          </div>
        ) : null}
        {row.event_time || serviceHours > 0 ? (
          <div>
            <strong>Start time:</strong> {row.event_time || "not given"}
            {serviceHours > 0 ? ` · ${serviceHours} hour${serviceHours === 1 ? "" : "s"} of service` : ""}
          </div>
        ) : null}
        {row.message ? (
          <div style={{ whiteSpace: "pre-wrap" }}>
            <strong>Message:</strong> {row.message}
          </div>
        ) : null}
      </div>

      {sameDay.length > 0 ? (
        <p className="adm-error">
          Heads up: {sameDay.length} booking{sameDay.length === 1 ? "" : "s"} already on {row.event_date}:{" "}
          {sameDay.map((s) => `${saleCode(s.sale_number)} ${s.customer_name}`).join(", ")}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 10, padding: 12, border: "1px dashed var(--adm-line)", borderRadius: 8 }}>
        <strong>Package &amp; add-ons they want</strong>
        <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          Package
          <select value={row.package_id ?? ""} onChange={(e) => changePackage(e.target.value)} disabled={update.isPending}>
            <option value="">Not chosen yet</option>
            {(packages.data ?? []).filter((p) => p.active || p.id === row.package_id).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {peso(p.selling_price)}</option>
            ))}
          </select>
        </label>
        {chosenPackage?.included_services ? <small className="adm-hint">Includes: {chosenPackage.included_services}</small> : null}
        {chosenAddons.length > 0 ? (
          <div style={{ display: "grid", gap: 4 }}>
            {chosenAddons.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ flex: 1 }}>{a.name_snapshot}{n(a.quantity) > 1 ? ` × ${n(a.quantity)}` : ""}</span>
                <span>{peso(n(a.price_snapshot) * n(a.quantity))}</span>
                <button type="button" className="admin-link" onClick={() => removeChosenAddon(a.id)}>Remove</button>
              </div>
            ))}
          </div>
        ) : <small className="adm-hint">No add-ons chosen.</small>}
        {addons.data?.ready && addons.data.rows.length > 0 ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={addonPick.id} onChange={(e) => setAddonPick({ ...addonPick, id: e.target.value })}>
              <option value="">Add an add-on…</option>
              {addons.data.rows.filter((a) => a.active).map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {peso(a.price)}</option>
              ))}
            </select>
            <input type="number" min="1" style={{ width: 70 }} value={addonPick.qty} onChange={(e) => setAddonPick({ ...addonPick, qty: e.target.value })} aria-label="Quantity" />
            <Button type="button" size="sm" variant="outline" disabled={!addonPick.id} onClick={addChosenAddon}>Add</Button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Estimated total: {peso(estimate)}</strong>
          {estimate > 0 && n(row.quoted_amount) !== estimate ? (
            <Button type="button" size="sm" variant="outline" onClick={() => { setQuoted(String(estimate)); update.mutate({ quoted_amount: estimate }); }}>
              Use as my quote
            </Button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Status
          <select
            value={row.status}
            onChange={(e) => setStatus(e.target.value as InquiryStatus)}
            disabled={update.isPending}
          >
            {INQUIRY_STATUSES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Quote (₱)
          <input
            type="number"
            min="0"
            step="0.01"
            value={quoted}
            style={{ width: 120 }}
            onChange={(e) => setQuoted(e.target.value)}
            onBlur={() => {
              const value = quoted === "" ? null : n(quoted);
              if (value !== row.quoted_amount) update.mutate({ quoted_amount: value });
            }}
          />
        </label>
        {row.last_contact_at ? <small>Last contacted {ago(row.last_contact_at)}</small> : null}
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        Internal notes
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (row.internal_notes ?? "")) update.mutate({ internal_notes: notes || null });
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {row.sale_id ? (
          <Button asChild variant="outline">
            <Link to="/admin/sales/$saleId" params={{ saleId: row.sale_id }}>
              View booking {linkedSale ? saleCode(linkedSale.sale_number) : ""}
              {linkedSale ? ` · ${peso(linkedSale.totals.netRevenue)}` : ""}
            </Link>
          </Button>
        ) : (
          <Button onClick={convert} disabled={busy || row.status === "lost"}>
            {busy ? "Creating…" : "Convert to booking"}
          </Button>
        )}
        {row.status !== "lost" && row.status !== "booked" && row.status !== "completed" ? (
          <Button variant="outline" onClick={() => setStatus("lost")}>
            Mark as lost
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={replyUrl} target="_blank" rel="noreferrer">Reply by email</a>
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            setCopied(await copyText(reply.body));
            window.setTimeout(() => setCopied(false), 2500);
          }}
        >
          {copied ? "Copied!" : "Copy reply for Messenger"}
        </Button>
        <Button variant="outline" onClick={remove}>
          Delete
        </Button>
      </div>
      {!row.sale_id ? (
        <p className="adm-hint">
          "Convert to booking" creates the sale (with the package price and materials), puts the
          date on your calendar, and links it back here.
        </p>
      ) : null}
    </div>
  );
}

function AddInquiry({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    contact: "",
    source: "messenger",
    event_type: "",
    event_date: "",
    message: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof f, value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await (supabase as any).from("inquiries").insert({
      name: f.name.trim(),
      contact: f.contact.trim() || null,
      source: f.source,
      event_type: f.event_type.trim() || null,
      event_date: f.event_date || null,
      message: f.message.trim() || null,
      status: "new",
    });
    setBusy(false);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["biz"] });
    onDone();
  }

  return (
    <form className="adm-card adm-form" onSubmit={save} style={{ marginBottom: 16 }}>
      <h2>Add an inquiry</h2>
      <p className="adm-hint adm-wide">
        Use this for people who message you on Messenger, call, or ask in person.
      </p>
      {err ? <p className="adm-error adm-wide">{err}</p> : null}
      <label>
        Name
        <input required value={f.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label>
        Contact (number / Messenger name)
        <input value={f.contact} onChange={(e) => set("contact", e.target.value)} />
      </label>
      <label>
        Where did they contact you?
        <select value={f.source} onChange={(e) => set("source", e.target.value)}>
          {INQUIRY_SOURCES.filter(([key]) => key !== "website").map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Event type
        <input value={f.event_type} placeholder="Birthday, Wedding…" onChange={(e) => set("event_type", e.target.value)} />
      </label>
      <label>
        Event date
        <input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} />
      </label>
      <label className="adm-wide">
        What they asked
        <textarea value={f.message} onChange={(e) => set("message", e.target.value)} />
      </label>
      <div className="adm-row">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save inquiry"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
