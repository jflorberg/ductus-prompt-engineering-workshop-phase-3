import { useState, type FormEvent } from "react";
import { MAX_NICKNAME_LENGTH, type Profile } from "./api";

/** The emojis to pick from. The backend accepts any single emoji. */
export const PROFILE_EMOJIS = [
  "😎",
  "🤓",
  "😺",
  "🐸",
  "🦄",
  "🐙",
  "🦊",
  "🐼",
  "🤖",
  "👻",
  "🌮",
  "🚀",
  "🐢",
  "🦖",
  "🍕",
  "👵",
];

interface ProfileViewProps {
  profile: Profile;
  /** Saves the changes. A rejected promise shows its message in the form. */
  onSave: (nickname: string, emoji: string) => Promise<Profile>;
}

/** The current user's profile: a nickname and an emoji, both editable. */
export function ProfileView({ profile, onSave }: ProfileViewProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [emoji, setEmoji] = useState(profile.emoji);
  const [saved, setSaved] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // The current emoji stays pickable even if it is not in the list (it may have been set elsewhere).
  const emojis = PROFILE_EMOJIS.includes(saved.emoji)
    ? PROFILE_EMOJIS
    : [saved.emoji, ...PROFILE_EMOJIS];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!nickname.trim()) {
      setError("Pick a nickname.");
      return;
    }
    setError(null);
    setConfirmed(false);
    setSaving(true);
    try {
      const updated = await onSave(nickname.trim(), emoji);
      setSaved(updated);
      setNickname(updated.nickname);
      setEmoji(updated.emoji);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-view">
      <h2>
        <span className="profile-emoji" aria-hidden="true">
          {saved.emoji}
        </span>{" "}
        {saved.nickname}
      </h2>
      <form onSubmit={submit} noValidate>
        <label>
          Nickname
          <input
            type="text"
            value={nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            required
            onChange={(event) => {
              setNickname(event.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <fieldset>
          <legend>Picture</legend>
          <div className="emoji-picker">
            {emojis.map((option) => (
              <label key={option} className="emoji-option">
                <input
                  type="radio"
                  name="emoji"
                  value={option}
                  checked={emoji === option}
                  onChange={() => {
                    setEmoji(option);
                    setConfirmed(false);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {confirmed && <p role="status">Saved! Other people see you as {saved.nickname}.</p>}
    </section>
  );
}
