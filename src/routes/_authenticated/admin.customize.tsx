import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { saveSiteSettings, siteSettingsQuery, uploadSiteImage } from "@/lib/site.functions";
import { HEX_RE, type SiteSettings } from "@/lib/site-settings";
import { SECTION_LABELS, type HomeContent, type SectionKey } from "@/lib/site-homepage";

export const Route = createFileRoute("/_authenticated/admin/customize")({
  head: () => ({ meta: [
    { title: "Edit landing page | Recibo Memorato Admin" },
    { name: "description", content: "Edit the Recibo Memorato landing page." },
    { property: "og:title", content: "Edit landing page | Recibo Memorato" },
    { property: "og:description", content: "Private landing page editor." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: CustomizePage,
});

type TextKey = Exclude<keyof SiteSettings, "homepage" | "colorAccent" | "colorPaper" | "colorInk">;
type HomeStringKey = { [K in keyof HomeContent]: HomeContent[K] extends string ? K : never }[keyof HomeContent];
type HomeArrayKey = { [K in keyof HomeContent]: HomeContent[K] extends string[] ? K : never }[keyof HomeContent];

const TOP_FIELDS: { key: TextKey; label: string; long?: boolean }[] = [
  { key: "brandLine1", label: "Brand first line" }, { key: "brandLine2", label: "Brand second line" },
  { key: "brandSub", label: "Brand byline" }, { key: "heroEyebrow", label: "Small heading" },
  { key: "heroTitle", label: "Main headline", long: true }, { key: "heroLead", label: "Intro line", long: true },
  { key: "heroDescription", label: "Intro description", long: true }, { key: "ctaLabel", label: "Message button text" },
  { key: "messengerUrl", label: "Message button link" },
];
const SECTIONS: Record<SectionKey, { fields: { key: HomeStringKey; label: string; long?: boolean }[]; arrays?: { key: HomeArrayKey; labels: string[] }[] }> = {
  hero: { fields: [
    { key: "heroStamp", label: "Round stamp" }, { key: "heroBackCaption", label: "Left photo caption" },
    { key: "heroReceiptNumber", label: "Receipt label" }, { key: "heroReceiptFooter", label: "Receipt footer" },
    { key: "heroFrontCaption", label: "Right photo caption" },
  ], arrays: [{ key: "heroSteps", labels: ["Step 1", "Step 2", "Step 3"] }] },
  problem: { fields: [
    { key: "problemHeading", label: "Heading", long: true }, { key: "problemQuote", label: "Quote", long: true },
    { key: "problemClosing", label: "Closing line" },
  ], arrays: [{ key: "problemParagraphs", labels: ["First paragraph", "Second paragraph"] }] },
  solution: { fields: [
    { key: "solutionEyebrow", label: "Small heading" }, { key: "solutionHeading", label: "Heading", long: true },
    { key: "solutionClosing", label: "Closing line" }, { key: "solutionButton", label: "Message button" },
  ], arrays: [{ key: "solutionParagraphs", labels: ["First paragraph", "Second paragraph"] }] },
  services: { fields: [
    { key: "servicesEyebrow", label: "Small heading" }, { key: "servicesHeading", label: "Heading", long: true },
    { key: "servicesIntro", label: "Introduction", long: true },
  ] },
  story: { fields: [
    { key: "storyEyebrow", label: "Small heading" }, { key: "storyHeading", label: "Heading", long: true },
    { key: "storyLead", label: "Opening line", long: true }, { key: "storyBody", label: "Closing paragraph", long: true },
    { key: "storyClosing", label: "Final line" }, { key: "storyImageCaption", label: "Photo caption" },
  ], arrays: [{ key: "storyPoints", labels: ["Point 1", "Point 2", "Point 3", "Point 4"] }] },
  proof: { fields: [
    { key: "proofEyebrow", label: "Small heading" }, { key: "proofHeading", label: "Heading", long: true },
    { key: "proofIntro", label: "Introduction", long: true },
  ] },
  archive: { fields: [
    { key: "archiveEyebrow", label: "Small heading" }, { key: "archiveHeading", label: "Heading", long: true },
    { key: "archiveIntro", label: "Introduction", long: true }, { key: "archiveLink", label: "Archive link" },
  ] },
  offer: { fields: [
    { key: "offerEyebrow", label: "Small heading" }, { key: "offerHeading", label: "Heading", long: true },
    { key: "offerBody", label: "Description", long: true }, { key: "offerReceiptHeading", label: "Receipt heading" },
  ] },
  faqs: { fields: [ { key: "faqEyebrow", label: "Small heading" }, { key: "faqHeading", label: "Heading", long: true } ] },
  final: { fields: [
    { key: "finalEyebrow", label: "Small heading" }, { key: "finalSmall", label: "Line beneath button" },
  ], arrays: [{ key: "finalLines", labels: ["Line 1", "Line 2", "Line 3", "Line 4"] }] },
};

function CustomizePage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(siteSettingsQuery);
  const [form, setForm] = useState<SiteSettings>(data);
  const [active, setActive] = useState<SectionKey>("hero");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState("");
  useEffect(() => setForm(data), [data]);
  const save = useMutation({
    mutationFn: (input: SiteSettings) => saveSiteSettings({ data: input }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["site-settings"] }); setMessage("Saved. Your landing page is updated."); },
    onError: () => setMessage("Could not save. Check your entries and try again."),
  });
  const set = (patch: Partial<SiteSettings>) => { setMessage(""); setForm((prev) => ({ ...prev, ...patch })); };
  const setHome = (patch: Partial<HomeContent>) => set({ homepage: { ...form.homepage, ...patch } });
  const setField = (key: HomeStringKey, value: string) => setHome({ [key]: value });
  const setArray = (key: HomeArrayKey, index: number, value: string) => {
    const updated = [...form.homepage[key]];
    updated[index] = value;
    setHome({ [key]: updated });
  };
  const move = (key: SectionKey, step: number) => {
    const order = [...form.homepage.sectionOrder];
    const current = order.indexOf(key), next = current + step;
    if (current < 0 || next < 0 || next >= order.length) return;
    const selected = order[current], neighbor = order[next];
    if (!selected || !neighbor) return;
    order[current] = neighbor;
    order[next] = selected;
    setHome({ sectionOrder: order });
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>, label: string, onDone: (url: string) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setMessage("Choose a JPG, PNG, or WebP image smaller than 8 MB."); return;
    }
    setUploading(label);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadSiteImage({ data: { name: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 } });
      onDone(result.url);
      setMessage("Photo ready. Save changes to put it on your website.");
    } catch { setMessage("Could not upload that photo. Please try again."); }
    finally { setUploading(""); }
  };
  const photo = (label: string, url: string, onDone: (url: string) => void) => (
    <div className="custom-photo" key={label}>
      <span>{label}</span>
      {url ? <img src={url} alt={`${label} preview`} /> : <span className="custom-photo-empty">No photo yet</span>}
      <div className="custom-photo-actions">
        <label className="custom-upload"><ImagePlus size={16} /> {uploading === label ? "Uploading…" : url ? "Replace" : "Upload"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(e) => void upload(e, label, onDone)} />
        </label>
        {url ? <Button type="button" size="sm" variant="outline" onClick={() => onDone("")}>Remove</Button> : null}
      </div>
    </div>
  );
  const input = (label: string, value: string, onChange: (value: string) => void, long = false) => (
    <label className="custom-field" key={label}><span>{label}</span>
      {long ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
  const h = form.homepage;
  const dirty = JSON.stringify(form) !== JSON.stringify(data);
  const config = SECTIONS[active];

  return <div className="adm-page custom-editor">
    <header className="adm-head custom-editor-head">
      <div><h1>Edit landing page</h1><p>Choose a section to change its words and photos. Save to update the public website.</p></div>
      <div className="custom-editor-actions"><Button asChild variant="outline"><Link to="/" target="_blank">View website</Link></Button><Button onClick={() => save.mutate(form)} disabled={!dirty || save.isPending || Boolean(uploading)}>{save.isPending ? "Saving…" : "Save changes"}</Button></div>
    </header>
    {message ? <p role="status" className={save.isError ? "adm-error" : "adm-hint"}>{message}</p> : null}
    <div className="custom-editor-layout">
      <nav className="custom-editor-nav" aria-label="Page sections">
        <button type="button" className={active === "hero" ? "is-active" : ""} onClick={() => setActive("hero")}>Opening & brand</button>
        {h.sectionOrder.filter((key) => key !== "hero").map((key) => <div className="custom-editor-navrow" key={key}>
          <button type="button" className={active === key ? "is-active" : ""} onClick={() => setActive(key)}>{SECTION_LABELS[key]}</button>
          <Button size="icon" variant="ghost" title={`Move ${SECTION_LABELS[key]} up`} aria-label={`Move ${SECTION_LABELS[key]} up`} onClick={() => move(key, -1)}><ArrowUp size={15} /></Button>
          <Button size="icon" variant="ghost" title={`Move ${SECTION_LABELS[key]} down`} aria-label={`Move ${SECTION_LABELS[key]} down`} onClick={() => move(key, 1)}><ArrowDown size={15} /></Button>
        </div>)}
        <button type="button" className="custom-editor-footer-nav" onClick={() => setActive("hero")}>Brand, colors & footer ↓</button>
      </nav>
      <div className="custom-editor-content">
        <div className="custom-editor-section-title"><h2>{SECTION_LABELS[active]}</h2>
          <Button size="sm" variant="outline" onClick={() => setHome({ hiddenSections: h.hiddenSections.includes(active) ? h.hiddenSections.filter((key) => key !== active) : [...h.hiddenSections, active] })}>
            {h.hiddenSections.includes(active) ? <><Eye size={16} /> Show section</> : <><EyeOff size={16} /> Hide section</>}
          </Button>
        </div>
        {active === "hero" && <>
          <h3>Brand & opening message</h3>
          <div className="custom-fields">{TOP_FIELDS.map(({ key, label, long }) => input(label, form[key], (value) => set({ [key]: value }), long))}</div>
          <div className="custom-photo-grid">
            {photo("Logo image", h.logoImage, (url) => setHome({ logoImage: url }))}
            {photo("Left keepsake photo", h.heroBackImage, (url) => setHome({ heroBackImage: url }))}
            {photo("Receipt photo", h.heroReceiptImage, (url) => setHome({ heroReceiptImage: url }))}
            {photo("Right keepsake photo", h.heroFrontImage, (url) => setHome({ heroFrontImage: url }))}
          </div>
        </>}
        <div className="custom-fields">
          {config.fields.map(({ key, label, long }) => input(label, h[key], (value) => setField(key, value), long))}
          {config.arrays?.flatMap(({ key, labels }) => labels.map((label, index) => input(label, h[key][index] ?? "", (value) => setArray(key, index, value), true)))}
        </div>
        {active === "services" && <div className="custom-repeat-list">{h.services.map((service, i) => <section key={i} className="custom-repeat">
          <h3>Service {i + 1}</h3>
          <div className="custom-fields">{(["title", "tagline", "body"] as const).map((key) => input(key === "body" ? "Description" : key === "title" ? "Name" : "Short line", service[key], (value) => setHome({ services: h.services.map((item, j) => j === i ? { ...item, [key]: value } : item) }), key === "body"))}</div>
          {photo(`Service ${i + 1} photo`, service.image, (url) => setHome({ services: h.services.map((item, j) => j === i ? { ...item, image: url } : item) }))}
        </section>)}</div>}
        {active === "story" && photo("Founders photo", h.storyImage, (url) => setHome({ storyImage: url }))}
        {active === "proof" && <div className="custom-photo-grid">{h.proofImages.map((item, i) => <div key={i}>
          {photo(`Moment ${i + 1}`, item.image, (url) => setHome({ proofImages: h.proofImages.map((image, j) => j === i ? { ...image, image: url } : image) }))}
          {input(`Moment ${i + 1} caption`, item.caption, (value) => setHome({ proofImages: h.proofImages.map((image, j) => j === i ? { ...image, caption: value } : image) }))}
        </div>)}</div>}
        {active === "faqs" && <div className="custom-repeat-list">{h.faqs.map((item, i) => <section key={i} className="custom-repeat">
          <div className="custom-editor-section-title"><h3>Question {i + 1}</h3><Button size="icon" variant="ghost" title="Remove question" aria-label={`Remove question ${i + 1}`} onClick={() => setHome({ faqs: h.faqs.filter((_, j) => j !== i) })}><Trash2 size={16} /></Button></div>
          {input("Question", item.question, (value) => setHome({ faqs: h.faqs.map((faq, j) => j === i ? { ...faq, question: value } : faq) }))}
          {input("Answer", item.answer, (value) => setHome({ faqs: h.faqs.map((faq, j) => j === i ? { ...faq, answer: value } : faq) }), true)}
        </section>)}<Button variant="outline" onClick={() => setHome({ faqs: [...h.faqs, { question: "", answer: "" }] })} disabled={h.faqs.length >= 30}><Plus size={16} /> Add question</Button></div>}
        {active === "final" && <div className="custom-fields">{input("Closing headline", form.finalTitle, (value) => set({ finalTitle: value }), true)}{input("Tagline", form.finalTagline, (value) => set({ finalTagline: value }))}</div>}
        <details className="custom-brand-details"><summary>Brand colors & footer</summary>
          <div className="custom-fields">{input("Footer description", h.footerDescription, (value) => setField("footerDescription", value), true)}{input("Footer closing line", h.footerClosing, (value) => setField("footerClosing", value))}</div>
          <div className="adm-colors">{([ ["colorAccent", "Accent"], ["colorPaper", "Paper"], ["colorInk", "Ink"] ] as const).map(([key, label]) => <label key={key} className="adm-color-row"><input type="color" aria-label={`${label} color`} value={HEX_RE.test(form[key]) ? form[key] : "#000000"} onChange={(e) => set({ [key]: e.target.value })} /><span className="adm-color-label">{label}<input aria-label={`${label} hex`} value={form[key]} maxLength={7} onChange={(e) => set({ [key]: e.target.value })} /></span></label>)}</div>
        </details>
        <div className="custom-bottom-save"><Button onClick={() => save.mutate(form)} disabled={!dirty || save.isPending || Boolean(uploading)}>{save.isPending ? "Saving…" : "Save changes"}</Button></div>
      </div>
    </div>
  </div>;
}
