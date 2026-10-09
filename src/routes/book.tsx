import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { peso } from "@/lib/finance";
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
          "Tell us about your event, choose a package and add-ons, and we'll get back to you with availability and pricing.",
      },
      { property: "og:title", content: "Book your event | Recibo Memorato" },
      {
        property: "og:description",
        content: "Send your event details and we'll guide you through the next steps.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { package?: string } => ({
    package: typeof search["package"] === "string" ? search["package"] : undefined,
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
  theme: "",
  eventDate: "",
  eventTime: "",
  backdrop: "",
  venue: "",
  guests: "",
  packageId: "",
  message: "",
  company: "",
};

/** Turns "3 hours, 50 prints" or a list with one item per line into bullet points. */
function bullets(text: string | null): string[] {
  return (text ?? "")
    .split(/\n|;|,/)
    .map((part) => part.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function SectionTitle({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <h2 className="admin-wide" style={{ margin: "26px 0 4px", fontSize: 18 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", marginRight: 10 }}>
        {number}
      </span>
      {children}
    </h2>
  );
}

function BookPage() {
  const { data: options } = useSuspenseQuery(optionsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const search = Route.useSearch();
  // A package picked on the Packages page arrives as ?package=… and starts out selected.
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    packageId: options.packages.some((p) => p.id === search.package) ? (search.package as string) : "",
  }));
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const today = new Date().toISOString().slice(0, 10);
  // Steps are numbered in the order they appear, skipping the ones with nothing to show.
  const hasBackdrops = options.backdrops.length > 0;
  const step = (() => {
    let next = 2;
    const take = () => String(++next).padStart(2, "0");
    return {
      backdrop: hasBackdrops ? take() : "",
      packages: options.packages.length > 0 ? take() : "",
      addons: options.addons.length > 0 ? take() : "",
      notes: take(),
    };
  })();
  const contactLabel =
    form.contactMethod === "messenger"
      ? "Your Facebook profile link or username *"
      : form.contactMethod === "email"
        ? "Your mobile number *"
        : "Your mobile number *";
  const contactPlaceholder =
    form.contactMethod === "messenger" ? "facebook.com/yourname, or your Facebook name" : "0917…";
  const messengerChatUrl = reference
    ? `${s.messengerUrl}${s.messengerUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(reference)}`
    : s.messengerUrl;
  const chosenPackage = options.packages.find((p) => p.id === form.packageId);
  const chosenAddons = options.addons.filter((a) => (addonQty[a.id] ?? 0) > 0);
  const estimate =
    (chosenPackage?.price ?? 0) +
    chosenAddons.reduce((sum, a) => sum + a.price * (addonQty[a.id] ?? 0), 0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitInquiry({
        data: {
          ...form,
          addons: chosenAddons.map((a) => ({ id: a.id, quantity: addonQty[a.id] ?? 1 })),
        },
      });
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
          Tell us about your event, pick a package and any add-ons, and we'll get back to you with
          availability and pricing. No payment needed to send this.
        </p>
      </header>

      {reference ? (
        <div className="gallery-state" style={{ marginTop: 40 }}>
          <p className="eyebrow">Inquiry received</p>
          <h3>Thank you! We'll be in touch soon.</h3>
          <p>
            Your reference number is <strong>{reference}</strong>. We usually reply within a day.
          </p>
          {estimate > 0 ? (
            <p style={{ marginTop: 10 }}>
              Your estimate: <strong>{peso(estimate)}</strong> (we'll confirm the final quote)
            </p>
          ) : null}
          {form.contactMethod === "messenger" ? (
            <p style={{ marginTop: 10, maxWidth: 480, marginInline: "auto" }}>
              To chat faster, open Messenger below and send us a quick “Hi, my reference is{" "}
              {reference}”. That's how we match your chat to your inquiry.
            </p>
          ) : null}
          <p style={{ marginTop: 20 }}>
            <Button asChild>
              <a href={messengerChatUrl} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" />
                {form.contactMethod === "messenger" ? "Open Messenger and say hi" : "Message us on Messenger"}
              </a>
            </Button>
          </p>
        </div>
      ) : (
        <form className="admin-form" style={{ marginTop: 40 }} onSubmit={onSubmit}>
          <div className="admin-grid">
            <SectionTitle number="01">About you</SectionTitle>
            <label>
              Your name *
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
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
              {contactLabel}
              <input
                required
                value={form.contact}
                placeholder={contactPlaceholder}
                onChange={(e) => set("contact", e.target.value)}
              />
              {form.contactMethod === "messenger" ? (
                <small style={{ textTransform: "none", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted-foreground)" }}>
                  Tip: open your Facebook profile, tap ⋯, then "Copy link", and paste it here. A name
                  works too, but a link helps us find you faster.
                </small>
              ) : null}
            </label>
            <label>
              Email {form.contactMethod === "email" ? "*" : "(optional)"}
              <input
                type="email"
                required={form.contactMethod === "email"}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </label>

            <SectionTitle number="02">Your event</SectionTitle>
            <label>
              Type of event *
              <select
                required
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
              Theme
              <input
                value={form.theme}
                placeholder="e.g. Hollywood, Barbie, rustic garden"
                onChange={(e) => set("theme", e.target.value)}
              />
            </label>
            <label>
              Location / venue *
              <input
                required
                value={form.venue}
                placeholder="Venue name and city"
                onChange={(e) => set("venue", e.target.value)}
              />
            </label>
            <label>
              Date of event *
              <input
                required
                type="date"
                min={today}
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
              />
            </label>
            <label>
              Event start time
              <input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
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

            {hasBackdrops ? (
              <>
                <SectionTitle number={step.backdrop}>Pick a backdrop (optional)</SectionTitle>
                <div
                  className="admin-wide"
                  style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))" }}
                >
                  {options.backdrops.map((backdrop) => {
                    const selected = form.backdrop === backdrop.name;
                    return (
                      <label
                        key={backdrop.id}
                        style={{
                          display: "grid",
                          gap: 6,
                          cursor: "pointer",
                          padding: 6,
                          border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                          background: "var(--card)",
                          textTransform: "none",
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          color: "var(--foreground)",
                        }}
                      >
                        <input
                          type="radio"
                          name="backdrop"
                          checked={selected}
                          onChange={() => set("backdrop", backdrop.name)}
                          style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                        />
                        <img
                          src={backdrop.imageUrl}
                          alt={backdrop.name}
                          loading="lazy"
                          style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
                        />
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                          <strong>{backdrop.name}</strong>
                          {selected ? <span aria-hidden="true" style={{ color: "var(--primary)" }}>✓</span> : null}
                        </span>
                      </label>
                    );
                  })}
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: 12,
                      cursor: "pointer",
                      border: `2px solid ${form.backdrop === "" ? "var(--primary)" : "var(--border)"}`,
                      background: "var(--card)",
                      textTransform: "none",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      color: "var(--foreground)",
                    }}
                  >
                    <input
                      type="radio"
                      name="backdrop"
                      checked={form.backdrop === ""}
                      onChange={() => set("backdrop", "")}
                      style={{ width: 16, height: 16, minHeight: 0 }}
                    />
                    <strong>No preference</strong>
                  </label>
                </div>
              </>
            ) : null}

            {options.packages.length > 0 ? (
              <>
                <SectionTitle number={step.packages}>Choose a package</SectionTitle>
                <div
                  className="admin-wide"
                  style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
                >
                  {options.packages.map((pkg) => {
                    const selected = form.packageId === pkg.id;
                    const items = bullets(pkg.includedServices);
                    return (
                      <label
                        key={pkg.id}
                        style={{
                          display: "grid",
                          gap: 8,
                          alignContent: "start",
                          padding: 16,
                          cursor: "pointer",
                          border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                          background: selected ? "color-mix(in oklab, var(--primary) 6%, var(--card))" : "var(--card)",
                          textTransform: "none",
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          color: "var(--foreground)",
                        }}
                      >
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="radio"
                              name="package"
                              checked={selected}
                              onChange={() => set("packageId", pkg.id)}
                              style={{ width: 16, height: 16, minHeight: 0 }}
                            />
                            <strong style={{ fontSize: 17 }}>{pkg.name}</strong>
                          </span>
                          <strong style={{ color: "var(--primary)" }}>{peso(pkg.price)}</strong>
                        </span>
                        {pkg.description ? (
                          <span style={{ color: "var(--muted-foreground)", lineHeight: 1.5 }}>{pkg.description}</span>
                        ) : null}
                        {items.length > 0 ? (
                          <span style={{ display: "grid", gap: 4 }}>
                            <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                              What's included
                            </small>
                            {items.map((item) => (
                              <span key={item}>✓ {item}</span>
                            ))}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: 16,
                      cursor: "pointer",
                      border: `2px solid ${form.packageId === "" ? "var(--primary)" : "var(--border)"}`,
                      background: "var(--card)",
                      textTransform: "none",
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      color: "var(--foreground)",
                    }}
                  >
                    <input
                      type="radio"
                      name="package"
                      checked={form.packageId === ""}
                      onChange={() => set("packageId", "")}
                      style={{ width: 16, height: 16, minHeight: 0 }}
                    />
                    <strong>Not sure yet — help me choose</strong>
                  </label>
                </div>
              </>
            ) : null}

            {options.addons.length > 0 ? (
              <>
                <SectionTitle number={step.addons}>Add-ons (optional)</SectionTitle>
                <div className="admin-wide" style={{ display: "grid", gap: 10 }}>
                  {options.addons.map((addon) => {
                    const qty = addonQty[addon.id] ?? 0;
                    return (
                      <div
                        key={addon.id}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          border: `1px solid ${qty > 0 ? "var(--primary)" : "var(--border)"}`,
                          background: "var(--card)",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                            flex: "1 1 260px",
                            cursor: "pointer",
                            textTransform: "none",
                            fontFamily: "var(--font-sans)",
                            fontSize: 14,
                            color: "var(--foreground)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={qty > 0}
                            onChange={(e) => setAddonQty((prev) => ({ ...prev, [addon.id]: e.target.checked ? 1 : 0 }))}
                            style={{ width: 18, height: 18, marginTop: 2 }}
                          />
                          <span style={{ display: "grid", gap: 2 }}>
                            <strong>{addon.name}</strong>
                            {addon.description ? (
                              <span style={{ color: "var(--muted-foreground)", lineHeight: 1.45 }}>{addon.description}</span>
                            ) : null}
                          </span>
                        </label>
                        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {qty > 0 ? (
                            <label style={{ display: "flex", gap: 6, alignItems: "center", textTransform: "none", fontFamily: "var(--font-sans)" }}>
                              Qty
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={qty}
                                onChange={(e) =>
                                  setAddonQty((prev) => ({
                                    ...prev,
                                    [addon.id]: Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                                  }))
                                }
                                style={{ ...fieldStyle, width: 72, minHeight: 36, padding: 6 }}
                              />
                            </label>
                          ) : null}
                          <strong style={{ color: "var(--primary)", minWidth: 80, textAlign: "right" }}>
                            {peso(addon.price)}
                          </strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            <SectionTitle number={step.notes}>Anything else?</SectionTitle>
            <label className="admin-wide">
              Notes for us
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

          {estimate > 0 ? (
            <div
              style={{
                margin: "6px 0 20px",
                padding: "14px 16px",
                border: "1px dashed var(--border)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase" }}>
                Estimated total
              </span>
              <strong style={{ fontSize: 20 }}>{peso(estimate)}</strong>
              <small style={{ flexBasis: "100%", color: "var(--muted-foreground)" }}>
                This is an estimate. We'll confirm the final quote with you.
              </small>
            </div>
          ) : null}

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
