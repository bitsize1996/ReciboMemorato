/** Wraps JPEG pictures in a PDF with one A4 page per picture. */
export function pdfFromJpegs(pages: { jpeg: Uint8Array; width: number; height: number }[]): Blob {
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
  const object = (id: number) => {
    offsets[id] = length;
  };

  // Object numbers: 1 = catalog, 2 = page list, then three objects per page (page, picture, drawing).
  const pageObj = (i: number) => 3 + i * 3;
  push("%PDF-1.4\n");
  object(1);
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  object(2);
  push(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pid = pageObj(i);
    object(pid);
    push(
      `${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${pid + 1} 0 R >> >> /Contents ${pid + 2} 0 R >>\nendobj\n`,
    );
    object(pid + 1);
    push(
      `${pid + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    push("\nendstream\nendobj\n");
    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
    object(pid + 2);
    push(`${pid + 2} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  });

  const total = 3 + pages.length * 3;
  const xrefAt = length;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id += 1) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  push(`${xref}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** Turns a canvas into JPEG bytes. */
export function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.92): Uint8Array {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Saves a file to the user's device. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
