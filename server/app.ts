import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import type { DB, Stmt } from "./db.js";
import {
  ALL_DAYS,
  MAX_PERIODS_PER_DAY,
  detectConflicts,
  generateTimetable,
  type Availability,
  type ClassGroup,
  type Entry,
  type Faculty,
  type FacultySubject,
  type Room,
  type Subject,
} from "./scheduler.js";

/** Thrown by validators and handlers; turned into a JSON error response. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- validation helpers ----------

type Body = Record<string, unknown>;

function text(body: Body, field: string, label: string, max = 100): string {
  const v = body[field];
  if (typeof v !== "string" || v.trim() === "") throw new HttpError(400, `${label} is required.`);
  if (v.trim().length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
  return v.trim();
}

function int(body: Body, field: string, label: string, min: number, max: number): number {
  const raw = body[field];
  const v = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  }
  return v;
}

function bool(body: Body, field: string): boolean {
  const v = body[field];
  return v === true || v === 1 || v === "1" || v === "true";
}

function email(body: Body, field: string): string | null {
  const v = body[field];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string" || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
    throw new HttpError(400, "Email address is not valid.");
  }
  return v.trim();
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Invalid id.");
  return id;
}

/** Express 4 does not catch rejected promises; forward them to the error handler. */
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

// ---------- app ----------

const UPLOAD_TYPES = ["departments", "faculty", "subjects", "classes", "rooms"] as const;
type UploadType = (typeof UPLOAD_TYPES)[number];
type Table = UploadType;

/** Ids that parsed rows may reference, loaded once per request. */
interface Refs {
  departments: Set<number>;
  faculty: Set<number>;
}

export function createApp(db: DB) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });

  const requireRow = async (table: Table, id: number, label: string) => {
    if (!(await db.get(`SELECT 1 FROM ${table} WHERE id = ?`, [id]))) throw new HttpError(404, `${label} not found.`);
  };
  const loadRefs = async (): Promise<Refs> => {
    const ids = async (table: Table) => new Set((await db.all<{ id: number }>(`SELECT id FROM ${table}`)).map((r) => r.id));
    const [departments, faculty] = await Promise.all([ids("departments"), ids("faculty")]);
    return { departments, faculty };
  };

  const deptId = (body: Body, refs: Refs) => {
    const id = int(body, "dept_id", "Department", 1, Number.MAX_SAFE_INTEGER);
    if (!refs.departments.has(id)) throw new HttpError(400, "Selected department does not exist.");
    return id;
  };
  const optionalFacultyId = (body: Body, refs: Refs): number | null => {
    const v = body.faculty_id;
    if (v === undefined || v === null || v === "") return null;
    const id = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
    if (!refs.faculty.has(id)) throw new HttpError(400, "Selected faculty member does not exist.");
    return id;
  };

  // Field parsers shared by JSON endpoints and CSV import. Each returns the
  // validated values and the INSERT statement for them.
  const parse = {
    departments: (b: Body, _refs: Refs) => {
      const v = { name: text(b, "name", "Department name") };
      return { v, insert: { sql: "INSERT INTO departments (name) VALUES (?)", args: [v.name] } };
    },
    faculty: (b: Body, refs: Refs) => {
      const v = { name: text(b, "name", "Name"), email: email(b, "email"), dept_id: deptId(b, refs) };
      return {
        v,
        insert: { sql: "INSERT INTO faculty (name, email, dept_id) VALUES (?, ?, ?)", args: [v.name, v.email, v.dept_id] },
      };
    },
    subjects: (b: Body, refs: Refs) => {
      const v = {
        name: text(b, "name", "Subject name"),
        code: text(b, "code", "Subject code", 20),
        periods_per_week: int(b, "periods_per_week", "Periods per week", 1, ALL_DAYS.length * MAX_PERIODS_PER_DAY),
        is_lab: bool(b, "is_lab") ? 1 : 0,
        dept_id: deptId(b, refs),
      };
      return {
        v,
        insert: {
          sql: "INSERT INTO subjects (name, code, periods_per_week, is_lab, dept_id) VALUES (?, ?, ?, ?, ?)",
          args: [v.name, v.code, v.periods_per_week, v.is_lab, v.dept_id],
        },
      };
    },
    classes: (b: Body, refs: Refs) => {
      const v = {
        name: text(b, "name", "Class name"),
        dept_id: deptId(b, refs),
        student_count: int(b, "student_count", "Student count", 1, 10000),
      };
      return {
        v,
        insert: {
          sql: "INSERT INTO classes (name, dept_id, student_count) VALUES (?, ?, ?)",
          args: [v.name, v.dept_id, v.student_count],
        },
      };
    },
    rooms: (b: Body, _refs: Refs) => {
      const v = { name: text(b, "name", "Room name"), capacity: int(b, "capacity", "Capacity", 1, 10000), is_lab: bool(b, "is_lab") ? 1 : 0 };
      return { v, insert: { sql: "INSERT INTO rooms (name, capacity, is_lab) VALUES (?, ?, ?)", args: [v.name, v.capacity, v.is_lab] } };
    },
  } satisfies Record<UploadType, (b: Body, refs: Refs) => { v: unknown; insert: Stmt }>;

  /** Links the subject inserted just before (last_insert_rowid) to its teacher, in the same batch. */
  const linkNewSubject = (facultyId: number | null): Stmt[] =>
    facultyId === null
      ? []
      : [{ sql: "INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, last_insert_rowid())", args: [facultyId] }];

  const loadAll = async () => {
    const [departments, faculty, subjects, classes, rooms, faculty_subjects, faculty_availability, timetable] = await Promise.all([
      db.all<{ id: number; name: string }>("SELECT * FROM departments ORDER BY name"),
      db.all<Faculty>("SELECT * FROM faculty ORDER BY name"),
      db.all<Subject>("SELECT * FROM subjects ORDER BY code"),
      db.all<ClassGroup>("SELECT * FROM classes ORDER BY name"),
      db.all<Room>("SELECT * FROM rooms ORDER BY name"),
      db.all<FacultySubject>("SELECT * FROM faculty_subjects"),
      db.all<Availability>("SELECT * FROM faculty_availability"),
      db.all<Entry & { id: number }>("SELECT * FROM timetable_entries ORDER BY id"),
    ]);
    return { departments, faculty, subjects, classes, rooms, faculty_subjects, faculty_availability, timetable };
  };

  const getMeta = async (key: string) =>
    (await db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))?.value ?? null;
  const setMeta = (key: string, value: string): Stmt => ({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });

  const conflictsFor = (d: Awaited<ReturnType<typeof loadAll>>) =>
    detectConflicts({
      entries: d.timetable,
      classes: d.classes,
      subjects: d.subjects,
      rooms: d.rooms,
      faculty: d.faculty,
      availability: d.faculty_availability,
    });

  const DEFAULT_SETTINGS = { workingDays: [...ALL_DAYS] as string[], periodsPerDay: 6, startTime: "09:00", periodMinutes: 60 };
  type Settings = typeof DEFAULT_SETTINGS;
  const settings = async (): Promise<Settings> => {
    const stored = await getMeta("schedule_settings");
    // Older rows lack the clock-time fields; fill them from the defaults.
    return { ...DEFAULT_SETTINGS, ...(stored ? (JSON.parse(stored) as Partial<Settings>) : {}) };
  };
  const startTime = (body: Body) => {
    const v = body.startTime;
    if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new HttpError(400, "Start time must be in HH:MM format.");
    return v;
  };

  // ---------- read ----------

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(
    "/api/data",
    route(async (_req, res) => {
      const [d, s, last] = await Promise.all([loadAll(), settings(), getMeta("last_generated_at")]);
      res.json({ ...d, conflicts: conflictsFor(d), settings: s, last_generated_at: last });
    }),
  );

  // ---------- create / update / delete ----------

  /** POST handler for entities with no extra relations. */
  const create = (type: "departments" | "faculty" | "classes" | "rooms") =>
    route(async (req, res) => {
      const { insert } = parse[type](req.body ?? {}, await loadRefs());
      const r = await db.run(insert.sql, insert.args);
      res.status(201).json({ id: r.lastInsertRowid });
    });

  /** DELETE handler: removes the row and its dependants atomically, reporting removed timetable periods. */
  const remove = (table: Table, label: string, column: string, dependants: string[] = []) =>
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow(table, id, label);
      const [entries] = await db.batch([
        { sql: `DELETE FROM timetable_entries WHERE ${column} = ?`, args: [id] },
        ...dependants.map((sql) => ({ sql, args: [id] })),
        { sql: `DELETE FROM ${table} WHERE id = ?`, args: [id] },
      ]);
      res.json({ id, removedEntries: entries.changes });
    });

  app.post("/api/departments", create("departments"));
  app.put(
    "/api/departments/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("departments", id, "Department");
      const { v } = parse.departments(req.body ?? {}, await loadRefs());
      await db.run("UPDATE departments SET name = ? WHERE id = ?", [v.name, id]);
      res.json({ id });
    }),
  );
  app.delete(
    "/api/departments/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("departments", id, "Department");
      const used: string[] = [];
      for (const t of ["faculty", "subjects", "classes"] as const) {
        if (await db.get(`SELECT 1 FROM ${t} WHERE dept_id = ? LIMIT 1`, [id])) used.push(t);
      }
      if (used.length) {
        throw new HttpError(409, `This department still has ${used.join(", ")}. Move or delete them first.`);
      }
      await db.run("DELETE FROM departments WHERE id = ?", [id]);
      res.json({ id });
    }),
  );

  app.post("/api/faculty", create("faculty"));
  app.put(
    "/api/faculty/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("faculty", id, "Faculty member");
      const { v } = parse.faculty(req.body ?? {}, await loadRefs());
      await db.run("UPDATE faculty SET name = ?, email = ?, dept_id = ? WHERE id = ?", [v.name, v.email, v.dept_id, id]);
      res.json({ id });
    }),
  );
  app.delete(
    "/api/faculty/:id",
    remove("faculty", "Faculty member", "faculty_id", [
      "DELETE FROM faculty_subjects WHERE faculty_id = ?",
      "DELETE FROM faculty_availability WHERE faculty_id = ?",
    ]),
  );

  app.post(
    "/api/subjects",
    route(async (req, res) => {
      const body = req.body ?? {};
      const refs = await loadRefs();
      const { insert } = parse.subjects(body, refs);
      const facultyId = optionalFacultyId(body, refs);
      const [r] = await db.batch([insert, ...linkNewSubject(facultyId)]);
      res.status(201).json({ id: r.lastInsertRowid });
    }),
  );
  app.put(
    "/api/subjects/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("subjects", id, "Subject");
      const body = req.body ?? {};
      const refs = await loadRefs();
      const { v } = parse.subjects(body, refs);
      const facultyId = optionalFacultyId(body, refs);
      const stmts: Stmt[] = [
        {
          sql: "UPDATE subjects SET name = ?, code = ?, periods_per_week = ?, is_lab = ?, dept_id = ? WHERE id = ?",
          args: [v.name, v.code, v.periods_per_week, v.is_lab, v.dept_id, id],
        },
      ];
      if ("faculty_id" in body) {
        stmts.push({ sql: "DELETE FROM faculty_subjects WHERE subject_id = ?", args: [id] });
        if (facultyId !== null) {
          stmts.push({ sql: "INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)", args: [facultyId, id] });
        }
      }
      await db.batch(stmts);
      res.json({ id });
    }),
  );
  app.delete("/api/subjects/:id", remove("subjects", "Subject", "subject_id", ["DELETE FROM faculty_subjects WHERE subject_id = ?"]));

  app.post("/api/classes", create("classes"));
  app.put(
    "/api/classes/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("classes", id, "Class");
      const { v } = parse.classes(req.body ?? {}, await loadRefs());
      await db.run("UPDATE classes SET name = ?, dept_id = ?, student_count = ? WHERE id = ?", [v.name, v.dept_id, v.student_count, id]);
      res.json({ id });
    }),
  );
  app.delete("/api/classes/:id", remove("classes", "Class", "class_id"));

  app.post("/api/rooms", create("rooms"));
  app.put(
    "/api/rooms/:id",
    route(async (req, res) => {
      const id = idParam(req);
      await requireRow("rooms", id, "Room");
      const { v } = parse.rooms(req.body ?? {}, await loadRefs());
      await db.run("UPDATE rooms SET name = ?, capacity = ?, is_lab = ? WHERE id = ?", [v.name, v.capacity, v.is_lab, id]);
      res.json({ id });
    }),
  );
  app.delete("/api/rooms/:id", remove("rooms", "Room", "room_id"));

  // ---------- assignments & availability ----------

  app.post(
    "/api/assign-faculty",
    route(async (req, res) => {
      const body = req.body ?? {};
      const facultyId = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
      const subjectId = int(body, "subject_id", "Subject", 1, Number.MAX_SAFE_INTEGER);
      await requireRow("faculty", facultyId, "Faculty member");
      await requireRow("subjects", subjectId, "Subject");
      const r = await db.run("INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)", [facultyId, subjectId]);
      if (r.changes === 0) throw new HttpError(409, "This faculty member is already assigned to the subject.");
      res.status(201).json({ success: true });
    }),
  );

  app.post(
    "/api/faculty-availability",
    route(async (req, res) => {
      const body = req.body ?? {};
      const facultyId = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
      await requireRow("faculty", facultyId, "Faculty member");
      const day = body.day;
      if (typeof day !== "string" || !(ALL_DAYS as readonly string[]).includes(day)) throw new HttpError(400, "Day is not valid.");
      const period = int(body, "period", "Period", 1, MAX_PERIODS_PER_DAY);
      await db.run(
        `INSERT INTO faculty_availability (faculty_id, day, period, is_available) VALUES (?, ?, ?, ?)
         ON CONFLICT(faculty_id, day, period) DO UPDATE SET is_available = excluded.is_available`,
        [facultyId, day, period, bool(body, "is_available") ? 1 : 0],
      );
      res.json({ success: true });
    }),
  );

  // ---------- CSV import ----------

  app.post(
    "/api/upload/:type",
    upload.single("file"),
    route(async (req, res) => {
      const type = req.params.type as UploadType;
      if (!UPLOAD_TYPES.includes(type)) throw new HttpError(400, "Unknown import type.");
      if (!req.file) throw new HttpError(400, "No file uploaded.");

      const rows: Body[] = [];
      await new Promise<void>((resolve, reject) => {
        Readable.from(req.file!.buffer)
          .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^﻿/, "") }))
          .on("data", (row: Body) => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });
      if (rows.length === 0) throw new HttpError(400, "The CSV file has no data rows.");
      if (rows.length > 5000) throw new HttpError(400, "CSV imports are limited to 5000 rows.");

      // Validate every row first, then write the whole file in one transaction.
      const refs = await loadRefs();
      const stmts: Stmt[] = [];
      rows.forEach((row, i) => {
        try {
          stmts.push(parse[type](row, refs).insert);
          if (type === "subjects") stmts.push(...linkNewSubject(optionalFacultyId(row, refs)));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new HttpError(400, `Row ${i + 2}: ${msg}`); // +2: header line and 1-based numbering
        }
      });
      await db.batch(stmts);
      res.json({ success: true, count: rows.length });
    }),
  );

  // ---------- scheduling ----------

  /** Display-only clock times. Changing them does not require regenerating. */
  app.put(
    "/api/settings",
    route(async (req, res) => {
      const body = req.body ?? {};
      const next = { ...(await settings()) };
      if (body.startTime !== undefined) next.startTime = startTime(body);
      if (body.periodMinutes !== undefined) next.periodMinutes = int(body, "periodMinutes", "Period length", 10, 240);
      const [h, m] = next.startTime.split(":").map(Number);
      if (h * 60 + m + next.periodsPerDay * next.periodMinutes > 24 * 60) {
        throw new HttpError(400, "The school day must end before midnight.");
      }
      await db.batch([setMeta("schedule_settings", JSON.stringify(next))]);
      res.json(next);
    }),
  );

  app.post(
    "/api/generate",
    route(async (req, res) => {
      const body = req.body ?? {};
      const current = await settings();
      const workingDays = body.workingDays ?? current.workingDays;
      if (
        !Array.isArray(workingDays) ||
        workingDays.length === 0 ||
        workingDays.some((d) => !(ALL_DAYS as readonly string[]).includes(d)) ||
        new Set(workingDays).size !== workingDays.length
      ) {
        throw new HttpError(400, `workingDays must be a non-empty list of distinct days from: ${ALL_DAYS.join(", ")}.`);
      }
      const periodsPerDay =
        body.periodsPerDay === undefined
          ? current.periodsPerDay
          : int(body, "periodsPerDay", "Periods per day", 1, MAX_PERIODS_PER_DAY);
      const days = ALL_DAYS.filter((d) => workingDays.includes(d));

      const d = await loadAll();
      const { entries, unscheduled } = generateTimetable({
        classes: d.classes,
        subjects: d.subjects,
        rooms: d.rooms,
        facultySubjects: d.faculty_subjects,
        availability: d.faculty_availability,
        workingDays: days,
        periodsPerDay,
      });

      await db.batch([
        { sql: "DELETE FROM timetable_entries" },
        ...entries.map((e) => ({
          sql: "INSERT INTO timetable_entries (class_id, subject_id, faculty_id, room_id, day, period) VALUES (?, ?, ?, ?, ?, ?)",
          args: [e.class_id, e.subject_id, e.faculty_id, e.room_id, e.day, e.period],
        })),
        setMeta("schedule_settings", JSON.stringify({ ...current, workingDays: days, periodsPerDay })),
        setMeta("last_generated_at", new Date().toISOString()),
      ]);

      res.json({ success: true, count: entries.length, unscheduled, conflicts: conflictsFor(await loadAll()) });
    }),
  );

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found.")));

  // ---------- errors ----------

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File is larger than 1 MB." : err.message });
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON." });
    if (e?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
