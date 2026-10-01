import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import type { MediaItem } from "@/lib/gallery/types";

interface LightboxProps {
  items: MediaItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps) {
  const touchStart = useRef<number | null>(null);
  const item = items[index];

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + items.length) % items.length;
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Memory ${index + 1} of ${items.length}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX ?? null;
        if (start === null || end === null) return;
        if (Math.abs(end - start) > 55) go(end < start ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <div className="lightbox-bar">
        <span>
          {index + 1} / {items.length}
          {item.isVideo ? " · VIDEO" : item.isGif ? " · GIF" : ""}
        </span>
        <div>
          {item.downloadUrl ? (
            <a
              href={item.downloadUrl}
              download={item.name}
              aria-label={item.isVideo ? "Download this video" : item.isGif ? "Download this GIF" : "Download this photo"}
            >
              <Download aria-hidden="true" />
              <span className="lightbox-download-label">
                {item.isVideo ? "Download video" : item.isGif ? "Download GIF" : "Download photo"}
              </span>
            </a>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="lightbox-nav lightbox-prev"
        onClick={() => go(-1)}
        aria-label="Previous memory"
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <figure className="lightbox-stage">
        {item.isVideo ? (
          <video
            key={item.id}
            src={item.fullUrl}
            controls
            autoPlay
            loop
            playsInline
            style={{ maxWidth: "100%", maxHeight: "80svh" }}
          />
        ) : (
          <img src={item.fullUrl} alt={item.name} />
        )}
        <figcaption>{item.name}</figcaption>
      </figure>

      <button
        type="button"
        className="lightbox-nav lightbox-next"
        onClick={() => go(1)}
        aria-label="Next memory"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
