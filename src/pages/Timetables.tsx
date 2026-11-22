import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { CalendarX2, Printer } from 'lucide-react';
import type { AppData, TimetableEntry } from '../types';
import { Badge, Button, Card, EmptyState, Field, SelectInput } from '../ui';

type View = 'class' | 'faculty' | 'room';

const viewLabels: Record<View, string> = { class: 'Class', faculty: 'Faculty', room: 'Room' };

function Grid({ data, view, id }: { data: AppData; view: View; id: number }) {
  const { workingDays, periodsPerDay } = data.settings;
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
  const field = view === 'class' ? 'class_id' : view === 'faculty' ? 'faculty_id' : 'room_id';
  const at = (day: string, period: number): TimetableEntry[] =>
    data.timetable.filter((t) => t[field] === id && t.day === day && t.period === period);
  const nameOf = (rows: { id: number; name: string }[], rid: number) => rows.find((r) => r.id === rid)?.name ?? '';

  return (
    <table className="timetable w-full min-w-[720px] table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className="w-28 border border-slate-200 bg-slate-50 p-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            Day
          </th>
          {periods.map((p) => (
            <th key={p} scope="col" className="border border-slate-200 bg-slate-50 p-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Period {p}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {workingDays.map((day) => (
          <tr key={day}>
            <th scope="row" className="border border-slate-200 bg-slate-50 p-2 text-left font-medium text-slate-700">
              {day}
            </th>
            {periods.map((p) => {
              const entries = at(day, p);
              return (
                <td key={p} className="h-20 border border-slate-200 p-1.5 align-top">
                  {entries.length === 0 ? (
                    <span className="sr-only">Free</span>
                  ) : (
                    entries.map((e) => {
                      const sub = data.subjects.find((s) => s.id === e.subject_id);
                      const lines =
                        view === 'class'
                          ? [nameOf(data.faculty, e.faculty_id), nameOf(data.rooms, e.room_id)]
                          : view === 'faculty'
                            ? [nameOf(data.classes, e.class_id), nameOf(data.rooms, e.room_id)]
                            : [nameOf(data.classes, e.class_id), nameOf(data.faculty, e.faculty_id)];
                      return (
                        <div
                          key={e.id}
                          className={`cell rounded-md border p-2 ${entries.length > 1 ? 'border-red-300 bg-red-50' : sub?.is_lab ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                        >
                          <div className="font-mono text-[11px] text-slate-500">{sub?.code}</div>
                          <div className="truncate text-xs font-semibold text-slate-900" title={sub?.name}>
                            {sub?.name}
                          </div>
                          {lines.map((l, i) => (
                            <div key={i} className="truncate text-[11px] text-slate-600" title={l}>
                              {l}
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Timetables({ data, printAll, onPrinted }: { data: AppData; printAll: boolean; onPrinted: () => void }) {
  const [view, setView] = useState<View>('class');
  const [selected, setSelected] = useState<number | null>(null);
  const [printing, setPrinting] = useState<'current' | 'all' | null>(null);

  const options = view === 'class' ? data.classes : view === 'faculty' ? data.faculty : data.rooms;
  const current = options.find((o) => o.id === selected) ?? options[0];

  useEffect(() => setSelected(null), [view]);

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

  const generated = data.last_generated_at ? new Date(data.last_generated_at).toLocaleString() : null;
  const hasTimetable = data.timetable.length > 0;

  const issuesFor = (name: string) => data.conflicts.filter((c) => c.message.includes(name)).length;

  return (
    <>
      <div className="space-y-6 print:hidden">
        <Card
          title="Timetables"
          description={generated ? `Last generated ${generated}` : 'No timetable has been generated yet.'}
          actions={
            <>
              <Button icon={<Printer size={16} aria-hidden />} onClick={() => print('current')} disabled={!hasTimetable || !current}>
                Print / save as PDF
              </Button>
              <Button onClick={() => print('all')} disabled={!hasTimetable || data.classes.length === 0}>
                Print all classes
              </Button>
            </>
          }
        >
          <div className="flex flex-wrap items-end gap-4">
            <div role="group" aria-label="View timetable by" className="inline-flex rounded-lg border border-slate-300 p-0.5">
              {(Object.keys(viewLabels) as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {viewLabels[v]}
                </button>
              ))}
            </div>
            {options.length > 0 && (
              <div className="w-64">
                <Field label={viewLabels[view]}>
                  {(id) => (
                    <SelectInput id={id} value={current?.id ?? ''} onChange={(e) => setSelected(Number(e.target.value))}>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              </div>
            )}
            {current && issuesFor(current.name) > 0 && <Badge tone="warning">{issuesFor(current.name)} issues mention {current.name}</Badge>}
          </div>
        </Card>

        <Card>
          {!current ? (
            <EmptyState icon={<CalendarX2 size={20} aria-hidden />} title={`No ${viewLabels[view].toLowerCase()} records`} />
          ) : !hasTimetable ? (
            <EmptyState icon={<CalendarX2 size={20} aria-hidden />} title="Nothing scheduled yet">
              Use Generate timetable to build a schedule from your current data.
            </EmptyState>
          ) : (
            <div className="-mx-5 -my-5 overflow-x-auto p-5">
              <Grid data={data} view={view} id={current.id} />
            </div>
          )}
        </Card>
      </div>

      {printing && (
        <div className="print-report hidden print:block">
          {(printing === 'all' ? data.classes.map((c) => ({ v: 'class' as View, row: c })) : current ? [{ v: view, row: current }] : []).map(
            ({ v, row }) => (
              <section key={`${v}-${row.id}`} className="print-page">
                <h1 className="mb-1 text-lg font-semibold">
                  {viewLabels[v]} timetable: {row.name}
                </h1>
                <p className="mb-3 text-xs text-slate-600">{generated ? `Generated ${generated}` : ''}</p>
                <Grid data={data} view={v} id={row.id} />
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
