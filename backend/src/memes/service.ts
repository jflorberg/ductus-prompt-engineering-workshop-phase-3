import { randomUUID } from "node:crypto";
import type { Meme, MemeCatalog } from "./catalog.js";
import { composeFullCardSvg, composeMemeSvg } from "./compose.js";
import type { ImageStore, StoredImage } from "./imageStore.js";

export const UPLOAD_PATH = "/api/memes/uploads";
export const MAX_CAPTION_LENGTH = 140;
export const MAX_IMAGE_BYTES = 1024 * 1024;

/** The image types users can post, with a check on the file content (not only the declared type). */
const IMAGE_TYPES: Record<string, (data: Buffer) => boolean> = {
  "image/png": (d) =>
    d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (d) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff,
  "image/gif": (d) => d.subarray(0, 4).toString("ascii") === "GIF8",
  "image/webp": (d) =>
    d.subarray(0, 4).toString("ascii") === "RIFF" && d.subarray(8, 12).toString("ascii") === "WEBP",
  "image/svg+xml": (d) => /<svg[\s>]/i.test(d.subarray(0, 4096).toString("utf8")),
};

export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_TYPES);

export class InvalidMemeError extends Error {}

export interface NewMeme {
  caption: string;
  /** The image as a data URL, for example "data:image/png;base64,...". */
  image: string;
}

export interface MemeService {
  /**
   * Validates and stores a new meme and adds it to the shared catalog, so it shows up first in
   * every user's pile. The stored image is an SVG with the caption in a band at the bottom. Throws InvalidMemeError for an empty or too long caption, or an
   * image that is not an allowed type, does not match its type, or is too large.
   */
  postMeme(input: NewMeme): Meme;
  /**
   * Stores an image that already has its text on it (no caption band) and adds it to the catalog.
   * Runs the same checks as postMeme and throws InvalidMemeError for the same reasons.
   */
  postCaptionedMeme(input: { caption: string; image: StoredImage }): Meme;
  /** The uploaded image for a meme id, or undefined. */
  getImage(id: string): StoredImage | undefined;
}

/** The caption rules shared by every way of posting. Returns the trimmed caption. */
function checkCaption(caption: string): string {
  const trimmed = caption.trim();
  if (!trimmed) throw new InvalidMemeError("caption is required");
  if (trimmed.length > MAX_CAPTION_LENGTH) {
    throw new InvalidMemeError(`caption must be ${MAX_CAPTION_LENGTH} characters or fewer`);
  }
  return trimmed;
}

/** The image rules shared by every way of posting: allowed type, not empty, size limit, content matches type. */
function checkImage({ contentType, data }: StoredImage): StoredImage {
  const check = IMAGE_TYPES[contentType];
  if (!check)
    throw new InvalidMemeError(`image type must be one of: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  if (data.length === 0) throw new InvalidMemeError("image is empty");
  if (data.length > MAX_IMAGE_BYTES) throw new InvalidMemeError("image must be 1 MB or smaller");
  if (!check(data)) throw new InvalidMemeError(`image content is not a valid ${contentType}`);
  return { contentType, data };
}

function parseDataUrl(image: string): StoredImage {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new InvalidMemeError("image must be a base64 data URL");
  const [, contentType, base64] = match;
  return checkImage({ contentType, data: Buffer.from(base64, "base64") });
}

export function createMemeService(catalog: MemeCatalog, images: ImageStore): MemeService {
  /** Stores the composed SVG under a new id and adds the meme first in the catalog. */
  function store(caption: string, svg: string): Meme {
    const id = `upload-${randomUUID()}`;
    images.save(id, { contentType: "image/svg+xml", data: Buffer.from(svg) });
    const meme = { id, caption, imageUrl: `${UPLOAD_PATH}/${id}` };
    catalog.add(meme);
    return meme;
  }

  return {
    postMeme({ caption, image }) {
      const trimmed = checkCaption(caption);
      const uploaded = parseDataUrl(image);
      // Stored as one SVG with the caption in it, so posted memes look like the seed memes.
      return store(trimmed, composeMemeSvg(uploaded, trimmed));
    },

    postCaptionedMeme({ caption, image }) {
      const trimmed = checkCaption(caption);
      // The text is already on the image, so the card has no caption band.
      return store(trimmed, composeFullCardSvg(checkImage(image), trimmed));
    },

    getImage: (id) => images.get(id),
  };
}
