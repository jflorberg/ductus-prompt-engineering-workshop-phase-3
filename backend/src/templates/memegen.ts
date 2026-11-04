import { MAX_IMAGE_BYTES } from "../memes/service.js";
import { TemplateSourceError, type Template, type TemplateSource } from "./source.js";

export const DEFAULT_MEMEGEN_BASE_URL = "https://api.memegen.link";
const TIMEOUT_MS = 5000;
/** Rendered width in pixels, so images stay well under MAX_IMAGE_BYTES. */
const RENDER_WIDTH = 600;
const RENDERED_TYPES = ["image/png", "image/jpeg"];

export interface MemegenSourceOptions {
  /** Defaults to the global fetch. Injected so tests never reach the network. */
  fetch?: typeof fetch;
  /** Defaults to DEFAULT_MEMEGEN_BASE_URL. */
  baseUrl?: string;
}

/** The fields we use from a memegen.link template. */
interface MemegenTemplate {
  id?: unknown;
  name?: unknown;
  lines?: unknown;
  blank?: unknown;
  keywords?: unknown;
}

function toTemplate(raw: MemegenTemplate): Template | null {
  const { id, name, lines, blank, keywords } = raw;
  if (typeof id !== "string" || !id || typeof blank !== "string") return null;
  return {
    id,
    name: typeof name === "string" && name ? name : id,
    lines: typeof lines === "number" && Number.isInteger(lines) && lines > 0 ? lines : 2,
    imageUrl: blank,
    keywords: Array.isArray(keywords)
      ? keywords.filter((k): k is string => typeof k === "string")
      : [],
  };
}

/** A TemplateSource backed by memegen.link (https://api.memegen.link/docs/). */
export function createMemegenSource(options: MemegenSourceOptions = {}): TemplateSource {
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl ?? DEFAULT_MEMEGEN_BASE_URL).replace(/\/+$/, "");

  /** fetch with a timeout. Network errors, timeouts and non-2xx responses throw TemplateSourceError. */
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new TemplateSourceError(`memegen request failed: ${String(err)}`);
    }
    if (!res.ok) throw new TemplateSourceError(`memegen responded with HTTP ${res.status}`);
    return res;
  }

  async function json(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new TemplateSourceError("memegen sent invalid JSON");
    }
  }

  return {
    async list() {
      const body = await json(await call(`${baseUrl}/templates/`));
      if (!Array.isArray(body)) throw new TemplateSourceError("memegen sent no template list");
      return body
        .map((raw: MemegenTemplate) => toTemplate(raw))
        .filter((t): t is Template => t !== null);
    },

    async render(templateId, texts) {
      const res = await call(`${baseUrl}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, text: texts, extension: "jpg" }),
      });
      const { url } = ((await json(res)) ?? {}) as { url?: unknown };
      if (typeof url !== "string" || !url) throw new TemplateSourceError("memegen sent no url");

      let imageUrl: URL;
      try {
        imageUrl = new URL(url, `${baseUrl}/`);
      } catch {
        throw new TemplateSourceError("memegen sent an invalid url");
      }
      imageUrl.searchParams.set("width", String(RENDER_WIDTH));

      const image = await call(imageUrl.toString());
      const contentType = (image.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!RENDERED_TYPES.includes(contentType)) {
        throw new TemplateSourceError(`memegen sent an unexpected content type: ${contentType}`);
      }
      const length = Number(image.headers.get("content-length"));
      if (length > MAX_IMAGE_BYTES) throw new TemplateSourceError("memegen image is too large");
      let data: Buffer;
      try {
        data = Buffer.from(await image.arrayBuffer());
      } catch (err) {
        throw new TemplateSourceError(`memegen image download failed: ${String(err)}`);
      }
      if (data.length > MAX_IMAGE_BYTES)
        throw new TemplateSourceError("memegen image is too large");
      return { contentType, data };
    },
  };
}
