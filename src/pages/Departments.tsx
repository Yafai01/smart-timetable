import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { AppData, Department } from '../types';
import { Button, Card, CsvImport, DataTable, EmptyState, Field, RowActions, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

export default function Departments({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const editor = useEntityEditor<Department>('departments', 'Department', refresh);
  const [name, setName] = useState('');

  useEffect(() => setName(editor.editing?.name ?? ''), [editor.editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await editor.save({ name })) setName('');
  };

  const count = (key: 'faculty' | 'classes' | 'subjects', id: number) => data[key].filter((x) => x.dept_id === id).length;

  return (
    <div className="space-y-6">
      <Card
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add department'}
        actions={!editor.editing && <CsvImport type="departments" columns="name" onDone={refresh} />}
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Department name">
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />}
          </Field>
          <div className="flex gap-2">
            {editor.editing && <Button onClick={() => editor.setEditing(null)}>Cancel</Button>}
            <Button type="submit" variant="primary" busy={editor.saving}>
              {editor.editing ? 'Save changes' : 'Add department'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Departments" description={`${data.departments.length} total`}>
        {data.departments.length === 0 ? (
          <EmptyState icon={<Building2 size={20} aria-hidden />} title="No departments yet">
            Add a department above or import a CSV file.
          </EmptyState>
        ) : (
          <DataTable head={['Name', 'Faculty', 'Subjects', 'Classes', '']}>
            {data.departments.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{d.name}</td>
                <td className="px-5 py-3 text-slate-600">{count('faculty', d.id)}</td>
                <td className="px-5 py-3 text-slate-600">{count('subjects', d.id)}</td>
                <td className="px-5 py-3 text-slate-600">{count('classes', d.id)}</td>
                <td className="px-5 py-2">
                  <RowActions name={d.name} onEdit={() => editor.setEditing(d)} onDelete={() => editor.requestDelete(d)} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      {editor.dialog}
    </div>
  );
}
