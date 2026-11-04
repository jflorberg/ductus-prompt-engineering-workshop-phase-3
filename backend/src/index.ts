import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createInMemorySwipeRepository } from "./swipes/repository.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Set DATABASE_FILE to a SQLite file path to keep swipes across restarts. Without it, swipes live in memory.
const databaseFile = process.env.DATABASE_FILE;
const swipeRepository = databaseFile
  ? createSqliteSwipeRepository(databaseFile)
  : createInMemorySwipeRepository();

const swipeService = createSwipeService(createMemeCatalog(), swipeRepository);

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, { staticDir }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(
    databaseFile ? `Swipes stored in SQLite: ${databaseFile}` : "Swipes stored in memory",
  );
});
