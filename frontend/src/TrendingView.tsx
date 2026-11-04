import type { Trending } from "./api";

const MEDALS = ["🥇", "🥈", "🥉"];

export function TrendingView({ trending }: { trending: Trending }) {
  const subtitle =
    trending.window === "hour" ? "Hottest memes of the last hour" : "All-time favourites";
  return (
    <section className="trending-view">
      <h2>
        <span className="emoji" aria-hidden="true">
          🔥
        </span>
        Trending
      </h2>
      <p className="trending-subtitle">{subtitle}</p>
      {trending.memes.length === 0 ? (
        <p>Nobody has loved a meme yet. Go swipe right on something!</p>
      ) : (
        <ol>
          {trending.memes.map(({ meme, likes, lovePercent }, index) => (
            <li key={meme.id} className="trending-item">
              <span className="trending-rank" aria-label={`Number ${index + 1}`}>
                {MEDALS[index] ?? `#${index + 1}`}
              </span>
              <img src={meme.imageUrl} alt={meme.caption} />
              <div className="trending-text">
                <p className="trending-caption">{meme.caption}</p>
                <p className="trending-stats">
                  <span className="emoji" aria-hidden="true">
                    💖
                  </span>
                  {likes} {likes === 1 ? "like" : "likes"} · {lovePercent}% loved it
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
