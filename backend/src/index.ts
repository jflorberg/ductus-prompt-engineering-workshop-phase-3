import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createInMemoryImageStore } from "./memes/imageStore.js";
import { createMemeService } from "./memes/service.js";
import { createInMemorySwipeRepository } from "./swipes/repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// The swipe service and the meme service share one catalog, so posted memes show up in every pile.
const catalog = createMemeCatalog();
const swipeService = createSwipeService(catalog, createInMemorySwipeRepository());
const memeService = createMemeService(catalog, createInMemoryImageStore());

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, { staticDir, memeService }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
