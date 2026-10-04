import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { EVENT_TAGS } from "@/lib/gallery/types";
import { useState, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListCategories,
  adminListEvents,
  claimAdmin,
  deleteCategory,
  deleteEvent,
  getAdminStatus,
  saveCategory,
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
  category_id: null,
  cover_position: null,
  tags: [],
  drive_folder_id: "",
  digitals_folder_id: "",
  gif_folder_id: "",
  singles_folder_id: "",
  published: true,
  sort_order: 0,
};

const FOLDER_FIELDS: [keyof EventInput, string][] = [
  ["drive_folder_id", "MAIN EVENT folder link (we find Animated, Prints and Single Photos inside it)"],
  ["gif_folder_id", "ANIMATED folder link (optional)"],
  ["digitals_folder_id", "PRINTS folder link (optional)"],
  ["singles_folder_id", "SINGLE PHOTOS folder link (optional)"],
];

function extractFolderId(value: string): string {
  const match =
    value.match(/folders\/([A-Za-z0-9_-]+)/) ?? value.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? value.trim();
}

function parsePosition(value: string | null | undefined): [number, number] {
  const match = value?.match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  return match ? [Number(match[1]), Number(match[2])] : [50, 50];
}

/** Lets the owner choose which part of the cover stays visible when it is cropped. */
function CoverFocus({
  url,
  position,
  onChange,
}: {
  url: string;
  position: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const [x, y] = parsePosition(position);
  const pick = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const ny = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(nx)}% ${Math.round(ny)}%`);
  };
  return (
    <div style={{ marginTop: 8 }}>
      <p>Tap or drag on the photo to choose the part that must stay visible, such as a face.</p>
      <div
        style={{
          position: "relative",
          display: "inline-block",
          lineHeight: 0,
          touchAction: "none",
          cursor: "crosshair",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pick(e);
        }}
      >
        <img
          src={url}
          alt="Cover"
          draggable={false}
          style={{ display: "block", maxWidth: "100%", maxHeight: 280 }}
        />
        <span
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: 22,
            height: 22,
            marginLeft: -11,
            marginTop: -11,
            borderRadius: "50%",
            border: "3px solid #fff",
            boxShadow: "0 0 0 2px #d40e14",
            pointerEvents: "none",
          }}
        />
      </div>
      <p style={{ marginTop: 12 }}>How it looks on the website:</p>
      <div style={{ aspectRatio: "4 / 3", width: 240, overflow: "hidden" }}>
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% ${y}%` }}
        />
      </div>
      <button type="button" className="admin-link" onClick={() => onChange("50% 50%")}>
        Center
      </button>
    </div>
  );
}

/** Shrinks a chosen photo to a web-friendly JPEG (max 1600px wide). */
async function resizeToJpeg(file: File, maxWidth = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))),
      "image/jpeg",
      0.85,
    ),
  );
}

function AdminEventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdminStatus() });
  const isAdmin = status.data?.isAdmin ?? false;

  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => adminListEvents(),
    enabled: isAdmin,
  });

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminListCategories(),
    enabled: isAdmin,
  });
  const categoryList = categories.data?.categories ?? [];
  const categoriesReady = categories.data?.ready ?? false;

  const refreshCategories = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const addCategory = useMutation({
    mutationFn: (name: string) =>
      saveCategory({
        data: { name, sort_order: (categoryList.at(-1)?.sort_order ?? 0) + 10 },
      }),
    onSuccess: () => {
      setNewCategory("");
      setCategoryMessage(null);
      refreshCategories();
    },
    onError: (e: Error) => setCategoryMessage(e.message),
  });

  const renameCategory = useMutation({
    mutationFn: (input: { id: string; name: string }) => saveCategory({ data: input }),
    onSuccess: () => {
      setCategoryMessage(null);
      refreshCategories();
    },
    onError: (e: Error) => setCategoryMessage(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: () => {
      setCategoryMessage(null);
      refreshCategories();
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => setCategoryMessage(e.message),
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

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      let blob: Blob;
      try {
        blob = await resizeToJpeg(file);
      } catch {
        throw new Error("That image type isn't supported. Please use a JPG or PNG photo.");
      }
      const path = `covers/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (uploadError) {
        throw new Error(
          "The upload didn't work. The one-time cover photo setup may not have been run yet.",
        );
      }
      const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
      set("cover_url", data.publicUrl);
      set("cover_position", "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const categoryName = (id: string | null | undefined) =>
    categoryList.find((c) => c.id === id)?.name ?? null;

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
          <fieldset className="admin-wide" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>
              Services at this event (shown as tags in the Memory Archive)
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {EVENT_TAGS.map((tag) => (
                <label key={tag.key} className="admin-check">
                  <input
                    type="checkbox"
                    checked={(form.tags ?? []).includes(tag.key)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tags: e.target.checked
                          ? [...(prev.tags ?? []), tag.key]
                          : (prev.tags ?? []).filter((t) => t !== tag.key),
                      }))
                    }
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>
          {categoriesReady ? (
            <label>
              Category
              <select
                value={form.category_id ?? ""}
                onChange={(e) => set("category_id", e.target.value)}
              >
                <option value="">No category</option>
                {categoryList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="admin-wide">
            <label>
              Cover photo
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  void uploadCover(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {uploading ? <p>Uploading…</p> : null}
            {form.cover_url ? (
              <>
                <CoverFocus
                  url={form.cover_url}
                  position={form.cover_position}
                  onChange={(value) => set("cover_position", value)}
                />
                <button
                  type="button"
                  className="admin-link"
                  onClick={() => {
                    set("cover_url", "");
                    set("cover_position", "");
                  }}
                >
                  Remove cover
                </button>
              </>
            ) : null}
          </div>
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
        <h2>Event categories</h2>
        {categories.isPending ? <p>Loading…</p> : null}
        {categories.data && !categoriesReady ? (
          <p>
            Categories need a one-time database setup before they can be used. Once it has been
            run, reload this page.
          </p>
        ) : null}
        {categoriesReady && categoryList.length === 0 ? (
          <p>No categories yet. Add one below, for example Birthday or Wedding.</p>
        ) : null}
        {categoryList.map((c) => (
          <div className="admin-row" key={c.id}>
            <div>
              <strong>{c.name}</strong>
            </div>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-link"
                onClick={() => {
                  const name = window.prompt("Rename category", c.name);
                  if (name && name.trim() && name.trim() !== c.name) {
                    renameCategory.mutate({ id: c.id, name: name.trim() });
                  }
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="admin-link admin-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete the "${c.name}" category? Its events are kept and just become uncategorized.`,
                    )
                  ) {
                    removeCategory.mutate(c.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {categoriesReady ? (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategory.trim()) addCategory.mutate(newCategory.trim());
            }}
          >
            <label>
              New category
              <input
                value={newCategory}
                maxLength={60}
                placeholder="e.g. Debut, Corporate, Christening"
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </label>
            {categoryMessage ? <p className="auth-message">{categoryMessage}</p> : null}
            <div className="admin-actions">
              <Button type="submit" disabled={addCategory.isPending || !newCategory.trim()}>
                Add category
              </Button>
            </div>
          </form>
        ) : null}
      </section>

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
                {categoryName(row.category_id) ? ` · ${categoryName(row.category_id)}` : ""}
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
