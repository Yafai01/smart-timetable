import { AlertTriangle, BookOpen, CheckCircle2, ChevronRight, DoorOpen, FlaskConical, GraduationCap, Printer, UserPlus, Users } from 'lucide-react';
import { ALL_DAYS, MAX_PERIODS_PER_DAY, type AppData, type Intent, type Page, type ScheduleSettings } from '../types';
import { Badge, Button, Card, Checkbox, Field, SelectInput } from '../ui';

function Stat({ label, value, icon, detail }: { label: string; value: string | number; icon: React.ReactNode; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  );
}

export default function Dashboard({
  data,
  settings,
  onSettingsChange,
  onGenerate,
  generating,
  navigate,
}: {
  data: AppData;
  settings: ScheduleSettings;
  onSettingsChange: (s: ScheduleSettings) => void;
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
  const high = data.conflicts.filter((c) => c.severity === 'high');
  const unassigned = data.subjects.filter((s) => !data.faculty_subjects.some((fs) => fs.subject_id === s.id));
  const generated = data.last_generated_at ? new Date(data.last_generated_at).toLocaleString() : null;
  const load = data.faculty
    .map((f) => ({ f, load: data.timetable.filter((t) => t.faculty_id === f.id).length }))
    .sort((a, b) => b.load - a.load);

  const toggleDay = (day: string, on: boolean) => {
    const days = on ? ALL_DAYS.filter((d) => d === day || settings.workingDays.includes(d)) : settings.workingDays.filter((d) => d !== day);
    onSettingsChange({ ...settings, workingDays: days });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faculty" value={data.faculty.length} icon={<Users size={18} aria-hidden />} />
        <Stat label="Subjects" value={data.subjects.length} icon={<BookOpen size={18} aria-hidden />} detail={unassigned.length ? `${unassigned.length} without a teacher` : undefined} />
        <Stat label="Classes" value={data.classes.length} icon={<GraduationCap size={18} aria-hidden />} />
        <Stat label="Rooms" value={data.rooms.length} icon={<DoorOpen size={18} aria-hidden />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Schedule status" description={generated ? `Last generated ${generated}` : 'No timetable generated yet.'}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">Periods scheduled</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                  {scheduled} <span className="text-sm font-normal text-slate-500">of {required} required</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Room utilisation</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                  {utilisation}% <span className="text-sm font-normal text-slate-500">of {roomSlots} room-periods</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Issues</dt>
                <dd className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900">
                  {data.conflicts.length}
                  {data.conflicts.length === 0 ? (
                    <CheckCircle2 size={18} className="text-emerald-600" aria-label="No issues" />
                  ) : (
                    high.length > 0 && <Badge tone="danger">{high.length} critical</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Issues" description="Double bookings, capacity and availability violations, and unmet weekly periods.">
            {data.conflicts.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 size={16} className="text-emerald-600" aria-hidden />
                {scheduled > 0 ? 'The current timetable satisfies every constraint.' : 'Nothing to check yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.conflicts.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${c.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`} aria-hidden />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{c.type}</div>
                      <div className="text-sm text-slate-600">{c.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Faculty workload" description={`Scheduled periods per week, out of ${slots}.`}>
            {load.length === 0 ? (
              <p className="text-sm text-slate-500">No faculty members yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {load.map(({ f, load: n }) => (
                  <li key={f.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{f.name}</span>
                      <span className="tabular-nums text-slate-500">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <div className="h-full bg-indigo-600" style={{ width: `${slots ? Math.min(100, (n / slots) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Generate timetable" description="Replaces the current timetable.">
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Working days</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_DAYS.map((d) => (
                    <Checkbox key={d} label={d} checked={settings.workingDays.includes(d)} onChange={(on) => toggleDay(d, on)} />
                  ))}
                </div>
              </fieldset>
              <Field label="Periods per day">
                {(id) => (
                  <SelectInput id={id} value={settings.periodsPerDay} onChange={(e) => onSettingsChange({ ...settings, periodsPerDay: Number(e.target.value) })}>
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

          <Card title="Quick actions">
            <ul className="-my-2 divide-y divide-slate-100">
              {[
                { label: 'Add faculty member', icon: <UserPlus size={16} aria-hidden />, run: () => navigate('faculty', 'new-faculty') },
                { label: 'Add lab subject', icon: <FlaskConical size={16} aria-hidden />, run: () => navigate('subjects', 'new-lab-subject') },
                {
                  label: 'Export all class timetables (PDF)',
                  icon: <Printer size={16} aria-hidden />,
                  run: () => navigate('timetables', 'print-all'),
                  disabled: scheduled === 0,
                },
              ].map((a) => (
                <li key={a.label}>
                  <button
                    type="button"
                    onClick={a.run}
                    disabled={a.disabled}
                    className="flex w-full items-center gap-3 rounded-md py-2.5 text-left text-sm text-slate-700 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-slate-500">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                    <ChevronRight size={16} className="text-slate-400" aria-hidden />
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
