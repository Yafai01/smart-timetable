import { useEffect, useState } from 'react';
import { DoorOpen, Plus } from 'lucide-react';
import type { AppData, Room } from '../types';
import { Badge, Button, Card, Checkbox, CsvImport, DataTable, Drawer, EmptyState, Field, Meter, PageHeader, RowActions, TextInput } from '../ui';
import { useEntityEditor } from '../useEntityEditor';

const blank = { name: '', capacity: '', is_lab: false };

export default function Rooms({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const editor = useEntityEditor<Room>('rooms', 'Room', refresh);
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!editor.open) return;
    const r = editor.editing;
    setForm(r ? { name: r.name, capacity: String(r.capacity), is_lab: Boolean(r.is_lab) } : blank);
  }, [editor.open, editor.editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editor.save({ name: form.name, capacity: Number(form.capacity), is_lab: form.is_lab });
  };

  const slots = data.settings.workingDays.length * data.settings.periodsPerDay;
  const add = (
    <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={editor.openNew}>
      Add room
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All rooms"
        description={`${data.rooms.length} ${data.rooms.length === 1 ? 'room' : 'rooms'} · usage out of ${slots} weekly periods`}
        actions={
          <>
            <CsvImport type="rooms" columns="name, capacity, is_lab" onDone={refresh} />
            {add}
          </>
        }
      />

      <Card flush>
        {data.rooms.length === 0 ? (
          <EmptyState icon={<DoorOpen size={18} aria-hidden />} title="No rooms yet" action={add}>
            Add classrooms and labs with their seating capacity so the generator can place classes.
          </EmptyState>
        ) : (
          <DataTable head={['Name', 'Type', 'Capacity', 'Usage', '']}>
            {data.rooms.map((r) => {
              const booked = data.timetable.filter((t) => t.room_id === r.id).length;
              return (
                <tr key={r.id}>
                  <td className="px-4 font-medium text-fg">{r.name}</td>
                  <td className="px-4">{r.is_lab ? <Badge tone="accent">Lab</Badge> : <Badge>Classroom</Badge>}</td>
                  <td className="px-4 tabular-nums text-fg-muted">{r.capacity}</td>
                  <td className="px-4">
                    <Meter value={booked} max={slots} />
                  </td>
                  <td className="px-4">
                    <RowActions name={r.name} onEdit={() => editor.setEditing(r)} onDelete={() => editor.requestDelete(r)} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Drawer
        open={editor.open}
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add room or lab'}
        formId="room-form"
        submitLabel={editor.editing ? 'Save changes' : 'Add room'}
        busy={editor.saving}
        onClose={editor.close}
        onSubmit={submit}
      >
        <Field label="Room name">
          {(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoFocus />}
        </Field>
        <Field label="Capacity" hint="Seats available. Classes larger than this are not placed here.">
          {(id) => (
            <TextInput id={id} type="number" min={1} max={10000} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required className="tabular-nums" />
          )}
        </Field>
        <Checkbox label="Laboratory (only lab subjects are placed here)" checked={form.is_lab} onChange={(is_lab) => setForm({ ...form, is_lab })} />
      </Drawer>
      {editor.dialog}
    </div>
  );
}
