import { useState } from 'react';
import { send } from './api';
import { ConfirmDialog, useToast } from './ui';

/**
 * Shared create / edit / delete flow for a REST resource such as
 * `/api/rooms`. Pages own their form state; this hook owns the requests,
 * busy flags, toasts, the drawer's open state and the delete confirmation.
 */
export function useEntityEditor<T extends { id: number; name: string }>(resource: string, label: string, refresh: () => Promise<void>) {
  const toast = useToast();
  const [editing, setEditingRow] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Open the drawer to edit a row. */
  const setEditing = (row: T | null) => {
    setEditingRow(row);
    setCreating(false);
  };
  /** Open the drawer with an empty form. */
  const openNew = () => {
    setEditingRow(null);
    setCreating(true);
  };
  const close = () => {
    setEditingRow(null);
    setCreating(false);
  };

  /** Returns true on success; the drawer closes. */
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
      close();
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
      if (editing?.id === pendingDelete.id) close();
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
          <strong className="font-medium text-fg">{pendingDelete?.name}</strong> will be permanently deleted, along with any
          timetable periods that use it. This cannot be undone.
        </>
      }
      busy={deleting}
      onConfirm={confirmDelete}
      onCancel={() => setPendingDelete(null)}
    />
  );

  return { editing, setEditing, creating, open: creating || editing !== null, openNew, close, saving, save, requestDelete: setPendingDelete, dialog };
}
