import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

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

/** Full-screen viewer for a package's sample photos: arrows, keyboard and a thumbnail strip. */
function PhotoViewer({
  pkg,
  start,
  onClose,
}: {
  pkg: PublicPackage;
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const total = pkg.photos.length;
  const go = (step: number) => setIndex((i) => (i + step + total) % total);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % total);
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + total) % total);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const photo = pkg.photos[index]!;
  const control: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    border: "1px solid rgba(255,255,255,.7)",
    borderRadius: "50%",
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    cursor: "pointer",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${pkg.name} sample photos`}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 12, background: "rgba(0,0,0,.88)" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(94vw, 920px)", color: "#fff", textAlign: "center" }}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ ...control, top: 6, right: 6, left: "auto", transform: "none", zIndex: 2 }}>
          <X className="size-5" aria-hidden="true" />
        </button>
        <img
          src={photo.url}
          alt={photo.caption ?? `${pkg.name} sample ${index + 1}`}
          style={{ display: "block", margin: "0 auto", maxWidth: "100%", maxHeight: "72svh", objectFit: "contain" }}
        />
        {total > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" style={{ ...control, left: 6 }}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" style={{ ...control, right: 6 }}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <p style={{ margin: "10px 0 2px", fontSize: 14 }}>
          <strong>{pkg.name}</strong>
          {photo.caption ? ` — ${photo.caption}` : ""}
        </p>
        <small style={{ opacity: 0.7 }}>{index + 1} / {total}</small>
        {total > 1 ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            {pkg.photos.map((item, i) => (
              <button
                key={item.url}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                style={{ padding: 0, border: i === index ? "2px solid #fff" : "2px solid transparent", opacity: i === index ? 1 : 0.6, background: "none", cursor: "pointer" }}
              >
                <img src={item.url} alt="" style={{ display: "block", width: 54, height: 54, objectFit: "cover" }} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PackageCard({ pkg, messengerUrl }: { pkg: PublicPackage; messengerUrl: string }) {
  const items = bullets(pkg.includedServices);
  const [viewing, setViewing] = useState<number | null>(null);
  const cover = pkg.photos[0];
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
      {cover ? (
        <button
          type="button"
          onClick={() => setViewing(0)}
          aria-label={`View ${pkg.photos.length} sample photo${pkg.photos.length === 1 ? "" : "s"} of ${pkg.name}`}
          style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}
        >
          <img
            src={cover.url}
            alt={cover.caption ?? `${pkg.name} sample`}
            loading="lazy"
            decoding="async"
            style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
          />
          <span
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(0,0,0,.65)",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            {pkg.photos.length > 1 ? `${pkg.photos.length} photos` : "View photo"}
          </span>
        </button>
      ) : null}
      {pkg.photos.length > 1 ? (
        <div style={{ display: "flex", gap: 6 }}>
          {pkg.photos.slice(1, 5).map((photo, i) => (
            <button
              key={photo.url}
              type="button"
              onClick={() => setViewing(i + 1)}
              aria-label={`View sample photo ${i + 2}`}
              style={{ flex: "1 1 0", minWidth: 0, padding: 0, border: "1px solid var(--border)", background: "none", cursor: "zoom-in" }}
            >
              <img src={photo.url} alt="" loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      ) : null}
      {viewing !== null ? <PhotoViewer pkg={pkg} start={viewing} onClose={() => setViewing(null)} /> : null}
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
