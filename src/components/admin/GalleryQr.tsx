import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { brandName, copyText } from "@/lib/messages";
import { qrMatrix, qrPath, qrSvg } from "@/lib/qr";
import { siteSettingsQuery } from "@/lib/site.functions";

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/** A printable card: business name, event name, the QR code and a short line telling guests what to do. */
function cardPng(modules: boolean[][], brand: string, eventName: string, caption: string): Promise<Blob> {
  const W = 1200;
  const H = 1500;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  ctx.fillStyle = "#6b6b6b";
  ctx.font = `600 32px ${font}`;
  ctx.fillText(brand.toUpperCase(), W / 2, 100);

  ctx.fillStyle = "#111111";
  ctx.font = `700 64px ${font}`;
  const titleLines = wrapLines(ctx, eventName, W - 200);
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, 210 + i * 76));

  const border = 4;
  const cells = modules.length + border * 2;
  const cell = Math.floor(860 / cells);
  const qrSize = cell * cells;
  const x0 = Math.round((W - qrSize) / 2);
  const y0 = 210 + titleLines.length * 76 + 20;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, qrSize, qrSize);
  ctx.fillStyle = "#000000";
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect(x0 + (x + border) * cell, y0 + (y + border) * cell, cell, cell);
    }),
  );

  ctx.fillStyle = "#111111";
  ctx.font = `600 46px ${font}`;
  wrapLines(ctx, caption, W - 200).forEach((line, i) => ctx.fillText(line, W / 2, y0 + qrSize + 90 + i * 60));

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the image"))), "image/png"),
  );
}

/** Makes a QR code that opens an event's public gallery. */
export function GalleryQr({ slug, name, published }: { slug: string; name: string; published: boolean }) {
  const site = useQuery(siteSettingsQuery);
  const [base, setBase] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("Scan to see and download your photos");

  // Start from the address this page is opened on, so the code matches your live website.
  useEffect(() => setBase(window.location.origin), []);

  const link = `${base.trim().replace(/\/+$/, "")}/memories/${slug}`;
  const modules = useMemo(() => {
    try {
      return base.trim() ? qrMatrix(link) : null;
    } catch {
      return null;
    }
  }, [base, link]);

  const fileBase = `qr-${slug}`;
  const brand = brandName(site.data);
  const onPreviewHost = /lovable(project)?\.(app|dev)|localhost/.test(base) && base.includes("preview");

  return (
    <section className="admin-panel">
      <h2>Gallery QR code</h2>
      <p className="adm-hint">
        Guests scan this to open this event's gallery on their phone. Print it on a card, a sign or the booth screen.
      </p>
      {!published ? (
        <p className="archive-note">
          This event isn't shown in the Memory Archive yet, so the QR code won't open anything until you switch it on
          under Event status.
        </p>
      ) : null}
      <label className="admin-wide">
        Website address
        <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://your-website.com" />
      </label>
      {onPreviewHost ? (
        <p className="archive-note">
          This looks like a preview address. For a printed QR code, open this page from your live website address, or
          type the live address above.
        </p>
      ) : null}
      <p className="adm-hint" style={{ wordBreak: "break-all" }}>Opens: {link}</p>
      <label className="admin-wide">
        Line under the QR code
        <input value={caption} maxLength={80} onChange={(e) => setCaption(e.target.value)} />
      </label>

      {modules ? (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", margin: "12px 0" }}>
          <svg
            role="img"
            aria-label={`QR code for ${name}`}
            viewBox={`0 0 ${modules.length + 8} ${modules.length + 8}`}
            shapeRendering="crispEdges"
            style={{ width: 220, height: 220, border: "1px solid var(--border)", background: "#fff" }}
          >
            <rect width={modules.length + 8} height={modules.length + 8} fill="#fff" />
            <path transform="translate(4 4)" d={qrPath(modules)} fill="#000" />
          </svg>
          <div style={{ display: "grid", gap: 8 }}>
            <Button
              type="button"
              onClick={async () => {
                download(await cardPng(modules, brand, name, caption), `${fileBase}-card.png`);
                setNote("Saved the printable card. Print it at A5 or A6, or send it to your printer.");
              }}
            >
              Download printable card (PNG)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                download(new Blob([qrSvg(link)], { type: "image/svg+xml" }), `${fileBase}.svg`);
                setNote("Saved the QR code on its own as a sharp vector file, good for print layouts.");
              }}
            >
              Download QR only (SVG)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => setNote((await copyText(link)) ? "Link copied." : "Could not copy the link.")}
            >
              Copy link
            </Button>
          </div>
        </div>
      ) : (
        <p className="adm-hint">Enter your website address to make the QR code.</p>
      )}
      {note ? <p className="adm-hint">{note}</p> : null}
      <p className="adm-hint">Tip: scan it with your own phone before printing, and print it at least 3 cm wide.</p>
    </section>
  );
}
