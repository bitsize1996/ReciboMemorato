import { type AgreementTerms, type Block, agreementBlocks } from "./agreement";
import { canvasJpeg, pdfFromJpegs } from "./pdf";

// An A4 page laid out at 96 dpi and drawn at double size so the text stays sharp when printed.
const PW = 794;
const PH = 1123;
const SCALE = 2;
const MARGIN = 52;
const TOP = 48;
const BOTTOM = PH - 70;
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';

type Ctx = CanvasRenderingContext2D;
interface Word {
  text: string;
  bold: boolean;
}

/** Splits text with **bold** parts into words that remember whether they are bold. */
function toWords(text: string): Word[] {
  const out: Word[] = [];
  text.split("**").forEach((segment, i) => {
    for (const piece of segment.split(/(\s+)/)) {
      if (!piece) continue;
      out.push({ text: /^\s+$/.test(piece) ? " " : piece, bold: i % 2 === 1 });
    }
  });
  return out;
}

const fontFor = (size: number, bold: boolean) => `${bold ? "700 " : "400 "}${size}px ${FONT}`;

function layoutLines(ctx: Ctx, text: string, size: number, maxWidth: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let width = 0;
  for (const word of toWords(text)) {
    ctx.font = fontFor(size, word.bold);
    const w = ctx.measureText(word.text).width;
    if (word.text === " ") {
      if (line.length > 0) {
        line.push(word);
        width += w;
      }
      continue;
    }
    if (width + w > maxWidth && line.length > 0) {
      while (line.length && line[line.length - 1]!.text === " ") line.pop();
      lines.push(line);
      line = [];
      width = 0;
    }
    line.push(word);
    width += w;
  }
  while (line.length && line[line.length - 1]!.text === " ") line.pop();
  if (line.length) lines.push(line);
  return lines;
}

function drawLine(ctx: Ctx, line: Word[], x: number, y: number, size: number, color: string) {
  let cursor = x;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  for (const word of line) {
    ctx.font = fontFor(size, word.bold);
    ctx.fillText(word.text, cursor, y);
    cursor += ctx.measureText(word.text).width;
  }
}

/** Letter-spaced capitals for the title. */
function spaced(ctx: Ctx, text: string, x: number, y: number, size: number, gap: number) {
  ctx.font = fontFor(size, false);
  ctx.textAlign = "left";
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + gap;
  }
}

const longDate = (iso: string): string => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Draws the agreement and returns its pages as canvases. */
export async function renderAgreementPages(t: AgreementTerms, signatureDataUrl?: string | null): Promise<HTMLCanvasElement[]> {
  const signature = t.includeSignature && signatureDataUrl ? await loadImage(signatureDataUrl) : null;
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement;
  let ctx!: Ctx;
  let y = TOP;

  const newPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = PW * SCALE;
    canvas.height = PH * SCALE;
    ctx = canvas.getContext("2d")!;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PW, PH);
    pages.push(canvas);
    y = TOP;
  };
  newPage();

  const contentWidth = PW - MARGIN * 2;

  // ---- title ----
  ctx.fillStyle = "#1a1a1a";
  ctx.font = fontFor(15, true);
  ctx.textAlign = "left";
  ctx.fillText(t.businessName.toUpperCase(), MARGIN, y + 12);
  ctx.fillStyle = "#1a1a1a";
  spaced(ctx, "PHOTOBOOTH SERVICE", MARGIN, y + 52, 24, 4);
  spaced(ctx, "AGREEMENT", MARGIN, y + 84, 24, 4);
  y += 104;
  ctx.fillStyle = "#1a1a1a";
  ctx.font = fontFor(13, false);
  ctx.fillText(`This agreement is made between ${t.businessName} and the client below.`, MARGIN, y);
  y += 24;

  // ---- the details block ----
  const fields: [string, string][] = [
    ["Client Name", t.clientName],
    ["Event Name", t.eventName],
    ["Event Date", t.eventDate ? longDate(t.eventDate) : ""],
    ["Event Location", t.eventLocation],
    ["Service Time", t.serviceTime],
    ["Service Duration", t.durationHours ? `${t.durationHours} hours` : ""],
    ...(t.theme.trim() ? ([["Theme", t.theme]] as [string, string][]) : []),
    ...(t.backdrop.trim() ? ([["Backdrop", t.backdrop]] as [string, string][]) : []),
  ];
  const labelX = MARGIN + 8;
  const valueX = MARGIN + 150;
  for (const [label, value] of fields) {
    ctx.fillStyle = "#555555";
    ctx.font = fontFor(12, false);
    ctx.textAlign = "left";
    ctx.fillText(label, labelX, y);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = fontFor(14, false);
    ctx.fillText(value, valueX + 4, y);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(valueX, y + 5, PW - MARGIN - valueX, 1);
    y += 25;
  }
  y += 8;

  // ---- the clauses ----
  const blocks: Block[] = agreementBlocks(t);
  const lineHeight = 18;
  const sizeFor = (block: Block) => (block.kind === "heading" ? 14 : 12);

  const signatureHeight = 140;
  const measure = (block: Block) => {
    const size = sizeFor(block);
    const indent = block.kind === "bullet" ? 22 : 0;
    const text = block.kind === "heading" ? `**${block.text}**` : block.text;
    const lines = layoutLines(ctx, text, size, contentWidth - indent);
    return { size, indent, lines, height: lines.length * lineHeight + (block.kind === "heading" ? 4 : 3) };
  };
  // The last clause stays with the signatures, so the signature lines never sit alone on a page.
  const lastHeading = blocks.map((block) => block.kind).lastIndexOf("heading");
  const tailHeight = blocks.slice(lastHeading).reduce((sum, block) => sum + measure(block).height, 0) + 24 + signatureHeight;

  blocks.forEach((block, index) => {
    const { size, indent, lines, height } = measure(block);
    const before = block.kind === "heading" ? 10 : 0;
    // A heading must not be left alone at the bottom of a page.
    const needed = block.kind === "heading" ? height + lineHeight * 2 : height;
    if (index === lastHeading && y + before + tailHeight > BOTTOM) newPage();
    else if (y + before + needed > BOTTOM) newPage();
    else y += before;
    lines.forEach((line, i) => {
      const lineY = y + lineHeight - 4 + i * lineHeight;
      if (block.kind === "bullet" && i === 0) {
        ctx.fillStyle = "#1a1a1a";
        ctx.font = fontFor(size, false);
        ctx.fillText("•", MARGIN + 8, lineY);
      }
      drawLine(ctx, line, MARGIN + indent, lineY, size, "#1a1a1a");
    });
    y += height + (block.kind === "paragraph" && blocks[index + 1]?.kind === "paragraph" ? 3 : 0);
  });

  // ---- signatures, kept together on one page ----
  if (y + 24 + signatureHeight > BOTTOM) newPage();
  y += 28;
  const colWidth = (contentWidth - 40) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + 40;
  const row = (x: number, label: string, value: string, top: number) => {
    ctx.fillStyle = "#555555";
    ctx.font = fontFor(12, false);
    ctx.textAlign = "left";
    ctx.fillText(label, x, top);
    const start = x + ctx.measureText(label).width + 8;
    ctx.fillStyle = "#1a1a1a";
    ctx.font = fontFor(13, false);
    ctx.fillText(value, start + 2, top);
    ctx.fillRect(start, top + 5, x + colWidth - start, 1);
  };
  row(leftX, "Client Name:", t.clientName, y);
  row(rightX, "Representative:", t.representativeName, y);
  y += 58;
  row(leftX, "Signature:", "", y);
  row(rightX, "Signature:", "", y);
  if (signature) {
    const targetH = 46;
    const targetW = Math.min(colWidth - 90, (signature.width / signature.height) * targetH);
    ctx.drawImage(signature, rightX + 78, y - targetH + 6, targetW, targetH);
  }
  y += 44;
  row(leftX, "Date:", "", y);
  row(rightX, "Date:", t.agreementDate ? longDate(t.agreementDate) : "", y);

  // ---- page numbers ----
  pages.forEach((page, i) => {
    const c = page.getContext("2d")!;
    c.fillStyle = "#8a8a8a";
    c.font = fontFor(11, false);
    c.textAlign = "center";
    c.fillText(`${t.businessName} · Photobooth Service Agreement · Page ${i + 1} of ${pages.length}`, PW / 2, PH - 34);
  });
  return pages;
}

/** The agreement as a PDF file, ready to send for signing. */
export async function buildAgreementPdf(t: AgreementTerms, signatureDataUrl?: string | null): Promise<Blob> {
  const pages = await renderAgreementPages(t, signatureDataUrl);
  return pdfFromJpegs(pages.map((page) => ({ jpeg: canvasJpeg(page, 0.92), width: page.width, height: page.height })));
}
