import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import type { AppData, Department } from '../types';
import { Button, Card, CsvImport, DataTable, Drawer, EmptyState, Field, PageHeader, RowActions, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

export default function Departments({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const editor = useEntityEditor<Department>('departments', 'Department', refresh);
  const [name, setName] = useState('');

  useEffect(() => {
    if (editor.open) setName(editor.editing?.name ?? '');
  }, [editor.open, editor.editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editor.save({ name });
  };

  const count = (key: 'faculty' | 'classes' | 'subjects', id: number) => data[key].filter((x) => x.dept_id === id).length;
  const add = (
    <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={editor.openNew}>
      Add department
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All departments"
        description={`${data.departments.length} ${data.departments.length === 1 ? 'department' : 'departments'}`}
        actions={
          <>
            <CsvImport type="departments" columns="name" onDone={refresh} />
            {add}
          </>
        }
      />

      <Card flush>
        {data.departments.length === 0 ? (
          <EmptyState icon={<Building2 size={18} aria-hidden />} title="No departments yet" action={add}>
            Departments group faculty, subjects and classes. Add one to get started, or import a CSV file.
          </EmptyState>
        ) : (
          <DataTable head={['Name', 'Faculty', 'Subjects', 'Classes', '']}>
            {data.departments.map((d) => (
              <tr key={d.id}>
                <td className="px-4 font-medium text-fg">{d.name}</td>
                <td className="px-4 tabular-nums text-fg-muted">{count('faculty', d.id)}</td>
                <td className="px-4 tabular-nums text-fg-muted">{count('subjects', d.id)}</td>
                <td className="px-4 tabular-nums text-fg-muted">{count('classes', d.id)}</td>
                <td className="px-4">
                  <RowActions name={d.name} onEdit={() => editor.setEditing(d)} onDelete={() => editor.requestDelete(d)} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Drawer
        open={editor.open}
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add department'}
        formId="department-form"
        submitLabel={editor.editing ? 'Save changes' : 'Add department'}
        busy={editor.saving}
        onClose={editor.close}
        onSubmit={submit}
      >
        <Field label="Department name">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />}
        </Field>
      </Drawer>
      {editor.dialog}
    </div>
  );
}
