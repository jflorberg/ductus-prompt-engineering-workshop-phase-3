import { useEffect, useState, type FormEvent } from "react";
import {
  MAX_TEMPLATE_TEXT_LENGTH,
  searchTemplates,
  templatePreviewUrl,
  type Meme,
  type Template,
} from "./api";

const SEARCH_DELAY_MS = 300;
const PREVIEW_DELAY_MS = 400;

interface TemplateViewProps {
  /** Creates the meme. A rejected promise shows its message in the form. */
  onPost: (templateId: string, texts: string[]) => Promise<Meme>;
  /** Searches templates. Defaults to the API. */
  onSearch?: (query: string) => Promise<Template[]>;
}

const hasText = (texts: string[]) => texts.some((text) => text.trim());
const message = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

/** Create a meme from a well-known template: search, pick a template, write each line, post. */
export function TemplateView({ onPost, onSearch = searchTemplates }: TemplateViewProps) {
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [texts, setTexts] = useState<string[]>([]);
  const [previewTexts, setPreviewTexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<Meme | null>(null);

  // Search, debounced while typing. The first results load right away when the view opens.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        onSearch(query.trim())
          .then((found) => {
            if (cancelled) return;
            setTemplates(found);
            setError(null);
          })
          .catch((err: unknown) => {
            if (!cancelled) setError(message(err));
          });
      },
      query ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onSearch]);

  // The preview follows the texts once typing stops.
  useEffect(() => {
    // Keeps the current array when nothing changed, so the preview does not re-render for nothing.
    const timer = setTimeout(
      () =>
        setPreviewTexts((current) =>
          current.length === texts.length && current.every((text, i) => text === texts[i])
            ? current
            : texts,
        ),
      PREVIEW_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [texts]);

  function pick(next: Template | null) {
    setTemplate(next);
    setTexts(next ? Array<string>(next.lines).fill("") : []);
    setPreviewTexts([]);
    setPosted(null);
    setError(null);
  }

  function setLine(index: number, value: string) {
    setTexts((current) => current.map((text, i) => (i === index ? value : text)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!template || posting || !hasText(texts)) return;
    setError(null);
    setPosting(true);
    try {
      setPosted(await onPost(template.id, texts));
      setTexts(Array<string>(template.lines).fill(""));
      setPreviewTexts([]);
    } catch (err) {
      setError(message(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="template-view">
      <h2>Create a meme</h2>
      {template ? (
        <form onSubmit={submit} noValidate>
          <p className="template-picked">
            <strong>{template.name}</strong>
            <button type="button" className="link-button" onClick={() => pick(null)}>
              Change template
            </button>
          </p>
          {texts.map((text, i) => (
            <label key={i}>
              Line {i + 1}
              <input
                type="text"
                value={text}
                maxLength={MAX_TEMPLATE_TEXT_LENGTH}
                onChange={(event) => setLine(i, event.target.value)}
              />
            </label>
          ))}
          {hasText(previewTexts) && (
            <figure className="template-preview">
              <img src={templatePreviewUrl(template.id, previewTexts)} alt="Preview of your meme" />
            </figure>
          )}
          <button type="submit" disabled={posting || !hasText(texts)}>
            {posting ? "Posting…" : "Post meme"}
          </button>
        </form>
      ) : (
        <>
          <label className="template-search">
            Search templates
            <input
              type="search"
              value={query}
              placeholder="this is fine, drake, distracted…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {!templates && !error && <p>Loading…</p>}
          {templates?.length === 0 && <p>No templates found.</p>}
          {templates && templates.length > 0 && (
            <ul className="template-grid">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => pick(t)}>
                    <img src={t.imageUrl} alt={t.name} loading="lazy" />
                    <span aria-hidden="true">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {posted && <p role="status">Posted! “{posted.caption}” is now in everyone's pile.</p>}
    </section>
  );
}
