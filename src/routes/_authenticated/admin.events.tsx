import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListEvents,
  claimAdmin,
  deleteEvent,
  getAdminStatus,
  saveEvent,
  type EventInput,
} from "@/lib/events.functions";

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({
    meta: [
      { title: "Manage events | Recibo Memorato" },
      { name: "description", content: "Add and edit Recibo Memorato memory archive events." },
      { property: "og:title", content: "Manage events | Recibo Memorato" },
      { property: "og:description", content: "Owner tools for the memory archive." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEventsPage,
});

const EMPTY: EventInput = {
  id: null,
  slug: "",
  name: "",
  event_date: "",
  location: "",
  cover_url: "",
  drive_folder_id: "",
  digitals_folder_id: "",
  gif_folder_id: "",
  singles_folder_id: "",
  published: true,
  sort_order: 0,
};

const FOLDER_FIELDS: [keyof EventInput, string][] = [
  ["drive_folder_id", "Event folder link or ID"],
  ["digitals_folder_id", "DIGITALS folder link or ID"],
  ["gif_folder_id", "GIF folder link or ID"],
  ["singles_folder_id", "SINGLES folder link or ID"],
];

function extractFolderId(value: string): string {
  const match = value.match(/folders\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? value.trim();
}

function AdminEventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdminStatus() });
  const isAdmin = status.data?.isAdmin ?? false;

  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => adminListEvents(),
    enabled: isAdmin,
  });

  const claim = useMutation({
    mutationFn: () => claimAdmin(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-status"] }),
  });

  const save = useMutation({
    mutationFn: (input: EventInput) =>
      saveEvent({
        data: {
          ...input,
          drive_folder_id: extractFolderId(input.drive_folder_id ?? ""),
          digitals_folder_id: extractFolderId(input.digitals_folder_id ?? ""),
          gif_folder_id: extractFolderId(input.gif_folder_id ?? ""),
          singles_folder_id: extractFolderId(input.singles_folder_id ?? ""),
        },
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  if (status.isPending) {
    return <main className="admin-page"><p>Loading…</p></main>;
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <h1>Owner access</h1>
        {status.data?.canClaim ? (
          <>
            <p>No owner has been set for this site yet. Claim it with this account.</p>
            <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
              {claim.isPending ? "Setting up…" : "Make this account the owner"}
            </Button>
          </>
        ) : (
          <p>This account doesn't have access to the memory archive tools.</p>
        )}
      </main>
    );
  }

  const set = (key: keyof EventInput, value: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <main className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Memory archive</p>
          <h1>Events</h1>
        </div>
        <div className="admin-actions">
          <Link to="/memories" className="admin-link">View archive</Link>
          <button
            type="button"
            className="admin-link"
            onClick={async () => {
              await supabase.auth.signOut();
              queryClient.clear();
              navigate({ to: "/auth" });
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <h2>{form.id ? "Edit event" : "Add an event"}</h2>
        <div className="admin-grid">
          <label>
            Event name
            <input value={form.name} required onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            Link name (used in the web address)
            <input
              value={form.slug}
              required
              placeholder="birthday-party"
              onChange={(e) => set("slug", e.target.value)}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.event_date ?? ""}
              onChange={(e) => set("event_date", e.target.value)}
            />
          </label>
          <label>
            Venue / location
            <input
              value={form.location ?? ""}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
          <label className="admin-wide">
            Cover photo address
            <input
              value={form.cover_url ?? ""}
              placeholder="https://…"
              onChange={(e) => set("cover_url", e.target.value)}
            />
          </label>
          {FOLDER_FIELDS.map(([key, label]) => (
            <label key={key} className="admin-wide">
              {label}
              <input
                value={(form[key] as string) ?? ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <label>
            Order (higher shows first)
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => set("published", e.target.checked)}
            />
            Show on the website
          </label>
        </div>
        {error ? <p className="auth-message">{error}</p> : null}
        <div className="admin-actions">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add event"}
          </Button>
          {form.id ? (
            <button type="button" className="admin-link" onClick={() => setForm(EMPTY)}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section className="admin-list">
        <h2>Your events</h2>
        {events.isPending ? <p>Loading…</p> : null}
        {events.data?.length === 0 ? <p>No events yet. Add your first one above.</p> : null}
        {(events.data ?? []).map((row: any) => (
          <div className="admin-row" key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>
                {row.event_date ?? "No date"}
                {row.location ? ` · ${row.location}` : ""}
                {row.published ? "" : " · hidden"}
              </span>
            </div>
            <div className="admin-actions">
              <Link
                to="/admin/gallery/$eventId"
                params={{ eventId: row.id }}
                className="admin-link"
              >
                Manage gallery
              </Link>
              <button
                type="button"
                className="admin-link"
                onClick={() => setForm({ ...EMPTY, ...row })}
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-link admin-danger"
                onClick={() => remove.mutate(row.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
