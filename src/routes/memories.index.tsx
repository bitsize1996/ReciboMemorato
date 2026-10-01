import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { listPublishedEvents } from "@/lib/gallery.functions";
import { listEventCategories } from "@/lib/events.functions";
import { siteSettingsQuery } from "@/lib/site.functions";
import type { SiteSettings } from "@/lib/site-settings";
import { formatEventDate, formatReceiptDate } from "@/lib/gallery/types";
import type { GalleryEvent } from "@/lib/gallery/types";

const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => listPublishedEvents(),
});

export const Route = createFileRoute("/memories/")({
  head: () => ({
    meta: [
      { title: "Memory Archive | Recibo Memorato" },
      {
        name: "description",
        content:
          "Browse memories from past Recibo Memorato events — printed keepsakes, digital photos, GIFs and singles.",
      },
      { property: "og:title", content: "Memory Archive | Recibo Memorato" },
      {
        property: "og:description",
        content: "Receipts from moments that happened. Browse our past event galleries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
  errorComponent: ArchiveError,
  component: ArchivePage,
});

export function EventCard({ event }: { event: GalleryEvent }) {
  return (
    <article className="event-card">
      <Link to="/memories/$slug" params={{ slug: event.slug }} className="event-card-media">
        {event.coverUrl ? (
          <img src={event.coverUrl} alt={event.name} loading="lazy" decoding="async" />
        ) : (
          <div className="memory-visual memory-visual-strip" role="img" aria-label={event.name}>
            <div className="memory-flash" />
            <div className="memory-figure memory-figure-one" />
            <div className="memory-figure memory-figure-two" />
          </div>
        )}
        {event.isSample ? <span className="media-badge">SAMPLE</span> : null}
      </Link>
      <div className="event-card-body">
        <div className="event-receipt-line">
          <span>EVENT</span>
          <span>{formatReceiptDate(event.eventDate)}</span>
        </div>
        <h3>{event.name}</h3>
        <p>
          {formatEventDate(event.eventDate)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <Link to="/memories/$slug" params={{ slug: event.slug }} className="event-card-link">
          View memories <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function ArchiveHeader({ s }: { s: SiteSettings }) {
  return (
    <header className="archive-head">
      <Link to="/" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
        <span>{s.brandLine1}</span>
        <span>{s.brandLine2}</span>
        <small>{s.brandSub}</small>
      </Link>
      <p className="eyebrow">Memory archive</p>
      <h1>Receipts from moments that happened.</h1>
      <p className="archive-lead">
        Browse memories from our past events — from printed keepsakes to digital photos, GIFs, and
        singles.
      </p>
    </header>
  );
}

function ArchivePage() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const { data: categories } = useQuery({ queryKey: ["event-categories"], queryFn: () => listEventCategories() });
  const [categoryId, setCategoryId] = useState<string>("");
  const filteredEvents = categoryId ? events.filter((event) => event.categoryId === categoryId) : events;

  return (
    <main className="archive-page">
      <ArchiveHeader s={s} />
      {categories?.length ? <div className="category-tabs" role="tablist" aria-label="Event categories"><button type="button" className={!categoryId ? "is-active" : undefined} onClick={() => setCategoryId("")}>All</button>{categories.map((category: any) => <button type="button" key={category.id} className={categoryId === category.id ? "is-active" : undefined} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}</div> : null}
      {filteredEvents.length === 0 ? (
        <div className="gallery-state">
          <p className="eyebrow">Coming soon</p>
          <h3>Our first memories are on their way.</h3>
          <p>Check back soon for photos from our past events.</p>
        </div>
      ) : (
        <div className="event-grid">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}

function ArchiveError() {
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  return (
    <main className="archive-page">
      <ArchiveHeader s={s} />
      <div className="gallery-state">
        <p className="eyebrow">Archive offline</p>
        <h3>Memory archive temporarily unavailable.</h3>
        <p>We're having trouble retrieving these memories. Please try again shortly.</p>
      </div>
    </main>
  );
}
