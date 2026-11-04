import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Direction, Meme, MemeStats } from "./api";
import { LoveMeter } from "./LoveMeter";
import { prefersReducedMotion } from "./motion";

/** Horizontal drag distance (in px) a release must pass to count as a swipe. */
export const SWIPE_THRESHOLD = 100;

/** How long (in ms) the card flies out with its stamp before `onSwipe` is called. */
export const EXIT_DURATION_MS = 300;

/** How far (in px) the card flies when it leaves. */
const EXIT_DISTANCE = 600;

interface MemeCardProps {
  meme: Meme;
  onSwipe: (direction: Direction) => void;
  /** Ignores drags, buttons and arrow keys, e.g. while a swipe request is in flight. */
  disabled?: boolean;
  /** How much people love this meme. Nothing is shown when null or left out. */
  stats?: MemeStats | null;
}

export function MemeCard({ meme, onSwipe, disabled = false, stats = null }: MemeCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const startX = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inactive = disabled || leaving !== null;

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  // Shows the stamp and flies the card out, then reports the swipe.
  // Without animations (reduced motion) the swipe is reported right away.
  function swipe(direction: Direction) {
    if (inactive) return;
    if (prefersReducedMotion()) {
      onSwipe(direction);
      return;
    }
    setLeaving(direction);
    exitTimer.current = setTimeout(() => onSwipe(direction), EXIT_DURATION_MS);
  }

  // Re-registered every render so the handler always sees the current state.
  useEffect(() => {
    if (inactive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") swipe("like");
      if (event.key === "ArrowLeft") swipe("nope");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (inactive) return;
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (dragging) setOffset(event.clientX - startX.current);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    const distance = event.clientX - startX.current;
    setDragging(false);
    setOffset(0);
    if (distance >= SWIPE_THRESHOLD) swipe("like");
    else if (distance <= -SWIPE_THRESHOLD) swipe("nope");
  }

  function onPointerCancel() {
    setDragging(false);
    setOffset(0);
  }

  const shownOffset = leaving ? (leaving === "like" ? EXIT_DISTANCE : -EXIT_DISTANCE) : offset;
  // The stamp fades in with the drag and is fully visible once the card leaves.
  const stamp: Direction | null = leaving ?? (offset > 0 ? "like" : offset < 0 ? "nope" : null);
  const stampOpacity = leaving ? 1 : Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);

  return (
    <div className="card-enter">
      <figure
        className={`meme-card${dragging ? " dragging" : ""}${leaving ? " leaving" : ""}`}
        style={{ transform: `translateX(${shownOffset}px) rotate(${shownOffset / 20}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img src={meme.imageUrl} alt={meme.caption} draggable={false} />
        {stamp && (
          <span
            className={`stamp stamp-${stamp}${leaving ? " stamped" : ""}`}
            style={{ opacity: stampOpacity }}
            aria-hidden="true"
          >
            {stamp === "like" ? "LIKE" : "NOPE"}
          </span>
        )}
        <figcaption>{meme.caption}</figcaption>
        {stats && <LoveMeter stats={stats} />}
      </figure>
      <div className="actions">
        <button type="button" className="nope" disabled={inactive} onClick={() => swipe("nope")}>
          Nope
        </button>
        <button type="button" className="like" disabled={inactive} onClick={() => swipe("like")}>
          Like
        </button>
      </div>
    </div>
  );
}
