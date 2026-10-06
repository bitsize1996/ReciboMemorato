import { n, peso, saleCode, statusLabel } from "./finance";

/** Everything printed on an invoice. */
export interface InvoiceData {
  brand: string;
  tagline: string;
  code: string;
  date: string;
  customer: { name: string; contact?: string | null; email?: string | null };
  /** The right-hand block: event details for a photobooth sale, the date of sale otherwise. */
  details: { heading: string; title: string; lines: string[] };
  lines: { description: string; qty: number; unit: number; amount: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  status: string;
  paymentInstructions?: string;
  footer: string;
}

interface SaleForInvoice {
  sale_number: number | null;
  customer_name: string;
  customer_contact?: string | null;
  customer_email?: string | null;
  event_name: string | null;
  event_date: string | null;
  event_time?: string | null;
  event_theme?: string | null;
  event_venue?: string | null;
  booking_date?: string | null;
  sale_type?: string | null;
  package_name_snapshot: string | null;
  quantity: number | null;
  selling_price: unknown;
  discount: unknown;
  amount_paid: unknown;
  payment_status: string;
  sale_addons?: { name_snapshot: string; unit_price_snapshot: unknown; quantity: unknown; total_price: unknown }[] | null;
}

export function invoiceDataFromSale(
  sale: SaleForInvoice,
  options: { brand: string; tagline: string; paymentInstructions?: string },
): InvoiceData {
  const addons = sale.sale_addons ?? [];
  const qty = n(sale.quantity) || 1;
  const subtotal = n(sale.selling_price) + addons.reduce((a, x) => a + n(x.total_price), 0);
  const total = subtotal - n(sale.discount);
  return {
    brand: options.brand,
    tagline: options.tagline,
    code: saleCode(sale.sale_number),
    date: new Date().toISOString().slice(0, 10),
    customer: { name: sale.customer_name, contact: sale.customer_contact, email: sale.customer_email },
    details:
      (sale.sale_type ?? "event") === "event"
        ? {
            heading: "EVENT",
            title: sale.event_name ?? "—",
            lines: [
              [sale.event_date ?? "Date to be confirmed", sale.event_time].filter(Boolean).join(" · "),
              sale.event_theme ? `Theme: ${sale.event_theme}` : "",
              sale.event_venue ? `Location: ${sale.event_venue}` : "",
            ].filter(Boolean),
          }
        : sale.sale_type === "popup"
          ? { heading: "POP-UP", title: sale.event_name ?? "Pop-up", lines: [`Date of sale: ${sale.booking_date ?? ""}`] }
          : { heading: "DATE OF SALE", title: sale.booking_date ?? "", lines: [] },
    lines: [
      {
        description: sale.package_name_snapshot ?? "Photobooth service",
        qty,
        unit: n(sale.selling_price) / qty,
        amount: n(sale.selling_price),
      },
      ...addons.map((a) => ({
        description: `Add-on: ${a.name_snapshot}`,
        qty: n(a.quantity),
        unit: n(a.unit_price_snapshot),
        amount: n(a.total_price),
      })),
    ],
    subtotal,
    discount: n(sale.discount),
    total,
    paid: n(sale.amount_paid),
    balance: total - n(sale.amount_paid),
    status: statusLabel(sale.payment_status),
    paymentInstructions: options.paymentInstructions,
    footer: "Thank you! Because memories need proofs.",
  };
}

// ---------------------------------------------------------------------------
// Drawing: an A4 page at 150 dpi, drawn with the browser's canvas.
// ---------------------------------------------------------------------------

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 96;
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';

type Ctx = CanvasRenderingContext2D;

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/** Draws the invoice and returns the y position where it ends. */
function render(ctx: Ctx, d: InvoiceData): number {
  const right = PAGE_W - MARGIN;
  const width = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  const text = (value: string, x: number, yy: number, opts: { size?: number; bold?: boolean; color?: string; align?: CanvasTextAlign } = {}) => {
    ctx.font = `${opts.bold ? "700 " : ""}${opts.size ?? 24}px ${FONT}`;
    ctx.fillStyle = opts.color ?? "#1a1a1a";
    ctx.textAlign = opts.align ?? "left";
    ctx.fillText(value, x, yy);
  };
  const rule = (yy: number, color = "#d8d4cc", thickness = 2) => {
    ctx.fillStyle = color;
    ctx.fillRect(MARGIN, yy, width, thickness);
  };

  // Header
  text(d.brand, MARGIN, y + 36, { size: 40, bold: true });
  text(d.tagline, MARGIN, y + 72, { size: 22, color: "#6b6b6b" });
  text("INVOICE", right, y + 36, { size: 46, bold: true, align: "right" });
  text(`No. ${d.code}`, right, y + 72, { size: 24, align: "right" });
  text(`Date: ${d.date}`, right, y + 104, { size: 24, color: "#6b6b6b", align: "right" });
  y += 150;
  rule(y, "#1a1a1a", 3);
  y += 44;

  // Billed to / Event
  const colRight = MARGIN + 560;
  text("BILLED TO", MARGIN, y, { size: 18, bold: true, color: "#8a8a8a" });
  text(d.details.heading, colRight, y, { size: 18, bold: true, color: "#8a8a8a" });
  let yl = y + 38;
  let yr = y + 38;
  text(d.customer.name, MARGIN, yl, { size: 28, bold: true });
  yl += 36;
  for (const detail of [d.customer.contact, d.customer.email]) {
    if (detail) {
      text(detail, MARGIN, yl, { size: 24, color: "#444" });
      yl += 32;
    }
  }
  ctx.font = `700 28px ${FONT}`;
  for (const line of wrap(ctx, d.details.title, 460)) {
    text(line, colRight, yr, { size: 28, bold: true });
    yr += 36;
  }
  ctx.font = `24px ${FONT}`;
  for (const item of d.details.lines) {
    for (const line of wrap(ctx, item, 460)) {
      text(line, colRight, yr, { size: 24, color: "#444" });
      yr += 32;
    }
  }
  y = Math.max(yl, yr) + 36;

  // Items table
  const xQty = MARGIN + 700;
  const xUnit = MARGIN + 870;
  const xAmount = right;
  text("DESCRIPTION", MARGIN, y, { size: 18, bold: true, color: "#8a8a8a" });
  text("QTY", xQty, y, { size: 18, bold: true, color: "#8a8a8a", align: "right" });
  text("UNIT PRICE", xUnit, y, { size: 18, bold: true, color: "#8a8a8a", align: "right" });
  text("AMOUNT", xAmount, y, { size: 18, bold: true, color: "#8a8a8a", align: "right" });
  y += 18;
  rule(y);
  y += 12;
  for (const row of d.lines) {
    ctx.font = `24px ${FONT}`;
    const descLines = wrap(ctx, row.description, 560);
    const rowHeight = descLines.length * 32 + 20;
    const baseline = y + 34;
    descLines.forEach((line, i) => text(line, MARGIN, baseline + i * 32, { size: 24 }));
    text(String(row.qty), xQty, baseline, { size: 24, align: "right" });
    text(peso(row.unit), xUnit, baseline, { size: 24, align: "right" });
    text(peso(row.amount), xAmount, baseline, { size: 24, align: "right" });
    y += rowHeight;
    rule(y, "#ece9e2", 1);
    y += 2;
  }
  y += 36;

  // Totals
  const xLabel = MARGIN + 640;
  const gap = 46;
  const totalRow = (label: string, value: string, bold = false, size = 26) => {
    text(label, xLabel, y, { size, bold });
    text(value, xAmount, y, { size, bold, align: "right" });
    y += gap;
  };
  // A short divider that sits between two rows without touching either.
  const divider = (color: string, above: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(xLabel - 20, y - above, right - xLabel + 20, 2);
  };
  totalRow("Subtotal", peso(d.subtotal));
  if (d.discount > 0) totalRow("Discount", `- ${peso(d.discount)}`);
  divider("#d8d4cc", 32);
  totalRow("Total", peso(d.total), true, 30);
  totalRow("Amount paid", peso(d.paid));
  divider("#1a1a1a", 34);
  totalRow("Balance due", peso(d.balance), true, 32);

  y += 4;
  text(`Status: ${d.status}`, MARGIN, y, { size: 24, color: "#6b6b6b" });
  y += 52;

  if (d.paymentInstructions?.trim()) {
    text("HOW TO PAY", MARGIN, y, { size: 18, bold: true, color: "#8a8a8a" });
    y += 36;
    ctx.font = `24px ${FONT}`;
    for (const line of wrap(ctx, d.paymentInstructions.trim(), width)) {
      text(line, MARGIN, y, { size: 24 });
      y += 32;
    }
    y += 20;
  }

  y += 36;
  text(d.footer, PAGE_W / 2, y, { size: 24, color: "#6b6b6b", align: "center" });
  return y + MARGIN;
}

/** Wraps a JPEG picture in a one-page A4 PDF. */
export function pdfFromJpeg(jpeg: Uint8Array, width: number, height: number): Blob {
  const pageW = 595.28;
  const pageH = 841.89;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };

  push("%PDF-1.4\n");
  offsets[1] = length;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = length;
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = length;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  offsets[4] = length;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  offsets[5] = length;
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const xrefAt = length;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** Draws the invoice and returns it as a ready-to-save PDF file. */
export function buildInvoicePdf(data: InvoiceData): Blob {
  const scratch = document.createElement("canvas");
  scratch.width = PAGE_W;
  scratch.height = PAGE_H;
  const measure = scratch.getContext("2d")!;
  const endY = render(measure, data);

  // A very long invoice is shrunk so it still fits on the one page.
  const scale = Math.min(1, PAGE_H / endY);
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.setTransform(scale, 0, 0, scale, (PAGE_W - PAGE_W * scale) / 2, 0);
  render(ctx, data);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.93);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) jpeg[i] = binary.charCodeAt(i);
  return pdfFromJpeg(jpeg, PAGE_W, PAGE_H);
}

/** Saves the invoice to the user's device. */
export function downloadInvoicePdf(data: InvoiceData) {
  const blob = buildInvoicePdf(data);
  const safeName = data.customer.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const fileName = `Invoice-${data.code.replace("#", "")}${safeName ? `-${safeName}` : ""}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
