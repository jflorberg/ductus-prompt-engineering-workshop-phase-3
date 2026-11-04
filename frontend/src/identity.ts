const STORAGE_KEY = "meme-tinder-user-id";

/** Returns the anonymous user id, creating and persisting it on first visit. */
export function getUserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (e.g. blocked): fall back to an id for this page load only.
    return (memoryId ??= crypto.randomUUID());
  }
}

let memoryId: string | undefined;

const LOGIN_KEY = "meme-tinder-logged-in";
let memoryLoggedIn = false;

/**
 * True when the user has clapped their way in during this browser session. It is kept in
 * sessionStorage, so a reload keeps you in and a new tab or visit asks for claps again.
 * This is a playful gate on the device, not an account: it does not change the user id.
 */
export function isLoggedIn(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_KEY) === "yes";
  } catch {
    return memoryLoggedIn;
  }
}

export function logIn(): void {
  memoryLoggedIn = true;
  try {
    sessionStorage.setItem(LOGIN_KEY, "yes");
  } catch {
    // sessionStorage unavailable: stay logged in for this page load only.
  }
}

export function logOut(): void {
  memoryLoggedIn = false;
  try {
    sessionStorage.removeItem(LOGIN_KEY);
  } catch {
    // sessionStorage unavailable: the in-memory flag is already cleared.
  }
}
