import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import fs from "fs";
import os from "os";
import path from "path";

export interface Stmt {
  sql: string;
  args?: InValue[];
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Small async wrapper over a libSQL client. The same code talks to a local
 * SQLite file (development, tests) or to a hosted Turso database (Vercel).
 */
export interface DB {
  get<T>(sql: string, args?: InValue[]): Promise<T | undefined>;
  all<T>(sql: string, args?: InValue[]): Promise<T[]>;
  run(sql: string, args?: InValue[]): Promise<RunResult>;
  /** Runs every statement in one transaction: all apply or none do. */
  batch(stmts: Stmt[]): Promise<RunResult[]>;
  close(): void;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    dept_id INTEGER,
    FOREIGN KEY(dept_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    periods_per_week INTEGER DEFAULT 3,
    is_lab INTEGER DEFAULT 0,
    dept_id INTEGER,
    FOREIGN KEY(dept_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dept_id INTEGER,
    student_count INTEGER DEFAULT 30,
    FOREIGN KEY(dept_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER,
    is_lab INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS faculty_subjects (
    faculty_id INTEGER,
    subject_id INTEGER,
    PRIMARY KEY(faculty_id, subject_id),
    FOREIGN KEY(faculty_id) REFERENCES faculty(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    subject_id INTEGER,
    faculty_id INTEGER,
    room_id INTEGER,
    day TEXT,
    period INTEGER,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(faculty_id) REFERENCES faculty(id),
    FOREIGN KEY(room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS faculty_availability (
    faculty_id INTEGER,
    day TEXT,
    period INTEGER,
    is_available INTEGER DEFAULT 1,
    PRIMARY KEY(faculty_id, day, period),
    FOREIGN KEY(faculty_id) REFERENCES faculty(id)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

/** Sample data inserted only the first time a database is initialised. */
const SAMPLE_DATA = `
  INSERT INTO departments (id, name) VALUES (1, 'Computer Science'), (2, 'Information Technology');

  INSERT INTO faculty (id, name, email, dept_id) VALUES
    (1, 'Dr. Alan Turing', 'alan@college.edu', 1),
    (2, 'Grace Hopper', 'grace@college.edu', 1),
    (3, 'Ada Lovelace', 'ada@college.edu', 2);

  INSERT INTO subjects (id, name, code, periods_per_week, is_lab, dept_id) VALUES
    (1, 'Artificial Intelligence', 'CS101', 4, 0, 1),
    (2, 'Data Structures', 'CS102', 3, 0, 1),
    (3, 'AI Lab', 'CS101L', 2, 1, 1),
    (4, 'Web Development', 'IT201', 4, 0, 2);

  INSERT INTO classes (id, name, dept_id, student_count) VALUES
    (1, 'CS Year 1', 1, 45),
    (2, 'IT Year 1', 2, 35);

  INSERT INTO rooms (id, name, capacity, is_lab) VALUES
    (1, 'Room 101', 60, 0),
    (2, 'Room 102', 60, 0),
    (3, 'Lab A', 48, 1);

  INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (1, 1), (1, 3), (2, 2), (3, 4);
`;

export interface DatabaseConfig {
  /** libSQL URL: `file:path/to.db`, `:memory:`, or `libsql://…` for Turso. */
  url: string;
  authToken?: string;
}

export interface OpenOptions {
  /** Insert sample departments, faculty, subjects, classes and rooms on first run. */
  seed?: boolean;
}

/**
 * Chooses the database from the environment:
 * 1. TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL (+ DATABASE_AUTH_TOKEN)
 * 2. DATABASE_PATH, a local SQLite file
 * 3. `fallbackPath`
 */
export function databaseConfigFromEnv(env: NodeJS.ProcessEnv, fallbackPath: string): DatabaseConfig {
  const url = env.TURSO_DATABASE_URL || env.DATABASE_URL;
  if (url) return { url, authToken: env.TURSO_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN || undefined };
  return { url: `file:${path.resolve(env.DATABASE_PATH || fallbackPath)}` };
}

/** A file in the OS temp directory: the only writable place on serverless hosts. */
export const tempDatabasePath = () => path.join(os.tmpdir(), "timetable.db");

const toRun = (rs: ResultSet): RunResult => ({
  changes: rs.rowsAffected,
  lastInsertRowid: rs.lastInsertRowid === undefined ? 0 : Number(rs.lastInsertRowid),
});

/** libSQL rows are array-like; turn them into plain objects keyed by column. */
const toObjects = <T>(rs: ResultSet): T[] =>
  rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);

const splitStatements = (sql: string): Stmt[] =>
  sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ sql: s }));

function wrap(client: Client): DB {
  return {
    async get<T>(sql: string, args: InValue[] = []) {
      return toObjects<T>(await client.execute({ sql, args }))[0];
    },
    async all<T>(sql: string, args: InValue[] = []) {
      return toObjects<T>(await client.execute({ sql, args }));
    },
    async run(sql: string, args: InValue[] = []) {
      return toRun(await client.execute({ sql, args }));
    },
    async batch(stmts: Stmt[]) {
      if (stmts.length === 0) return [];
      return (await client.batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write")).map(toRun);
    },
    close: () => client.close(),
  };
}

/**
 * Opens (or creates) the database, applies the schema and, on first
 * initialisation only, inserts sample data. Deleted sample rows therefore stay
 * deleted across restarts.
 */
export async function openDatabase(config: DatabaseConfig | string, { seed = true }: OpenOptions = {}): Promise<DB> {
  const cfg = typeof config === "string" ? { url: config === ":memory:" ? ":memory:" : `file:${path.resolve(config)}` } : config;
  if (cfg.url.startsWith("file:")) {
    fs.mkdirSync(path.dirname(cfg.url.slice("file:".length)), { recursive: true });
  }
  const client = createClient({ url: cfg.url, authToken: cfg.authToken });
  const db = wrap(client);
  if (cfg.url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL");
  await client.batch(splitStatements(SCHEMA), "write");

  if (!(await db.get("SELECT value FROM meta WHERE key = 'initialised'"))) {
    // Databases created by earlier versions already contain data: never re-seed them.
    const hasData = await db.get("SELECT 1 FROM departments LIMIT 1");
    try {
      // The meta row goes first: if another instance initialised the database
      // in the meantime, its primary key clashes and the whole batch rolls back.
      await db.batch([
        { sql: "INSERT INTO meta (key, value) VALUES ('initialised', ?)", args: [new Date().toISOString()] },
        ...(seed && !hasData ? splitStatements(SAMPLE_DATA) : []),
      ]);
    } catch (err) {
      if (!(await db.get("SELECT value FROM meta WHERE key = 'initialised'"))) throw err;
    }
  }
  return db;
}
