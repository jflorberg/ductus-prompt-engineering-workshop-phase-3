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

/** Resolves to null when the user has swiped every meme. */
export async function fetchNextMeme(): Promise<Meme | null> {
  const { meme } = await request<{ meme: Meme | null }>("/api/memes/next");
  return meme;
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

/** Image types and limits for posting a meme. They match the backend's rules. */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
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
