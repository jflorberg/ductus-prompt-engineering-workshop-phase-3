export interface StoredImage {
  contentType: string;
  data: Buffer;
}

/** Storage seam for uploaded meme images. Replace the in-memory implementation to persist them. */
export interface ImageStore {
  save(id: string, image: StoredImage): void;
  get(id: string): StoredImage | undefined;
}

export function createInMemoryImageStore(): ImageStore {
  const images = new Map<string, StoredImage>();
  return {
    save: (id, image) => {
      images.set(id, image);
    },
    get: (id) => images.get(id),
  };
}
