import { useEffect, useRef, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import type { AppData, Room } from '../types';
import { Badge, Button, Card, Checkbox, CsvImport, DataTable, EmptyState, Field, RowActions, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', capacity: '', is_lab: false };

export default function Rooms({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const editor = useEntityEditor<Room>('rooms', 'Room', refresh);
  const [form, setForm] = useState(blank);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const r = editor.editing;
    setForm(r ? { name: r.name, capacity: String(r.capacity), is_lab: Boolean(r.is_lab) } : blank);
    if (r) nameRef.current?.focus();
  }, [editor.editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await editor.save({ name: form.name, capacity: Number(form.capacity), is_lab: form.is_lab })) setForm(blank);
  };

  const slots = data.settings.workingDays.length * data.settings.periodsPerDay;

  return (
    <div className="space-y-6">
      <Card
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add room or lab'}
        actions={!editor.editing && <CsvImport type="rooms" columns="name, capacity, is_lab" onDone={refresh} />}
      >
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_10rem_auto_auto] md:items-end">
          <Field label="Room name">
            {(id) => <TextInput id={id} ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />}
          </Field>
          <Field label="Capacity">
            {(id) => (
              <TextInput id={id} type="number" min={1} max={10000} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
            )}
          </Field>
          <div className="pb-2">
            <Checkbox label="Laboratory" checked={form.is_lab} onChange={(is_lab) => setForm({ ...form, is_lab })} />
          </div>
          <div className="flex gap-2">
            {editor.editing && <Button onClick={() => editor.setEditing(null)}>Cancel</Button>}
            <Button type="submit" variant="primary" busy={editor.saving}>
              {editor.editing ? 'Save changes' : 'Add room'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Rooms" description={`${data.rooms.length} total · usage is out of ${slots} weekly periods. Room schedules are under Timetables.`}>
        {data.rooms.length === 0 ? (
          <EmptyState icon={<DoorOpen size={20} aria-hidden />} title="No rooms yet" />
        ) : (
          <DataTable head={['Name', 'Type', 'Capacity', 'Booked periods', '']}>
            {data.rooms.map((r) => {
              const booked = data.timetable.filter((t) => t.room_id === r.id).length;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-5 py-3">{r.is_lab ? <Badge tone="accent">Lab</Badge> : <Badge>Classroom</Badge>}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{r.capacity}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">
                    {booked} / {slots}
                  </td>
                  <td className="px-5 py-2">
                    <RowActions name={r.name} onEdit={() => editor.setEditing(r)} onDelete={() => editor.requestDelete(r)} />
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
