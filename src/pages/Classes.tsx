import { useEffect, useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import type { AppData, ClassGroup, Page } from '../types';
import { Badge, Button, Card, CsvImport, DataTable, Drawer, EmptyState, Field, PageHeader, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';
import { NeedsDepartment } from './Faculty';

const blank = { name: '', dept_id: '', student_count: '30' };

export default function Classes({
  data,
  refresh,
  openForm,
  navigate,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  openForm: boolean;
  navigate: (p: Page) => void;
}) {
  const editor = useEntityEditor<ClassGroup>('classes', 'Class', refresh);
  const [form, setForm] = useState(blank);
  const noDepts = data.departments.length === 0;

  useEffect(() => {
    if (!editor.open) return;
    const c = editor.editing;
    setForm(c ? { name: c.name, dept_id: String(c.dept_id ?? ''), student_count: String(c.student_count) } : blank);
  }, [editor.open, editor.editing]);

  useEffect(() => {
    if (openForm && !noDepts) editor.openNew();
  }, [openForm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editor.save({ name: form.name, dept_id: Number(form.dept_id), student_count: Number(form.student_count) });
  };

  const deptName = (id: number) => data.departments.find((d) => d.id === id)?.name ?? '—';
  const add = (
    <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={editor.openNew} disabled={noDepts}>
      Add class
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All classes"
        description={`${data.classes.length} ${data.classes.length === 1 ? 'class' : 'classes'}`}
        actions={
          <>
            <CsvImport type="classes" columns="name, dept_id, student_count" onDone={refresh} />
            {add}
          </>
        }
      />

      <Card flush>
        {data.classes.length === 0 ? (
          noDepts ? (
            <NeedsDepartment what="class" navigate={navigate} />
          ) : (
            <EmptyState icon={<GraduationCap size={18} aria-hidden />} title="No classes yet" action={add}>
              A class is a student group. It takes every subject in its department.
            </EmptyState>
          )
        ) : (
          <DataTable head={['Name', 'Department', 'Students', 'Subjects', 'Scheduled', '']}>
            {data.classes.map((c) => {
              const subjects = data.subjects.filter((s) => s.dept_id === c.dept_id);
              const required = subjects.reduce((n, s) => n + s.periods_per_week, 0);
              const scheduled = data.timetable.filter((t) => t.class_id === c.id).length;
              return (
                <tr key={c.id}>
                  <td className="px-4 font-medium text-fg">{c.name}</td>
                  <td className="px-4 text-fg-muted">{deptName(c.dept_id)}</td>
                  <td className="px-4 tabular-nums text-fg-muted">{c.student_count}</td>
                  <td className="px-4 tabular-nums text-fg-muted">{subjects.length}</td>
                  <td className="px-4">
                    {scheduled < required ? (
                      <Badge tone="warning">
                        {scheduled} / {required} periods
                      </Badge>
                    ) : (
                      <span className="text-[13px] tabular-nums text-fg-muted">
                        {scheduled} / {required}
                      </span>
                    )}
                  </td>
                  <td className="px-4">
                    <RowActions name={c.name} onEdit={() => editor.setEditing(c)} onDelete={() => editor.requestDelete(c)} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Drawer
        open={editor.open}
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add class or section'}
        formId="class-form"
        submitLabel={editor.editing ? 'Save changes' : 'Add class'}
        busy={editor.saving}
        onClose={editor.close}
        onSubmit={submit}
      >
        <Field label="Class name" hint="For example CS Year 2 — Section A">
          {(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoFocus />}
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
        <Field label="Students" hint="Used to pick a room with enough seats.">
          {(id) => (
            <TextInput
              id={id}
              type="number"
              min={1}
              max={10000}
              value={form.student_count}
              onChange={(e) => setForm({ ...form, student_count: e.target.value })}
              required
              className="tabular-nums"
            />
          )}
        </Field>
      </Drawer>
      {editor.dialog}
    </div>
  );
}
