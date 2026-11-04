/** A person. `userId` is the secret X-User-Id; `id` is public and safe to show to other users. */
export interface Profile {
  id: string;
  userId: string;
  nickname: string;
  emoji: string;
  bot: boolean;
}

/** Storage seam for profiles. Replace the in-memory implementation to use a real database. */
export interface ProfileRepository {
  findByUserId(userId: string): Profile | undefined;
  findById(id: string): Profile | undefined;
  list(): Profile[];
  /** Inserts the profile, or replaces the stored profile with the same `userId`. */
  save(profile: Profile): void;
}

export function createInMemoryProfileRepository(): ProfileRepository {
  const byUserId = new Map<string, Profile>();
  return {
    findByUserId: (userId) => {
      const profile = byUserId.get(userId);
      return profile && { ...profile };
    },
    findById: (id) => {
      const profile = [...byUserId.values()].find((p) => p.id === id);
      return profile && { ...profile };
    },
    list: () => [...byUserId.values()].map((p) => ({ ...p })),
    save: (profile) => {
      byUserId.set(profile.userId, { ...profile });
    },
  };
}
