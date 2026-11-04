/** A meme template from the Meme-Tinder API. */
export interface Template {
  id: string;
  name: string;
  lines: number;
  imageUrl: string;
}

/** A meme created through the Meme-Tinder API. `imageUrl` is absolute (base URL included). */
export interface CreatedMeme {
  id: string;
  caption: string;
  imageUrl: string;
}

/** The API answered with an error, or could not be reached. The message is safe to show the model. */
export class MemeTinderError extends Error {}

export interface MemeTinderClient {
  searchTemplates(query: string): Promise<Template[]>;
  createMemeFromTemplate(templateId: string, texts: string[]): Promise<CreatedMeme>;
}

export interface MemeTinderClientOptions {
  /** Defaults to the global fetch. Injected so tests never reach the network. */
  fetch?: typeof fetch;
  /** The Meme-Tinder backend, for example http://localhost:3000. */
  baseUrl: string;
  /** Sent as X-User-Id. */
  userId: string;
}

/** A thin client of the Meme-Tinder HTTP API. It has no meme or template logic of its own. */
export function createMemeTinderClient(options: MemeTinderClientOptions): MemeTinderClient {
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, "X-User-Id": options.userId },
      });
    } catch {
      throw new MemeTinderError(
        `Could not reach Meme-Tinder at ${baseUrl}. Is the backend running?`,
      );
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Handled below: an error without a JSON body, or a success we cannot read.
    }
    if (!res.ok) {
      const error = (body as { error?: unknown } | null)?.error;
      throw new MemeTinderError(
        typeof error === "string" ? error : `Meme-Tinder responded with HTTP ${res.status}`,
      );
    }
    if (body === null) throw new MemeTinderError("Meme-Tinder sent an invalid response");
    return body as T;
  }

  return {
    async searchTemplates(query) {
      const { templates } = await request<{ templates: Template[] }>(
        `/api/templates?${new URLSearchParams({ q: query })}`,
      );
      return templates;
    },

    async createMemeFromTemplate(templateId, texts) {
      const meme = await request<CreatedMeme>("/api/memes/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, texts }),
      });
      return { ...meme, imageUrl: `${baseUrl}${meme.imageUrl}` };
    },
  };
}
