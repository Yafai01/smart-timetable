import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { ALL_DAYS, MAX_PERIODS_PER_DAY, type AppData, type Page, type Subject } from '../types';
import { Badge, Button, Card, Checkbox, CsvImport, DataTable, Drawer, EmptyState, Field, PageHeader, RowActions, SelectInput, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';
import { subjectTones } from '../schedule';
import { NeedsDepartment } from './Faculty';

const blank = { name: '', code: '', periods_per_week: '3', dept_id: '', faculty_id: '', is_lab: false };

export default function Subjects({
  data,
  refresh,
  newLab,
  navigate,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  newLab: boolean;
  navigate: (p: Page) => void;
}) {
  const editor = useEntityEditor<Subject>('subjects', 'Subject', refresh);
  const [form, setForm] = useState(blank);
  const [labPreset, setLabPreset] = useState(false);
  const noDepts = data.departments.length === 0;
  const tones = useMemo(() => subjectTones(data), [data]);

  const teacherOf = (subjectId: number) => data.faculty_subjects.find((fs) => fs.subject_id === subjectId)?.faculty_id;

  useEffect(() => {
    if (!editor.open) return;
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
        : labPreset
          ? { ...blank, is_lab: true, periods_per_week: '2' }
          : blank,
    );
  }, [editor.open, editor.editing]);

  useEffect(() => {
    if (newLab && !noDepts) {
      setLabPreset(true);
      editor.openNew();
    }
  }, [newLab]);

  const close = () => {
    setLabPreset(false);
    editor.close();
  };

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
    if (ok) setLabPreset(false);
  };

  const name = (rows: { id: number; name: string }[], id?: number) => rows.find((r) => r.id === id)?.name;
  const maxPeriods = ALL_DAYS.length * MAX_PERIODS_PER_DAY;
  const unassigned = data.subjects.filter((s) => teacherOf(s.id) === undefined).length;
  const add = (
    <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={editor.openNew} disabled={noDepts}>
      Add subject
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All subjects"
        description={
          <>
            {data.subjects.length} {data.subjects.length === 1 ? 'subject' : 'subjects'}
            {unassigned > 0 && <span className="text-warning"> · {unassigned} without a teacher (not scheduled)</span>}
          </>
        }
        actions={
          <>
            <CsvImport type="subjects" columns="name, code, periods_per_week, is_lab, dept_id, faculty_id (optional)" onDone={refresh} />
            {add}
          </>
        }
      />

      <Card flush>
        {data.subjects.length === 0 ? (
          noDepts ? (
            <NeedsDepartment what="subject" navigate={navigate} />
          ) : (
            <EmptyState icon={<BookOpen size={18} aria-hidden />} title="No subjects yet" action={add}>
              Every class in a subject's department takes it. Assign a teacher so it can be scheduled.
            </EmptyState>
          )
        ) : (
          <DataTable head={['Code', 'Name', 'Department', 'Type', 'Periods / week', 'Teacher', '']}>
            {data.subjects.map((s) => {
              const teacher = name(data.faculty, teacherOf(s.id));
              return (
                <tr key={s.id}>
                  <td className="px-4">
                    <span className={`tone-${tones.get(s.id) ?? 0} inline-flex items-center gap-2 font-mono text-xs text-fg-muted`}>
                      <span className="h-2.5 w-2.5 rounded-sm bg-[var(--tone-bar)]" aria-hidden />
                      {s.code}
                    </span>
                  </td>
                  <td className="px-4 font-medium text-fg">{s.name}</td>
                  <td className="px-4 text-fg-muted">{name(data.departments, s.dept_id) ?? '—'}</td>
                  <td className="px-4">{s.is_lab ? <Badge tone="accent">Lab</Badge> : <Badge>Theory</Badge>}</td>
                  <td className="px-4 tabular-nums text-fg-muted">{s.periods_per_week}</td>
                  <td className="px-4 text-fg-muted">{teacher ?? <Badge tone="warning">Not assigned</Badge>}</td>
                  <td className="px-4">
                    <RowActions name={s.name} onEdit={() => editor.setEditing(s)} onDelete={() => editor.requestDelete(s)} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Drawer
        open={editor.open}
        title={editor.editing ? `Edit ${editor.editing.name}` : form.is_lab ? 'Add lab subject' : 'Add subject'}
        description="Every class in the subject's department takes it."
        formId="subject-form"
        submitLabel={editor.editing ? 'Save changes' : 'Add subject'}
        busy={editor.saving}
        onClose={close}
        onSubmit={submit}
      >
        <Field label="Subject name">
          {(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoFocus />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" hint="For example CS101">
            {(id) => <TextInput id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={20} className="font-mono" />}
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
                className="tabular-nums"
              />
            )}
          </Field>
        </div>
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
        <Field label="Teacher" hint="Subjects without a teacher are not scheduled.">
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
        <Checkbox label="Laboratory session (needs a lab room)" checked={form.is_lab} onChange={(is_lab) => setForm({ ...form, is_lab })} />
      </Drawer>
      {editor.dialog}
    </div>
  );
}
