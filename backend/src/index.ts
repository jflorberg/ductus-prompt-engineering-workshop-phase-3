import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createInMemoryImageStore } from "./memes/imageStore.js";
import { createMemeService } from "./memes/service.js";
import { createInMemoryProfileRepository } from "./profiles/repository.js";
import { createProfileService } from "./profiles/service.js";
import { createSqliteProfileRepository } from "./profiles/sqlite-repository.js";
import { createInMemorySwipeRepository } from "./swipes/repository.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Set DATABASE_FILE to a SQLite file path to keep swipes and profiles across restarts.
// Without it, they live in memory.
const databaseFile = process.env.DATABASE_FILE;
const swipeRepository = databaseFile
  ? createSqliteSwipeRepository(databaseFile)
  : createInMemorySwipeRepository();
const profileRepository = databaseFile
  ? createSqliteProfileRepository(databaseFile)
  : createInMemoryProfileRepository();
const profileService = createProfileService(profileRepository);

// The swipe service and the meme service share one catalog, so posted memes show up in every pile.
const catalog = createMemeCatalog();
const swipeService = createSwipeService(catalog, swipeRepository);
const memeService = createMemeService(catalog, createInMemoryImageStore());

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, { staticDir, memeService, profileService }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(
    databaseFile
      ? `Swipes and profiles stored in SQLite: ${databaseFile}`
      : "Swipes and profiles stored in memory",
  );
});
