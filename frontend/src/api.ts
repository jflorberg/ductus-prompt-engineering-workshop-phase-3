import { getUserId } from "./identity";

export interface Meme {
  id: string;
  caption: string;
  imageUrl: string;
}

export type Direction = "like" | "nope";

/** The backend's `{ "error": "..." }` message as ": message", or "" when there is none. */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    const error = (body as { error?: unknown } | null)?.error;
    return typeof error === "string" ? `: ${error}` : "";
  } catch {
    return "";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, "X-User-Id": getUserId() },
  });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})${await errorDetail(res)}`);
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

/** A person as other users see them. The id is public; the secret user id is never in it. */
export interface Profile {
  id: string;
  nickname: string;
  emoji: string;
  bot: boolean;
}

export const MAX_NICKNAME_LENGTH = 30;

/** The current user's profile. The backend creates it on the first call. */
export async function fetchMe(): Promise<Profile> {
  const { profile } = await request<{ profile: Profile }>("/api/me");
  return profile;
}

/** Changes the current user's nickname and emoji. Resolves to the updated profile. */
export async function updateMe(nickname: string, emoji: string): Promise<Profile> {
  const { profile } = await request<{ profile: Profile }>("/api/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, emoji }),
  });
  return profile;
}

/** Image types and limits for posting a meme. They match the backend's rules. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_CAPTION_LENGTH = 140;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image file"));
    reader.readAsDataURL(file);
  });
}

/** Posts a new meme. It is added to every user's pile. Resolves to the created meme. */
export async function postMeme(caption: string, image: File): Promise<Meme> {
  return request<Meme>("/api/memes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption, image: await readAsDataUrl(image) }),
  });
}

/** A meme template, for example "This is Fine". */
export interface Template {
  id: string;
  name: string;
  /** How many text lines the template takes, top to bottom. */
  lines: number;
  /** The blank template image, for thumbnails. */
  imageUrl: string;
}

/** The longest text for one template line. It matches the backend's rule. */
export const MAX_TEMPLATE_TEXT_LENGTH = 100;

/** Templates matching the query (the first templates when it is empty). */
export async function searchTemplates(q: string): Promise<Template[]> {
  const { templates } = await request<{ templates: Template[] }>(
    `/api/templates?${new URLSearchParams({ q })}`,
  );
  return templates;
}

/** The URL of a rendered preview, for an <img src>. One text per line, top to bottom. */
export function templatePreviewUrl(templateId: string, texts: string[]): string {
  const params = new URLSearchParams();
  for (const text of texts) params.append("text", text);
  return `/api/templates/${encodeURIComponent(templateId)}/preview?${params}`;
}

/** Creates a meme from a template. It is added to every user's pile. Resolves to the created meme. */
export async function postMemeFromTemplate(templateId: string, texts: string[]): Promise<Meme> {
  return request<Meme>("/api/memes/from-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, texts }),
  });
}
