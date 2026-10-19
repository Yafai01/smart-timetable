# Smart Timetable Pro

A college timetable generator with a React dashboard and an Express + SQLite backend. You enter departments, faculty, subjects, classes and rooms, mark when faculty are available, and the server builds a weekly timetable with a greedy scheduler. It then reports any conflicts or unmet requirements it finds.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)

## Features

- **Master data management**: add departments, faculty, subjects (with periods per week and a lab flag), classes (with student count) and rooms (with capacity and a lab flag).
- **Bulk CSV import**: upload CSV files for departments, faculty, subjects, classes and rooms.
- **Faculty availability**: mark each faculty member as available or unavailable for every day and period.
- **Automatic timetable generation**: a greedy scheduler fills a Monday to Saturday week with 6 periods per day for every class. It respects:
  - faculty, room and class double-booking,
  - faculty availability,
  - lab and theory room types,
  - room capacity against class size.
- **Conflict detection**: flags faculty, room and class double-bookings, rooms too small for a class, and subjects that got fewer periods than they need.
- **Timetable viewer**: shows the generated weekly grid for each class.
- **Seed data**: a sample dataset is inserted on first run so the app works straight away.
- **Faculty-subject assignment**: the API links faculty to subjects. Seed data includes these links, and the scheduler uses the first faculty member assigned to each subject.

## Tech stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion, Lucide icons
- **Backend**: Node.js, Express 4, better-sqlite3, Multer and csv-parser for CSV uploads
- **Dev server**: `tsx` runs `server.ts`, with Vite mounted as middleware

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm

### Install and run

```bash
npm install
npm run dev
```

Then open http://localhost:3001.

The SQLite database (`timetable.db`) is created in the working directory on first start and filled with sample data. CSV uploads are stored briefly in `uploads/`.

### Production build

```bash
npm run build                          # vite build + tsc -> dist/
NODE_ENV=production npm start          # node dist/server.js
```

### Environment variables

`.env.example` comes from the AI Studio template and lists `GEMINI_API_KEY` and `APP_URL`. The current code doesn't use either one, so the app runs without a `.env` file.

## CSV format

Each upload expects a header row with these columns:

| Type        | Columns                                         |
|-------------|-------------------------------------------------|
| departments | `name`                                          |
| faculty     | `name, email, dept_id`                          |
| subjects    | `name, code, periods_per_week, is_lab, dept_id` |
| classes     | `name, dept_id`                                 |
| rooms       | `name, capacity, is_lab`                        |

`is_lab` accepts `true` or `1`.

## Project structure

```
server.ts        Express API, SQLite schema/seed, scheduler, conflict detection
src/App.tsx      Dashboard, data managers, availability grid, timetable viewer
src/main.tsx     React entry point
vite.config.ts   Vite + Tailwind configuration
tsconfig.json    Server compile settings (outputs to dist/)
```

## API overview

| Method | Endpoint                     | Purpose                                                     |
|--------|------------------------------|-------------------------------------------------------------|
| GET    | `/api/data`                  | Return all entities, the current timetable and its conflicts |
| POST   | `/api/departments`, `/api/faculty`, `/api/subjects`, `/api/classes`, `/api/rooms` | Create records |
| POST   | `/api/faculty-availability`  | Set availability for a faculty member, day and period       |
| POST   | `/api/assign-faculty`        | Link a faculty member to a subject                          |
| POST   | `/api/upload/:type`          | Bulk import from CSV                                        |
| POST   | `/api/generate`              | Generate a timetable (`workingDays`, `periodsPerDay`)       |
