import { queryOptions, useInfiniteQuery, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";

import { GalleryEmpty, GalleryError, GalleryLoading, MediaGrid } from "@/components/gallery/MediaGrid";
import { getPublishedEvent, listEventMedia, refreshEventGallery } from "@/lib/gallery.functions";
import {
  MEDIA_CATEGORIES,
  formatEventDate,
  formatReceiptDate,
  type MediaCategory,
} from "@/lib/gallery/types";

const eventQuery = (slug: string) =>
  queryOptions({
    queryKey: ["event", slug],
    queryFn: () => getPublishedEvent({ data: { slug } }),
  });

export const Route = createFileRoute("/memories/$slug")({
  loader: async ({ context, params }) => {
    const event = await context.queryClient.ensureQueryData(eventQuery(params.slug));
    if (!event) throw notFound();
    return event;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} | Recibo Memorato` : "Event memories";
    const description = loaderData
      ? `Photos, prints, GIFs and singles from ${loaderData.name}.`
      : "Memories from a Recibo Memorato event.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: EventErrorPage,
  component: EventGalleryPage,
});

function CategoryPanel({ slug, category }: { slug: string; category: MediaCategory }) {
  const query = useInfiniteQuery({
    queryKey: ["media", slug, category],
    queryFn: ({ pageParam }) =>
      listEventMedia({ data: { slug, category, pageToken: pageParam as string | null } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextPageToken,
  });

  if (query.isPending) return <GalleryLoading />;
  if (query.isError) return <GalleryError />;

  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <GalleryEmpty />;

  return (
    <>
      <MediaGrid items={items} />
      {query.hasNextPage ? (
        <div className="gallery-more">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more memories"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function EventGalleryPage() {
  const { slug } = Route.useParams();
  const { data: event } = useSuspenseQuery(eventQuery(slug));
  const queryClient = useQueryClient();
  const lastCount = useRef<number | null>(null);

  useQuery({
    queryKey: ["event-live", slug],
    queryFn: async () => {
      const result = await refreshEventGallery({ data: { slug } });
      const changed = lastCount.current !== null && lastCount.current !== result.publishedCount;
      if (result.added > 0 || changed) {
        queryClient.invalidateQueries({ queryKey: ["media", slug] });
      }
      lastCount.current = result.publishedCount;
      return result;
    },
    refetchInterval: 30_000,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const tabs = MEDIA_CATEGORIES.filter((tab) => event?.categories.includes(tab.key));
  const [category, setCategory] = useState<MediaCategory | null>(null);
  const active = category && tabs.some((tab) => tab.key === category) ? category : tabs[0]?.key;

  if (!event) return null;

  return (
    <main className="event-page">
      <Link to="/memories" className="back-link">
        <ArrowLeft aria-hidden="true" /> Memory archive
      </Link>

      <header className="event-head">
        <p className="eyebrow">Memory receipt</p>
        <h1>{event.name}</h1>
        <p className="event-meta">
          {formatEventDate(event.eventDate)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <div className="event-receipt-strip">
          <span>EVENT: {event.name.toUpperCase()}</span>
          <span>DATE: {formatReceiptDate(event.eventDate)}</span>
          <span>PROOFS: FILED</span>
        </div>
      </header>

      {tabs.length > 0 ? (
        <div className="category-tabs" role="tablist" aria-label="Memory categories">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              className={active === tab.key ? "is-active" : undefined}
              onClick={() => setCategory(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="category-panel" role="tabpanel" aria-label={active ?? "memories"}>
        {active ? <CategoryPanel slug={slug} category={active} /> : <GalleryEmpty />}
      </section>
    </main>
  );
}

function EventErrorPage() {
  return (
    <main className="event-page">
      <Link to="/memories" className="back-link">
        <ArrowLeft aria-hidden="true" /> Memory archive
      </Link>
      <div className="gallery-state">
        <p className="eyebrow">Archive offline</p>
        <h3>Memory archive temporarily unavailable.</h3>
        <p>We're having trouble retrieving these memories. Please try again shortly.</p>
      </div>
    </main>
  );
}
