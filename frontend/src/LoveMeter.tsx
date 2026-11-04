import type { MemeStats } from "./api";

/** "87% of people loved this" with a pink bar, or an invitation when nobody has swiped yet. */
export function LoveMeter({ stats }: { stats: MemeStats }) {
  const votes = stats.likes + stats.nopes;
  if (stats.lovePercent === null || votes === 0) {
    return (
      <p className="love-meter love-meter-empty">
        <span className="emoji" aria-hidden="true">
          ✨
        </span>
        Be the first to rate this meme!
      </p>
    );
  }
  return (
    <div className="love-meter">
      <p>
        <span className="emoji" aria-hidden="true">
          {stats.lovePercent >= 50 ? "🔥" : "🧊"}
        </span>
        <strong>{stats.lovePercent}%</strong> of people loved this
        <span className="love-votes">
          {" "}
          ({votes} {votes === 1 ? "swipe" : "swipes"})
        </span>
      </p>
      <div
        className="love-bar"
        role="meter"
        aria-label="Love"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.lovePercent}
      >
        <div className="love-bar-fill" style={{ width: `${stats.lovePercent}%` }} />
      </div>
    </div>
  );
}
