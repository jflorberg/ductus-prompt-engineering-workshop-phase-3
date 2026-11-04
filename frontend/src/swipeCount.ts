const STORAGE_KEY = "meme-tinder-swipe-count";

let memoryCount = 0;

/** Adds one swipe to this browser's lifetime swipe count and returns the new total. */
export function countSwipe(): number {
  try {
    const next = (Number(localStorage.getItem(STORAGE_KEY)) || 0) + 1;
    localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    // localStorage unavailable (e.g. blocked): count for this page load only.
    return ++memoryCount;
  }
}
