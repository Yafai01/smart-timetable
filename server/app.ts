import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import type { DB } from "./db.js";
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

// ---------- app ----------

const UPLOAD_TYPES = ["departments", "faculty", "subjects", "classes", "rooms"] as const;
type UploadType = (typeof UPLOAD_TYPES)[number];

export function createApp(db: DB) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });

  const exists = (table: string, id: number) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id));
  const requireRow = (table: string, id: number, label: string) => {
    if (!exists(table, id)) throw new HttpError(404, `${label} not found.`);
  };
  const deptId = (body: Body) => {
    const id = int(body, "dept_id", "Department", 1, Number.MAX_SAFE_INTEGER);
    if (!exists("departments", id)) throw new HttpError(400, "Selected department does not exist.");
    return id;
  };
  const optionalFacultyId = (body: Body): number | null => {
    const v = body.faculty_id;
    if (v === undefined || v === null || v === "") return null;
    const id = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
    if (!exists("faculty", id)) throw new HttpError(400, "Selected faculty member does not exist.");
    return id;
  };

  // Field parsers shared by JSON endpoints and CSV import.
  const parse = {
    departments: (b: Body) => ({ name: text(b, "name", "Department name") }),
    faculty: (b: Body) => ({ name: text(b, "name", "Name"), email: email(b, "email"), dept_id: deptId(b) }),
    subjects: (b: Body) => ({
      name: text(b, "name", "Subject name"),
      code: text(b, "code", "Subject code", 20),
      periods_per_week: int(b, "periods_per_week", "Periods per week", 1, ALL_DAYS.length * MAX_PERIODS_PER_DAY),
      is_lab: bool(b, "is_lab") ? 1 : 0,
      dept_id: deptId(b),
    }),
    classes: (b: Body) => ({
      name: text(b, "name", "Class name"),
      dept_id: deptId(b),
      student_count: int(b, "student_count", "Student count", 1, 10000),
    }),
    rooms: (b: Body) => ({
      name: text(b, "name", "Room name"),
      capacity: int(b, "capacity", "Capacity", 1, 10000),
      is_lab: bool(b, "is_lab") ? 1 : 0,
    }),
  };

  const insert = {
    departments: (v: ReturnType<typeof parse.departments>) =>
      db.prepare("INSERT INTO departments (name) VALUES (?)").run(v.name).lastInsertRowid,
    faculty: (v: ReturnType<typeof parse.faculty>) =>
      db.prepare("INSERT INTO faculty (name, email, dept_id) VALUES (?, ?, ?)").run(v.name, v.email, v.dept_id).lastInsertRowid,
    subjects: (v: ReturnType<typeof parse.subjects>) =>
      db
        .prepare("INSERT INTO subjects (name, code, periods_per_week, is_lab, dept_id) VALUES (?, ?, ?, ?, ?)")
        .run(v.name, v.code, v.periods_per_week, v.is_lab, v.dept_id).lastInsertRowid,
    classes: (v: ReturnType<typeof parse.classes>) =>
      db.prepare("INSERT INTO classes (name, dept_id, student_count) VALUES (?, ?, ?)").run(v.name, v.dept_id, v.student_count)
        .lastInsertRowid,
    rooms: (v: ReturnType<typeof parse.rooms>) =>
      db.prepare("INSERT INTO rooms (name, capacity, is_lab) VALUES (?, ?, ?)").run(v.name, v.capacity, v.is_lab).lastInsertRowid,
  };

  const setSubjectFaculty = (subjectId: number, facultyId: number | null) => {
    db.prepare("DELETE FROM faculty_subjects WHERE subject_id = ?").run(subjectId);
    if (facultyId !== null) {
      db.prepare("INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)").run(facultyId, subjectId);
    }
  };

  const loadAll = () => ({
    departments: db.prepare("SELECT * FROM departments ORDER BY name").all(),
    faculty: db.prepare("SELECT * FROM faculty ORDER BY name").all() as Faculty[],
    subjects: db.prepare("SELECT * FROM subjects ORDER BY code").all() as Subject[],
    classes: db.prepare("SELECT * FROM classes ORDER BY name").all() as ClassGroup[],
    rooms: db.prepare("SELECT * FROM rooms ORDER BY name").all() as Room[],
    faculty_subjects: db.prepare("SELECT * FROM faculty_subjects").all() as FacultySubject[],
    faculty_availability: db.prepare("SELECT * FROM faculty_availability").all() as Availability[],
    timetable: db.prepare("SELECT * FROM timetable_entries ORDER BY id").all() as (Entry & { id: number })[],
  });

  const getMeta = (key: string) =>
    (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
  const setMeta = (key: string, value: string) =>
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);

  const conflictsFor = (d: ReturnType<typeof loadAll>) =>
    detectConflicts({
      entries: d.timetable,
      classes: d.classes,
      subjects: d.subjects,
      rooms: d.rooms,
      faculty: d.faculty,
      availability: d.faculty_availability,
    });

  const settings = () => {
    const stored = getMeta("schedule_settings");
    const fallback = { workingDays: [...ALL_DAYS], periodsPerDay: 6 };
    return stored ? (JSON.parse(stored) as typeof fallback) : fallback;
  };

  // ---------- read ----------

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/data", (_req, res) => {
    const d = loadAll();
    res.json({
      ...d,
      conflicts: conflictsFor(d),
      settings: settings(),
      last_generated_at: getMeta("last_generated_at"),
    });
  });

  // ---------- create / update / delete ----------

  app.post("/api/departments", (req, res) => {
    res.status(201).json({ id: Number(insert.departments(parse.departments(req.body ?? {}))) });
  });
  app.put("/api/departments/:id", (req, res) => {
    const id = idParam(req);
    requireRow("departments", id, "Department");
    const v = parse.departments(req.body ?? {});
    db.prepare("UPDATE departments SET name = ? WHERE id = ?").run(v.name, id);
    res.json({ id });
  });
  app.delete("/api/departments/:id", (req, res) => {
    const id = idParam(req);
    requireRow("departments", id, "Department");
    const used = ["faculty", "subjects", "classes"].filter((t) => db.prepare(`SELECT 1 FROM ${t} WHERE dept_id = ? LIMIT 1`).get(id));
    if (used.length) {
      throw new HttpError(409, `This department still has ${used.join(", ")}. Move or delete them first.`);
    }
    db.prepare("DELETE FROM departments WHERE id = ?").run(id);
    res.json({ id });
  });

  app.post("/api/faculty", (req, res) => {
    res.status(201).json({ id: Number(insert.faculty(parse.faculty(req.body ?? {}))) });
  });
  app.put("/api/faculty/:id", (req, res) => {
    const id = idParam(req);
    requireRow("faculty", id, "Faculty member");
    const v = parse.faculty(req.body ?? {});
    db.prepare("UPDATE faculty SET name = ?, email = ?, dept_id = ? WHERE id = ?").run(v.name, v.email, v.dept_id, id);
    res.json({ id });
  });
  app.delete("/api/faculty/:id", (req, res) => {
    const id = idParam(req);
    requireRow("faculty", id, "Faculty member");
    const removed = db.transaction(() => {
      const r = db.prepare("DELETE FROM timetable_entries WHERE faculty_id = ?").run(id).changes;
      db.prepare("DELETE FROM faculty_subjects WHERE faculty_id = ?").run(id);
      db.prepare("DELETE FROM faculty_availability WHERE faculty_id = ?").run(id);
      db.prepare("DELETE FROM faculty WHERE id = ?").run(id);
      return r;
    })();
    res.json({ id, removedEntries: removed });
  });

  app.post("/api/subjects", (req, res) => {
    const body = req.body ?? {};
    const v = parse.subjects(body);
    const facultyId = optionalFacultyId(body);
    const id = db.transaction(() => {
      const newId = Number(insert.subjects(v));
      setSubjectFaculty(newId, facultyId);
      return newId;
    })();
    res.status(201).json({ id });
  });
  app.put("/api/subjects/:id", (req, res) => {
    const id = idParam(req);
    requireRow("subjects", id, "Subject");
    const body = req.body ?? {};
    const v = parse.subjects(body);
    const facultyId = optionalFacultyId(body);
    db.transaction(() => {
      db.prepare("UPDATE subjects SET name = ?, code = ?, periods_per_week = ?, is_lab = ?, dept_id = ? WHERE id = ?").run(
        v.name, v.code, v.periods_per_week, v.is_lab, v.dept_id, id,
      );
      if ("faculty_id" in body) setSubjectFaculty(id, facultyId);
    })();
    res.json({ id });
  });
  app.delete("/api/subjects/:id", (req, res) => {
    const id = idParam(req);
    requireRow("subjects", id, "Subject");
    const removed = db.transaction(() => {
      const r = db.prepare("DELETE FROM timetable_entries WHERE subject_id = ?").run(id).changes;
      db.prepare("DELETE FROM faculty_subjects WHERE subject_id = ?").run(id);
      db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
      return r;
    })();
    res.json({ id, removedEntries: removed });
  });

  app.post("/api/classes", (req, res) => {
    res.status(201).json({ id: Number(insert.classes(parse.classes(req.body ?? {}))) });
  });
  app.put("/api/classes/:id", (req, res) => {
    const id = idParam(req);
    requireRow("classes", id, "Class");
    const v = parse.classes(req.body ?? {});
    db.prepare("UPDATE classes SET name = ?, dept_id = ?, student_count = ? WHERE id = ?").run(v.name, v.dept_id, v.student_count, id);
    res.json({ id });
  });
  app.delete("/api/classes/:id", (req, res) => {
    const id = idParam(req);
    requireRow("classes", id, "Class");
    const removed = db.transaction(() => {
      const r = db.prepare("DELETE FROM timetable_entries WHERE class_id = ?").run(id).changes;
      db.prepare("DELETE FROM classes WHERE id = ?").run(id);
      return r;
    })();
    res.json({ id, removedEntries: removed });
  });

  app.post("/api/rooms", (req, res) => {
    res.status(201).json({ id: Number(insert.rooms(parse.rooms(req.body ?? {}))) });
  });
  app.put("/api/rooms/:id", (req, res) => {
    const id = idParam(req);
    requireRow("rooms", id, "Room");
    const v = parse.rooms(req.body ?? {});
    db.prepare("UPDATE rooms SET name = ?, capacity = ?, is_lab = ? WHERE id = ?").run(v.name, v.capacity, v.is_lab, id);
    res.json({ id });
  });
  app.delete("/api/rooms/:id", (req, res) => {
    const id = idParam(req);
    requireRow("rooms", id, "Room");
    const removed = db.transaction(() => {
      const r = db.prepare("DELETE FROM timetable_entries WHERE room_id = ?").run(id).changes;
      db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
      return r;
    })();
    res.json({ id, removedEntries: removed });
  });

  // ---------- assignments & availability ----------

  app.post("/api/assign-faculty", (req, res) => {
    const body = req.body ?? {};
    const facultyId = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
    const subjectId = int(body, "subject_id", "Subject", 1, Number.MAX_SAFE_INTEGER);
    requireRow("faculty", facultyId, "Faculty member");
    requireRow("subjects", subjectId, "Subject");
    const r = db.prepare("INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)").run(facultyId, subjectId);
    if (r.changes === 0) throw new HttpError(409, "This faculty member is already assigned to the subject.");
    res.status(201).json({ success: true });
  });

  app.post("/api/faculty-availability", (req, res) => {
    const body = req.body ?? {};
    const facultyId = int(body, "faculty_id", "Faculty", 1, Number.MAX_SAFE_INTEGER);
    requireRow("faculty", facultyId, "Faculty member");
    const day = body.day;
    if (typeof day !== "string" || !(ALL_DAYS as readonly string[]).includes(day)) throw new HttpError(400, "Day is not valid.");
    const period = int(body, "period", "Period", 1, MAX_PERIODS_PER_DAY);
    db.prepare(
      `INSERT INTO faculty_availability (faculty_id, day, period, is_available) VALUES (?, ?, ?, ?)
       ON CONFLICT(faculty_id, day, period) DO UPDATE SET is_available = excluded.is_available`,
    ).run(facultyId, day, period, bool(body, "is_available") ? 1 : 0);
    res.json({ success: true });
  });

  // ---------- CSV import ----------

  app.post("/api/upload/:type", upload.single("file"), (req, res, next) => {
    importCsv(req, res).catch(next);
  });

  const importCsv = async (req: Request, res: Response) => {
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

    db.transaction(() => {
      rows.forEach((row, i) => {
        try {
          if (type === "subjects") {
            const id = Number(insert.subjects(parse.subjects(row)));
            setSubjectFaculty(id, optionalFacultyId(row));
          } else {
            // Each parser/insert pair is matched by key.
            (insert[type] as (v: unknown) => unknown)(parse[type](row));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new HttpError(400, `Row ${i + 2}: ${msg}`); // +2: header line and 1-based numbering
        }
      });
    })();
    res.json({ success: true, count: rows.length });
  };

  // ---------- scheduling ----------

  app.post("/api/generate", (req, res) => {
    const body = req.body ?? {};
    const current = settings();
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
      body.periodsPerDay === undefined ? current.periodsPerDay : int(body, "periodsPerDay", "Periods per day", 1, MAX_PERIODS_PER_DAY);
    const days = ALL_DAYS.filter((d) => workingDays.includes(d));

    const d = loadAll();
    const { entries, unscheduled } = generateTimetable({
      classes: d.classes,
      subjects: d.subjects,
      rooms: d.rooms,
      facultySubjects: d.faculty_subjects,
      availability: d.faculty_availability,
      workingDays: days,
      periodsPerDay,
    });

    const stmt = db.prepare(
      "INSERT INTO timetable_entries (class_id, subject_id, faculty_id, room_id, day, period) VALUES (?, ?, ?, ?, ?, ?)",
    );
    db.transaction(() => {
      db.prepare("DELETE FROM timetable_entries").run();
      for (const e of entries) stmt.run(e.class_id, e.subject_id, e.faculty_id, e.room_id, e.day, e.period);
      setMeta("schedule_settings", JSON.stringify({ workingDays: days, periodsPerDay }));
      setMeta("last_generated_at", new Date().toISOString());
    })();

    res.json({ success: true, count: entries.length, unscheduled, conflicts: conflictsFor(loadAll()) });
  });

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
