// Vercel serverless entry point. Vercel serves the Vite client build from
// dist/client as static files and routes every /api/* request here.
import os from "os";
import path from "path";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db.js";

// The deployment filesystem is read-only apart from the OS temp directory.
// The database there lives only as long as the function instance, so data
// resets on cold starts unless DATABASE_PATH points somewhere persistent.
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(os.tmpdir(), "timetable.db");
const SEED = process.env.SEED_SAMPLE_DATA !== "false";

const app = createApp(openDatabase(DATABASE_PATH, { seed: SEED }));

export default app;
