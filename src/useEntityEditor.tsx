import { useState } from 'react';
import { send } from './api';
import { ConfirmDialog, useToast } from './ui';

/**
 * Shared create / edit / delete flow for a REST resource such as
 * `/api/rooms`. Pages own their form state; this hook owns the requests,
 * busy flags, toasts and the delete confirmation dialog.
 */
export function useEntityEditor<T extends { id: number; name: string }>(resource: string, label: string, refresh: () => Promise<void>) {
  const toast = useToast();
  const [editing, setEditing] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Returns true on success so the caller can reset its form. */
  const save = async (payload: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    try {
      if (editing) {
        await send('PUT', `/api/${resource}/${editing.id}`, payload);
        toast('success', `${label} updated.`);
      } else {
        await send('POST', `/api/${resource}`, payload);
        toast('success', `${label} added.`);
      }
      setEditing(null);
      await refresh();
      return true;
    } catch (err) {
      toast('error', (err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await send<{ removedEntries?: number }>('DELETE', `/api/${resource}/${pendingDelete.id}`);
      const removed = res.removedEntries ?? 0;
      toast(
        'success',
        removed > 0
          ? `${pendingDelete.name} deleted. ${removed} scheduled ${removed === 1 ? 'period was' : 'periods were'} removed; regenerate the timetable to fill the gaps.`
          : `${pendingDelete.name} deleted.`,
      );
      if (editing?.id === pendingDelete.id) setEditing(null);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      toast('error', (err as Error).message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={pendingDelete !== null}
      title={`Delete ${label.toLowerCase()}?`}
      message={
        <>
          <strong className="font-medium text-slate-900">{pendingDelete?.name}</strong> will be permanently deleted, along with any
          timetable periods that use it. This cannot be undone.
        </>
      }
      busy={deleting}
      onConfirm={confirmDelete}
      onCancel={() => setPendingDelete(null)}
    />
  );

  return { editing, setEditing, saving, save, requestDelete: setPendingDelete, dialog };
}
