import { randomUUID } from "node:crypto";
import type { Profile, ProfileRepository } from "./repository.js";

export const MAX_NICKNAME_LENGTH = 30;

const ADJECTIVES = [
  "Curious",
  "Sleepy",
  "Sneaky",
  "Grumpy",
  "Giggly",
  "Brave",
  "Fuzzy",
  "Witty",
  "Zesty",
  "Jolly",
  "Cosmic",
  "Sassy",
];
const ANIMALS = [
  "Otter",
  "Panda",
  "Llama",
  "Penguin",
  "Badger",
  "Koala",
  "Fox",
  "Hedgehog",
  "Narwhal",
  "Capybara",
  "Sloth",
  "Moose",
];
const EMOJIS = ["😎", "🤓", "😺", "🐸", "🦄", "🐙", "🦊", "🐼", "🤖", "👻", "🌮", "🚀"];

export class InvalidProfileError extends Error {}

/** What other users may see of a profile. Never contains the secret user id. */
export interface PublicProfile {
  id: string;
  nickname: string;
  emoji: string;
  bot: boolean;
}

export interface ProfileChanges {
  nickname: string;
  emoji: string;
}

export interface ProfileService {
  /** The user's profile. Created on the first call with a random nickname and emoji. */
  getOrCreate(userId: string): PublicProfile;
  /**
   * Changes the user's nickname and emoji (creating the profile first if needed). Throws
   * InvalidProfileError for an empty or too long nickname, or an emoji that is not one emoji.
   */
  update(userId: string, changes: ProfileChanges): PublicProfile;
}

export interface ProfileServiceOptions {
  /** A number in [0, 1), like Math.random. Injected so tests get predictable names. */
  random?: () => number;
  /** Creates public profile ids. */
  newId?: () => string;
}

export function toPublicProfile({ id, nickname, emoji, bot }: Profile): PublicProfile {
  return { id, nickname, emoji, bot };
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** True for exactly one emoji, including skin tones, flags and joined sequences like 👩‍💻. */
export function isSingleEmoji(value: string): boolean {
  const graphemes = [...segmenter.segment(value)];
  return graphemes.length === 1 && EMOJI.test(value);
}

export function createProfileService(
  repository: ProfileRepository,
  { random = Math.random, newId = randomUUID }: ProfileServiceOptions = {},
): ProfileService {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

  function findOrCreate(userId: string): Profile {
    const existing = repository.findByUserId(userId);
    if (existing) return existing;
    const profile: Profile = {
      id: newId(),
      userId,
      nickname: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
      emoji: pick(EMOJIS),
      bot: false,
    };
    repository.save(profile);
    return profile;
  }

  return {
    getOrCreate: (userId) => toPublicProfile(findOrCreate(userId)),

    update(userId, { nickname, emoji }) {
      const trimmedNickname = nickname.trim();
      const trimmedEmoji = emoji.trim();
      if (!trimmedNickname) throw new InvalidProfileError("nickname is required");
      if ([...trimmedNickname].length > MAX_NICKNAME_LENGTH) {
        throw new InvalidProfileError(
          `nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer`,
        );
      }
      if (!isSingleEmoji(trimmedEmoji)) throw new InvalidProfileError("emoji must be one emoji");
      const profile = { ...findOrCreate(userId), nickname: trimmedNickname, emoji: trimmedEmoji };
      repository.save(profile);
      return toPublicProfile(profile);
    },
  };
}
