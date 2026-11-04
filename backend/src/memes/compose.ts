import type { StoredImage } from "./imageStore.js";

/** Layout of the seed memes: a 400x400 card with the caption in a dark band at the bottom. */
const SIZE = 400;
const BAND_TOP = 270;
const BAND_HEIGHT = SIZE - BAND_TOP;

const escapeXml = (text: string) =>
  text.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );

/** Splits text into lines of at most maxChars, breaking at spaces (and inside words that are too long). */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.split(/\s+/)) {
    while (word.length > maxChars) {
      if (line) lines.push(line);
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
      line = "";
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Picks the largest font where the caption fits in the band. */
function layoutCaption(caption: string) {
  for (const fontSize of [22, 18, 15]) {
    const lineHeight = Math.round(fontSize * 1.27);
    const lines = wrap(caption.toUpperCase(), Math.floor(26 * (22 / fontSize)));
    if (lines.length * lineHeight <= BAND_HEIGHT - 16) return { fontSize, lineHeight, lines };
  }
  const fontSize = 15;
  const lineHeight = 19;
  return {
    fontSize,
    lineHeight,
    lines: wrap(caption.toUpperCase(), 38).slice(0, Math.floor((BAND_HEIGHT - 16) / lineHeight)),
  };
}

/**
 * Builds a meme SVG in the same style as the seed memes: the uploaded image above,
 * and the caption in a dark band at the bottom.
 */
export function composeMemeSvg(image: StoredImage, caption: string): string {
  const { fontSize, lineHeight, lines } = layoutCaption(caption);
  const href = `data:${image.contentType};base64,${image.data.toString("base64")}`;
  const firstBaseline = BAND_TOP + (BAND_HEIGHT - lines.length * lineHeight) / 2 + fontSize;
  const text = lines
    .map(
      (line, i) =>
        `<text x="200" y="${Math.round(firstBaseline + i * lineHeight)}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${fontSize}" font-weight="bold" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke" stroke-linejoin="round">${escapeXml(line)}</text>`,
    )
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-labelledby="t">`,
    `<title id="t">${escapeXml(caption)}</title>`,
    `<rect width="${SIZE}" height="${SIZE}" fill="#1e1e2e"/>`,
    `<image href="${href}" x="0" y="0" width="${SIZE}" height="${BAND_TOP}" preserveAspectRatio="xMidYMid meet"/>`,
    `<rect y="${BAND_TOP}" width="${SIZE}" height="${BAND_HEIGHT}" fill="#000" opacity="0.55"/>`,
    text,
    `</svg>`,
  ].join("\n");
}

/**
 * Builds a meme SVG for an image that already has its text on it (a rendered template):
 * the image fills the 400x400 card on a dark background, with no caption band and no text overlay.
 * The caption is only the accessible title.
 */
export function composeFullCardSvg(image: StoredImage, caption: string): string {
  const href = `data:${image.contentType};base64,${image.data.toString("base64")}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-labelledby="t">`,
    `<title id="t">${escapeXml(caption)}</title>`,
    `<rect width="${SIZE}" height="${SIZE}" fill="#1e1e2e"/>`,
    `<image href="${href}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid meet"/>`,
    `</svg>`,
  ].join("\n");
}
