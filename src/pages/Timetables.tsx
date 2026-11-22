import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlertTriangle, CalendarDays, CalendarX2, Download, FileSpreadsheet, FilterX, Loader2, Plus, Printer, RefreshCw } from 'lucide-react';
import type { AppData, Conflict, Intent, Page, TimetableEntry } from '../types';
import { conflictsByEntry, exportCsv, exportIcs, lookups, periodTimes, slug, subjectTones, todayName, type PeriodTime } from '../schedule';
import { Badge, Button, Card, EmptyState, Menu, Segmented, SelectInput } from '../ui';

type View = 'class' | 'faculty' | 'room';
const viewLabels: Record<View, string> = { class: 'Class', faculty: 'Teacher', room: 'Room' };
const viewField = { class: 'class_id', faculty: 'faculty_id', room: 'room_id' } as const;

interface Filters {
  day: string;
  subject: number | null;
  class: number | null;
  faculty: number | null;
  room: number | null;
}
const NO_FILTERS: Filters = { day: '', subject: null, class: null, faculty: null, room: null };

/** Current time, refreshed every 30 seconds for the "now" indicator. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

interface GridProps {
  data: AppData;
  view: View;
  entries: TimetableEntry[];
  matches: (e: TimetableEntry) => boolean;
  tones: Map<number, number>;
  conflicts: Map<number, Conflict[]>;
  today: string | null;
  nowMin: number | null;
  days: string[];
}

/** Fraction (0–1) of the way through the period at `nowMin`, or null when outside it. */
const progress = (t: PeriodTime, nowMin: number | null) =>
  nowMin !== null && nowMin >= t.startMin && nowMin < t.endMin ? (nowMin - t.startMin) / (t.endMin - t.startMin) : null;

function EntryCard({ data, view, entry, dim, tone, issues, compact }: { data: AppData; view: View; entry: TimetableEntry; dim: boolean; tone: number; issues: Conflict[]; compact: boolean }) {
  const L = lookups(data);
  const sub = L.subject.get(entry.subject_id);
  const parts =
    view === 'class'
      ? [L.faculty.get(entry.faculty_id)?.name, L.room.get(entry.room_id)?.name]
      : view === 'faculty'
        ? [L.cls.get(entry.class_id)?.name, L.room.get(entry.room_id)?.name]
        : [L.cls.get(entry.class_id)?.name, L.faculty.get(entry.faculty_id)?.name];
  const severity = issues[0]?.severity;
  const issueText = issues.map((c) => `${c.type}: ${c.message}`).join('\n');
  return (
    <div
      className={`cell tone-${tone} relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[5px] border-l-[3px] border-[var(--tone-bar)] bg-[var(--tone-bg)] text-[var(--tone-fg)] transition-opacity ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      } ${dim ? 'opacity-25' : ''} ${severity === 'high' ? 'ring-1 ring-danger ring-inset' : severity === 'medium' ? 'ring-1 ring-warning ring-inset' : ''}`}
      title={[sub ? `${sub.code} · ${sub.name}` : '', ...parts, issueText].filter(Boolean).join('\n')}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10.5px] font-medium opacity-80">{sub?.code}</span>
        {sub?.is_lab ? <span className="rounded-sm bg-[var(--tone-bar)]/15 px-1 text-[9.5px] font-semibold uppercase tracking-wide">Lab</span> : null}
        {severity && (
          <span
            className={`ml-auto inline-flex items-center gap-0.5 rounded-sm px-1 text-[9.5px] font-semibold uppercase tracking-wide ${
              severity === 'high' ? 'bg-danger-solid text-white' : 'bg-warning-soft text-warning'
            }`}
          >
            <AlertTriangle size={9} aria-hidden />
            {severity === 'high' ? 'Clash' : 'Issue'}
            <span className="sr-only">: {issueText}</span>
          </span>
        )}
      </div>
      <div className="truncate text-[12.5px] font-semibold leading-tight">{sub?.name}</div>
      {!compact && <div className="truncate text-[11.5px] leading-tight opacity-80">{parts.filter(Boolean).join(' · ')}</div>}
    </div>
  );
}

function WeekGrid({ data, view, entries, matches, tones, conflicts, today, nowMin, days }: GridProps) {
  const times = periodTimes(data.settings);
  const at = (day: string, period: number) => entries.filter((e) => e.day === day && e.period === period);
  return (
    <table className="timetable w-full table-fixed border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-line">
          <th scope="col" className="w-[72px] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            <span className="sr-only">Time</span>
          </th>
          {days.map((d) => (
            <th
              key={d}
              scope="col"
              className={`px-1.5 py-2 text-left text-[12px] font-medium ${d === today ? 'text-accent-text' : 'text-fg-muted'}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="lg:hidden">{d.slice(0, 3)}</span>
                <span className="hidden lg:inline">{d}</span>
                {d === today && <span className="rounded-sm bg-accent px-1 text-[9.5px] font-semibold tracking-wide text-white">TODAY</span>}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {times.map((t) => {
          const p = progress(t, nowMin);
          return (
            <tr key={t.period} className="border-b border-line last:border-0">
              <th scope="row" className="relative h-[84px] px-3 align-top font-normal">
                <div className="pt-1.5 text-[12.5px] font-medium tabular-nums text-fg">{t.start}</div>
                <div className="text-[11px] tabular-nums text-fg-subtle">{t.end}</div>
                <div className="text-[10.5px] tabular-nums text-fg-subtle">P{t.period}</div>
              </th>
              {days.map((day) => {
                const cell = at(day, t.period);
                const isToday = day === today;
                return (
                  <td key={day} className={`relative h-[84px] p-1 align-top ${isToday ? 'bg-accent-soft/40' : ''}`}>
                    {cell.length === 0 ? (
                      <span className="sr-only">Free</span>
                    ) : (
                      <div className="flex h-full flex-col gap-1">
                        {cell.map((e) => (
                          <EntryCard
                            key={e.id}
                            data={data}
                            view={view}
                            entry={e}
                            dim={!matches(e)}
                            tone={tones.get(e.subject_id) ?? 0}
                            issues={conflicts.get(e.id) ?? []}
                            compact={cell.length > 1}
                          />
                        ))}
                      </div>
                    )}
                    {isToday && p !== null && (
                      <div className="pointer-events-none absolute inset-x-0 z-[5] flex items-center" style={{ top: `${p * 100}%` }} aria-hidden>
                        <span className="-ml-1 h-2 w-2 rounded-full bg-danger-solid" />
                        <span className="h-px flex-1 bg-danger-solid" />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Single-day agenda for narrow screens. */
function DayList({ data, view, entries, matches, tones, conflicts, today, nowMin, day }: Omit<GridProps, 'days'> & { day: string }) {
  const times = periodTimes(data.settings);
  return (
    <ol className="divide-y divide-line">
      {times.map((t) => {
        const cell = entries.filter((e) => e.day === day && e.period === t.period);
        const current = day === today && progress(t, nowMin) !== null;
        return (
          <li key={t.period} className={`flex gap-3 px-3 py-2 ${current ? 'bg-accent-soft/50' : ''}`}>
            <div className="w-14 shrink-0 pt-1">
              <div className="text-[13px] font-medium tabular-nums text-fg">{t.start}</div>
              <div className="text-[11px] tabular-nums text-fg-subtle">{t.end}</div>
              {current && <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">Now</div>}
            </div>
            <div className="flex min-h-[60px] flex-1 flex-col gap-1">
              {cell.length === 0 ? (
                <div className="flex flex-1 items-center rounded-[5px] border border-dashed border-line px-3 text-xs text-fg-subtle">Free</div>
              ) : (
                cell.map((e) => (
                  <EntryCard
                    key={e.id}
                    data={data}
                    view={view}
                    entry={e}
                    dim={!matches(e)}
                    tone={tones.get(e.subject_id) ?? 0}
                    issues={conflicts.get(e.id) ?? []}
                    compact={false}
                  />
                ))
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Timetables({
  data,
  printAll,
  onPrinted,
  navigate,
  onGenerate,
  generating,
}: {
  data: AppData;
  printAll: boolean;
  onPrinted: () => void;
  navigate: (p: Page, i?: Intent) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const [view, setView] = useState<View>('class');
  const [selected, setSelected] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [printing, setPrinting] = useState<'current' | 'all' | null>(null);
  const now = useNow();

  const { workingDays } = data.settings;
  const today = todayName(now, workingDays);
  const [mobileDay, setMobileDay] = useState<string>(() => today ?? workingDays[0] ?? 'Monday');
  useEffect(() => {
    if (!workingDays.includes(mobileDay)) setMobileDay(today ?? workingDays[0] ?? 'Monday');
  }, [workingDays.join(',')]);

  const options = view === 'class' ? data.classes : view === 'faculty' ? data.faculty : data.rooms;
  const current = options.find((o) => o.id === selected) ?? options[0];
  const tones = useMemo(() => subjectTones(data), [data]);
  const conflicts = useMemo(() => conflictsByEntry(data), [data]);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const changeView = (v: View) => {
    setView(v);
    setSelected(null);
    setFilters((f) => ({ ...f, [v]: null }));
  };

  const entriesFor = (v: View, id: number) => data.timetable.filter((t) => t[viewField[v]] === id);
  const entries = current ? entriesFor(view, current.id) : [];

  const matches = (e: TimetableEntry) =>
    (!filters.day || e.day === filters.day) &&
    (filters.subject === null || e.subject_id === filters.subject) &&
    (filters.class === null || e.class_id === filters.class) &&
    (filters.faculty === null || e.faculty_id === filters.faculty) &&
    (filters.room === null || e.room_id === filters.room);
  const filterActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const matching = entries.filter(matches);
  const gridDays = filters.day ? workingDays.filter((d) => d === filters.day) : workingDays;

  const issues = current
    ? data.conflicts.filter(
        (c) => c.entry_ids?.some((id) => entries.some((e) => e.id === id)) || (view === 'class' && c.class_id === current.id),
      )
    : [];
  const high = issues.filter((c) => c.severity === 'high').length;

  const print = (what: 'current' | 'all') => {
    flushSync(() => setPrinting(what));
    window.print();
    setPrinting(null);
  };

  useEffect(() => {
    if (printAll && data.classes.length > 0) {
      onPrinted();
      // Give the browser a frame to lay out the print view.
      requestAnimationFrame(() => print('all'));
    }
  }, [printAll, data.classes.length]);

  const generated = data.last_generated_at ? new Date(data.last_generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const hasTimetable = data.timetable.length > 0;
  const exportName = current ? slug(`${view}-${current.name}`) : 'timetable';

  const filterSelect = (key: 'subject' | 'class' | 'faculty' | 'room', all: string, rows: { id: number; name: string; code?: string }[]) => (
    <SelectInput
      aria-label={`Filter by ${key === 'faculty' ? 'teacher' : key}`}
      value={filters[key] ?? ''}
      onChange={(e) => setFilters({ ...filters, [key]: e.target.value ? Number(e.target.value) : null })}
      compact
      className={filters[key] !== null ? 'border-accent text-accent-text' : ''}
    >
      <option value="">{all}</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.code ? `${r.code} · ${r.name}` : r.name}
        </option>
      ))}
    </SelectInput>
  );

  const emptyOptionsAction =
    view === 'class' ? (
      <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => navigate('classes', 'new-class')}>
        Add a class
      </Button>
    ) : view === 'faculty' ? (
      <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => navigate('faculty', 'new-faculty')}>
        Add faculty
      </Button>
    ) : (
      <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => navigate('rooms')}>
        Add a room
      </Button>
    );

  return (
    <>
      <div className="space-y-3 print:hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="View timetable by" value={view} onChange={changeView} options={(Object.keys(viewLabels) as View[]).map((v) => ({ value: v, label: viewLabels[v] }))} />
          {options.length > 0 && (
            <div className="w-full sm:w-56">
              <label className="sr-only" htmlFor="timetable-target">
                {viewLabels[view]}
              </label>
              <SelectInput id="timetable-target" value={current?.id ?? ''} onChange={(e) => setSelected(Number(e.target.value))} className="font-medium">
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Menu
              label="Export"
              icon={<Download size={15} aria-hidden />}
              items={[
                { label: 'Print / save as PDF', icon: <Printer size={15} />, onSelect: () => print('current'), disabled: !hasTimetable || !current },
                { label: 'Print all classes', icon: <Printer size={15} />, onSelect: () => print('all'), disabled: !hasTimetable || data.classes.length === 0 },
                {
                  label: 'CSV — this timetable',
                  icon: <FileSpreadsheet size={15} />,
                  onSelect: () => exportCsv(data, entries, exportName),
                  disabled: entries.length === 0,
                },
                {
                  label: 'CSV — all classes',
                  icon: <FileSpreadsheet size={15} />,
                  onSelect: () => exportCsv(data, data.timetable, 'timetable-all-classes'),
                  disabled: !hasTimetable,
                },
                {
                  label: 'Calendar (.ics)',
                  icon: <CalendarDays size={15} />,
                  hint: 'weekly',
                  onSelect: () => exportIcs(data, entries, `Timetable — ${current?.name ?? ''}`, exportName),
                  disabled: entries.length === 0,
                },
              ]}
            />
          </div>
        </div>

        {/* Filters + status */}
        {hasTimetable && current && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <SelectInput
              aria-label="Filter by day"
              value={filters.day}
              onChange={(e) => setFilters({ ...filters, day: e.target.value })}
              compact
              className={filters.day ? 'border-accent text-accent-text' : ''}
            >
              <option value="">All days</option>
              {workingDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectInput>
            {filterSelect('subject', 'All subjects', data.subjects)}
            {view !== 'class' && filterSelect('class', 'All classes', data.classes)}
            {view !== 'faculty' && filterSelect('faculty', 'All teachers', data.faculty)}
            {view !== 'room' && filterSelect('room', 'All rooms', data.rooms)}
            {filterActive && (
              <Button size="sm" variant="ghost" icon={<FilterX size={14} aria-hidden />} onClick={() => setFilters(NO_FILTERS)}>
                Clear
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2 text-fg-muted">
              {issues.length > 0 ? (
                <Badge tone={high ? 'danger' : 'warning'}>
                  <AlertTriangle size={11} aria-hidden />
                  {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                </Badge>
              ) : (
                <Badge tone="success">No issues</Badge>
              )}
              <span className="hidden tabular-nums sm:inline">
                {filterActive ? `${matching.length} of ${entries.length}` : entries.length} periods
                {generated && <span className="text-fg-subtle"> · generated {generated}</span>}
              </span>
            </div>
          </div>
        )}

        <Card flush className="relative">
          {!current ? (
            <EmptyState icon={<CalendarX2 size={18} aria-hidden />} title={`No ${viewLabels[view].toLowerCase()}s yet`} action={emptyOptionsAction}>
              Timetables are shown per {viewLabels[view].toLowerCase()}.
            </EmptyState>
          ) : !hasTimetable ? (
            <EmptyState
              icon={<CalendarDays size={18} aria-hidden />}
              title="Nothing scheduled yet"
              action={
                <Button variant="primary" icon={<RefreshCw size={15} aria-hidden />} busy={generating} onClick={onGenerate}>
                  Generate timetable
                </Button>
              }
            >
              Build a conflict-free week from your faculty, subjects, classes and rooms.
            </EmptyState>
          ) : (
            <>
              {filterActive && matching.length === 0 && (
                <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-2 text-[13px] text-fg-muted">
                  No periods for {current.name} match these filters.
                  <Button size="sm" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </Button>
                </div>
              )}
              {/* Desktop and tablet: full week */}
              <div className="hidden max-h-[calc(100dvh-13rem)] overflow-auto md:block">
                <WeekGrid
                  data={data}
                  view={view}
                  entries={entries}
                  matches={matches}
                  tones={tones}
                  conflicts={conflicts}
                  today={today}
                  nowMin={nowMin}
                  days={gridDays}
                />
              </div>
              {/* Phones: one day at a time */}
              <div className="md:hidden">
                <div role="tablist" aria-label="Day" className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2">
                  {workingDays.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="tab"
                      aria-selected={mobileDay === d}
                      onClick={() => setMobileDay(d)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium ${
                        mobileDay === d ? 'bg-accent text-white' : d === today ? 'text-accent-text' : 'text-fg-muted hover:bg-subtle'
                      }`}
                    >
                      {d.slice(0, 3)}
                      {d === today && <span className="sr-only"> (today)</span>}
                    </button>
                  ))}
                </div>
                <DayList data={data} view={view} entries={entries} matches={matches} tones={tones} conflicts={conflicts} today={today} nowMin={nowMin} day={mobileDay} />
              </div>
            </>
          )}
          {generating && hasTimetable && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]" role="status">
              <span className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-fg-muted">
                <Loader2 size={15} className="animate-spin" aria-hidden /> Generating timetable…
              </span>
            </div>
          )}
        </Card>

        {/* Legend */}
        {hasTimetable && entries.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-fg-muted" aria-label="Subjects in this timetable">
            {data.subjects
              .filter((s) => entries.some((e) => e.subject_id === s.id))
              .map((s) => (
                <li key={s.id} className={`tone-${tones.get(s.id) ?? 0} flex items-center gap-1.5`}>
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--tone-bar)]" aria-hidden />
                  <span className="font-mono">{s.code}</span> {s.name}
                </li>
              ))}
          </ul>
        )}
      </div>

      {printing && (
        <div className="print-report hidden print:block">
          {(printing === 'all' ? data.classes.map((c) => ({ v: 'class' as View, row: c })) : current ? [{ v: view, row: current }] : []).map(
            ({ v, row }) => (
              <section key={`${v}-${row.id}`} className="print-page">
                <h1 className="mb-1 text-lg font-semibold">
                  {viewLabels[v]} timetable: {row.name}
                </h1>
                <p className="mb-3 text-xs text-fg-muted">{generated ? `Generated ${generated}` : ''}</p>
                <WeekGrid
                  data={data}
                  view={v}
                  entries={entriesFor(v, row.id)}
                  matches={() => true}
                  tones={tones}
                  conflicts={conflicts}
                  today={null}
                  nowMin={null}
                  days={workingDays}
                />
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
