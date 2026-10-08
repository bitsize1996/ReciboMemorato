import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteSettingsQuery } from "@/lib/site.functions";
import { stars } from "@/lib/testimonials";
import { listTestimonials } from "@/lib/testimonials.functions";

const reviewsQuery = queryOptions({
  queryKey: ["testimonials"],
  queryFn: () => listTestimonials(),
});

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews | Recibo Memorato" },
      { name: "description", content: "What our clients say about Recibo Memorato photobooths and keepsakes." },
      { property: "og:title", content: "Reviews | Recibo Memorato" },
      { property: "og:description", content: "Kind words from the people we've made memories for." },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(reviewsQuery),
      context.queryClient.ensureQueryData(siteSettingsQuery),
    ]),
  component: ReviewsPage,
});

function ReviewsPage() {
  const { data: reviews } = useSuspenseQuery(reviewsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <main className="archive-page">
      <header className="archive-head">
        <Link to="/" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
          <span>{s.brandLine1}</span>
          <span>{s.brandLine2}</span>
          <small>{s.brandSub}</small>
        </Link>
        <p className="eyebrow">Reviews</p>
        <h1>Kind words from our clients.</h1>
        {reviews.length > 0 ? (
          <p className="archive-lead">
            <strong style={{ color: "var(--primary)" }} aria-hidden="true">{stars(Math.round(average))}</strong>{" "}
            {average.toFixed(1)} out of 5 from {reviews.length} review{reviews.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="archive-lead">What the people we've made memories for have to say.</p>
        )}
      </header>

      {reviews.length === 0 ? (
        <div className="gallery-state">
          <p className="eyebrow">Coming soon</p>
          <h3>Reviews will appear here.</h3>
          <p>Message us to see what our clients say.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20, marginTop: 28, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
          {reviews.map((review) => (
            <figure
              key={review.id}
              style={{ margin: 0, display: "grid", gap: 12, alignContent: "start", padding: 22, border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div aria-label={`${review.rating} out of 5 stars`} style={{ color: "var(--primary)", letterSpacing: 2, fontSize: 18 }}>
                {stars(review.rating)}
              </div>
              <blockquote style={{ margin: 0, lineHeight: 1.6, fontSize: 15, whiteSpace: "pre-line" }}>“{review.quote}”</blockquote>
              {review.imageUrl ? (
                <a href={review.imageUrl} target="_blank" rel="noreferrer">
                  <img src={review.imageUrl} alt={`Review from ${review.name}`} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 340, objectFit: "contain", border: "1px solid var(--border)", background: "#fff" }} />
                </a>
              ) : null}
              <figcaption style={{ fontSize: 14 }}>
                <strong>{review.name}</strong>
                {review.label ? <div style={{ color: "var(--muted-foreground)" }}>{review.label}</div> : null}
                {review.source ? (
                  <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>
                    via {review.source}
                  </div>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 40 }}>
        <Button asChild size="lg">
          <Link to="/book">Book your event</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={s.messengerUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" className="size-4" />
            Message us
          </a>
        </Button>
      </div>
    </main>
  );
}
