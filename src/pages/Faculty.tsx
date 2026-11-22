import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import type { AppData, Faculty as FacultyRow } from '../types';
import { Button, Card, CsvImport, DataTable, EmptyState, Field, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', email: '', dept_id: '' };

export default function Faculty({ data, refresh, focusForm }: { data: AppData; refresh: () => Promise<void>; focusForm: boolean }) {
  const editor = useEntityEditor<FacultyRow>('faculty', 'Faculty member', refresh);
  const [form, setForm] = useState(blank);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const f = editor.editing;
    setForm(f ? { name: f.name, email: f.email ?? '', dept_id: String(f.dept_id ?? '') } : blank);
    if (f) nameRef.current?.focus();
  }, [editor.editing]);

  useEffect(() => {
    if (focusForm) nameRef.current?.focus();
  }, [focusForm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await editor.save({ ...form, dept_id: Number(form.dept_id) })) setForm(blank);
  };

  const slots = data.settings.workingDays.length * data.settings.periodsPerDay;
  const deptName = (id: number) => data.departments.find((d) => d.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <Card
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add faculty member'}
        actions={!editor.editing && <CsvImport type="faculty" columns="name, email, dept_id" onDone={refresh} />}
      >
        {data.departments.length === 0 ? (
          <p className="text-sm text-slate-500">Create a department first.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <Field label="Full name">
              {(id) => (
                <TextInput id={id} ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
              )}
            </Field>
            <Field label="Email (optional)">
              {(id) => <TextInput id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </Field>
            <Field label="Department">
              {(id) => (
                <SelectInput id={id} value={form.dept_id} onChange={(e) => setForm({ ...form, dept_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <div className="flex gap-2">
              {editor.editing && <Button onClick={() => editor.setEditing(null)}>Cancel</Button>}
              <Button type="submit" variant="primary" busy={editor.saving}>
                {editor.editing ? 'Save changes' : 'Add faculty'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Faculty" description={`${data.faculty.length} members · weekly load out of ${slots} periods`}>
        {data.faculty.length === 0 ? (
          <EmptyState icon={<Users size={20} aria-hidden />} title="No faculty members yet" />
        ) : (
          <DataTable head={['Name', 'Email', 'Department', 'Teaches', 'Weekly load', '']}>
            {data.faculty.map((f) => {
              const load = data.timetable.filter((t) => t.faculty_id === f.id).length;
              const subjects = data.faculty_subjects
                .filter((fs) => fs.faculty_id === f.id)
                .map((fs) => data.subjects.find((s) => s.id === fs.subject_id)?.code)
                .filter(Boolean);
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{f.name}</td>
                  <td className="px-5 py-3 text-slate-600">{f.email || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{deptName(f.dept_id)}</td>
                  <td className="px-5 py-3 text-slate-600">{subjects.length ? subjects.join(', ') : '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 tabular-nums text-slate-700">{load}</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div className="h-full bg-indigo-600" style={{ width: `${slots ? Math.min(100, (load / slots) * 100) : 0}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-2">
                    <RowActions name={f.name} onEdit={() => editor.setEditing(f)} onDelete={() => editor.requestDelete(f)} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>
      {editor.dialog}
    </div>
  );
}
