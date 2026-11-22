# Smart Timetable

A self-hosted web app that generates conflict-free weekly timetables for a college from its departments, faculty, subjects, classes and rooms.

## What it does

You enter (or import from CSV) the departments, teachers, subjects, classes and rooms of an institution, mark the periods when individual teachers are unavailable, and generate a weekly timetable. The generator places every subject for every class into free periods without double-booking a teacher, a room or a class. It also respects room capacity, lab/theory room types and teacher availability. A conflict checker then reports anything the timetable still gets wrong, including unmet weekly periods. These problems can also appear when data is edited after generation, for example when a room is made smaller.

## Features

- Create, edit and delete departments, faculty, subjects, classes and rooms, with server-side validation.
- Assign a teacher to each subject.
- CSV import for every entity. An import is all-or-nothing: if any row is invalid, the whole file is rejected and the error names the row.
- Per-teacher weekly availability grid.
- Configurable working days (Monday to Saturday) and periods per day (1 to 10).
- Greedy timetable generator that uses the smallest suitable room for each period.
- Conflict report covering teacher, room and class double bookings, capacity problems, room-type mismatches, availability violations and unmet weekly periods.
- Timetable views by class, by teacher or by room, with clock times, colour-coded subjects, a "today" column and a live "now" line. On phones the week becomes a single-day view with day tabs.
- Conflict badges on the affected timetable cards (red for clashes, amber for capacity, availability or room-type issues).
- Quick filters by day, subject, class, teacher and room.
- Export: print or save as PDF (one timetable or all classes), CSV (one timetable or all classes), and an `.ics` calendar file with weekly recurring events.
- Configurable period clock times (first period start and period length), saved without regenerating.
- Light and dark themes that follow the system setting, with a manual switch.
- Each page has its own URL (`#/timetables`), so refresh and the back button work.
- Dashboard figures computed from your data: periods scheduled compared with periods required, room utilisation, and teacher workload.

## Limitations

- **No authentication.** Anyone who can reach the server can read and change the data. Run it on a trusted network or behind an authenticating reverse proxy.
- The generator is greedy, not an optimiser. It fills the earliest free periods first, so it does not spread a subject evenly across the week. When it cannot place a period, it reports the period as an unmet requirement and does not backtrack.
- Every class takes every subject of its department. Electives and cross-department subjects are not modelled.
- Each subject has one assigned teacher in the UI. The API and the generator accept several teachers per subject.
- Periods are back to back: breaks between periods are not modelled.
- PDF export relies on the browser's "Save as PDF" print destination.

## Tech stack

- **Server:** Node.js, Express 4, libSQL (`@libsql/client`: a local SQLite file, or Turso in production), multer and csv-parser for CSV import
- **Client:** React 19, Vite 6, Tailwind CSS 4, lucide-react icons
- **Tooling:** TypeScript, Vitest and Supertest

## Project structure

```
server.ts            Entry point: env config, Vite dev middleware or static client build
api/index.ts         Vercel serverless entry point (wraps the same Express app)
server/
  app.ts             Express app and REST API (validation, CRUD, CSV import, generation)
  db.ts              SQLite schema, first-run initialisation and sample data
  scheduler.ts       Timetable generator and conflict detection (pure functions)
src/
  App.tsx            Layout, navigation, data loading
  pages/             Dashboard, Departments, Faculty, Availability, Subjects, Classes, Rooms, Timetables
  ui.tsx             Shared UI components (buttons, fields, tables, toasts, confirm dialog)
tests/               Scheduler and API tests
```

## Prerequisites

- Node.js 24 (pinned in `package.json`)
- npm

## Setup

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

Open http://localhost:3001.

On first start the server creates `timetable.db` and fills it with a small set of sample data. Sample data is inserted only once, so rows you delete do not reappear after a restart. To start with an empty database, set `SEED_SAMPLE_DATA=false` before the first run. The database file is git-ignored.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port. Most hosting platforms set this automatically. |
| `HOST` | `0.0.0.0` | Interface to bind to. |
| `DATABASE_PATH` | `./timetable.db` | Local SQLite database file. It is created automatically. Ignored when a database URL is set. |
| `TURSO_DATABASE_URL` / `DATABASE_URL` | | libSQL URL of a hosted database, such as `libsql://<db>-<org>.turso.io`. Takes precedence over `DATABASE_PATH`. |
| `TURSO_AUTH_TOKEN` / `DATABASE_AUTH_TOKEN` | | Auth token for the hosted database. |
| `SEED_SAMPLE_DATA` | `true` | Set to `false` to start with an empty database. This only has an effect on first run. |

No API keys or secrets are required to run locally.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the server with Vite middleware and hot reload. |
| `npm run build` | Builds the client to `dist/client` and compiles the server to `dist/`. |
| `npm start` | Runs the production build (`node dist/server.js`). In this mode the server serves only `dist/client`. |
| `npm run lint` | Type-checks the client, the tests and the server. |
| `npm test` | Runs the scheduler and API tests. |

## CSV import format

Each import expects a header row. Departments, faculty, subjects and classes refer to departments by numeric `dept_id`.

| Entity | Columns |
| --- | --- |
| Departments | `name` |
| Faculty | `name, email, dept_id` |
| Subjects | `name, code, periods_per_week, is_lab, dept_id, faculty_id` (`faculty_id` is optional) |
| Classes | `name, dept_id, student_count` |
| Rooms | `name, capacity, is_lab` |

In the `is_lab` column, `1` or `true` means a lab.

## Deployment

```bash
npm ci
npm run build
npm start
```

The database is a single SQLite file. Point `DATABASE_PATH` at persistent storage, such as a mounted disk, because ephemeral container file systems lose data on redeploy.

### Vercel

Live demo: https://smart-timetable-brown.vercel.app

`vercel.json` builds the client with `vite build`, serves `dist/client` as static files and sends every `/api/*` request to `api/index.ts`, which wraps the same Express app. Pushes to `main` deploy to production automatically.

Vercel functions have a read-only file system, so persistent data needs a hosted database. The app uses [Turso](https://turso.tech) (hosted SQLite, same SQL):

1. In the Vercel dashboard, open the project, go to **Storage** and connect a **Turso** database. This sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for the project. Alternatively, create the database with the Turso CLI and add the two variables yourself.
2. Redeploy. On the first request the app creates the tables and loads the sample data once.

Without those variables the app still runs, but it falls back to a database in the function's temp directory. That data resets when an instance starts cold, and separate instances do not share it.
