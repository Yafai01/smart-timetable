export const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MAX_PERIODS_PER_DAY = 10;

export interface Faculty { id: number; name: string; email?: string | null; dept_id: number | null }
export interface Subject { id: number; name: string; code: string; periods_per_week: number; is_lab: number | boolean; dept_id: number | null }
export interface ClassGroup { id: number; name: string; dept_id: number | null; student_count: number }
export interface Room { id: number; name: string; capacity: number; is_lab: number | boolean }
export interface FacultySubject { faculty_id: number; subject_id: number }
export interface Availability { faculty_id: number; day: string; period: number; is_available: number | boolean }
export interface Entry { class_id: number; subject_id: number; faculty_id: number; room_id: number; day: string; period: number }

export type Severity = "high" | "medium";
export interface Conflict { type: string; message: string; severity: Severity }

export interface Unscheduled {
  class_id: number;
  subject_id: number;
  missing: number;
  reason: "no-faculty" | "no-suitable-room" | "no-free-slot";
}

export interface SchedulerInput {
  classes: ClassGroup[];
  subjects: Subject[];
  rooms: Room[];
  facultySubjects: FacultySubject[];
  availability: Availability[];
  workingDays: string[];
  periodsPerDay: number;
}

const slotKey = (id: number, day: string, period: number) => `${id}|${day}|${period}`;

function unavailableSet(availability: Availability[]): Set<string> {
  const busy = new Set<string>();
  for (const a of availability) {
    if (!a.is_available) busy.add(slotKey(a.faculty_id, a.day, a.period));
  }
  return busy;
}

/** A room suits a subject when the lab/theory type matches and the class fits. */
export function roomSuits(room: Room, subject: Subject, cls: ClassGroup): boolean {
  return Boolean(room.is_lab) === Boolean(subject.is_lab) && room.capacity >= cls.student_count;
}

/**
 * Greedy scheduler. For every class, each subject of the class's department is
 * placed into the first free slots where the class, an assigned faculty member
 * (who is available) and a suitable room are all free. The smallest suitable
 * room is preferred so large rooms stay free for large classes.
 *
 * The result never contains a faculty, room or class double booking, never
 * places a class in a room that is too small or of the wrong type, and never
 * uses a slot a faculty member has marked as unavailable.
 */
export function generateTimetable(input: SchedulerInput): { entries: Entry[]; unscheduled: Unscheduled[] } {
  const { classes, subjects, facultySubjects, workingDays, periodsPerDay } = input;
  const rooms = [...input.rooms].sort((a, b) => a.capacity - b.capacity || a.id - b.id);
  const facultyBusy = unavailableSet(input.availability);
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const entries: Entry[] = [];
  const unscheduled: Unscheduled[] = [];

  for (const cls of classes) {
    for (const sub of subjects.filter((s) => s.dept_id === cls.dept_id)) {
      const facultyIds = facultySubjects
        .filter((fs) => fs.subject_id === sub.id)
        .map((fs) => fs.faculty_id)
        .sort((a, b) => a - b);
      const suitableRooms = rooms.filter((r) => roomSuits(r, sub, cls));

      if (facultyIds.length === 0) {
        unscheduled.push({ class_id: cls.id, subject_id: sub.id, missing: sub.periods_per_week, reason: "no-faculty" });
        continue;
      }
      if (suitableRooms.length === 0) {
        unscheduled.push({ class_id: cls.id, subject_id: sub.id, missing: sub.periods_per_week, reason: "no-suitable-room" });
        continue;
      }

      let remaining = sub.periods_per_week;
      for (const day of workingDays) {
        for (let period = 1; period <= periodsPerDay && remaining > 0; period++) {
          if (classBusy.has(slotKey(cls.id, day, period))) continue;
          const facultyId = facultyIds.find((f) => !facultyBusy.has(slotKey(f, day, period)));
          if (facultyId === undefined) continue;
          const room = suitableRooms.find((r) => !roomBusy.has(slotKey(r.id, day, period)));
          if (!room) continue;

          entries.push({ class_id: cls.id, subject_id: sub.id, faculty_id: facultyId, room_id: room.id, day, period });
          classBusy.add(slotKey(cls.id, day, period));
          facultyBusy.add(slotKey(facultyId, day, period));
          roomBusy.add(slotKey(room.id, day, period));
          remaining--;
        }
        if (remaining <= 0) break;
      }
      if (remaining > 0) {
        unscheduled.push({ class_id: cls.id, subject_id: sub.id, missing: remaining, reason: "no-free-slot" });
      }
    }
  }
  return { entries, unscheduled };
}

export interface ConflictInput {
  entries: Entry[];
  classes: ClassGroup[];
  subjects: Subject[];
  rooms: Room[];
  faculty: Faculty[];
  availability: Availability[];
}

/**
 * Validates a timetable (for example after data was edited following
 * generation) and reports double bookings, capacity/room-type problems,
 * availability violations and unmet weekly period requirements.
 */
export function detectConflicts(input: ConflictInput): Conflict[] {
  const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const classes = byId(input.classes);
  const subjects = byId(input.subjects);
  const rooms = byId(input.rooms);
  const faculty = byId(input.faculty);
  const name = (m: Map<number, { name: string }>, id: number) => m.get(id)?.name ?? `#${id}`;
  const busy = unavailableSet(input.availability);
  const conflicts: Conflict[] = [];

  const facultySeen = new Map<string, Entry>();
  const roomSeen = new Map<string, Entry>();
  const classSeen = new Map<string, Entry>();

  for (const e of input.entries) {
    const when = `${e.day} period ${e.period}`;

    const fKey = slotKey(e.faculty_id, e.day, e.period);
    const fOther = facultySeen.get(fKey);
    if (fOther) {
      conflicts.push({
        type: "Faculty double booking",
        severity: "high",
        message: `${name(faculty, e.faculty_id)} is scheduled for both ${name(classes, fOther.class_id)} and ${name(classes, e.class_id)} on ${when}.`,
      });
    } else facultySeen.set(fKey, e);

    const rKey = slotKey(e.room_id, e.day, e.period);
    const rOther = roomSeen.get(rKey);
    if (rOther) {
      conflicts.push({
        type: "Room double booking",
        severity: "high",
        message: `${name(rooms, e.room_id)} is booked by both ${name(classes, rOther.class_id)} and ${name(classes, e.class_id)} on ${when}.`,
      });
    } else roomSeen.set(rKey, e);

    const cKey = slotKey(e.class_id, e.day, e.period);
    const cOther = classSeen.get(cKey);
    if (cOther) {
      conflicts.push({
        type: "Class double booking",
        severity: "high",
        message: `${name(classes, e.class_id)} has both ${name(subjects, cOther.subject_id)} and ${name(subjects, e.subject_id)} on ${when}.`,
      });
    } else classSeen.set(cKey, e);

    if (busy.has(fKey)) {
      conflicts.push({
        type: "Faculty unavailable",
        severity: "high",
        message: `${name(faculty, e.faculty_id)} is marked unavailable on ${when} but is scheduled to teach ${name(classes, e.class_id)}.`,
      });
    }

    const room = rooms.get(e.room_id);
    const cls = classes.get(e.class_id);
    const sub = subjects.get(e.subject_id);
    if (room && cls && cls.student_count > room.capacity) {
      conflicts.push({
        type: "Capacity conflict",
        severity: "medium",
        message: `${room.name} (capacity ${room.capacity}) is too small for ${cls.name} (${cls.student_count} students) on ${when}.`,
      });
    }
    if (room && sub && Boolean(room.is_lab) !== Boolean(sub.is_lab)) {
      conflicts.push({
        type: "Room type mismatch",
        severity: "medium",
        message: `${sub.name} is a ${sub.is_lab ? "lab" : "theory"} subject but is scheduled in ${room.name} on ${when}.`,
      });
    }
  }

  for (const cls of input.classes) {
    for (const sub of input.subjects.filter((s) => s.dept_id === cls.dept_id)) {
      const scheduled = input.entries.filter((e) => e.class_id === cls.id && e.subject_id === sub.id).length;
      if (scheduled < sub.periods_per_week) {
        conflicts.push({
          type: "Unmet requirement",
          severity: "medium",
          message: `${cls.name}: ${sub.name} needs ${sub.periods_per_week} periods per week, ${scheduled} scheduled.`,
        });
      }
    }
  }
  return conflicts;
}
