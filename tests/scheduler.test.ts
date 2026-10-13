import { describe, expect, it } from "vitest";
import {
  detectConflicts,
  generateTimetable,
  type ClassGroup,
  type Entry,
  type Faculty,
  type Room,
  type Subject,
} from "../server/scheduler";

const faculty: Faculty[] = [
  { id: 1, name: "Turing", dept_id: 1 },
  { id: 2, name: "Hopper", dept_id: 1 },
];
const subjects: Subject[] = [
  { id: 1, name: "AI", code: "CS101", periods_per_week: 3, is_lab: 0, dept_id: 1 },
  { id: 2, name: "AI Lab", code: "CS101L", periods_per_week: 2, is_lab: 1, dept_id: 1 },
];
const classes: ClassGroup[] = [
  { id: 1, name: "CS A", dept_id: 1, student_count: 40 },
  { id: 2, name: "CS B", dept_id: 1, student_count: 40 },
];
const rooms: Room[] = [
  { id: 1, name: "Room 101", capacity: 60, is_lab: 0 },
  { id: 2, name: "Room 102", capacity: 60, is_lab: 0 },
  { id: 3, name: "Lab A", capacity: 40, is_lab: 1 },
];
const days = ["Monday", "Tuesday", "Wednesday"];

const base = {
  classes,
  subjects,
  rooms,
  facultySubjects: [
    { faculty_id: 1, subject_id: 1 },
    { faculty_id: 2, subject_id: 2 },
  ],
  availability: [],
  workingDays: days,
  periodsPerDay: 4,
};

function keysUnique(entries: Entry[], pick: (e: Entry) => number) {
  const keys = entries.map((e) => `${pick(e)}|${e.day}|${e.period}`);
  return new Set(keys).size === keys.length;
}

describe("generateTimetable", () => {
  it("schedules every required period without double bookings", () => {
    const { entries, unscheduled } = generateTimetable(base);
    expect(unscheduled).toEqual([]);
    expect(entries).toHaveLength(2 * (3 + 2));
    expect(keysUnique(entries, (e) => e.faculty_id)).toBe(true);
    expect(keysUnique(entries, (e) => e.room_id)).toBe(true);
    expect(keysUnique(entries, (e) => e.class_id)).toBe(true);
    expect(detectConflicts({ entries, classes, subjects, rooms, faculty, availability: [] })).toEqual([]);
  });

  it("never double-books a teacher, even with spare rooms", () => {
    // Both classes need the same single teacher; 2 days x 1 period = only 2 teacher slots for 6 periods.
    const { entries, unscheduled } = generateTimetable({
      ...base,
      subjects: [subjects[0]],
      workingDays: ["Monday", "Tuesday"],
      periodsPerDay: 1,
    });
    expect(entries).toHaveLength(2);
    expect(keysUnique(entries, (e) => e.faculty_id)).toBe(true);
    expect(unscheduled.reduce((n, u) => n + u.missing, 0)).toBe(4);
    expect(unscheduled.every((u) => u.reason === "no-free-slot")).toBe(true);
  });

  it("never double-books a room", () => {
    // Two teachers but only one theory room.
    const { entries } = generateTimetable({
      ...base,
      subjects: [subjects[0], { ...subjects[0], id: 3, name: "DS", code: "CS102" }],
      rooms: [rooms[0]],
      facultySubjects: [
        { faculty_id: 1, subject_id: 1 },
        { faculty_id: 2, subject_id: 3 },
      ],
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(keysUnique(entries, (e) => e.room_id)).toBe(true);
  });

  it("does not put a class in a room that is too small", () => {
    const big = { ...classes[0], student_count: 50 };
    const { entries, unscheduled } = generateTimetable({ ...base, classes: [big] });
    // Lab A (40 seats) is the only lab, so the lab subject cannot be placed.
    expect(entries.some((e) => e.room_id === 3)).toBe(false);
    expect(unscheduled).toEqual([{ class_id: 1, subject_id: 2, missing: 2, reason: "no-suitable-room" }]);
  });

  it("prefers the smallest room that fits", () => {
    const { entries } = generateTimetable({
      ...base,
      classes: [classes[0]],
      subjects: [subjects[0]],
      rooms: [{ id: 9, name: "Hall", capacity: 300, is_lab: 0 }, rooms[0]],
    });
    expect(new Set(entries.map((e) => e.room_id))).toEqual(new Set([1]));
  });

  it("matches lab subjects to lab rooms and theory subjects to classrooms", () => {
    const { entries } = generateTimetable(base);
    for (const e of entries) {
      const room = rooms.find((r) => r.id === e.room_id)!;
      const sub = subjects.find((s) => s.id === e.subject_id)!;
      expect(Boolean(room.is_lab)).toBe(Boolean(sub.is_lab));
    }
  });

  it("respects faculty unavailability", () => {
    const availability = days.flatMap((day) => [1, 2].map((period) => ({ faculty_id: 1, day, period, is_available: 0 })));
    const { entries } = generateTimetable({ ...base, availability });
    expect(entries.filter((e) => e.faculty_id === 1).every((e) => e.period > 2)).toBe(true);
  });

  it("reports subjects with no assigned faculty", () => {
    const { unscheduled } = generateTimetable({ ...base, facultySubjects: [{ faculty_id: 1, subject_id: 1 }] });
    expect(unscheduled.filter((u) => u.reason === "no-faculty")).toHaveLength(2);
  });
});

describe("detectConflicts", () => {
  const entry = (e: Partial<Entry>): Entry => ({ class_id: 1, subject_id: 1, faculty_id: 1, room_id: 1, day: "Monday", period: 1, ...e });
  const check = (entries: Entry[], extra: Partial<Parameters<typeof detectConflicts>[0]> = {}) =>
    detectConflicts({
      entries,
      classes,
      subjects: [{ ...subjects[0], periods_per_week: 1 }],
      rooms,
      faculty,
      availability: [],
      ...extra,
    });
  const types = (c: { type: string }[]) => c.map((x) => x.type);

  it("detects a teacher booked twice in the same slot", () => {
    const c = check([entry({}), entry({ class_id: 2, room_id: 2 })]);
    expect(types(c)).toEqual(["Faculty double booking"]);
    expect(c[0].severity).toBe("high");
  });

  it("detects a room booked twice in the same slot", () => {
    const c = check([entry({}), entry({ class_id: 2, faculty_id: 2 })]);
    expect(types(c)).toEqual(["Room double booking"]);
  });

  it("detects a class booked twice in the same slot", () => {
    const c = check([entry({}), entry({ faculty_id: 2, room_id: 2 }), entry({ class_id: 2, faculty_id: 2, room_id: 2, period: 2 })]);
    expect(types(c)).toContain("Class double booking");
  });

  it("detects a class that exceeds room capacity", () => {
    const c = check([entry({}), entry({ class_id: 2, room_id: 2, faculty_id: 2 })], {
      rooms: [{ ...rooms[0], capacity: 30 }, rooms[1]],
    });
    expect(types(c)).toEqual(["Capacity conflict"]);
    expect(c[0].message).toContain("Room 101");
  });

  it("detects a teacher scheduled in a slot marked unavailable", () => {
    const c = check([entry({}), entry({ class_id: 2, room_id: 2, faculty_id: 2 })], {
      availability: [{ faculty_id: 1, day: "Monday", period: 1, is_available: 0 }],
    });
    expect(types(c)).toEqual(["Faculty unavailable"]);
  });

  it("detects unmet weekly period requirements", () => {
    const c = check([entry({})]);
    expect(types(c)).toEqual(["Unmet requirement"]);
    expect(c[0].message).toContain("CS B");
  });

  it("reports nothing for a valid timetable", () => {
    expect(check([entry({}), entry({ class_id: 2, room_id: 2, faculty_id: 2 })])).toEqual([]);
  });
});
