import { useEffect, useState, type FormEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, MAX_CAPTION_LENGTH, MAX_IMAGE_BYTES, type Meme } from "./api";

interface PostViewProps {
  /** Posts the meme. A rejected promise shows its message in the form. */
  onPost: (caption: string, image: File) => Promise<Meme>;
}

/** A form to post your own meme: pick a local image, write a caption, post. */
export function PostView({ onPost }: PostViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<Meme | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!file || !URL.createObjectURL) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(picked: File | null) {
    setPosted(null);
    setError(null);
    if (picked && !ACCEPTED_IMAGE_TYPES.includes(picked.type)) {
      setError("Pick a PNG, JPEG, GIF, WebP or SVG image.");
      setFile(null);
      return;
    }
    if (picked && picked.size > MAX_IMAGE_BYTES) {
      setError("The image must be 1 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(picked);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (posting) return;
    if (!file) {
      setError("Pick an image first.");
      return;
    }
    if (!caption.trim()) {
      setError("Write a caption.");
      return;
    }
    setError(null);
    setPosting(true);
    try {
      setPosted(await onPost(caption.trim(), file));
      setFile(null);
      setCaption("");
      setFormKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="post-view">
      <h2>Post a meme</h2>
      <form key={formKey} onSubmit={submit} noValidate>
        <label>
          Image
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            required
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {preview && (
          <figure className="post-preview">
            <img src={preview} alt="Preview of your meme" />
            <div className="post-preview-band" aria-hidden="true">
              {caption.trim().toUpperCase()}
            </div>
          </figure>
        )}
        <label>
          Caption
          <input
            type="text"
            value={caption}
            maxLength={MAX_CAPTION_LENGTH}
            required
            placeholder="Make it funny"
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>
        <button type="submit" disabled={posting}>
          {posting ? "Posting…" : "Post meme"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {posted && <p role="status">Posted! “{posted.caption}” is now in everyone's pile.</p>}
    </section>
  );
}
