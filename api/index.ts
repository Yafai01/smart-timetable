// Vercel serverless entry point. Vercel serves the Vite client build from
// dist/client as static files and routes every /api/* request here.
import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";
import { createApp } from "../server/app.js";
import { databaseConfigFromEnv, openDatabase, tempDatabasePath } from "../server/db.js";

// With TURSO_DATABASE_URL / TURSO_AUTH_TOKEN set, data lives in Turso and
// persists. Without them, the database falls back to the function's temp
// directory: fine for a demo, but it resets whenever an instance starts cold.
const SEED = process.env.SEED_SAMPLE_DATA !== "false";

let app: Promise<Express> | undefined;

function getApp() {
  app ??= openDatabase(databaseConfigFromEnv(process.env, tempDatabasePath()), { seed: SEED })
    .then(createApp)
    .catch((err) => {
      app = undefined; // retry on the next request instead of caching the failure
      throw err;
    });
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    (await getApp())(req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Database unavailable." }));
  }
}
