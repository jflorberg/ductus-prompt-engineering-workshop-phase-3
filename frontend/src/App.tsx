import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  fetchTrending,
  postMeme,
  resetSwipes,
  sendSwipe,
  type Direction,
  type Meme,
  type MemeStats,
  type Trending,
} from "./api";
import { Celebration } from "./Celebration";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";
import { PostView } from "./PostView";
import { PulseCounter } from "./PulseCounter";
import { TrendingView } from "./TrendingView";
import { countSwipe } from "./swipeCount";

/** Likes in a row that earn fireworks. */
export const LIKE_STREAK = 3;
/** Every this many swipes (per browser) earns a celebration. */
export const SWIPE_MILESTONE = 100;

type View = "swipe" | "likes" | "trending" | "post";

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [stats, setStats] = useState<MemeStats | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [trending, setTrending] = useState<Trending | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likeStreak, setLikeStreak] = useState(0);
  const [celebration, setCelebration] = useState<string | null>(null);
  const endCelebration = useCallback(() => setCelebration(null), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchNextMeme();
      setMeme(next.meme);
      setStats(next.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load. State is only set in promise callbacks (not synchronously in the effect),
  // and results that arrive after unmount are ignored.
  useEffect(() => {
    let cancelled = false;
    fetchNextMeme()
      .then((next) => {
        if (cancelled) return;
        setMeme(next.meme);
        setStats(next.stats);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function showLikes() {
    setView("likes");
    setLikes(null);
    setError(null);
    try {
      setLikes(await fetchLikes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function showTrending() {
    setView("trending");
    setTrending(null);
    setError(null);
    try {
      setTrending(await fetchTrending());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function showPost() {
    setView("post");
    setError(null);
  }

  async function showSwipe() {
    setView("swipe");
    await load();
  }

  async function swipe(direction: Direction) {
    if (!meme || swiping) return;
    setError(null);
    setSwiping(true);
    try {
      await sendSwipe(meme.id, direction);
      celebrate(direction);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSwiping(false);
    }
  }

  function celebrate(direction: Direction) {
    const total = countSwipe();
    const streak = direction === "like" ? likeStreak + 1 : 0;
    setLikeStreak(streak);
    if (total % SWIPE_MILESTONE === 0) setCelebration(`${total} memes swiped! You legend.`);
    else if (streak > 0 && streak % LIKE_STREAK === 0) {
      setCelebration(`${streak} likes in a row! You're on fire.`);
    }
  }

  async function reset() {
    setError(null);
    try {
      await resetSwipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return;
    }
    await load();
  }

  return (
    <main>
      <h1>
        Meme-Tinder{" "}
        <span className="sparkle" aria-hidden="true">
          💖
        </span>
      </h1>
      <nav>
        <button
          type="button"
          aria-current={view === "swipe" ? "page" : undefined}
          onClick={showSwipe}
        >
          Swipe
        </button>
        <button
          type="button"
          aria-current={view === "likes" ? "page" : undefined}
          onClick={showLikes}
        >
          Likes
        </button>
        <button
          type="button"
          aria-current={view === "trending" ? "page" : undefined}
          onClick={showTrending}
        >
          Trending
        </button>
        <button
          type="button"
          aria-current={view === "post" ? "page" : undefined}
          onClick={showPost}
        >
          Post
        </button>
      </nav>
      {celebration && <Celebration message={celebration} onDone={endCelebration} />}
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "post" && <PostView onPost={postMeme} />}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "trending" && <PulseCounter />}
      {view === "trending" &&
        !error &&
        (trending ? <TrendingView trending={trending} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <div className="swipe-view">
          <MemeCard key={meme.id} meme={meme} stats={stats} onSwipe={swipe} disabled={swiping} />
        </div>
      )}
      <p className="saved-note">
        <span className="emoji" aria-hidden="true">
          💾
        </span>
        Your likes are saved, even when the app restarts.
      </p>
    </main>
  );
}
