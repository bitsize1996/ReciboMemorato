import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import { listPublishedEvents } from "@/lib/gallery.functions";
import { siteSettingsQuery } from "@/lib/site.functions";
import type { SiteSettings } from "@/lib/site-settings";
import { EVENT_TAGS, formatEventDate, formatReceiptDate, tagLabel } from "@/lib/gallery/types";
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
  // A cover that can't be loaded falls back to the placeholder, never a broken icon.
  const [coverFailed, setCoverFailed] = useState(false);
  return (
    <article className="event-card">
      <Link to="/memories/$slug" params={{ slug: event.slug }} className="event-card-media">
        {event.coverUrl && !coverFailed ? (
          <img
            src={event.coverUrl}
            alt={event.name}
            loading="lazy"
            decoding="async"
            style={event.coverPosition ? { objectPosition: event.coverPosition } : undefined}
            onError={() => setCoverFailed(true)}
          />
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
          <span>{event.categoryName ? event.categoryName.toUpperCase() : "EVENT"}</span>
          <span>{formatReceiptDate(event.eventDate)}</span>
        </div>
        <h3>{event.name}</h3>
        {event.tags?.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 8px" }}>
            {event.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "2px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                }}
              >
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        ) : null}
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

const OTHER_KEY = "__other";

function ArchivePage() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const [selected, setSelected] = useState<string>("all");
  const [service, setService] = useState<string>("all");

  // Group events by the category the owner picked; the rest go under "Other events".
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; sort: number; events: GalleryEvent[] }>();
    for (const event of events) {
      const key = event.categoryId ?? OTHER_KEY;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: event.categoryName ?? "Other events",
          sort: event.categoryId ? event.categorySort : Number.MAX_SAFE_INTEGER,
          events: [],
        });
      }
      map.get(key)!.events.push(event);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }, [events]);

  const hasCategories = events.some((event) => event.categoryId);
  const usedTags = EVENT_TAGS.filter((tag) => events.some((event) => event.tags?.includes(tag.key)));
  const byService = (list: GalleryEvent[]) =>
    service === "all" ? list : list.filter((event) => event.tags?.includes(service));
  const visibleGroups = (selected === "all" ? groups : groups.filter((g) => g.key === selected))
    .map((group) => ({ ...group, events: byService(group.events) }))
    .filter((group) => group.events.length > 0);
  const flatEvents = byService(events);

  const servicePills =
    usedTags.length > 0 ? (
      <div className="category-tabs" role="tablist" aria-label="Services" style={{ marginBottom: 8 }}>
        <button
          type="button"
          role="tab"
          aria-selected={service === "all"}
          className={service === "all" ? "is-active" : ""}
          onClick={() => setService("all")}
        >
          All services
        </button>
        {usedTags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            role="tab"
            aria-selected={service === tag.key}
            className={service === tag.key ? "is-active" : ""}
            onClick={() => setService(tag.key)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <main className="archive-page">
      <ArchiveHeader s={s} />
      {events.length === 0 ? (
        <div className="gallery-state">
          <p className="eyebrow">Coming soon</p>
          <h3>Our first memories are on their way.</h3>
          <p>Check back soon for photos from our past events.</p>
        </div>
      ) : !hasCategories ? (
        <>
          {servicePills}
          <div className="event-grid">
            {flatEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </>
      ) : (
        <>
          {servicePills}
          <div className="category-tabs" role="tablist" aria-label="Event categories">
            <button
              type="button"
              role="tab"
              aria-selected={selected === "all"}
              className={selected === "all" ? "is-active" : ""}
              onClick={() => setSelected("all")}
            >
              All
            </button>
            {groups.map((group) => (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={selected === group.key}
                className={selected === group.key ? "is-active" : ""}
                onClick={() => setSelected(group.key)}
              >
                {group.name}
              </button>
            ))}
          </div>
          {visibleGroups.map((group) => (
            <section key={group.key}>
              {selected === "all" ? (
                <h2 className="eyebrow" style={{ margin: "32px 0 16px" }}>
                  {group.name}
                </h2>
              ) : null}
              <div className="event-grid">
                {group.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </>
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
