import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  AGREEMENT_STATUSES,
  type AgreementTerms,
  agreementStatusLabel,
  bookingChanges,
  defaultsFromTerms,
  money,
  termsFromSale,
} from "@/lib/agreement";
import { buildAgreementPdf, renderAgreementPages } from "@/lib/agreement-pdf";
import { n, saleCode } from "@/lib/finance";
import { brandName, gmailComposeUrl, useBusinessInfo } from "@/lib/messages";
import { saveBlob } from "@/lib/pdf";
import { siteSettingsQuery } from "@/lib/site.functions";

export const Route = createFileRoute("/_authenticated/admin/sales/$saleId/agreement")({
  head: () => ({
    meta: [{ title: "Service agreement | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AgreementPage,
});

/** Shrinks a signature picture to a small PNG that keeps its see-through background. */
async function signatureFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 600 / bitmap.width, 220 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function AgreementPage() {
  const { saleId } = Route.useParams();
  const qc = useQueryClient();
  const biz = useBusinessInfo();
  const site = useQuery(siteSettingsQuery);

  const sale = useQuery({
    queryKey: ["biz", "sale", saleId, "agreement-source"],
    queryFn: async () => {
      const run = (fields: string) => (supabase as any).from("sales").select(fields).eq("id", saleId).maybeSingle();
      let result = await run("*, packages(name, included_services), sale_addons(*)");
      if (result.error) result = await run("*, sale_addons(*)");
      if (result.error) result = await run("*");
      if (result.error) throw result.error;
      return result.data as Record<string, any> | null;
    },
  });

  // A saved agreement for this booking, if there is one (the table may not exist yet).
  const saved = useQuery({
    queryKey: ["biz", "agreement", saleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agreements")
        .select("id, terms, status, sent_at, signed_at")
        .eq("sale_id", saleId)
        .maybeSingle();
      if (error) return { ready: false, row: null as null | Record<string, any> };
      return { ready: true, row: (data ?? null) as null | Record<string, any> };
    },
  });

  const [terms, setTerms] = useState<AgreementTerms | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fill the form once everything has loaded: saved terms win over a fresh draft.
  useEffect(() => {
    if (terms || !sale.data || biz.isPending || saved.isPending) return;
    const draft = termsFromSale(sale.data as never, biz.data?.agreementDefaults as never, biz.data?.representativeName ?? "");
    const storedTerms = saved.data?.row?.terms as Partial<AgreementTerms> | undefined;
    setTerms(storedTerms && Object.keys(storedTerms).length > 0 ? { ...draft, ...storedTerms } : draft);
    setSignature(biz.data?.signatureImage || null);
  }, [terms, sale.data, biz.isPending, biz.data, saved.isPending, saved.data]);

  // A live preview that follows every change.
  useEffect(() => {
    if (!terms) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const pages = await renderAgreementPages(terms, signature);
      if (!cancelled) setPreviews(pages.map((page) => page.toDataURL("image/jpeg", 0.85)));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [terms, signature]);

  // The booking as it is now, to spot details that changed after the agreement was saved.
  const fresh = useMemo(
    () =>
      sale.data
        ? termsFromSale(sale.data as never, biz.data?.agreementDefaults as never, biz.data?.representativeName ?? "")
        : null,
    [sale.data, biz.data],
  );
  const [dismissed, setDismissed] = useState(false);
  const savedTerms = saved.data?.row?.terms as Partial<AgreementTerms> | undefined;
  const changes = fresh && savedTerms && Object.keys(savedTerms).length > 0 ? bookingChanges(fresh, savedTerms) : [];

  const set = <K extends keyof AgreementTerms>(key: K, value: AgreementTerms[K]) =>
    setTerms((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (sale.isPending || !terms) return <div className="adm-page"><p>Loading…</p></div>;
  if (!sale.data) return <div className="adm-page"><p>Booking not found.</p></div>;

  const s = sale.data;
  const status = (saved.data?.row?.status as string | undefined) ?? "draft";
  const fileName = `Service-Agreement-${saleCode(s.sale_number).replace("#", "")}-${terms.clientName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)}.pdf`;
  const brand = brandName(site.data);

  async function downloadPdf() {
    setBusy(true);
    try {
      saveBlob(await buildAgreementPdf(terms!, signature), fileName);
      setMessage("Saved the agreement as a PDF. Send it to your client to sign, or print it.");
    } finally {
      setBusy(false);
    }
  }

  async function saveToBooking(nextStatus?: string) {
    const when = new Date().toISOString();
    const body: Record<string, unknown> = { sale_id: saleId, terms, status: nextStatus ?? status };
    if (nextStatus === "sent") body["sent_at"] = when;
    if (nextStatus === "signed") body["signed_at"] = when;
    const { error } = await (supabase as any).from("agreements").upsert(body, { onConflict: "sale_id" });
    if (error) return setMessage("Could not save. The one-time setup for agreements may not have been run yet.");
    setMessage(nextStatus ? `Marked as ${agreementStatusLabel(nextStatus).toLowerCase()}.` : "Saved with this booking.");
    qc.invalidateQueries({ queryKey: ["biz", "agreement", saleId] });
    qc.invalidateQueries({ queryKey: ["biz", "agreement-status", saleId] });
  }

  async function saveDefaults() {
    const { error } = await (supabase as any).from("business_info").upsert(
      {
        id: 1,
        agreement_defaults: defaultsFromTerms(terms!),
        representative_name: terms!.representativeName || null,
        signature_image: signature,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return setMessage("Could not save your defaults. The one-time setup may not have been run yet.");
    setMessage("Saved. New agreements will start with these amounts, your name and your signature.");
    qc.invalidateQueries({ queryKey: ["biz", "business-info"] });
  }

  const mail = gmailComposeUrl({
    from: biz.data?.email,
    to: (s["customer_email"] as string | null) ?? "",
    subject: `Photobooth Service Agreement — ${terms.eventName || terms.clientName}`,
    body: [
      `Hi ${terms.clientName},`,
      "",
      `Attached is the Photobooth Service Agreement for ${terms.eventName || "your event"}${terms.eventDate ? ` on ${terms.eventDate}` : ""}.`,
      "Please read it, sign it, and send a photo or scan of the signed copy back to confirm your booking.",
      "",
      "Thank you!",
      brand,
    ].join("\n"),
  });

  const field = (label: string, key: keyof AgreementTerms, props: { type?: string; placeholder?: string; wide?: boolean } = {}) => (
    <label className={props.wide ? "adm-wide" : undefined}>
      {label}
      <input
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        value={String(terms[key] ?? "")}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </label>
  );

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <Link to="/admin/sales/$saleId" params={{ saleId }}>← Back to booking</Link>
          <h1>Service agreement</h1>
          <p className="adm-hint">
            Everything here can be changed for this booking. Your amounts, wording, name and signature can be saved as the
            starting point for the next agreement.
          </p>
        </div>
        <div className="adm-row">
          <Button onClick={downloadPdf} disabled={busy}>{busy ? "Making PDF…" : "Download PDF"}</Button>
          <Button asChild variant="outline"><a href={mail} target="_blank" rel="noreferrer">Email to client</a></Button>
        </div>
      </header>
      {message ? <p className="adm-hint" style={{ fontWeight: 600 }}>{message}</p> : null}
      {changes.length > 0 && !dismissed ? (
        <section className="adm-card">
          <h2>The booking has changed</h2>
          <p>
            Since this agreement was saved, these details changed on the booking:{" "}
            <strong>{changes.map(([, label]) => label).join(", ")}</strong>.
          </p>
          {status === "signed" ? (
            <p className="adm-error">This agreement was already signed. If you change it, your client needs to sign the new version.</p>
          ) : null}
          <div className="adm-row">
            <Button
              type="button"
              onClick={() => {
                if (!fresh) return;
                setTerms((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev } as Record<string, unknown>;
                  for (const [key] of changes) next[key] = fresh[key];
                  return next as unknown as AgreementTerms;
                });
                setDismissed(true);
                setMessage("Updated from the booking. Click Save with this booking to keep it.");
              }}
            >
              Update the agreement from the booking
            </Button>
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>Keep my version</Button>
          </div>
        </section>
      ) : null}
      {saved.data && !saved.data.ready ? (
        <p className="adm-hint">Saving agreements with a booking needs a one-time database setup. You can still download the PDF.</p>
      ) : null}

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <section className="adm-card adm-form">
            <h2>Client and event</h2>
            {field("Client name", "clientName")}
            {field("Event name", "eventName")}
            {field("Event date", "eventDate", { type: "date" })}
            {field("Event location", "eventLocation", { wide: true })}
            {field("Theme (optional)", "theme")}
            {field("Backdrop (optional)", "backdrop")}
            {field("Service time", "serviceTime", { placeholder: "e.g. 12pm-2pm" })}
            {field("Service duration (hours)", "durationHours", { type: "number" })}
          </section>

          <section className="adm-card adm-form">
            <h2>What the package includes</h2>
            <label className="adm-wide">
              Inclusions, one per line (started from your package and the booking's add-ons)
              <textarea rows={6} value={terms.inclusions} onChange={(e) => set("inclusions", e.target.value)} placeholder={"3 hours of photobooth service\nUnlimited photo sessions\nPrinted photo strips"} />
            </label>
            <p className="adm-hint adm-wide">These appear on the agreement as "Package Inclusions". Leave it empty to leave the section out.</p>
          </section>

          <section className="adm-card adm-form">
            <h2>Package and payment</h2>
            {field("Package shown on the agreement", "packageLabel", { wide: true })}
            {field("Total package rate (₱)", "totalRate", { type: "number" })}
            {field("Reservation fee (₱)", "reservationFee", { type: "number" })}
            {n(s["amount_paid"]) > 0 ? (
              <p className="adm-hint adm-wide">
                Paid so far on this booking: <strong>{money(s["amount_paid"])}</strong>{" "}
                <button type="button" className="admin-link" onClick={() => set("reservationFee", String(n(s["amount_paid"])))}>
                  Use it as the reservation fee
                </button>
              </p>
            ) : null}
            {field("Reschedule notice (days)", "rescheduleNoticeDays", { type: "number" })}
          </section>

          <section className="adm-card adm-form">
            <h2>Service time, pauses and prints</h2>
            {field("Grace pause allowed (minutes)", "graceMinutes", { placeholder: "e.g. 10–15" })}
            {field("Extra fee applies after (minutes)", "pauseLimitMinutes", { type: "number" })}
            {field("Extra fee for a long pause (₱)", "extraPauseFee", { type: "number" })}
            {field("Fee per extra print (₱)", "extraPrintFee", { type: "number" })}
          </section>

          <section className="adm-card adm-form">
            <h2>Overtime</h2>
            {field("Overtime per hour (₱)", "overtimeRate", { type: "number" })}
            {field("Extra per hour with the Magnet add-on (₱)", "magnetOvertime", { type: "number", placeholder: "Leave empty to leave it out" })}
            <p className="adm-hint adm-wide">The Magnet sentence only appears when an amount is filled in. It starts filled in only when the booking includes a Magnet package or add-on.</p>
          </section>

          <section className="adm-card adm-form">
            <h2>Client requirements and other terms</h2>
            {field("Space needed", "spaceNeeded", { placeholder: "e.g. 2.5m x 2.5m" })}
            {field("Power needed", "powerNeeded", { placeholder: "e.g. One 220V power outlet" })}
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includePowerClause} onChange={(e) => set("includePowerClause", e.target.checked)} />
              Include the power interruption clause
            </label>
            <label className="adm-wide">
              What the service includes (follows your business name)
              <textarea rows={3} value={terms.serviceText} onChange={(e) => set("serviceText", e.target.value)} />
            </label>
            <label className="adm-wide">
              Additional terms (optional, one per line)
              <textarea rows={3} value={terms.additionalTerms} onChange={(e) => set("additionalTerms", e.target.value)} />
            </label>
            {field("Business name on the agreement", "businessName", { wide: true })}
          </section>

          <section className="adm-card adm-form">
            <h2>More clauses (suggested)</h2>
            <p className="adm-hint adm-wide">
              Common terms for photobooth bookings. Tick the ones you want and set the amounts. Each one shows in the preview.
              This wording is a general template, so have it checked if you need legal advice.
            </p>
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeSetupClause} onChange={(e) => set("includeSetupClause", e.target.checked)} />
              Set-up time: the booth is set up before the service starts, and the venue lets us in
            </label>
            {terms.includeSetupClause ? field("Set-up starts this many minutes before", "setupMinutes", { type: "number" }) : null}
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeDamageClause} onChange={(e) => set("includeDamageClause", e.target.checked)} />
              Equipment care: the client covers damage caused by guests or the venue
            </label>
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includePhotoUseClause} onChange={(e) => set("includePhotoUseClause", e.target.checked)} />
              Photo use: you may show the photos in your portfolio and social media unless the client says no
            </label>
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeGalleryClause} onChange={(e) => set("includeGalleryClause", e.target.checked)} />
              Digital copies: shared through an online gallery for a set number of days
            </label>
            {terms.includeGalleryClause ? field("Gallery stays online for (days)", "galleryDays", { type: "number" }) : null}
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeForceMajeure} onChange={(e) => set("includeForceMajeure", e.target.checked)} />
              Events beyond our control (weather, calamities): the event is rescheduled
            </label>
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeUnpaidBalanceClause} onChange={(e) => set("includeUnpaidBalanceClause", e.target.checked)} />
              The service may not start until the remaining balance is paid
            </label>
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeStaffMeal} onChange={(e) => set("includeStaffMeal", e.target.checked)} />
              A meal for the on-site attendant at long events
            </label>
            {terms.includeStaffMeal ? field("For events longer than (hours)", "staffMealHours", { type: "number" }) : null}
            {field("Travel fee for far venues (₱)", "travelFee", { type: "number", placeholder: "Leave empty to leave it out" })}
            {field("Travel fee applies outside", "travelArea", { placeholder: "e.g. Calapan City" })}
          </section>

          <section className="adm-card adm-form">
            <h2>Signing</h2>
            {field("Your representative's name", "representativeName")}
            {field("Date of agreement", "agreementDate", { type: "date" })}
            <label className="adm-check adm-wide">
              <input type="checkbox" checked={terms.includeSignature} onChange={(e) => set("includeSignature", e.target.checked)} />
              Show my signature on the agreement
            </label>
            <label className="adm-wide">
              Upload your signature (a photo or scan on white or see-through background)
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    setSignature(await signatureFromFile(file));
                    set("includeSignature", true);
                  } catch {
                    setMessage("That picture could not be used. Please try a JPG or PNG.");
                  }
                }}
              />
            </label>
            {signature ? (
              <div className="adm-wide">
                <img src={signature} alt="Your signature" style={{ maxHeight: 70, background: "#fff", border: "1px solid var(--adm-line)", padding: 4 }} />
                <button type="button" className="admin-link" onClick={() => setSignature(null)}>Remove signature</button>
              </div>
            ) : null}
            <p className="adm-hint adm-wide">The client's signature and date stay blank for them to complete.</p>
          </section>

          <section className="adm-card adm-form">
            <h2>Save and track</h2>
            <div className="adm-row adm-wide">
              <Button type="button" variant="outline" onClick={() => saveToBooking()}>Save with this booking</Button>
              <Button type="button" variant="outline" onClick={saveDefaults}>Save as my defaults</Button>
            </div>
            <label className="adm-wide">
              Status: <strong>{agreementStatusLabel(status)}</strong>
              {saved.data?.row?.sent_at ? <small className="adm-hint"> · sent {new Date(saved.data.row.sent_at).toLocaleDateString()}</small> : null}
              {saved.data?.row?.signed_at ? <small className="adm-hint"> · signed {new Date(saved.data.row.signed_at).toLocaleDateString()}</small> : null}
            </label>
            <div className="adm-row adm-wide">
              {AGREEMENT_STATUSES.map(([key, label]) => (
                <Button key={key} type="button" size="sm" variant={status === key ? "default" : "outline"} onClick={() => saveToBooking(key)}>
                  Mark as {label.toLowerCase()}
                </Button>
              ))}
            </div>
            <p className="adm-hint adm-wide">"Email to client" opens a ready message in your Gmail. Download the PDF first and attach it.</p>
          </section>
        </div>

        <aside style={{ position: "sticky", top: 12, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Preview</h2>
          {previews.length === 0 ? <p className="adm-hint">Preparing the preview…</p> : previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Agreement page ${i + 1}`}
              style={{ width: "100%", height: "auto", border: "1px solid var(--adm-line)", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.08)" }}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
