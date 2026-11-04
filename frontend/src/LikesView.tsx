import type { Meme } from "./api";

export function LikesView({ memes }: { memes: Meme[] }) {
  if (memes.length === 0) {
    return (
      <section className="likes-view">
        <h2>Your likes</h2>
        <p>You have not liked any memes yet.</p>
        <p>
          <span className="emoji" aria-hidden="true">
            👉
          </span>
          Swipe right on a meme to keep it here forever.
        </p>
      </section>
    );
  }
  return (
    <section className="likes-view">
      <h2>Your likes</h2>
      <ul>
        {memes.map((meme) => (
          <li key={meme.id}>
            <figure className="meme-card">
              <img src={meme.imageUrl} alt={meme.caption} />
              <figcaption>{meme.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
