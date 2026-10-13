import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { send } from '../api';
import type { AppData } from '../types';
import { Card, EmptyState, Field, SelectInput, useToast } from '../ui';

export default function Availability({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const toast = useToast();
  const [facultyId, setFacultyId] = useState<number | null>(data.faculty[0]?.id ?? null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (facultyId === null || !data.faculty.some((f) => f.id === facultyId)) setFacultyId(data.faculty[0]?.id ?? null);
  }, [data.faculty, facultyId]);

  const { workingDays, periodsPerDay } = data.settings;
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const isAvailable = (day: string, period: number) => {
    const r = data.faculty_availability.find((a) => a.faculty_id === facultyId && a.day === day && a.period === period);
    return r ? Boolean(r.is_available) : true;
  };

  const toggle = async (day: string, period: number) => {
    if (facultyId === null) return;
    const key = `${day}-${period}`;
    setPending(key);
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
        <EmptyState icon={<Users size={20} aria-hidden />} title="No faculty members yet">
          Add faculty before setting availability.
        </EmptyState>
      </Card>
    );
  }

  const blocked = data.faculty_availability.filter((a) => a.faculty_id === facultyId && !a.is_available).length;

  return (
    <Card
      title="Weekly availability"
      description="Click a period to mark it unavailable. The generator never schedules a teacher in an unavailable period; changes apply the next time you generate."
      actions={
        <div className="w-64">
          <Field label="Faculty member">
            {(id) => (
              <SelectInput id={id} value={facultyId ?? ''} onChange={(e) => setFacultyId(Number(e.target.value))}>
                {data.faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {blocked === 0 ? 'Available in every period.' : `${blocked} ${blocked === 1 ? 'period' : 'periods'} marked unavailable.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-28 border-b border-slate-200 p-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Day
              </th>
              {periods.map((p) => (
                <th key={p} scope="col" className="border-b border-slate-200 p-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  P{p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workingDays.map((day) => (
              <tr key={day}>
                <th scope="row" className="border-b border-slate-100 p-2 text-left font-medium text-slate-700">
                  {day}
                </th>
                {periods.map((p) => {
                  const available = isAvailable(day, p);
                  return (
                    <td key={p} className="border-b border-slate-100 p-1.5">
                      <button
                        type="button"
                        aria-pressed={!available}
                        aria-label={`${day} period ${p}: ${available ? 'available' : 'unavailable'}`}
                        disabled={pending === `${day}-${p}`}
                        onClick={() => toggle(day, p)}
                        className={`h-10 w-full rounded-md border text-xs font-medium transition-colors disabled:opacity-50 ${
                          available
                            ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {available ? 'Available' : 'Unavailable'}
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
  );
}
