import { useEffect, useState } from "react";
import { fetchPulse } from "./api";

/** How often the counter asks the backend for a new number. */
export const PULSE_INTERVAL_MS = 5000;

/**
 * Live "memes per minute" across the whole app. Polls the backend; a failed poll keeps the last
 * number on screen (it is a fun counter, not worth an error banner) and the next poll tries again.
 */
export function PulseCounter() {
  const [perMinute, setPerMinute] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      fetchPulse()
        .then((value) => {
          if (!cancelled) setPerMinute(value);
        })
        .catch(() => {
          // Keep the last value; the next poll retries.
        });
    }
    poll();
    const timer = setInterval(poll, PULSE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="pulse" aria-label="Memes per minute">
      <span className="pulse-dot" aria-hidden="true" />
      <span className="pulse-number" aria-live="polite">
        {perMinute ?? "…"}
      </span>
      <span className="pulse-label">memes swiped per minute, right now</span>
    </section>
  );
}
