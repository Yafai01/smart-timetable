import { useEffect, useRef, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { AppData, ClassGroup } from '../types';
import { Button, Card, CsvImport, DataTable, EmptyState, Field, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', dept_id: '', student_count: '30' };

export default function Classes({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const editor = useEntityEditor<ClassGroup>('classes', 'Class', refresh);
  const [form, setForm] = useState(blank);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = editor.editing;
    setForm(c ? { name: c.name, dept_id: String(c.dept_id ?? ''), student_count: String(c.student_count) } : blank);
    if (c) nameRef.current?.focus();
  }, [editor.editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await editor.save({ name: form.name, dept_id: Number(form.dept_id), student_count: Number(form.student_count) })) setForm(blank);
  };

  const deptName = (id: number) => data.departments.find((d) => d.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <Card
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add class or section'}
        actions={!editor.editing && <CsvImport type="classes" columns="name, dept_id, student_count" onDone={refresh} />}
      >
        {data.departments.length === 0 ? (
          <p className="text-sm text-slate-500">Create a department first.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end">
            <Field label="Class name">
              {(id) => <TextInput id={id} ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />}
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
            <Field label="Students">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={10000}
                  value={form.student_count}
                  onChange={(e) => setForm({ ...form, student_count: e.target.value })}
                  required
                />
              )}
            </Field>
            <div className="flex gap-2">
              {editor.editing && <Button onClick={() => editor.setEditing(null)}>Cancel</Button>}
              <Button type="submit" variant="primary" busy={editor.saving}>
                {editor.editing ? 'Save changes' : 'Add class'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Classes" description={`${data.classes.length} total`}>
        {data.classes.length === 0 ? (
          <EmptyState icon={<GraduationCap size={20} aria-hidden />} title="No classes yet" />
        ) : (
          <DataTable head={['Name', 'Department', 'Students', 'Subjects', 'Scheduled periods', '']}>
            {data.classes.map((c) => {
              const subjects = data.subjects.filter((s) => s.dept_id === c.dept_id);
              const required = subjects.reduce((n, s) => n + s.periods_per_week, 0);
              const scheduled = data.timetable.filter((t) => t.class_id === c.id).length;
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-5 py-3 text-slate-600">{deptName(c.dept_id)}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{c.student_count}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{subjects.length}</td>
                  <td className={`px-5 py-3 tabular-nums ${scheduled < required ? 'text-amber-700' : 'text-slate-600'}`}>
                    {scheduled} / {required}
                  </td>
                  <td className="px-5 py-2">
                    <RowActions name={c.name} onEdit={() => editor.setEditing(c)} onDelete={() => editor.requestDelete(c)} />
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
