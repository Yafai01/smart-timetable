import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./server/app.js";
import { openDatabase } from "./server/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_PATH = process.env.DATABASE_PATH || path.resolve("timetable.db");
const SEED = process.env.SEED_SAMPLE_DATA !== "false";

// The compiled server (dist/server.js) always serves the production build;
// `npm run dev` runs this file through tsx and uses Vite middleware instead.
const isCompiled = __filename.endsWith(".js");
const isProduction = isCompiled || process.env.NODE_ENV === "production";

async function main() {
  const db = openDatabase(DATABASE_PATH, { seed: SEED });
  const app = createApp(db);

  if (isProduction) {
    // Serve only the Vite client build, never the directory holding server code.
    const clientDir = [path.join(__dirname, "client"), path.join(__dirname, "dist", "client")].find((dir) =>
      fs.existsSync(path.join(dir, "index.html")),
    );
    if (!clientDir) {
      throw new Error("Client build not found. Run `npm run build` first.");
    }
    app.use(express.static(clientDir, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Smart Timetable running on http://localhost:${PORT} (${isProduction ? "production" : "development"})`);
    console.log(`Database: ${DATABASE_PATH}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
