import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PRODUCT_TAGS, productLabel, type ShowcaseItem } from "@/lib/showcase";
import { listOrderProofs } from "@/lib/showcase.functions";
import { siteSettingsQuery } from "@/lib/site.functions";

const proofsQuery = queryOptions({
  queryKey: ["order-proofs"],
  queryFn: () => listOrderProofs(),
});

export const Route = createFileRoute("/proofs")({
  head: () => ({
    meta: [
      { title: "Proof of orders | Recibo Memorato" },
      {
        name: "description",
        content: "Real made-to-order Sintra board and Instax prints we've made for our customers.",
      },
      { property: "og:title", content: "Proof of orders | Recibo Memorato" },
      {
        property: "og:description",
        content: "See finished made-to-order keepsakes from Recibo Memorato.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(proofsQuery),
      context.queryClient.ensureQueryData(siteSettingsQuery),
    ]),
  component: ProofsPage,
});

function Lightbox({ item, onClose }: { item: ShowcaseItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,.82)",
      }}
    >
      <figure style={{ margin: 0, maxWidth: "min(92vw, 900px)", textAlign: "center", color: "#fff" }}>
        <img
          src={item.imageUrl}
          alt={item.title}
          style={{ maxWidth: "100%", maxHeight: "78svh", objectFit: "contain" }}
        />
        <figcaption style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          <strong>{item.title}</strong>
          {item.caption ? <div style={{ opacity: 0.85 }}>{item.caption}</div> : null}
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {productLabel(item.product)}
            {item.customerLabel ? ` · ${item.customerLabel}` : ""}
          </div>
        </figcaption>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: "8px 18px",
            border: "1px solid #fff",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </figure>
    </div>
  );
}

function ProofsPage() {
  const { data: items } = useSuspenseQuery(proofsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const [product, setProduct] = useState<string>("all");
  const [open, setOpen] = useState<ShowcaseItem | null>(null);

  const used = useMemo(
    () => PRODUCT_TAGS.filter((tag) => items.some((item) => item.product === tag.key)),
    [items],
  );
  const shown = product === "all" ? items : items.filter((item) => item.product === product);

  return (
    <main className="archive-page">
      <header className="archive-head">
        <Link to="/" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
          <span>{s.brandLine1}</span>
          <span>{s.brandLine2}</span>
          <small>{s.brandSub}</small>
        </Link>
        <p className="eyebrow">Proof of orders</p>
        <h1>Made for real customers.</h1>
        <p className="archive-lead">
          A look at the Sintra board and Instax prints we've made to order. Want one of your own?
          Send us a message and we'll make it.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="gallery-state">
          <p className="eyebrow">Coming soon</p>
          <h3>Our first finished orders are on their way.</h3>
          <p>Check back soon, or message us to order yours.</p>
        </div>
      ) : (
        <>
          {used.length > 1 ? (
            <div className="category-tabs" role="tablist" aria-label="Products">
              <button
                type="button"
                role="tab"
                aria-selected={product === "all"}
                className={product === "all" ? "is-active" : ""}
                onClick={() => setProduct("all")}
              >
                All
              </button>
              {used.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  role="tab"
                  aria-selected={product === tag.key}
                  className={product === tag.key ? "is-active" : ""}
                  onClick={() => setProduct(tag.key)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gap: 16,
              marginTop: 24,
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            }}
          >
            {shown.map((item) => (
              <figure key={item.id} style={{ margin: 0 }}>
                <button
                  type="button"
                  onClick={() => setOpen(item)}
                  aria-label={`View ${item.title}`}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 0,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    cursor: "zoom-in",
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    style={{ display: "block", width: "100%", aspectRatio: "4 / 5", objectFit: "cover" }}
                  />
                </button>
                <figcaption style={{ padding: "8px 2px", fontSize: 14, lineHeight: 1.45 }}>
                  <strong>{item.title}</strong>
                  {item.caption ? <div style={{ color: "var(--muted-foreground)" }}>{item.caption}</div> : null}
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    {productLabel(item.product)}
                    {item.customerLabel ? ` · ${item.customerLabel}` : ""}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <p style={{ marginTop: 40 }}>
        <Button asChild size="lg">
          <a href={s.messengerUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" className="size-4" />
            Order yours on Messenger
          </a>
        </Button>
      </p>

      {open ? <Lightbox item={open} onClose={() => setOpen(null)} /> : null}
    </main>
  );
}
