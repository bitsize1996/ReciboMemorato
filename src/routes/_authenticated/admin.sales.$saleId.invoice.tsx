import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { n, peso, saleCode, statusLabel } from "@/lib/finance";
import { brandName, copyText, gmailComposeUrl, invoiceMessage, useBusinessInfo } from "@/lib/messages";
import { siteSettingsQuery } from "@/lib/site.functions";

export const Route = createFileRoute("/_authenticated/admin/sales/$saleId/invoice")({
  head: () => ({ meta: [{ title: "Invoice | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: Invoice,
});

function Invoice() {
  const { saleId } = Route.useParams();
  const biz = useBusinessInfo();
  const site = useQuery(siteSettingsQuery);
  const [note, setNote] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["biz", "sale", saleId, "invoice"],
    queryFn: async () => {
      const run = (fields: string) => (supabase as any).from("sales").select(fields).eq("id", saleId).maybeSingle();
      let result = await run("*, sale_addons(*)");
      if (result.error) result = await run("*");
      if (result.error) throw result.error;
      return result.data as (Database["public"]["Tables"]["sales"]["Row"] & {
        sale_addons?: { id: string; name_snapshot: string; unit_price_snapshot: number; quantity: number; total_price: number }[];
        event_theme?: string | null;
        event_venue?: string | null;
      }) | null;
    },
  });
  if (q.isPending) return <div className="adm-page"><p>Loading…</p></div>;
  if (!q.data) return <div className="adm-page"><p>Sale not found.</p></div>;
  const s = q.data;
  const addonLines = s.sale_addons ?? [];
  const addonsTotal = addonLines.reduce((a, x) => a + n(x.total_price), 0);
  const subtotal = n(s.selling_price) + addonsTotal;
  const net = subtotal - n(s.discount);
  const balance = net - n(s.amount_paid);
  const unit = s.quantity ? n(s.selling_price) / s.quantity : n(s.selling_price);
  const payment = biz.data?.paymentInstructions ?? "";
  const message = invoiceMessage(s as never, brandName(site.data), payment);
  const mailUrl = gmailComposeUrl({
    from: biz.data?.email, to: s.customer_email ?? "", subject: message.subject, body: message.body,
  });

  return (
    <div className="adm-page">
      <div className="adm-head inv-noprint">
        <Link to="/admin/sales/$saleId" params={{ saleId }}>← Back to sale</Link>
        <div className="adm-row">
          <Button asChild variant="outline"><a href={mailUrl} target="_blank" rel="noreferrer">Email invoice</a></Button>
          <Button
            variant="outline"
            onClick={async () => setNote((await copyText(message.body)) ? "Invoice text copied. Paste it into Messenger or any chat." : "Could not copy automatically.")}
          >
            Copy invoice text
          </Button>
          <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        </div>
      </div>
      {note ? <p className="adm-hint inv-noprint">{note}</p> : null}
      <article className="inv-sheet">
        <header className="inv-top">
          <div><strong className="inv-brand">RECIBO MEMORATO</strong><div className="inv-muted">by the bitsize sibs</div></div>
          <div className="inv-right"><h1>INVOICE</h1><div>No. {saleCode(s.sale_number)}</div><div>Date: {new Date().toISOString().slice(0, 10)}</div></div>
        </header>
        <section className="inv-cols">
          <div><div className="inv-muted">Billed to</div><strong>{s.customer_name}</strong>
            {s.customer_contact && <div>{s.customer_contact}</div>}{s.customer_email && <div>{s.customer_email}</div>}</div>
          <div><div className="inv-muted">Event</div><strong>{s.event_name ?? "—"}</strong>
            <div>{s.event_date ?? "Date to be confirmed"}{s.event_time ? ` · ${s.event_time}` : ""}</div>
            {s.event_theme ? <div>Theme: {s.event_theme}</div> : null}
            {s.event_venue ? <div>Location: {s.event_venue}</div> : null}</div>
        </section>
        <table className="inv-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>{s.package_name_snapshot ?? "Photobooth service"}</td><td>{s.quantity}</td><td>{peso(unit)}</td><td>{peso(s.selling_price)}</td></tr>
            {addonLines.map((a) => (
              <tr key={a.id}><td>Add-on: {a.name_snapshot}</td><td>{n(a.quantity)}</td><td>{peso(a.unit_price_snapshot)}</td><td>{peso(a.total_price)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="inv-totals">
          <dt>Subtotal</dt><dd>{peso(subtotal)}</dd>
          {n(s.discount) > 0 && <><dt>Discount</dt><dd>− {peso(s.discount)}</dd></>}
          <dt><strong>Total</strong></dt><dd><strong>{peso(net)}</strong></dd>
          <dt>Amount paid</dt><dd>{peso(s.amount_paid)}</dd>
          <dt><strong>Balance due</strong></dt><dd><strong>{peso(balance)}</strong></dd>
        </dl>
        <p className="inv-muted">Status: {statusLabel(s.payment_status)}</p>
        {payment ? (
          <div>
            <div className="inv-muted">How to pay</div>
            <p style={{ whiteSpace: "pre-line", margin: "4px 0 0" }}>{payment}</p>
          </div>
        ) : null}
        <p className="inv-foot">Thank you! Because memories need proofs.</p>
      </article>
    </div>
  );
}
