import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: 'uploads/' });
const db = new Database("timetable.db");

// Initialize Database
db.exec(`
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

  -- Seed Data
  INSERT OR IGNORE INTO departments (id, name) VALUES (1, 'Computer Science');
  INSERT OR IGNORE INTO departments (id, name) VALUES (2, 'Information Technology');

  INSERT OR IGNORE INTO faculty (id, name, email, dept_id) VALUES (1, 'Dr. Alan Turing', 'alan@college.edu', 1);
  INSERT OR IGNORE INTO faculty (id, name, email, dept_id) VALUES (2, 'Grace Hopper', 'grace@college.edu', 1);
  INSERT OR IGNORE INTO faculty (id, name, email, dept_id) VALUES (3, 'Ada Lovelace', 'ada@college.edu', 2);

  INSERT OR IGNORE INTO subjects (id, name, code, periods_per_week, is_lab, dept_id) VALUES (1, 'Artificial Intelligence', 'CS101', 4, 0, 1);
  INSERT OR IGNORE INTO subjects (id, name, code, periods_per_week, is_lab, dept_id) VALUES (2, 'Data Structures', 'CS102', 3, 0, 1);
  INSERT OR IGNORE INTO subjects (id, name, code, periods_per_week, is_lab, dept_id) VALUES (3, 'AI Lab', 'CS101L', 2, 1, 1);
  INSERT OR IGNORE INTO subjects (id, name, code, periods_per_week, is_lab, dept_id) VALUES (4, 'Web Development', 'IT201', 4, 0, 2);

  INSERT OR IGNORE INTO classes (id, name, dept_id, student_count) VALUES (1, 'CS Year 1', 1, 45);
  INSERT OR IGNORE INTO classes (id, name, dept_id, student_count) VALUES (2, 'IT Year 1', 2, 35);

  INSERT OR IGNORE INTO rooms (id, name, capacity, is_lab) VALUES (1, 'Room 101', 60, 0);
  INSERT OR IGNORE INTO rooms (id, name, capacity, is_lab) VALUES (2, 'Room 102', 60, 0);
  INSERT OR IGNORE INTO rooms (id, name, capacity, is_lab) VALUES (3, 'Lab A', 30, 1);

  INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (1, 1);
  INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (1, 3);
  INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (2, 2);
  INSERT OR IGNORE INTO faculty_subjects (faculty_id, subject_id) VALUES (3, 4);
`);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Conflict Detection Logic
  const getConflicts = () => {
    const entries = db.prepare(`
      SELECT t.*, c.name as class_name, f.name as faculty_name, r.name as room_name, s.name as subject_name
      FROM timetable_entries t
      JOIN classes c ON t.class_id = c.id
      JOIN faculty f ON t.faculty_id = f.id
      JOIN rooms r ON t.room_id = r.id
      JOIN subjects s ON t.subject_id = s.id
    `).all();

    const conflicts: any[] = [];

    // 1. Check for Faculty Double Booking
    const facultyMap = new Map();
    entries.forEach((e: any) => {
      const key = `${e.faculty_id}-${e.day}-${e.period}`;
      if (facultyMap.has(key)) {
        const other = facultyMap.get(key);
        conflicts.push({
          type: 'Faculty Double Booking',
          message: `${e.faculty_name} is scheduled for both ${e.class_name} (${e.subject_name}) and ${other.class_name} (${other.subject_name}) on ${e.day} Period ${e.period}`,
          severity: 'high'
        });
      }
      facultyMap.set(key, e);
    });

    // 2. Check for Room Double Booking
    const roomMap = new Map();
    entries.forEach((e: any) => {
      const key = `${e.room_id}-${e.day}-${e.period}`;
      if (roomMap.has(key)) {
        const other = roomMap.get(key);
        conflicts.push({
          type: 'Room Double Booking',
          message: `${e.room_name} is occupied by both ${e.class_name} and ${other.class_name} on ${e.day} Period ${e.period}`,
          severity: 'high'
        });
      }
      roomMap.set(key, e);
    });

    // 3. Check for Class Double Booking
    const classMap = new Map();
    entries.forEach((e: any) => {
      const key = `${e.class_id}-${e.day}-${e.period}`;
      if (classMap.has(key)) {
        const other = classMap.get(key);
        conflicts.push({
          type: 'Class Double Booking',
          message: `${e.class_name} has two subjects scheduled at the same time: ${e.subject_name} and ${other.subject_name} on ${e.day} Period ${e.period}`,
          severity: 'high'
        });
      }
      classMap.set(key, e);
    });

    // 4. Check for Unmet Period Requirements
    const subjects = db.prepare("SELECT * FROM subjects").all();
    const classes = db.prepare("SELECT * FROM classes").all();
    const rooms = db.prepare("SELECT * FROM rooms").all();
    
    classes.forEach((cls: any) => {
      const classSubjects = subjects.filter((s: any) => s.dept_id === cls.dept_id);
      classSubjects.forEach((sub: any) => {
        const scheduled = entries.filter((e: any) => e.class_id === cls.id && e.subject_id === sub.id).length;
        if (scheduled < sub.periods_per_week) {
          conflicts.push({
            type: 'Unmet Requirement',
            message: `${cls.name}: ${sub.name} requires ${sub.periods_per_week} periods, but only ${scheduled} were scheduled.`,
            severity: 'medium'
          });
        }
      });
    });

    // 5. Check for Room Capacity Conflicts
    entries.forEach((e: any) => {
      const room = rooms.find((r: any) => r.id === e.room_id);
      const cls = classes.find((c: any) => c.id === e.class_id);
      if (room && cls && cls.student_count > room.capacity) {
        conflicts.push({
          type: 'Capacity Conflict',
          message: `${room.name} (Cap: ${room.capacity}) is too small for ${cls.name} (Students: ${cls.student_count})`,
          severity: 'medium'
        });
      }
    });

    return conflicts;
  };

  // API Routes
  app.get("/api/data", (req, res) => {
    const departments = db.prepare("SELECT * FROM departments").all();
    const faculty = db.prepare("SELECT * FROM faculty").all();
    const subjects = db.prepare("SELECT * FROM subjects").all();
    const classes = db.prepare("SELECT * FROM classes").all();
    const rooms = db.prepare("SELECT * FROM rooms").all();
    const faculty_subjects = db.prepare("SELECT * FROM faculty_subjects").all();
    const faculty_availability = db.prepare("SELECT * FROM faculty_availability").all();
    const timetable = db.prepare("SELECT * FROM timetable_entries").all();
    const conflicts = getConflicts();

    res.json({ departments, faculty, subjects, classes, rooms, faculty_subjects, faculty_availability, timetable, conflicts });
  });

  app.post("/api/faculty-availability", (req, res) => {
    const { faculty_id, day, period, is_available } = req.body;
    db.prepare(`
      INSERT INTO faculty_availability (faculty_id, day, period, is_available)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(faculty_id, day, period) DO UPDATE SET is_available = excluded.is_available
    `).run(faculty_id, day, period, is_available ? 1 : 0);
    res.json({ success: true });
  });

  app.post("/api/departments", (req, res) => {
    const { name } = req.body;
    const info = db.prepare("INSERT INTO departments (name) VALUES (?)").run(name);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/faculty", (req, res) => {
    const { name, email, dept_id } = req.body;
    const info = db.prepare("INSERT INTO faculty (name, email, dept_id) VALUES (?, ?, ?)").run(name, email, dept_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/subjects", (req, res) => {
    const { name, code, periods_per_week, is_lab, dept_id } = req.body;
    const info = db.prepare("INSERT INTO subjects (name, code, periods_per_week, is_lab, dept_id) VALUES (?, ?, ?, ?, ?)")
      .run(name, code, periods_per_week, is_lab ? 1 : 0, dept_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/classes", (req, res) => {
    const { name, dept_id, student_count } = req.body;
    const info = db.prepare("INSERT INTO classes (name, dept_id, student_count) VALUES (?, ?, ?)").run(name, dept_id, student_count);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/rooms", (req, res) => {
    const { name, capacity, is_lab } = req.body;
    const info = db.prepare("INSERT INTO rooms (name, capacity, is_lab) VALUES (?, ?, ?)").run(name, capacity, is_lab ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/upload/:type", upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const type = req.params.type;
    const results: any[] = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          db.transaction(() => {
            for (const row of results) {
              if (type === 'departments') {
                db.prepare("INSERT INTO departments (name) VALUES (?)").run(row.name);
              } else if (type === 'faculty') {
                db.prepare("INSERT INTO faculty (name, email, dept_id) VALUES (?, ?, ?)").run(row.name, row.email, row.dept_id);
              } else if (type === 'subjects') {
                db.prepare("INSERT INTO subjects (name, code, periods_per_week, is_lab, dept_id) VALUES (?, ?, ?, ?, ?)")
                  .run(row.name, row.code, parseInt(row.periods_per_week), row.is_lab === 'true' || row.is_lab === '1' ? 1 : 0, row.dept_id);
              } else if (type === 'classes') {
                db.prepare("INSERT INTO classes (name, dept_id) VALUES (?, ?)").run(row.name, row.dept_id);
              } else if (type === 'rooms') {
                db.prepare("INSERT INTO rooms (name, capacity, is_lab) VALUES (?, ?, ?)")
                  .run(row.name, parseInt(row.capacity), row.is_lab === 'true' || row.is_lab === '1' ? 1 : 0);
              }
            }
          })();
          fs.unlinkSync(req.file.path);
          res.json({ success: true, count: results.length });
        } catch (err: any) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          res.status(500).json({ error: err.message });
        }
      });
  });

  app.post("/api/assign-faculty", (req, res) => {
    const { faculty_id, subject_id } = req.body;
    try {
      db.prepare("INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)").run(faculty_id, subject_id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already assigned" });
    }
  });

  // Scheduling Algorithm
  app.post("/api/generate", (req, res) => {
    const { workingDays, periodsPerDay } = req.body;
    
    const classes = db.prepare("SELECT * FROM classes").all();
    const subjects = db.prepare("SELECT * FROM subjects").all();
    const rooms = db.prepare("SELECT * FROM rooms").all();
    const faculty = db.prepare("SELECT * FROM faculty").all();
    const faculty_subjects = db.prepare("SELECT * FROM faculty_subjects").all();
    const faculty_availability = db.prepare("SELECT * FROM faculty_availability").all();

    // Clear existing timetable
    db.prepare("DELETE FROM timetable_entries").run();

    const timetable: any[] = [];
    const facultyBusy = new Set(); // "facultyId-day-period"
    const roomBusy = new Set();    // "roomId-day-period"
    const classBusy = new Set();   // "classId-day-period"

    // Helper to check if faculty is available
    const isFacultyAvailable = (facultyId: number, day: string, period: number) => {
      const record = faculty_availability.find((fa: any) => fa.faculty_id === facultyId && fa.day === day && fa.period === period);
      return record ? record.is_available === 1 : true; // Default to available if no record
    };

    // Helper to find faculty for a subject
    const getFacultyForSubject = (subjectId: number) => {
      const assignments = faculty_subjects.filter((fs: any) => fs.subject_id === subjectId);
      return assignments.length > 0 ? assignments[0].faculty_id : null;
    };

    // Simple Greedy Algorithm
    for (const cls of classes) {
      const classSubjects = subjects.filter((s: any) => s.dept_id === cls.dept_id);
      
      for (const sub of classSubjects) {
        let periodsRemaining = sub.periods_per_week;
        const facultyId = getFacultyForSubject(sub.id);
        if (!facultyId) continue;

        // Try to find slots
        for (const day of workingDays) {
          for (let p = 1; p <= periodsPerDay; p++) {
            if (periodsRemaining <= 0) break;

            const facultyKey = `${facultyId}-${day}-${p}`;
            const roomKeyPrefix = `${day}-${p}`;
            const classKey = `${cls.id}-${day}-${p}`;

            if (!facultyBusy.has(facultyKey) && !classBusy.has(classKey) && isFacultyAvailable(facultyId, day, p)) {
              // Find an available room
              const availableRoom = rooms.find((r: any) => {
                if (sub.is_lab && !r.is_lab) return false;
                if (!sub.is_lab && r.is_lab) return false;
                if (r.capacity < cls.student_count) return false;
                return !roomBusy.has(`${r.id}-${roomKeyPrefix}`);
              });

              if (availableRoom) {
                // Assign
                const entry = {
                  class_id: cls.id,
                  subject_id: sub.id,
                  faculty_id: facultyId,
                  room_id: availableRoom.id,
                  day,
                  period: p
                };
                
                timetable.push(entry);
                facultyBusy.add(facultyKey);
                roomBusy.add(`${availableRoom.id}-${roomKeyPrefix}`);
                classBusy.add(classKey);
                periodsRemaining--;
              }
            }
          }
          if (periodsRemaining <= 0) break;
        }
      }
    }

    // Batch insert
    const insert = db.prepare("INSERT INTO timetable_entries (class_id, subject_id, faculty_id, room_id, day, period) VALUES (?, ?, ?, ?, ?, ?)");
    const insertMany = db.transaction((entries) => {
      for (const e of entries) insert.run(e.class_id, e.subject_id, e.faculty_id, e.room_id, e.day, e.period);
    });
    insertMany(timetable);

    const conflicts = getConflicts();
    res.json({ success: true, count: timetable.length, conflicts });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
