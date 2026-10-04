import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminGetEvent,
  adminListMedia,
  clearRemovedFiles,
  deleteCategoryMedia,
  deleteMedia,
  deleteSampleMedia,
  setCategoryMediaFlags,
  setEventCategoryEnabled,
  setEventLive,
  setEventPublished,
  setMediaFlags,
  syncEventMedia,
} from "@/lib/media.functions";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/gallery/types";

export const Route = createFileRoute("/_authenticated/admin/gallery/$eventId")({
  head: () => ({
    meta: [
      { title: "Manage gallery | Recibo Memorato" },
      { name: "description", content: "Choose which event memories are public and downloadable." },
      { property: "og:title", content: "Manage gallery | Recibo Memorato" },
      { property: "og:description", content: "Owner tools for the memory archive." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManageGalleryPage,
});

const FOLDER_LABEL: Record<MediaCategory, string> = {
  gif: "Animated folder",
  digitals: "Prints folder",
  singles: "Single Photos folder",
};

const FOLDER_COLUMN: Record<MediaCategory, string> = {
  digitals: "digitals_folder_id",
  singles: "singles_folder_id",
  gif: "gif_folder_id",
};

function ManageGalleryPage() {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<MediaCategory>("digitals");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["admin-gallery", eventId],
    queryFn: () => adminGetEvent({ data: { eventId } }),
  });

  const media = useQuery({
    queryKey: ["admin-media", eventId, category],
    queryFn: () => adminListMedia({ data: { eventId, category } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-gallery", eventId] });
    queryClient.invalidateQueries({ queryKey: ["admin-media", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const sync = useMutation({
    mutationFn: () => syncEventMedia({ data: { eventId } }),
    onSuccess: (result) => {
      const headline =
        result.foldersFound === 0
          ? "We couldn't find folders named Animated, Prints or Single Photos in that Google Drive folder. Check the folder names, or use \"Edit folder links\" to paste each folder's link."
          : result.added === 0
            ? "No new files found."
            : (overview.data as any)?.event?.auto_publish === true
              ? `${result.added} new file${result.added === 1 ? "" : "s"} added and published.`
              : `${result.added} new file${result.added === 1 ? "" : "s"} added — all still hidden until you publish them.`;
      setNotice([headline, ...(result.report ?? [])].join("\n"));
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const live = useMutation({
    mutationFn: (input: { autoSync: boolean; autoPublish: boolean; autoDownloads: boolean }) =>
      setEventLive({ data: { eventId, ...input } }),
    onSuccess: () => {
      setNotice(null);
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const restoreRemoved = useMutation({
    mutationFn: () => clearRemovedFiles({ data: { eventId } }),
    onSuccess: () => {
      setNotice('Removed files will come back (hidden) the next time Drive is checked.');
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const flags = useMutation({
    mutationFn: (input: { ids: string[]; published?: boolean; downloadEnabled?: boolean }) =>
      setMediaFlags({ data: input }),
    onSuccess: refresh,
  });

  const categoryFlags = useMutation({
    mutationFn: (input: { published?: boolean; downloadEnabled?: boolean }) =>
      setCategoryMediaFlags({ data: { eventId, category, ...input } }),
    onSuccess: () => {
      setSelected(new Set());
      refresh();
    },
  });

  const removeFiles = useMutation({
    mutationFn: (ids: string[]) => deleteMedia({ data: { ids } }),
    onSuccess: (result) => {
      setSelected(new Set());
      setNotice(`${result.removed} file${result.removed === 1 ? "" : "s"} removed from the gallery.`);
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: () => deleteCategoryMedia({ data: { eventId, category } }),
    onSuccess: (result) => {
      setSelected(new Set());
      setNotice(`${result.removed} file${result.removed === 1 ? "" : "s"} removed from the gallery.`);
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const removeSamples = useMutation({
    mutationFn: () => deleteSampleMedia(),
    onSuccess: (result) => {
      setSelected(new Set());
      setNotice(`${result.removed} sample file${result.removed === 1 ? "" : "s"} removed.`);
      refresh();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const toggleCategory = useMutation({
    mutationFn: (input: { category: MediaCategory; enabled: boolean }) =>
      setEventCategoryEnabled({ data: { eventId, ...input } }),
    onSuccess: refresh,
  });

  const togglePublished = useMutation({
    mutationFn: (published: boolean) => setEventPublished({ data: { eventId, published } }),
    onSuccess: refresh,
  });

  // While this page is open and live sync is on, look for new Drive files every 30 seconds.
  const liveEvent = (overview.data as any)?.event;
  const autoOn = liveEvent?.auto_sync === true && (overview.data as any)?.driveConnected === true;
  const checking = useRef(false);
  useEffect(() => {
    if (!autoOn) return;
    const timer = window.setInterval(async () => {
      if (checking.current || document.hidden) return;
      checking.current = true;
      try {
        const result = await syncEventMedia({ data: { eventId } });
        if (result.added > 0) refresh();
      } catch {
        // ignore: the next check will try again
      } finally {
        checking.current = false;
      }
    }, 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, eventId]);

  if (overview.isPending) return <main className="admin-page"><p>Loading…</p></main>;
  if (overview.isError || !overview.data) {
    return (
      <main className="admin-page">
        <p>We couldn't open this event.</p>
        <Link to="/admin/events" className="admin-link">Back to events</Link>
      </main>
    );
  }

  const { event, stats, driveConnected, samplesTotal, removedCount } = overview.data as any;
  const rows = media.data ?? [];
  const categoryLabel = MEDIA_CATEGORIES.find((tab) => tab.key === category)?.label ?? category;
  const allSelected = rows.length > 0 && rows.every((row: any) => selected.has(row.id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulk = (patch: { published?: boolean; downloadEnabled?: boolean }) => {
    if (selected.size === 0) return;
    flags.mutate({ ids: Array.from(selected), ...patch });
    setSelected(new Set());
  };

  const confirmRemove = (ids: string[], label: string) => {
    if (ids.length === 0) return;
    if (
      window.confirm(
        `Remove ${label} from the gallery?\n\nThis removes them from the gallery only. The original files in Google Drive are not touched, and automatic sync won't bring them back (you can undo this later under Live sync).`,
      )
    ) {
      removeFiles.mutate(ids);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Manage gallery</p>
          <h1>{event.name}</h1>
        </div>
        <div className="admin-actions">
          <Link to="/admin/events" className="admin-link">Back to events</Link>
          <Link to="/memories/$slug" params={{ slug: event.slug }} className="admin-link">
            View public page
          </Link>
        </div>
      </header>

      {!driveConnected ? (
        <p className="archive-note">
          Google Drive isn't connected yet, so there are no photos to load. Once your Drive is
          connected, you can use the controls here on your real photos.
        </p>
      ) : null}

      <section className="admin-panel">
        <h2>Google Drive folders</h2>
        <div className="admin-folders">
          {MEDIA_CATEGORIES.map((tab) => (
            <div className="admin-folder" key={tab.key}>
              <span>{FOLDER_LABEL[tab.key]}</span>
              <strong className={event[FOLDER_COLUMN[tab.key]] ? "is-on" : undefined}>
                {event[FOLDER_COLUMN[tab.key]] ? "Connected" : "Not connected"}
              </strong>
            </div>
          ))}
        </div>
        <div className="admin-actions">
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? "Checking…" : "Check for new files"}
          </Button>
          <Link to="/admin/events" className="admin-link">Edit folder links</Link>
        </div>
        {notice ? <p className="auth-message" style={{ whiteSpace: "pre-line" }}>{notice}</p> : null}
        {samplesTotal > 0 ? (
          <div className="admin-actions">
            <button
              type="button"
              className="admin-link"
              disabled={removeSamples.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove all ${samplesTotal} sample files from every event? Your real photos are not affected.`,
                  )
                ) {
                  removeSamples.mutate();
                }
              }}
            >
              Remove all sample files ({samplesTotal})
            </button>
          </div>
        ) : null}
      </section>

      <section className="admin-panel">
        <h2>Live sync</h2>
        {event.auto_sync === undefined ? (
          <p className="archive-note">
            Live sync needs a one-time database setup. Once it has been run, reload this page.
          </p>
        ) : (
          <>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={event.auto_sync === true}
                disabled={live.isPending}
                onChange={(e) =>
                  live.mutate({
                    autoSync: e.target.checked,
                    autoPublish: event.auto_publish === true,
                    autoDownloads: event.auto_downloads === true,
                  })
                }
              />
              Check Google Drive automatically for new photos
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={event.auto_publish === true}
                disabled={live.isPending}
                onChange={(e) => {
                  if (
                    e.target.checked &&
                    !window.confirm(
                      "New photos added to your Drive folders will appear on the public page right away, without you reviewing them. Turn this on?",
                    )
                  ) {
                    return;
                  }
                  live.mutate({
                    autoSync: event.auto_sync === true,
                    autoPublish: e.target.checked,
                    autoDownloads: e.target.checked && event.auto_downloads === true,
                  });
                }}
              />
              Show new photos on the website automatically
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={event.auto_downloads === true}
                disabled={live.isPending || event.auto_publish !== true}
                onChange={(e) =>
                  live.mutate({
                    autoSync: event.auto_sync === true,
                    autoPublish: event.auto_publish === true,
                    autoDownloads: e.target.checked,
                  })
                }
              />
              Also let guests download new photos
            </label>
            <p className="adm-hint">
              While this event's page is open (on your screen or a guest's phone), Drive is checked
              about every 30 seconds. With "show automatically" off, new photos wait here, hidden,
              until you publish them.
              {event.last_synced_at
                ? ` Last checked ${new Date(event.last_synced_at).toLocaleString()}.`
                : ""}
            </p>
            {removedCount > 0 ? (
              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-link"
                  disabled={restoreRemoved.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Allow the ${removedCount} files you removed to come back from Drive? They return hidden unless "show automatically" is on.`,
                      )
                    ) {
                      restoreRemoved.mutate();
                    }
                  }}
                >
                  Bring back removed files ({removedCount})
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="admin-panel">
        <h2>Event status</h2>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={event.published}
            onChange={(e) => togglePublished.mutate(e.target.checked)}
          />
          Show this event in the public Memory Archive
        </label>
        <div className="admin-stats">
          <div><span>Published</span><strong>{stats.published}</strong></div>
          <div><span>Hidden</span><strong>{stats.unpublished}</strong></div>
          <div><span>Downloads on</span><strong>{stats.downloadsOn}</strong></div>
          <div><span>Downloads off</span><strong>{stats.downloadsOff}</strong></div>
          {MEDIA_CATEGORIES.map((tab) => (
            <div key={tab.key}>
              <span>{tab.label}</span>
              <strong>{stats.byCategory[tab.key]}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <h2>Public categories</h2>
        <p className="admin-hint">Visitors only see the tabs you switch on here.</p>
        <div className="admin-category-toggles">
          {MEDIA_CATEGORIES.map((tab) => (
            <label className="admin-check" key={tab.key}>
              <input
                type="checkbox"
                checked={Boolean(event[`${tab.key}_enabled`])}
                onChange={(e) =>
                  toggleCategory.mutate({ category: tab.key, enabled: e.target.checked })
                }
              />
              {tab.label}
            </label>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <h2>Media</h2>
        <div className="category-tabs" role="tablist" aria-label="Media categories">
          {MEDIA_CATEGORIES.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={category === tab.key}
              className={category === tab.key ? "is-active" : undefined}
              onClick={() => {
                setCategory(tab.key);
                setSelected(new Set());
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-bulk">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(rows.map((r: any) => r.id)) : new Set())
              }
            />
            Select all ({selected.size} selected)
          </label>
          <button type="button" className="admin-link" onClick={() => bulk({ published: true })}>
            Publish selected
          </button>
          <button type="button" className="admin-link" onClick={() => bulk({ published: false })}>
            Unpublish selected
          </button>
          <button
            type="button"
            className="admin-link"
            onClick={() => bulk({ downloadEnabled: true })}
          >
            Allow downloads
          </button>
          <button
            type="button"
            className="admin-link"
            onClick={() => bulk({ downloadEnabled: false })}
          >
            Block downloads
          </button>
          <button
            type="button"
            className="admin-link"
            onClick={() => {
              if (rows.length === 0) return;
              if (
                window.confirm(
                  `Publish all ${rows.length} ${categoryLabel} files?`,
                )
              ) {
                categoryFlags.mutate({ published: true });
              }
            }}
          >
            Publish all in {categoryLabel}
          </button>
          <button
            type="button"
            className="admin-link"
            disabled={selected.size === 0 || removeFiles.isPending}
            onClick={() => confirmRemove(Array.from(selected), `${selected.size} selected file${selected.size === 1 ? "" : "s"}`)}
          >
            Remove selected ({selected.size})
          </button>
          <button
            type="button"
            className="admin-link"
            disabled={rows.length === 0 || removeCategory.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Remove ALL ${rows.length} ${categoryLabel} files from the gallery?\n\nThe original files in Google Drive are not touched. This cannot be undone.`,
                )
              ) {
                removeCategory.mutate();
              }
            }}
          >
            Remove all in {categoryLabel}
          </button>
        </div>

        {media.isPending ? <p>Loading files…</p> : null}
        {!media.isPending && rows.length === 0 ? (
          <p>No files here. Use "Check for new files" after uploading to Google Drive.</p>
        ) : null}

        <div className="admin-media-list">
          {rows.map((row: any) => (
            <div className="admin-media-row" key={row.id}>
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => toggleOne(row.id)}
                aria-label={`Select ${row.name}`}
              />
              {String(row.mime_type ?? "").startsWith("video/") ? (
                <video
                  src={`/api/public/memory-media?id=${row.id}#t=0.1`}
                  muted
                  playsInline
                  preload="none"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, background: "rgba(0,0,0,.08)" }}
                />
              ) : (
                <img
                  src={row.thumb_url ?? `/api/public/memory-media?id=${row.id}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="admin-media-meta">
                <strong>{row.name}</strong>
                <span>
                  {categoryLabel}
                  {row.is_gif ? " · GIF" : ""}
                  {String(row.mime_type ?? "").startsWith("video/") ? " · video" : ""}
                  {row.source === "sample" ? " · sample" : ""}
                </span>
              </div>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={row.published}
                  onChange={(e) =>
                    flags.mutate({ ids: [row.id], published: e.target.checked })
                  }
                />
                Public
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={row.download_enabled}
                  disabled={!row.published}
                  onChange={(e) =>
                    flags.mutate({ ids: [row.id], downloadEnabled: e.target.checked })
                  }
                />
                Download
              </label>
              <button
                type="button"
                className="admin-link"
                disabled={removeFiles.isPending}
                onClick={() => confirmRemove([row.id], `"${row.name}"`)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
