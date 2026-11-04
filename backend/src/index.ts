import { resolve } from "node:path";
import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createFileSwipeRepository } from "./swipes/fileRepository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Swipes are saved to this JSON file so likes survive a restart. Relative paths resolve against
// the working directory (backend/ under `npm run dev`); the container sets an absolute path on a volume.
const dataFile = resolve(process.env.DATA_FILE ?? "data/swipes.json");

const swipeService = createSwipeService(createMemeCatalog(), createFileSwipeRepository(dataFile));

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, { staticDir }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Saving swipes to ${dataFile}`);
});
