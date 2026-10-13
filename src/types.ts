export interface Department { id: number; name: string }
export interface Faculty { id: number; name: string; email: string | null; dept_id: number }
export interface Subject { id: number; name: string; code: string; periods_per_week: number; is_lab: number; dept_id: number }
export interface ClassGroup { id: number; name: string; dept_id: number; student_count: number }
export interface Room { id: number; name: string; capacity: number; is_lab: number }
export interface FacultySubject { faculty_id: number; subject_id: number }
export interface FacultyAvailability { faculty_id: number; day: string; period: number; is_available: number }
export interface TimetableEntry {
  id: number;
  class_id: number;
  subject_id: number;
  faculty_id: number;
  room_id: number;
  day: string;
  period: number;
}
export interface Conflict { type: string; message: string; severity: 'high' | 'medium' }
export interface ScheduleSettings { workingDays: string[]; periodsPerDay: number }

export interface AppData {
  departments: Department[];
  faculty: Faculty[];
  subjects: Subject[];
  classes: ClassGroup[];
  rooms: Room[];
  faculty_subjects: FacultySubject[];
  faculty_availability: FacultyAvailability[];
  timetable: TimetableEntry[];
  conflicts: Conflict[];
  settings: ScheduleSettings;
  last_generated_at: string | null;
}

export const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MAX_PERIODS_PER_DAY = 10;

export const EMPTY_DATA: AppData = {
  departments: [],
  faculty: [],
  subjects: [],
  classes: [],
  rooms: [],
  faculty_subjects: [],
  faculty_availability: [],
  timetable: [],
  conflicts: [],
  settings: { workingDays: [...ALL_DAYS], periodsPerDay: 6 },
  last_generated_at: null,
};

export type Page = 'dashboard' | 'departments' | 'faculty' | 'availability' | 'subjects' | 'classes' | 'rooms' | 'timetables';

/** One-shot navigation intents triggered from dashboard quick actions. */
export type Intent = 'new-faculty' | 'new-lab-subject' | 'print-all' | null;
