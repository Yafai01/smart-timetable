import { ALL_DAYS, type AppData, type ScheduleSettings, type TimetableEntry } from './types';

// ---------- clock times ----------

export interface PeriodTime {
  period: number;
  start: string; // HH:MM
  end: string;
  startMin: number; // minutes since midnight
  endMin: number;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function periodTimes(s: ScheduleSettings): PeriodTime[] {
  const first = toMinutes(s.startTime);
  return Array.from({ length: s.periodsPerDay }, (_, i) => {
    const startMin = first + i * s.periodMinutes;
    const endMin = startMin + s.periodMinutes;
    return { period: i + 1, start: hhmm(startMin), end: hhmm(endMin), startMin, endMin };
  });
}

/** Today's weekday name when it is a working day, else null. */
export function todayName(now: Date, workingDays: string[]): string | null {
  const name = ['Sunday', ...ALL_DAYS][now.getDay()];
  return workingDays.includes(name) ? name : null;
}

// ---------- subject colours ----------

export const TONE_COUNT = 8;

/** Stable colour index per subject, assigned in id order so neighbours differ. */
export function subjectTones(data: AppData): Map<number, number> {
  return new Map([...data.subjects].sort((a, b) => a.id - b.id).map((s, i) => [s.id, i % TONE_COUNT]));
}

// ---------- lookups ----------

export function lookups(data: AppData) {
  const by = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  return {
    subject: by(data.subjects),
    faculty: by(data.faculty),
    room: by(data.rooms),
    cls: by(data.classes),
  };
}

/** Conflicts keyed by entry id, highest severity first. */
export function conflictsByEntry(data: AppData) {
  const map = new Map<number, AppData['conflicts']>();
  for (const c of data.conflicts) {
    for (const id of c.entry_ids ?? []) map.set(id, [...(map.get(id) ?? []), c]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
  return map;
}

// ---------- export ----------

const dayIndex = (d: string) => ALL_DAYS.indexOf(d);
const sortEntries = (rows: TimetableEntry[]) => [...rows].sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.period - b.period);

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'timetable';

const csvCell = (v: string | number) => {
  const s = String(v);
  // Quote when needed; prefix formula-like cells so spreadsheets do not execute them.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function exportCsv(data: AppData, entries: TimetableEntry[], filename: string) {
  const L = lookups(data);
  const times = new Map(periodTimes(data.settings).map((t) => [t.period, t]));
  const rows = [
    ['Day', 'Period', 'Start', 'End', 'Class', 'Subject code', 'Subject', 'Type', 'Teacher', 'Room'],
    ...sortEntries(entries).map((e) => {
      const sub = L.subject.get(e.subject_id);
      const t = times.get(e.period);
      return [
        e.day,
        e.period,
        t?.start ?? '',
        t?.end ?? '',
        L.cls.get(e.class_id)?.name ?? '',
        sub?.code ?? '',
        sub?.name ?? '',
        sub?.is_lab ? 'Lab' : 'Theory',
        L.faculty.get(e.faculty_id)?.name ?? '',
        L.room.get(e.room_id)?.name ?? '',
      ];
    }),
  ];
  download(`${filename}.csv`, 'text/csv;charset=utf-8', '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d: Date, min: number) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;
/** RFC 5545: fold lines longer than 75 octets (approximated by characters). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

/**
 * Weekly recurring events starting this week. Times are "floating" (no time
 * zone), so they show at the same clock time wherever the calendar is.
 */
export function exportIcs(data: AppData, entries: TimetableEntry[], calendarName: string, filename: string, now = new Date()) {
  const L = lookups(data);
  const times = new Map(periodTimes(data.settings).map((t) => [t.period, t]));
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart Timetable//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsText(calendarName)}`,
  ];
  for (const e of sortEntries(entries)) {
    const t = times.get(e.period);
    const sub = L.subject.get(e.subject_id);
    if (!t || !sub) continue;
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex(e.day));
    const teacher = L.faculty.get(e.faculty_id)?.name ?? '';
    const cls = L.cls.get(e.class_id)?.name ?? '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:entry-${e.id}-${slug(calendarName)}@smart-timetable`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(date, t.startMin)}`,
      `DTEND:${icsDate(date, t.endMin)}`,
      'RRULE:FREQ=WEEKLY',
      `SUMMARY:${icsText(`${sub.code} ${sub.name}`)}`,
      `LOCATION:${icsText(L.room.get(e.room_id)?.name ?? '')}`,
      `DESCRIPTION:${icsText(`${cls} · ${teacher}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  download(`${filename}.ics`, 'text/calendar;charset=utf-8', lines.map(fold).join('\r\n') + '\r\n');
}
