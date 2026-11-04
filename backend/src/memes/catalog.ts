import { seedMemes, type SeedMeme } from "./seed.js";

export interface Meme {
  id: string;
  caption: string;
  imageUrl: string;
}

export const IMAGE_PATH = "/api/memes/images";

export interface MemeCatalog {
  /** All memes: added memes first (newest first), then the seed memes. */
  list(): Meme[];
  getById(id: string): Meme | undefined;
  /** Adds a meme to the front of the catalog, so every user gets it next in their pile. */
  add(meme: Meme): void;
}

function toMeme(seed: SeedMeme): Meme {
  return { id: seed.id, caption: seed.caption, imageUrl: `${IMAGE_PATH}/${seed.file}` };
}

export function createMemeCatalog(seeds: SeedMeme[] = seedMemes): MemeCatalog {
  const memes = seeds.map(toMeme);
  return {
    list: () => [...memes],
    getById: (id) => memes.find((meme) => meme.id === id),
    add: (meme) => {
      memes.unshift(meme);
    },
  };
}
