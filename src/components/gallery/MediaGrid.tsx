import { useState } from "react";

import { Lightbox } from "./Lightbox";
import type { MediaItem } from "@/lib/gallery/types";

export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="media-grid">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className="media-tile"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open ${item.name}`}
          >
            {item.isVideo ? (
              <video
                src={`${item.fullUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                aria-label={item.name}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : "3 / 4",
                  objectFit: "cover",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <img
                src={item.thumbUrl}
                alt={item.name}
                loading="lazy"
                decoding="async"
                width={item.width ?? undefined}
                height={item.height ?? undefined}
              />
            )}
            {item.isVideo ? (
              <span className="media-badge">VIDEO</span>
            ) : item.isGif ? (
              <span className="media-badge">GIF</span>
            ) : null}
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <Lightbox
          items={items}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}

export function GalleryEmpty() {
  return (
    <div className="gallery-state">
      <p className="eyebrow">Nothing filed yet</p>
      <h3>No proofs here yet.</h3>
      <p>We're still collecting the memories from this event. Check back soon.</p>
    </div>
  );
}

export function GalleryError() {
  return (
    <div className="gallery-state">
      <p className="eyebrow">Archive offline</p>
      <h3>Memory archive temporarily unavailable.</h3>
      <p>We're having trouble retrieving these memories. Please try again shortly.</p>
    </div>
  );
}

export function GalleryLoading() {
  return (
    <div className="media-grid" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="media-tile media-skeleton" />
      ))}
    </div>
  );
}
