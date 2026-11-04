import type { StoredImage } from "../memes/imageStore.js";

/** A meme template from the provider, for example "This is Fine". */
export interface Template {
  id: string;
  name: string;
  /** How many text lines the template takes, top to bottom. */
  lines: number;
  /** The blank template image, used for thumbnails. */
  imageUrl: string;
  /** Extra search words from the provider. Not part of the API response. */
  keywords?: string[];
}

/** The provider failed: it is unreachable, timed out, or sent something we cannot use. */
export class TemplateSourceError extends Error {}

/**
 * Seam for the external template provider, like SwipeRepository is for storage.
 * Swap the implementation to change providers.
 */
export interface TemplateSource {
  /** Every template, in provider order. Throws TemplateSourceError on failure. */
  list(): Promise<Template[]>;
  /** Renders the template with the texts (top to bottom). Throws TemplateSourceError on failure. */
  render(templateId: string, texts: string[]): Promise<StoredImage>;
}
