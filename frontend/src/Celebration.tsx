import { useEffect, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "./motion";

/** How long (in ms) a celebration stays on screen. */
export const CELEBRATION_DURATION_MS = 2500;

const COLORS = ["#d64545", "#2e9e5b", "#f2b705", "#3b82f6", "#a855f7", "#ff7ab6"];

/** Where (in % of the screen) and when (in s) each firework explodes. */
const BURSTS = [
  { x: 25, y: 30, delay: 0 },
  { x: 72, y: 22, delay: 0.35 },
  { x: 50, y: 55, delay: 0.7 },
  { x: 18, y: 65, delay: 1.05 },
  { x: 80, y: 60, delay: 1.3 },
];
const SPARKS_PER_BURST = 18;

interface CelebrationProps {
  message: string;
  onDone: () => void;
}

/** A short message with CSS fireworks (no fireworks when the user prefers reduced motion). */
export function Celebration({ message, onDone }: CelebrationProps) {
  const [fireworks] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const timer = setTimeout(onDone, CELEBRATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="celebration" role="status">
      {fireworks && (
        <div className="fireworks" aria-hidden="true">
          {BURSTS.map((burst, b) => (
            <div
              key={b}
              className="firework"
              style={
                {
                  left: `${burst.x}%`,
                  top: `${burst.y}%`,
                  "--delay": `${burst.delay}s`,
                  "--color": COLORS[b % COLORS.length],
                } as CSSProperties
              }
            >
              {Array.from({ length: SPARKS_PER_BURST }, (_, i) => (
                <span
                  key={i}
                  style={
                    {
                      // Sparks fly out evenly in a circle; every other one flies a bit further.
                      "--angle": `${(360 / SPARKS_PER_BURST) * i}deg`,
                      "--distance": `${i % 2 === 0 ? 90 : 65}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ))}
        </div>
      )}
      <p className="celebration-message">{message}</p>
    </div>
  );
}
