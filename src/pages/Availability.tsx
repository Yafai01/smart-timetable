import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { send } from '../api';
import type { AppData, Page } from '../types';
import { periodTimes } from '../schedule';
import { Button, Card, EmptyState, PageHeader, SelectInput, useToast } from '../ui';

export default function Availability({ data, refresh, navigate }: { data: AppData; refresh: () => Promise<void>; navigate: (p: Page) => void }) {
  const toast = useToast();
  const [facultyId, setFacultyId] = useState<number | null>(data.faculty[0]?.id ?? null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (facultyId === null || !data.faculty.some((f) => f.id === facultyId)) setFacultyId(data.faculty[0]?.id ?? null);
  }, [data.faculty, facultyId]);

  const { workingDays } = data.settings;
  const times = periodTimes(data.settings);

  const isAvailable = (day: string, period: number) => {
    const r = data.faculty_availability.find((a) => a.faculty_id === facultyId && a.day === day && a.period === period);
    return r ? Boolean(r.is_available) : true;
  };

  const toggle = async (day: string, period: number) => {
    if (facultyId === null) return;
    setPending(`${day}-${period}`);
    try {
      await send('POST', '/api/faculty-availability', { faculty_id: facultyId, day, period, is_available: !isAvailable(day, period) });
      await refresh();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setPending(null);
    }
  };

  if (data.faculty.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Users size={18} aria-hidden />}
          title="No faculty members yet"
          action={
            <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => navigate('faculty')}>
              Add faculty
            </Button>
          }
        >
          Add teaching staff before setting when they can teach.
        </EmptyState>
      </Card>
    );
  }

  const blocked = data.faculty_availability.filter((a) => a.faculty_id === facultyId && !a.is_available).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weekly availability"
        description="Click a period to block it. Changes apply the next time you generate."
        actions={
          <div className="w-60">
            <label className="sr-only" htmlFor="availability-faculty">
              Faculty member
            </label>
            <SelectInput id="availability-faculty" value={facultyId ?? ''} onChange={(e) => setFacultyId(Number(e.target.value))}>
              {data.faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectInput>
          </div>
        }
      />

      <Card flush>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[13px] text-fg-muted">
          <span className="tabular-nums">{blocked === 0 ? 'Available in every period.' : `${blocked} ${blocked === 1 ? 'period' : 'periods'} blocked.`}</span>
          <span className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-line-strong bg-surface" aria-hidden /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-danger-line bg-danger-soft" aria-hidden /> Blocked
            </span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-24 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Time
                </th>
                {workingDays.map((d) => (
                  <th key={d} scope="col" className="px-1.5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d.slice(0, 3)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((t) => (
                <tr key={t.period} className="border-b border-line last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left align-middle font-normal">
                    <div className="text-[13px] tabular-nums text-fg">{t.start}</div>
                    <div className="text-[11px] tabular-nums text-fg-subtle">P{t.period}</div>
                  </th>
                  {workingDays.map((day) => {
                    const available = isAvailable(day, t.period);
                    return (
                      <td key={day} className="p-1">
                        <button
                          type="button"
                          aria-pressed={!available}
                          aria-label={`${day} ${t.start}, period ${t.period}: ${available ? 'available' : 'blocked'}`}
                          disabled={pending === `${day}-${t.period}`}
                          onClick={() => toggle(day, t.period)}
                          className={`h-10 w-full rounded border text-xs font-medium transition-colors disabled:opacity-50 ${
                            available
                              ? 'border-line bg-surface text-fg-subtle hover:border-line-strong hover:bg-subtle'
                              : 'border-danger-line bg-danger-soft text-danger hover:opacity-90'
                          }`}
                        >
                          {available ? '' : 'Blocked'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
