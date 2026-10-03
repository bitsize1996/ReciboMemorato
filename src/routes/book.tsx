import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getBookingOptions, submitInquiry } from "@/lib/inquiries.functions";
import { siteSettingsQuery } from "@/lib/site.functions";

const optionsQuery = queryOptions({
  queryKey: ["booking-options"],
  queryFn: () => getBookingOptions(),
});

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book your event | Recibo Memorato" },
      {
        name: "description",
        content:
          "Tell us about your event and we'll get back to you with availability and pricing.",
      },
      { property: "og:title", content: "Book your event | Recibo Memorato" },
      {
        property: "og:description",
        content: "Send your event details and we'll guide you through the next steps.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(optionsQuery),
      context.queryClient.ensureQueryData(siteSettingsQuery),
    ]),
  component: BookPage,
});

const fieldStyle: React.CSSProperties = {
  padding: 12,
  minHeight: 44,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  width: "100%",
};

const EMPTY = {
  name: "",
  contact: "",
  email: "",
  contactMethod: "messenger" as "messenger" | "call_text" | "email",
  eventType: "",
  eventDate: "",
  venue: "",
  guests: "",
  packageId: "",
  message: "",
  company: "",
};

function BookPage() {
  const { data: options } = useSuspenseQuery(optionsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitInquiry({ data: form });
      setReference(result.reference);
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      // Zod problems arrive as JSON text; show the first friendly message.
      try {
        const parsed = JSON.parse(text) as { message?: string }[];
        setError(parsed[0]?.message ?? "Please check your details and try again.");
      } catch {
        setError(text || "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="archive-page">
      <header className="archive-head">
        <Link to="/" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
          <span>{s.brandLine1}</span>
          <span>{s.brandLine2}</span>
          <small>{s.brandSub}</small>
        </Link>
        <p className="eyebrow">Book your event</p>
        <h1>Let's make it one worth keeping.</h1>
        <p className="archive-lead">
          Tell us about your event and we'll get back to you with availability and pricing. No
          payment needed to send this.
        </p>
      </header>

      {reference ? (
        <div className="gallery-state" style={{ marginTop: 40 }}>
          <p className="eyebrow">Inquiry received</p>
          <h3>Thank you! We'll be in touch soon.</h3>
          <p>
            Your reference number is <strong>{reference}</strong>. We usually reply within a day.
          </p>
          <p style={{ marginTop: 20 }}>
            <Button asChild>
              <a href={s.messengerUrl} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" />
                Message us on Messenger
              </a>
            </Button>
          </p>
        </div>
      ) : (
        <form className="admin-form" style={{ marginTop: 40 }} onSubmit={onSubmit}>
          <div className="admin-grid">
            <label>
              Your name *
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label>
              Mobile number or Messenger name *
              <input
                required
                value={form.contact}
                placeholder="0917… or your Facebook name"
                onChange={(e) => set("contact", e.target.value)}
              />
            </label>
            <label>
              Email (optional)
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </label>
            <label>
              Best way to reach you
              <select
                style={fieldStyle}
                value={form.contactMethod}
                onChange={(e) => set("contactMethod", e.target.value)}
              >
                <option value="messenger">Messenger</option>
                <option value="call_text">Call / text</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              Type of event
              <select
                style={fieldStyle}
                value={form.eventType}
                onChange={(e) => set("eventType", e.target.value)}
              >
                <option value="">Choose…</option>
                {options.eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event date
              <input
                type="date"
                min={today}
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
              />
            </label>
            <label>
              Venue / location
              <input value={form.venue} onChange={(e) => set("venue", e.target.value)} />
            </label>
            <label>
              Expected number of guests
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.guests}
                onChange={(e) => set("guests", e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {options.packages.length > 0 ? (
              <label className="admin-wide">
                Package you're interested in
                <select
                  style={fieldStyle}
                  value={form.packageId}
                  onChange={(e) => set("packageId", e.target.value)}
                >
                  <option value="">Not sure yet</option>
                  {options.packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="admin-wide">
              Anything else we should know?
              <textarea
                style={{ ...fieldStyle, minHeight: 110 }}
                value={form.message}
                maxLength={2000}
                onChange={(e) => set("message", e.target.value)}
              />
            </label>
            {/* Spam trap: hidden from people, bots tend to fill it in. */}
            <div aria-hidden="true" style={{ position: "absolute", left: -9999, height: 0, overflow: "hidden" }}>
              <label>
                Company
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                />
              </label>
            </div>
          </div>
          {error ? <p className="auth-message">{error}</p> : null}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send my inquiry"}
          </Button>
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--muted-foreground)", maxWidth: 520 }}>
            By sending this form you agree that we may contact you about your inquiry. We only use
            your details to reply to you and to plan your event.
          </p>
        </form>
      )}
    </main>
  );
}
