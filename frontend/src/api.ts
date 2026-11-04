import { getUserId } from "./identity";

export interface Meme {
  id: string;
  caption: string;
  imageUrl: string;
}

export type Direction = "like" | "nope";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, "X-User-Id": getUserId() },
  });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  return res.status === 204 ? (undefined as T) : res.json();
}

/** How much people love a meme, across all users. */
export interface MemeStats {
  likes: number;
  nopes: number;
  /** 0-100, or null when nobody has swiped the meme yet. */
  lovePercent: number | null;
}

export interface NextMeme {
  /** null when the user has swiped every meme. */
  meme: Meme | null;
  /** null when there is no meme, or when the backend sent no stats. */
  stats: MemeStats | null;
}

export interface TrendingMeme extends MemeStats {
  meme: Meme;
}

export interface Trending {
  /** "hour" when ranked on the last hour, "all" when that hour was quiet and all time is used. */
  window: "hour" | "all";
  memes: TrendingMeme[];
}

export async function fetchNextMeme(): Promise<NextMeme> {
  const { meme, stats } = await request<{ meme: Meme | null; stats?: MemeStats | null }>(
    "/api/memes/next",
  );
  return { meme, stats: meme ? (stats ?? null) : null };
}

/** The most loved memes right now, across all users. */
export async function fetchTrending(): Promise<Trending> {
  return request<Trending>("/api/trending");
}

/** Swipes from all users in the last minute. */
export async function fetchPulse(): Promise<number> {
  const { swipesPerMinute } = await request<{ swipesPerMinute: number }>("/api/pulse");
  return swipesPerMinute;
}

export async function sendSwipe(memeId: string, direction: Direction): Promise<void> {
  await request("/api/swipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memeId, direction }),
  });
}

/** The memes the user has liked, in a stable order. */
export async function fetchLikes(): Promise<Meme[]> {
  const { memes } = await request<{ memes: Meme[] }>("/api/likes");
  return memes;
}

/** Removes all of the user's swipes, including likes. */
export async function resetSwipes(): Promise<void> {
  await request("/api/swipes", { method: "DELETE" });
}
