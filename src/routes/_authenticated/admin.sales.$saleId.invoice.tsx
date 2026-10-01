import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { n, peso, saleCode, statusLabel } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/sales/$saleId/invoice")({
  head: () => ({ meta: [{ title: "Invoice | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: Invoice,
});

function Invoice() {
  const { saleId } = Route.useParams();
  const q = useQuery({
    queryKey: ["biz", "sale", saleId, "invoice"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (q.isPending) return <div className="adm-page"><p>Loading…</p></div>;
  if (!q.data) return <div className="adm-page"><p>Sale not found.</p></div>;
  const s = q.data;
  const net = n(s.selling_price) - n(s.discount);
  const balance = net - n(s.amount_paid);
  const unit = s.quantity ? n(s.selling_price) / s.quantity : n(s.selling_price);

  return (
    <div className="adm-page">
      <div className="adm-head inv-noprint">
        <Link to="/admin/sales/$saleId" params={{ saleId }}>← Back to sale</Link>
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      <article className="inv-sheet">
        <header className="inv-top">
          <div><strong className="inv-brand">RECIBO MEMORATO</strong><div className="inv-muted">by the bitsize sibs</div></div>
          <div className="inv-right"><h1>INVOICE</h1><div>No. {saleCode(s.sale_number)}</div><div>Date: {new Date().toISOString().slice(0, 10)}</div></div>
        </header>
        <section className="inv-cols">
          <div><div className="inv-muted">Billed to</div><strong>{s.customer_name}</strong>
            {s.customer_contact && <div>{s.customer_contact}</div>}{s.customer_email && <div>{s.customer_email}</div>}</div>
          <div><div className="inv-muted">Event</div><strong>{s.event_name ?? "—"}</strong>
            <div>{s.event_date ?? "Date to be confirmed"}{s.event_time ? ` · ${s.event_time}` : ""}</div></div>
        </section>
        <table className="inv-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody><tr><td>{s.package_name_snapshot ?? "Photobooth service"}</td><td>{s.quantity}</td><td>{peso(unit)}</td><td>{peso(s.selling_price)}</td></tr></tbody>
        </table>
        <dl className="inv-totals">
          <dt>Subtotal</dt><dd>{peso(s.selling_price)}</dd>
          {n(s.discount) > 0 && <><dt>Discount</dt><dd>− {peso(s.discount)}</dd></>}
          <dt><strong>Total</strong></dt><dd><strong>{peso(net)}</strong></dd>
          <dt>Amount paid</dt><dd>{peso(s.amount_paid)}</dd>
          <dt><strong>Balance due</strong></dt><dd><strong>{peso(balance)}</strong></dd>
        </dl>
        <p className="inv-muted">Status: {statusLabel(s.payment_status)}</p>
        <p className="inv-foot">Thank you! Because memories need proofs.</p>
      </article>
    </div>
  );
}
