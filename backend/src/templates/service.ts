import type { Meme } from "../memes/catalog.js";
import type { StoredImage } from "../memes/imageStore.js";
import { MAX_CAPTION_LENGTH, type MemeService } from "../memes/service.js";
import type { Template, TemplateSource } from "./source.js";

export const MAX_TEMPLATE_RESULTS = 24;
export const MAX_TEMPLATE_TEXT_LENGTH = 100;
export const TEMPLATE_CACHE_MS = 24 * 60 * 60 * 1000;

export class UnknownTemplateError extends Error {}
export class InvalidTemplateTextError extends Error {}

export interface TemplateServiceOptions {
  /** The clock for the template cache. Defaults to the system clock. */
  now?: () => Date;
}

export interface TemplateService {
  /**
   * Templates whose id, name or keywords contain the query (case-insensitive), at most
   * MAX_TEMPLATE_RESULTS. An empty query returns the first templates in provider order.
   * Throws TemplateSourceError when the provider fails.
   */
  search(query: string): Promise<Template[]>;
  /** Renders the template with the texts without storing anything. Validates like createMeme. */
  preview(templateId: string, texts: unknown): Promise<StoredImage>;
  /**
   * Renders the template with the texts and posts it as a new meme, first in every pile.
   * Throws UnknownTemplateError, InvalidTemplateTextError or TemplateSourceError.
   */
  createMeme(templateId: string, texts: unknown): Promise<Meme>;
}

export function createTemplateService(
  source: TemplateSource,
  memeService: MemeService,
  options: TemplateServiceOptions = {},
): TemplateService {
  const now = options.now ?? (() => new Date());
  let cache: { templates: Template[]; fetchedAt: number } | null = null;

  /** The provider's templates, fetched at most once per TEMPLATE_CACHE_MS. Failures are not cached. */
  async function templates(): Promise<Template[]> {
    const time = now().getTime();
    if (cache && time - cache.fetchedAt < TEMPLATE_CACHE_MS) return cache.templates;
    const list = await source.list();
    cache = { templates: list, fetchedAt: time };
    return list;
  }

  /** Checks the template and texts. Returns the texts padded to the template's lines and the caption. */
  async function validate(templateId: string, texts: unknown) {
    const template = (await templates()).find((t) => t.id === templateId);
    if (!template) throw new UnknownTemplateError(`Unknown template: ${templateId}`);
    if (!Array.isArray(texts) || !texts.every((t): t is string => typeof t === "string")) {
      throw new InvalidTemplateTextError("texts must be an array of strings");
    }
    if (texts.length > template.lines) {
      throw new InvalidTemplateTextError(
        `This template takes at most ${template.lines} line${template.lines === 1 ? "" : "s"}`,
      );
    }
    if (texts.some((t) => t.length > MAX_TEMPLATE_TEXT_LENGTH)) {
      throw new InvalidTemplateTextError(
        `Each line must be ${MAX_TEMPLATE_TEXT_LENGTH} characters or fewer`,
      );
    }
    const trimmed = texts.map((t) => t.trim());
    const filled = trimmed.filter(Boolean);
    if (filled.length === 0) throw new InvalidTemplateTextError("Write text for at least one line");
    const caption = filled.join(" / ");
    if (caption.length > MAX_CAPTION_LENGTH) {
      throw new InvalidTemplateTextError(
        `The text must be ${MAX_CAPTION_LENGTH} characters or fewer in total`,
      );
    }
    const padded = [...trimmed, ...Array<string>(template.lines - trimmed.length).fill("")];
    return { template, texts: padded, caption };
  }

  return {
    async search(query) {
      const q = query.trim().toLowerCase();
      const all = await templates();
      const matches = q
        ? all.filter((t) =>
            [t.id, t.name, ...(t.keywords ?? [])].some((field) => field.toLowerCase().includes(q)),
          )
        : all;
      return matches.slice(0, MAX_TEMPLATE_RESULTS);
    },

    async preview(templateId, texts) {
      const valid = await validate(templateId, texts);
      return source.render(valid.template.id, valid.texts);
    },

    async createMeme(templateId, texts) {
      const valid = await validate(templateId, texts);
      const image = await source.render(valid.template.id, valid.texts);
      return memeService.postCaptionedMeme({ caption: valid.caption, image });
    },
  };
}
