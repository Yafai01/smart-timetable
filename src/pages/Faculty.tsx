import { useEffect, useState } from 'react';
import { Building2, Plus, Users } from 'lucide-react';
import type { AppData, Faculty as FacultyRow, Page } from '../types';
import { Button, Card, CsvImport, DataTable, Drawer, EmptyState, Field, Meter, PageHeader, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', email: '', dept_id: '' };

/** Shown on pages whose records belong to a department when none exist yet. */
export function NeedsDepartment({ what, navigate }: { what: string; navigate: (p: Page) => void }) {
  return (
    <EmptyState
      icon={<Building2 size={18} aria-hidden />}
      title="Add a department first"
      action={
        <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => navigate('departments')}>
          Go to departments
        </Button>
      }
    >
      Every {what} belongs to a department.
    </EmptyState>
  );
}

export default function Faculty({
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
  const editor = useEntityEditor<FacultyRow>('faculty', 'Faculty member', refresh);
  const [form, setForm] = useState(blank);
  const noDepts = data.departments.length === 0;

  useEffect(() => {
    if (!editor.open) return;
    const f = editor.editing;
    setForm(f ? { name: f.name, email: f.email ?? '', dept_id: String(f.dept_id ?? '') } : blank);
  }, [editor.open, editor.editing]);

  useEffect(() => {
    if (openForm && !noDepts) editor.openNew();
  }, [openForm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editor.save({ ...form, dept_id: Number(form.dept_id) });
  };

  const slots = data.settings.workingDays.length * data.settings.periodsPerDay;
  const deptName = (id: number) => data.departments.find((d) => d.id === id)?.name ?? '—';
  const add = (
    <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={editor.openNew} disabled={noDepts}>
      Add faculty
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All faculty"
        description={`${data.faculty.length} ${data.faculty.length === 1 ? 'member' : 'members'} · weekly load out of ${slots} periods`}
        actions={
          <>
            <CsvImport type="faculty" columns="name, email, dept_id" onDone={refresh} />
            {add}
          </>
        }
      />

      <Card flush>
        {data.faculty.length === 0 ? (
          noDepts ? (
            <NeedsDepartment what="faculty member" navigate={navigate} />
          ) : (
            <EmptyState icon={<Users size={18} aria-hidden />} title="No faculty members yet" action={add}>
              Add teaching staff, then assign them to subjects.
            </EmptyState>
          )
        ) : (
          <DataTable head={['Name', 'Email', 'Department', 'Teaches', 'Weekly load', '']}>
            {data.faculty.map((f) => {
              const load = data.timetable.filter((t) => t.faculty_id === f.id).length;
              const subjects = data.faculty_subjects
                .filter((fs) => fs.faculty_id === f.id)
                .map((fs) => data.subjects.find((s) => s.id === fs.subject_id)?.code)
                .filter(Boolean);
              return (
                <tr key={f.id}>
                  <td className="px-4 font-medium text-fg">{f.name}</td>
                  <td className="px-4 text-fg-muted">{f.email || '—'}</td>
                  <td className="px-4 text-fg-muted">{deptName(f.dept_id)}</td>
                  <td className="px-4 font-mono text-xs text-fg-muted">{subjects.length ? subjects.join(', ') : '—'}</td>
                  <td className="px-4">
                    <Meter value={load} max={slots} />
                  </td>
                  <td className="px-4">
                    <RowActions name={f.name} onEdit={() => editor.setEditing(f)} onDelete={() => editor.requestDelete(f)} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Drawer
        open={editor.open}
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add faculty member'}
        formId="faculty-form"
        submitLabel={editor.editing ? 'Save changes' : 'Add faculty'}
        busy={editor.saving}
        onClose={editor.close}
        onSubmit={submit}
      >
        <Field label="Full name">
          {(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoFocus />}
        </Field>
        <Field label="Email" hint="Optional.">
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
      </Drawer>
      {editor.dialog}
    </div>
  );
}
