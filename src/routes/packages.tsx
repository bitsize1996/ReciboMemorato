import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

const CARD_GRID: React.CSSProperties = {
  display: "grid",
  gap: 28,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
  alignItems: "stretch",
};

function PackageCard({ pkg, messengerUrl }: { pkg: PublicPackage; messengerUrl: string }) {
  const items = bullets(pkg.includedServices);
  const [viewing, setViewing] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Browse the samples right on the card; tapping the big photo still opens the full-screen viewer.
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const total = pkg.photos.length;
  const photo = pkg.photos[current];
  const go = (step: number) => setCurrent((i) => (i + step + total) % total);
  const visibleItems = showAll ? items : items.slice(0, 3);
  const arrow: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    display: "grid",
    placeItems: "center",
    width: 36,
    height: 36,
    border: "1px solid rgba(255,255,255,.8)",
    borderRadius: "50%",
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    cursor: "pointer",
  };

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      {/* Photo area: swipe or use the arrows and thumbnails to browse; tap the big photo to enlarge. */}
      <div>
        <div
          style={{
            position: "relative",
            // Portrait frame: boards, strips and prints are tall, so the whole photo fits without being cut off.
            aspectRatio: "4 / 5",
            background: "color-mix(in oklab, var(--foreground) 6%, var(--card))",
            touchAction: "pan-y",
          }}
          onTouchStart={(e) => {
            touchStart.current = e.touches[0]?.clientX ?? null;
            swiped.current = false;
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start == null || end == null || total < 2) return;
            const dx = end - start;
            if (Math.abs(dx) > 40) {
              swiped.current = true;
              go(dx < 0 ? 1 : -1);
            }
          }}
        >
          {photo ? (
            <button
              type="button"
              onClick={() => {
                if (swiped.current) {
                  swiped.current = false;
                  return;
                }
                setViewing(current);
              }}
              aria-label={`Enlarge photo ${current + 1} of ${total} for ${pkg.name}`}
              style={{ display: "block", width: "100%", height: "100%", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}
            >
              <img
                key={photo.url}
                src={photo.url}
                alt={photo.caption ?? `${pkg.name} sample ${current + 1}`}
                decoding="async"
                style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          ) : (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: "100%",
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Photos coming soon
            </div>
          )}
          {total > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" style={{ ...arrow, left: 8 }}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" style={{ ...arrow, right: 8 }}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : null}
          {photo ? (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 10,
                bottom: 10,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(0,0,0,.68)",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                pointerEvents: "none",
              }}
            >
              {total > 1 ? `${current + 1} / ${total} · tap to enlarge` : "tap to enlarge"}
            </span>
          ) : null}
          {pkg.popupAvailable ? (
            <span
              style={{
                position: "absolute",
                left: 10,
                top: 10,
                padding: "4px 10px",
                background: "var(--background)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Also at pop-ups
            </span>
          ) : null}
        </div>
        {total > 1 ? (
          <div
            role="group"
            aria-label="Sample photos"
            style={{ display: "flex", gap: 8, padding: "10px 12px", overflowX: "auto", borderBottom: "1px solid var(--border)" }}
          >
            {pkg.photos.map((item, i) => (
              <button
                key={item.url}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === current}
                style={{
                  flex: "0 0 auto",
                  padding: 0,
                  border: i === current ? "2px solid var(--primary)" : "2px solid transparent",
                  opacity: i === current ? 1 : 0.65,
                  background: "none",
                  cursor: "pointer",
                }}
              >
                <img src={item.url} alt="" loading="lazy" style={{ display: "block", width: 58, height: 58, objectFit: "cover" }} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 14, padding: "22px 22px 24px" }}>
        <header style={{ display: "grid", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 19, lineHeight: 1.3 }}>{pkg.name}</h3>
          <strong style={{ color: "var(--primary)", fontSize: 22 }}>{peso(pkg.price)}</strong>
        </header>

        {pkg.description ? (
          <p
            style={{
              margin: 0,
              color: "var(--muted-foreground)",
              fontSize: 14,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: showAll ? "unset" : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {pkg.description}
          </p>
        ) : null}

        {items.length > 0 ? (
          <div style={{ display: "grid", gap: 8, fontSize: 14, lineHeight: 1.45 }}>
            {visibleItems.map((item) => (
              <span key={item} style={{ display: "flex", gap: 8 }}>
                <span aria-hidden="true" style={{ color: "var(--primary)" }}>✓</span>
                {item}
              </span>
            ))}
            {items.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                style={{
                  justifySelf: "start",
                  padding: 0,
                  border: 0,
                  background: "none",
                  cursor: "pointer",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                {showAll ? "Show less" : `Show all ${items.length} included`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          {pkg.serviceType === "event" ? (
            <Button asChild className="w-full">
              <Link to="/book" search={{ package: pkg.id }}>
                Book this package
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <a href={messengerUrl} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" />
                Order on Messenger
              </a>
            </Button>
          )}
        </div>
      </div>
      {viewing !== null ? <PhotoViewer pkg={pkg} start={viewing} onClose={() => setViewing(null)} /> : null}
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
            <section key={group.key} id={group.key} style={{ scrollMarginTop: 90, marginTop: 64 }}>
              <h2 className="eyebrow" style={{ marginBottom: 6 }}>{group.label}</h2>
              <p style={{ margin: "0 0 24px", color: "var(--muted-foreground)", fontSize: 14 }}>
                {group.kind === "event" ? "Booked for your event." : "Made to order."}
              </p>
              <div style={CARD_GRID}>
                {group.items.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} messengerUrl={s.messengerUrl} />
                ))}
              </div>
            </section>
          ))}

          {others.length > 0 ? (
            <section id="other" style={{ scrollMarginTop: 90, marginTop: 64 }}>
              <h2 className="eyebrow" style={{ marginBottom: 24 }}>{lineLabel(null)}</h2>
              <div style={CARD_GRID}>
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
