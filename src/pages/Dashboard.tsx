import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, DoorOpen, FlaskConical, GraduationCap, Printer, UserPlus, Users } from 'lucide-react';
import { ALL_DAYS, MAX_PERIODS_PER_DAY, type AppData, type Intent, type Page, type ScheduleSettings } from '../types';
import { periodTimes } from '../schedule';
import { Badge, Button, Card, Field, Meter, SelectInput, TextInput } from '../ui';

function Stat({ label, value, icon, detail, onClick }: { label: string; value: number; icon: React.ReactNode; detail?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between text-fg-subtle">
        <span className="text-[13px] font-medium text-fg-muted">{label}</span>
        <span className="transition-colors group-hover:text-fg">{icon}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</div>
      <div className="h-4 text-xs text-fg-subtle">{detail}</div>
    </button>
  );
}

export default function Dashboard({
  data,
  settings,
  onSettingsChange,
  onSaveTimes,
  onGenerate,
  generating,
  navigate,
}: {
  data: AppData;
  settings: ScheduleSettings;
  onSettingsChange: (s: ScheduleSettings) => void;
  onSaveTimes: (t: { startTime: string; periodMinutes: number }) => Promise<boolean>;
  onGenerate: () => void;
  generating: boolean;
  navigate: (page: Page, intent?: Intent) => void;
}) {
  const required = data.classes.reduce(
    (n, c) => n + data.subjects.filter((s) => s.dept_id === c.dept_id).reduce((m, s) => m + s.periods_per_week, 0),
    0,
  );
  const scheduled = data.timetable.length;
  const slots = data.settings.workingDays.length * data.settings.periodsPerDay;
  const roomSlots = data.rooms.length * slots;
  const utilisation = roomSlots ? Math.round((scheduled / roomSlots) * 100) : 0;
  const coverage = required ? Math.round((Math.min(scheduled, required) / required) * 100) : 0;
  const high = data.conflicts.filter((c) => c.severity === 'high');
  const unassigned = data.subjects.filter((s) => !data.faculty_subjects.some((fs) => fs.subject_id === s.id));
  const generated = data.last_generated_at ? new Date(data.last_generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const load = data.faculty
    .map((f) => ({ f, load: data.timetable.filter((t) => t.faculty_id === f.id).length }))
    .sort((a, b) => b.load - a.load);

  // Period clock times are saved on blur/change, independent of generation.
  const [times, setTimes] = useState({ startTime: data.settings.startTime, periodMinutes: String(data.settings.periodMinutes) });
  const [savingTimes, setSavingTimes] = useState(false);
  useEffect(() => setTimes({ startTime: data.settings.startTime, periodMinutes: String(data.settings.periodMinutes) }), [data.settings.startTime, data.settings.periodMinutes]);
  const saveTimes = async (next: typeof times) => {
    const minutes = Number(next.periodMinutes);
    if (!/^\d{2}:\d{2}$/.test(next.startTime) || !Number.isInteger(minutes)) return;
    if (next.startTime === data.settings.startTime && minutes === data.settings.periodMinutes) return;
    setSavingTimes(true);
    const ok = await onSaveTimes({ startTime: next.startTime, periodMinutes: minutes });
    setSavingTimes(false);
    if (!ok) setTimes({ startTime: data.settings.startTime, periodMinutes: String(data.settings.periodMinutes) });
  };
  const preview = periodTimes({ ...settings, startTime: times.startTime || '09:00', periodMinutes: Number(times.periodMinutes) || 60 });
  const dayEnds = preview[preview.length - 1]?.end;

  const toggleDay = (day: string) => {
    const on = !settings.workingDays.includes(day);
    const days = on ? ALL_DAYS.filter((d) => d === day || settings.workingDays.includes(d)) : settings.workingDays.filter((d) => d !== day);
    onSettingsChange({ ...settings, workingDays: days });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faculty" value={data.faculty.length} icon={<Users size={16} aria-hidden />} onClick={() => navigate('faculty')} />
        <Stat
          label="Subjects"
          value={data.subjects.length}
          icon={<BookOpen size={16} aria-hidden />}
          detail={unassigned.length ? <span className="text-warning">{unassigned.length} without a teacher</span> : undefined}
          onClick={() => navigate('subjects')}
        />
        <Stat label="Classes" value={data.classes.length} icon={<GraduationCap size={16} aria-hidden />} onClick={() => navigate('classes')} />
        <Stat label="Rooms" value={data.rooms.length} icon={<DoorOpen size={16} aria-hidden />} onClick={() => navigate('rooms')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Schedule status"
            description={generated ? `Last generated ${generated}` : 'No timetable generated yet.'}
            actions={
              scheduled > 0 && (
                <Button size="sm" variant="ghost" onClick={() => navigate('timetables')}>
                  View timetables <ArrowRight size={14} aria-hidden />
                </Button>
              )
            }
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-fg-muted">Periods scheduled</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-fg">
                  {scheduled} <span className="text-[13px] font-normal text-fg-subtle">/ {required}</span>
                </dd>
                <dd className="mt-2 h-1 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <div className={`h-full rounded-full ${coverage === 100 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${coverage}%` }} />
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-muted">Room utilisation</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-fg">
                  {utilisation}% <span className="text-[13px] font-normal text-fg-subtle">of {roomSlots} room-periods</span>
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-muted">Issues</dt>
                <dd className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-fg">
                  {data.conflicts.length}
                  {data.conflicts.length === 0 ? (
                    <CheckCircle2 size={16} className="text-success" aria-label="No issues" />
                  ) : (
                    high.length > 0 && <Badge tone="danger">{high.length} critical</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Issues" description="Double bookings, capacity and availability violations, and unmet weekly periods." flush>
            {data.conflicts.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-fg-muted">
                <CheckCircle2 size={15} className="text-success" aria-hidden />
                {scheduled > 0 ? 'The current timetable satisfies every constraint.' : 'Nothing to check yet. Generate a timetable to validate it.'}
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {data.conflicts.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${c.severity === 'high' ? 'text-danger' : 'text-warning'}`} aria-hidden />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-fg">{c.type}</div>
                      <div className="text-[13px] text-fg-muted">{c.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Faculty workload" description={`Scheduled periods per week, out of ${slots}.`}>
            {load.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No faculty members yet.</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {load.map(({ f, load: n }) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] text-fg">{f.name}</span>
                    <Meter value={n} max={slots} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Generate timetable" description="Replaces the current timetable.">
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-fg">Working days</legend>
                <div className="grid grid-cols-6 gap-1">
                  {ALL_DAYS.map((d) => {
                    const on = settings.workingDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={d}
                        title={d}
                        onClick={() => toggleDay(d)}
                        className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                          on ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong text-fg-subtle hover:bg-subtle'
                        }`}
                      >
                        {d.slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="Periods per day">
                {(id) => (
                  <SelectInput id={id} value={settings.periodsPerDay} onChange={(e) => onSettingsChange({ ...settings, periodsPerDay: Number(e.target.value) })} className="tabular-nums">
                    {Array.from({ length: MAX_PERIODS_PER_DAY }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Button variant="primary" className="w-full" onClick={onGenerate} busy={generating} disabled={settings.workingDays.length === 0}>
                Generate timetable
              </Button>
            </div>
          </Card>

          <Card title="Period times" description="Used for display, calendar export and the “now” marker. Saved instantly.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First period">
                {(id) => (
                  <TextInput
                    id={id}
                    type="time"
                    value={times.startTime}
                    disabled={savingTimes}
                    onChange={(e) => setTimes({ ...times, startTime: e.target.value })}
                    onBlur={() => saveTimes(times)}
                    className="tabular-nums"
                  />
                )}
              </Field>
              <Field label="Length (min)">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={10}
                    max={240}
                    step={5}
                    value={times.periodMinutes}
                    disabled={savingTimes}
                    onChange={(e) => setTimes({ ...times, periodMinutes: e.target.value })}
                    onBlur={() => saveTimes(times)}
                    className="tabular-nums"
                  />
                )}
              </Field>
            </div>
            <p className="mt-3 text-xs tabular-nums text-fg-subtle">
              {settings.periodsPerDay} periods · {preview[0]?.start}–{dayEnds}
            </p>
          </Card>

          <Card title="Quick actions" flush>
            <ul className="divide-y divide-line">
              {[
                { label: 'Add faculty member', icon: <UserPlus size={15} aria-hidden />, run: () => navigate('faculty', 'new-faculty') },
                { label: 'Add lab subject', icon: <FlaskConical size={15} aria-hidden />, run: () => navigate('subjects', 'new-lab-subject') },
                {
                  label: 'Print all class timetables',
                  icon: <Printer size={15} aria-hidden />,
                  run: () => navigate('timetables', 'print-all'),
                  disabled: scheduled === 0,
                },
              ].map((a) => (
                <li key={a.label}>
                  <button
                    type="button"
                    onClick={a.run}
                    disabled={a.disabled}
                    className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-fg hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-fg-subtle">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight size={14} className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
