import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { createApp } from "../server/app";
import { openDatabase, type DB } from "../server/db";

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:", { seed: true });
  app = createApp(db);
});

const data = async () => (await request(app).get("/api/data").expect(200)).body;

describe("database bootstrap", () => {
  it("seeds sample data on first initialisation", async () => {
    const d = await data();
    expect(d.departments).toHaveLength(2);
    expect(d.rooms).toHaveLength(3);
  });

  it("does not re-seed rows the user deleted after a restart", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "timetable-"));
    const file = path.join(dir, "test.db");
    try {
      const first = openDatabase(file);
      first.prepare("DELETE FROM faculty_subjects WHERE subject_id = 3").run();
      first.prepare("DELETE FROM subjects WHERE id = 3").run();
      first.close();
      const second = openDatabase(file);
      expect(second.prepare("SELECT 1 FROM subjects WHERE id = 3").get()).toBeUndefined();
      expect((second.prepare("SELECT COUNT(*) AS n FROM subjects").get() as { n: number }).n).toBe(3);
      second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can start empty", async () => {
    const empty = createApp(openDatabase(":memory:", { seed: false }));
    const res = await request(empty).get("/api/data").expect(200);
    expect(res.body.departments).toEqual([]);
  });
});

describe("departments", () => {
  it("creates, renames and deletes", async () => {
    const { body } = await request(app).post("/api/departments").send({ name: "Mathematics" }).expect(201);
    await request(app).put(`/api/departments/${body.id}`).send({ name: "Applied Maths" }).expect(200);
    expect((await data()).departments.find((d: { id: number }) => d.id === body.id).name).toBe("Applied Maths");
    await request(app).delete(`/api/departments/${body.id}`).expect(200);
    expect((await data()).departments.some((d: { id: number }) => d.id === body.id)).toBe(false);
  });

  it("rejects a blank name", async () => {
    const res = await request(app).post("/api/departments").send({ name: "   " }).expect(400);
    expect(res.body.error).toMatch(/required/);
  });

  it("refuses to delete a department that is still in use", async () => {
    const res = await request(app).delete("/api/departments/1").expect(409);
    expect(res.body.error).toMatch(/faculty/);
  });

  it("returns 404 for unknown ids", async () => {
    await request(app).put("/api/departments/999").send({ name: "X" }).expect(404);
    await request(app).delete("/api/departments/999").expect(404);
    await request(app).delete("/api/departments/abc").expect(400);
  });
});

describe("faculty", () => {
  it("validates email and department", async () => {
    await request(app).post("/api/faculty").send({ name: "A", email: "not-an-email", dept_id: 1 }).expect(400);
    await request(app).post("/api/faculty").send({ name: "A", email: "a@b.edu", dept_id: 99 }).expect(400);
    await request(app).post("/api/faculty").send({ name: "A", email: "a@b.edu", dept_id: 1 }).expect(201);
  });

  it("updates a faculty member", async () => {
    await request(app).put("/api/faculty/2").send({ name: "Rear Adm. Grace Hopper", email: "grace@college.edu", dept_id: 2 }).expect(200);
    const f = (await data()).faculty.find((x: { id: number }) => x.id === 2);
    expect(f).toMatchObject({ name: "Rear Adm. Grace Hopper", dept_id: 2 });
  });

  it("deleting a faculty member removes their assignments and timetable entries", async () => {
    await request(app).post("/api/generate").send({}).expect(200);
    const res = await request(app).delete("/api/faculty/1").expect(200);
    expect(res.body.removedEntries).toBeGreaterThan(0);
    const d = await data();
    expect(d.timetable.some((t: { faculty_id: number }) => t.faculty_id === 1)).toBe(false);
    expect(d.faculty_subjects.some((t: { faculty_id: number }) => t.faculty_id === 1)).toBe(false);
  });
});

describe("subjects", () => {
  it("creates a subject with an assigned teacher and can reassign it", async () => {
    const { body } = await request(app)
      .post("/api/subjects")
      .send({ name: "Networks", code: "CS201", periods_per_week: 2, is_lab: false, dept_id: 1, faculty_id: 2 })
      .expect(201);
    let d = await data();
    expect(d.faculty_subjects).toContainEqual({ faculty_id: 2, subject_id: body.id });

    await request(app)
      .put(`/api/subjects/${body.id}`)
      .send({ name: "Networks", code: "CS201", periods_per_week: 2, is_lab: false, dept_id: 1, faculty_id: 1 })
      .expect(200);
    d = await data();
    expect(d.faculty_subjects.filter((x: { subject_id: number }) => x.subject_id === body.id)).toEqual([
      { faculty_id: 1, subject_id: body.id },
    ]);
  });

  it("rejects an invalid periods-per-week value", async () => {
    await request(app).post("/api/subjects").send({ name: "X", code: "X1", periods_per_week: 0, dept_id: 1 }).expect(400);
    await request(app).post("/api/subjects").send({ name: "X", code: "X1", periods_per_week: 2.5, dept_id: 1 }).expect(400);
  });

  it("deletes a subject", async () => {
    await request(app).delete("/api/subjects/2").expect(200);
    expect((await data()).subjects.some((s: { id: number }) => s.id === 2)).toBe(false);
  });
});

describe("classes and rooms", () => {
  it("validates student count and capacity", async () => {
    await request(app).post("/api/classes").send({ name: "C", dept_id: 1, student_count: -5 }).expect(400);
    await request(app).post("/api/rooms").send({ name: "R", capacity: "lots" }).expect(400);
    await request(app).post("/api/rooms").send({ name: "R", capacity: 20, is_lab: true }).expect(201);
  });

  it("updates and deletes a class", async () => {
    await request(app).put("/api/classes/2").send({ name: "IT Year 1", dept_id: 2, student_count: 50 }).expect(200);
    expect((await data()).classes.find((c: { id: number }) => c.id === 2).student_count).toBe(50);
    await request(app).delete("/api/classes/2").expect(200);
  });

  it("flags a capacity conflict when a room is shrunk after generation", async () => {
    await request(app).post("/api/generate").send({}).expect(200);
    await request(app).put("/api/rooms/1").send({ name: "Room 101", capacity: 10, is_lab: false }).expect(200);
    const d = await data();
    expect(d.conflicts.some((c: { type: string }) => c.type === "Capacity conflict")).toBe(true);
  });
});

describe("generate", () => {
  it("produces a conflict-free timetable for the sample data", async () => {
    const res = await request(app).post("/api/generate").send({ workingDays: ["Monday", "Tuesday", "Wednesday"], periodsPerDay: 4 }).expect(200);
    expect(res.body.count).toBe(4 + 3 + 2 + 4);
    expect(res.body.conflicts).toEqual([]);
    const d = await data();
    expect(d.settings).toEqual({ workingDays: ["Monday", "Tuesday", "Wednesday"], periodsPerDay: 4 });
    expect(d.last_generated_at).toBeTruthy();
  });

  it("rejects invalid settings", async () => {
    await request(app).post("/api/generate").send({ workingDays: ["Funday"] }).expect(400);
    await request(app).post("/api/generate").send({ periodsPerDay: 0 }).expect(400);
  });
});

describe("availability and CSV import", () => {
  it("validates availability updates", async () => {
    await request(app).post("/api/faculty-availability").send({ faculty_id: 1, day: "Sunday", period: 1, is_available: false }).expect(400);
    await request(app).post("/api/faculty-availability").send({ faculty_id: 1, day: "Monday", period: 1, is_available: false }).expect(200);
  });

  it("imports valid rows and rejects the whole file on a bad row", async () => {
    const good = "name,capacity,is_lab\nRoom 201,40,0\nLab B,30,1\n";
    await request(app).post("/api/upload/rooms").attach("file", Buffer.from(good), "rooms.csv").expect(200);
    expect((await data()).rooms).toHaveLength(5);

    const bad = "name,capacity,is_lab\nRoom 301,40,0\nRoom 302,abc,0\n";
    const res = await request(app).post("/api/upload/rooms").attach("file", Buffer.from(bad), "rooms.csv").expect(400);
    expect(res.body.error).toMatch(/Row 3/);
    expect((await data()).rooms).toHaveLength(5);
  });

  it("rejects unknown import types", async () => {
    await request(app).post("/api/upload/users").attach("file", Buffer.from("name\nx\n"), "x.csv").expect(400);
  });
});

it("returns JSON 404 for unknown API routes", async () => {
  const res = await request(app).get("/api/nope").expect(404);
  expect(res.body.error).toBeTruthy();
});
