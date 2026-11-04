import type { Meme, MemeCatalog } from "../memes/catalog.js";
import type { Direction, Swipe, SwipeRepository } from "./repository.js";

export class UnknownMemeError extends Error {
  constructor(memeId: string) {
    super(`Unknown meme id: ${memeId}`);
  }
}

/** How much people love a meme, across all users. */
export interface MemeStats {
  likes: number;
  nopes: number;
  /** Rounded share of likes among all swipes (0-100), or null when nobody has swiped it yet. */
  lovePercent: number | null;
}

export interface TrendingMeme extends MemeStats {
  meme: Meme;
}

export interface Trending {
  /** "hour" when ranked on the last hour, "all" when that hour was too quiet and all time is used. */
  window: "hour" | "all";
  memes: TrendingMeme[];
}

/** Trending looks at the last hour... */
export const TRENDING_WINDOW_MS = 60 * 60 * 1000;
/** ...unless it has fewer swipes than this, then it falls back to all time. */
export const TRENDING_MIN_SWIPES = 5;
export const TRENDING_LIMIT = 10;
/** Memes per minute counts the swipes in this window. */
export const PULSE_WINDOW_MS = 60 * 1000;

export interface SwipeService {
  /** The next meme the user has not swiped yet, or null when all memes have been swiped. */
  getNextMeme(userId: string): Meme | null;
  /**
   * Records a swipe. Swiping the same meme again is idempotent: the first swipe is kept
   * and returned. Throws UnknownMemeError if the meme does not exist.
   */
  recordSwipe(userId: string, memeId: string, direction: Direction): Swipe;
  /** The memes the user has liked, in catalog order (a stable order that does not depend on the repository). */
  listLikedMemes(userId: string): Meme[];
  /** Removes all of the user's swipes, including likes. Safe to call repeatedly. */
  resetSwipes(userId: string): void;
  /** Likes and nopes for one meme across all users. Throws UnknownMemeError if the meme does not exist. */
  getMemeStats(memeId: string): MemeStats;
  /**
   * The most liked memes of the last hour (only memes with at least one like), by likes, then
   * love percent, then catalog order. Falls back to all time when the last hour is too quiet.
   */
  getTrending(): Trending;
  /** Swipes from all users in the last minute. */
  getSwipesPerMinute(): number;
}

function toStats(likes: number, nopes: number): MemeStats {
  const total = likes + nopes;
  return { likes, nopes, lovePercent: total === 0 ? null : Math.round((likes / total) * 100) };
}

/** `now` is injectable so tests control time. */
export function createSwipeService(
  catalog: MemeCatalog,
  repository: SwipeRepository,
  now: () => Date = () => new Date(),
): SwipeService {
  /** Swipes newer than `windowMs` ago. Unparseable timestamps never count as recent. */
  function swipesSince(windowMs: number): Swipe[] {
    const since = now().getTime() - windowMs;
    return repository.listAll().filter((swipe) => Date.parse(swipe.swipedAt) > since);
  }

  return {
    getNextMeme(userId) {
      const seen = new Set(repository.listByUser(userId).map((swipe) => swipe.memeId));
      return catalog.list().find((meme) => !seen.has(meme.id)) ?? null;
    },

    recordSwipe(userId, memeId, direction) {
      if (!catalog.getById(memeId)) throw new UnknownMemeError(memeId);
      const existing = repository.listByUser(userId).find((swipe) => swipe.memeId === memeId);
      if (existing) return existing;
      const swipe = { memeId, direction, swipedAt: now().toISOString() };
      repository.add(userId, swipe);
      return swipe;
    },

    listLikedMemes(userId) {
      const liked = new Set(
        repository
          .listByUser(userId)
          .filter((swipe) => swipe.direction === "like")
          .map((swipe) => swipe.memeId),
      );
      return catalog.list().filter((meme) => liked.has(meme.id));
    },

    resetSwipes(userId) {
      repository.clearByUser(userId);
    },

    getMemeStats(memeId) {
      if (!catalog.getById(memeId)) throw new UnknownMemeError(memeId);
      let likes = 0;
      let nopes = 0;
      for (const swipe of repository.listAll()) {
        if (swipe.memeId !== memeId) continue;
        if (swipe.direction === "like") likes++;
        else nopes++;
      }
      return toStats(likes, nopes);
    },

    getTrending() {
      const recent = swipesSince(TRENDING_WINDOW_MS);
      const window = recent.length >= TRENDING_MIN_SWIPES ? "hour" : "all";
      const swipes = window === "hour" ? recent : repository.listAll();

      const counts = new Map<string, { likes: number; nopes: number }>();
      for (const swipe of swipes) {
        const count = counts.get(swipe.memeId) ?? { likes: 0, nopes: 0 };
        if (swipe.direction === "like") count.likes++;
        else count.nopes++;
        counts.set(swipe.memeId, count);
      }

      // Walking the catalog drops swipes for memes that no longer exist and gives the tie-break order.
      const memes = catalog
        .list()
        .flatMap((meme, index) => {
          const count = counts.get(meme.id);
          if (!count || count.likes === 0) return [];
          return [{ meme, index, ...toStats(count.likes, count.nopes) }];
        })
        .sort(
          (a, b) =>
            b.likes - a.likes || (b.lovePercent ?? 0) - (a.lovePercent ?? 0) || a.index - b.index,
        )
        .slice(0, TRENDING_LIMIT)
        .map(({ index: _index, ...trending }) => trending);

      return { window, memes };
    },

    getSwipesPerMinute() {
      return swipesSince(PULSE_WINDOW_MS).length;
    },
  };
}
