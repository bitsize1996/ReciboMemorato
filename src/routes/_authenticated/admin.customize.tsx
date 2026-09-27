import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getSiteSettings, saveSiteSettings, siteSettingsQuery } from "@/lib/site.functions";
import { HEX_RE, type SiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/_authenticated/admin/customize")({
  head: () => ({
    meta: [
      { title: "Customize | Recibo Memorato Admin" },
      { name: "description", content: "Edit the website's texts, logo name, and colors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomizePage,
});

type TextKey =
  | "brandLine1"
  | "brandLine2"
  | "brandSub"
  | "heroEyebrow"
  | "heroTitle"
  | "heroLead"
  | "heroDescription"
  | "ctaLabel"
  | "messengerUrl"
  | "finalTitle"
  | "finalTagline";

const TEXT_FIELDS: { key: TextKey; label: string; hint?: string; long?: boolean }[] = [
  { key: "brandLine1", label: "Logo — first line" },
  { key: "brandLine2", label: "Logo — second line" },
  { key: "brandSub", label: "Logo — small line underneath" },
  { key: "heroEyebrow", label: "Homepage top — small label" },
  { key: "heroTitle", label: "Homepage top — big headline", hint: "Put words in *stars* to make them italic." },
  { key: "heroLead", label: "Homepage top — line under the headline" },
  { key: "heroDescription", label: "Homepage top — description", long: true },
  { key: "ctaLabel", label: "Button text" },
  { key: "messengerUrl", label: "Message button link (Messenger URL)" },
  { key: "finalTitle", label: "Closing section — big line", hint: "Put words in *stars* to make them italic." },
  { key: "finalTagline", label: "Closing section — tagline" },
];

const COLOR_FIELDS: { key: "colorAccent" | "colorPaper" | "colorInk"; label: string }[] = [
  { key: "colorAccent", label: "Accent color (red details & buttons)" },
  { key: "colorPaper", label: "Background color (paper)" },
  { key: "colorInk", label: "Text color (ink)" },
];

const safeHex = (value: string) => (HEX_RE.test(value) ? value : "#000000");

function CustomizePage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(siteSettingsQuery);
  const [form, setForm] = useState<SiteSettings>(data);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setForm(data), [data]);

  const save = useMutation({
    mutationFn: (input: SiteSettings) => saveSiteSettings({ data: input }),
    onSuccess: () => {
      setMessage("Saved — the website now shows your changes.");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: () => setMessage("Something went wrong. Please try again."),
  });

  const set = (patch: Partial<SiteSettings>) => setForm((prev) => ({ ...prev, ...patch }));

  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <h1>Customize</h1>
          <p>Edit the website's name, main texts, and colors. Changes go live as soon as you save.</p>
        </div>
        <Button onClick={() => save.mutate(form)} disabled={save.isPending || !dirty}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </header>

      {message ? <p className={save.isError ? "adm-error" : "adm-hint"}>{message}</p> : null}

      <section className="adm-card" style={{ marginBottom: 24 }}>
        <h2>Colors</h2>
        <div className="adm-colors">
          {COLOR_FIELDS.map((field) => (
            <label key={field.key} className="adm-color-row">
              <input
                type="color"
                value={safeHex(form[field.key])}
                onChange={(e) => set({ [field.key]: e.target.value })}
                aria-label={field.label}
              />
              <span className="adm-color-label">
                {field.label}
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={(e) => set({ [field.key]: e.target.value })}
                  maxLength={7}
                  aria-label={`${field.label} (hex)`}
                />
              </span>
            </label>
          ))}
        </div>
        <p className="adm-hint">Tip: press "Save changes" to see them on the live website.</p>
      </section>

      <section className="adm-card">
        <h2>Texts &amp; logo</h2>
        <div className="adm-form">
          {TEXT_FIELDS.map((field) => (
            <label key={field.key} className="adm-line">
              <span>{field.label}</span>
              {field.long ? (
                <textarea
                  value={form[field.key]}
                  onChange={(e) => set({ [field.key]: e.target.value })}
                  rows={3}
                />
              ) : (
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={(e) => set({ [field.key]: e.target.value })}
                />
              )}
              {field.hint ? <small className="adm-hint">{field.hint}</small> : null}
            </label>
          ))}
        </div>
        <p className="adm-hint">
          Other texts (services, FAQs, story) are edited by Lovable — just ask in chat, e.g. "change
          the first FAQ to…" or "make the red darker".
        </p>
      </section>
    </div>
  );
}
