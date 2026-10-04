import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { peso } from "@/lib/finance";
import { listPublicPackages } from "@/lib/packages.functions";
import { PRODUCT_LINES, lineLabel, type PublicPackage } from "@/lib/product-lines";
import { siteSettingsQuery } from "@/lib/site.functions";

const packagesQuery = queryOptions({
  queryKey: ["public-packages"],
  queryFn: () => listPublicPackages(),
});

export const Route = createFileRoute("/packages")({
  head: () => ({
    meta: [
      { title: "Packages & prices | Recibo Memorato" },
      {
        name: "description",
        content: "See our photobooth packages for events and our made-to-order Sintra board and Instax prints, with what's included.",
      },
      { property: "og:title", content: "Packages & prices | Recibo Memorato" },
      {
        property: "og:description",
        content: "Choose the package that fits your event or order.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(packagesQuery),
      context.queryClient.ensureQueryData(siteSettingsQuery),
    ]),
  component: PackagesPage,
});

/** One item per line, or comma-separated, becomes a checklist. */
function bullets(text: string | null): string[] {
  return (text ?? "")
    .split(/\n|;|,/)
    .map((part) => part.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function PackageCard({ pkg, messengerUrl }: { pkg: PublicPackage; messengerUrl: string }) {
  const items = bullets(pkg.includedServices);
  return (
    <article
      style={{
        display: "grid",
        gap: 10,
        alignContent: "start",
        padding: 18,
        border: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{pkg.name}</h3>
        <strong style={{ color: "var(--primary)", whiteSpace: "nowrap" }}>{peso(pkg.price)}</strong>
      </header>
      {pkg.popupAvailable ? (
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
          Also available at pop-up events
        </small>
      ) : null}
      {pkg.description ? (
        <p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.55 }}>{pkg.description}</p>
      ) : null}
      {items.length > 0 ? (
        <div style={{ display: "grid", gap: 5, fontSize: 14 }}>
          <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            What's included
          </small>
          {items.map((item) => (
            <span key={item}>✓ {item}</span>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 6 }}>
        {pkg.serviceType === "event" ? (
          <Button asChild>
            <Link to="/book" search={{ package: pkg.id }}>
              Book this package
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <a href={messengerUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" className="size-4" />
              Order on Messenger
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

function PackagesPage() {
  const { data: packages } = useSuspenseQuery(packagesQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);

  const groups = PRODUCT_LINES.map((line) => ({
    ...line,
    items: packages.filter((p) => p.productLine === line.key),
  })).filter((group) => group.items.length > 0);
  const known = new Set(PRODUCT_LINES.map((line) => line.key));
  const others = packages.filter((p) => !p.productLine || !known.has(p.productLine));

  return (
    <main className="archive-page">
      <header className="archive-head">
        <Link to="/" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
          <span>{s.brandLine1}</span>
          <span>{s.brandLine2}</span>
          <small>{s.brandSub}</small>
        </Link>
        <p className="eyebrow">Packages &amp; prices</p>
        <h1>Pick what fits your moment.</h1>
        <p className="archive-lead">
          Photobooth packages are booked for your event date. Sintra boards and Instax prints are
          made to order. Not sure which to choose? Message us and we'll help.
        </p>
      </header>

      {packages.length === 0 ? (
        <div className="gallery-state">
          <p className="eyebrow">Coming soon</p>
          <h3>Our packages are being finalized.</h3>
          <p>Message us and we'll share our current offers.</p>
        </div>
      ) : (
        <>
          {groups.length > 1 ? (
            <nav className="category-tabs" aria-label="Jump to a service" style={{ flexWrap: "wrap" }}>
              {groups.map((group) => (
                <a key={group.key} href={`#${group.key}`} style={{ padding: "10px 14px" }}>
                  {group.label}
                </a>
              ))}
            </nav>
          ) : null}

          {groups.map((group) => (
            <section key={group.key} id={group.key} style={{ scrollMarginTop: 90, marginTop: 36 }}>
              <h2 className="eyebrow" style={{ marginBottom: 6 }}>{group.label}</h2>
              <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 14 }}>
                {group.kind === "event" ? "Booked for your event." : "Made to order."}
              </p>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
                {group.items.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} messengerUrl={s.messengerUrl} />
                ))}
              </div>
            </section>
          ))}

          {others.length > 0 ? (
            <section id="other" style={{ scrollMarginTop: 90, marginTop: 36 }}>
              <h2 className="eyebrow" style={{ marginBottom: 14 }}>{lineLabel(null)}</h2>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
                {others.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} messengerUrl={s.messengerUrl} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <p style={{ marginTop: 40 }}>
        <Button asChild size="lg" variant="outline">
          <a href={s.messengerUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" className="size-4" />
            Ask us on Messenger
          </a>
        </Button>
      </p>
    </main>
  );
}
