import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ALL_DAYS, MAX_PERIODS_PER_DAY, type AppData, type Subject } from '../types';
import { Badge, Button, Card, Checkbox, CsvImport, DataTable, EmptyState, Field, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', code: '', periods_per_week: '3', dept_id: '', faculty_id: '', is_lab: false };

export default function Subjects({ data, refresh, newLab }: { data: AppData; refresh: () => Promise<void>; newLab: boolean }) {
  const editor = useEntityEditor<Subject>('subjects', 'Subject', refresh);
  const [form, setForm] = useState(blank);
  const nameRef = useRef<HTMLInputElement>(null);

  const teacherOf = (subjectId: number) => data.faculty_subjects.find((fs) => fs.subject_id === subjectId)?.faculty_id;

  useEffect(() => {
    const s = editor.editing;
    setForm(
      s
        ? {
            name: s.name,
            code: s.code,
            periods_per_week: String(s.periods_per_week),
            dept_id: String(s.dept_id ?? ''),
            faculty_id: String(teacherOf(s.id) ?? ''),
            is_lab: Boolean(s.is_lab),
          }
        : blank,
    );
    if (s) nameRef.current?.focus();
  }, [editor.editing]);

  useEffect(() => {
    if (newLab) {
      setForm({ ...blank, is_lab: true, periods_per_week: '2' });
      nameRef.current?.focus();
    }
  }, [newLab]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await editor.save({
      name: form.name,
      code: form.code,
      periods_per_week: Number(form.periods_per_week),
      is_lab: form.is_lab,
      dept_id: Number(form.dept_id),
      faculty_id: form.faculty_id ? Number(form.faculty_id) : null,
    });
    if (ok) setForm(blank);
  };

  const name = (rows: { id: number; name: string }[], id?: number) => rows.find((r) => r.id === id)?.name;
  const maxPeriods = ALL_DAYS.length * MAX_PERIODS_PER_DAY;

  return (
    <div className="space-y-6">
      <Card
        title={editor.editing ? `Edit ${editor.editing.name}` : form.is_lab ? 'Add lab subject' : 'Add subject'}
        description="Every class in the subject's department takes the subject. Assign a teacher so it can be scheduled."
        actions={!editor.editing && <CsvImport type="subjects" columns="name, code, periods_per_week, is_lab, dept_id, faculty_id (optional)" onDone={refresh} />}
      >
        {data.departments.length === 0 ? (
          <p className="text-sm text-slate-500">Create a department first.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Subject name">
              {(id) => <TextInput id={id} ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />}
            </Field>
            <Field label="Code" hint="For example CS101">
              {(id) => <TextInput id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={20} />}
            </Field>
            <Field label="Periods per week">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={maxPeriods}
                  step={1}
                  value={form.periods_per_week}
                  onChange={(e) => setForm({ ...form, periods_per_week: e.target.value })}
                  required
                />
              )}
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
            <Field label="Teacher">
              {(id) => (
                <SelectInput id={id} value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}>
                  <option value="">Not assigned</option>
                  {data.faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox label="Laboratory session (needs a lab room)" checked={form.is_lab} onChange={(is_lab) => setForm({ ...form, is_lab })} />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" variant="primary" busy={editor.saving}>
                {editor.editing ? 'Save changes' : 'Add subject'}
              </Button>
              {(editor.editing || form !== blank) && (
                <Button
                  onClick={() => {
                    editor.setEditing(null);
                    setForm(blank);
                  }}
                >
                  {editor.editing ? 'Cancel' : 'Clear'}
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      <Card title="Subjects" description={`${data.subjects.length} total`}>
        {data.subjects.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} aria-hidden />} title="No subjects yet" />
        ) : (
          <DataTable head={['Code', 'Name', 'Department', 'Type', 'Periods / week', 'Teacher', '']}>
            {data.subjects.map((s) => {
              const teacher = name(data.faculty, teacherOf(s.id));
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.code}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3 text-slate-600">{name(data.departments, s.dept_id) ?? '—'}</td>
                  <td className="px-5 py-3">{s.is_lab ? <Badge tone="accent">Lab</Badge> : <Badge>Theory</Badge>}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{s.periods_per_week}</td>
                  <td className="px-5 py-3 text-slate-600">{teacher ?? <Badge tone="warning">Not assigned</Badge>}</td>
                  <td className="px-5 py-2">
                    <RowActions name={s.name} onEdit={() => editor.setEditing(s)} onDelete={() => editor.requestDelete(s)} />
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
