import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type DB = Database.Database;

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

export interface OpenOptions {
  /** Insert sample departments, faculty, subjects, classes and rooms on first run. */
  seed?: boolean;
}

/**
 * Opens (or creates) the SQLite database, applies the schema and, on first
 * initialisation only, inserts sample data. Deleted sample rows therefore stay
 * deleted across restarts.
 */
export function openDatabase(file: string, { seed = true }: OpenOptions = {}): DB {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  const initialised = db.prepare("SELECT value FROM meta WHERE key = 'initialised'").get();
  if (!initialised) {
    db.transaction(() => {
      const hasData = db.prepare("SELECT 1 FROM departments LIMIT 1").get();
      // Databases created by earlier versions already contain data: never re-seed them.
      if (seed && !hasData) db.exec(SAMPLE_DATA);
      db.prepare("INSERT INTO meta (key, value) VALUES ('initialised', ?)").run(new Date().toISOString());
    })();
  }
  return db;
}
