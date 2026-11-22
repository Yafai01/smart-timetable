import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { api } from './api';

// ---------- primitives ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-fg hover:bg-subtle border border-line-strong',
  ghost: 'bg-transparent text-fg-muted hover:bg-subtle hover:text-fg border border-transparent',
  danger: 'bg-danger-solid text-white hover:opacity-90 border border-transparent',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; busy?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonSizes[size]} ${buttonStyles[variant]} ${className}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, tone = 'default', className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition-colors disabled:opacity-50 ${
        tone === 'danger' ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-subtle hover:text-fg'
      } ${className}`}
    />
  );
}

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-0.5">
      <IconButton label={`Edit ${name}`} onClick={onEdit}>
        <Pencil size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Delete ${name}`} tone="danger" onClick={onDelete}>
        <Trash2 size={15} aria-hidden />
      </IconButton>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  flush = false,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Remove body padding (for tables and grids that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

/** Page title row: heading, count/description and primary actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const controlBase =
  'rounded-md border border-line-strong bg-surface px-2.5 text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60';
const controlClass = `${controlBase} h-9 w-full text-sm`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function TextInput({ className = '', ...props }: React.ComponentProps<'input'>) {
  return <input {...props} className={`${controlClass} ${className}`} />;
}

export function SelectInput({ className = '', compact = false, ...props }: React.ComponentProps<'select'> & { compact?: boolean }) {
  // compact: toolbar-sized, as wide as its content.
  return <select {...props} className={`${compact ? `${controlBase} h-8 max-w-48 text-[13px]` : controlClass} pr-8 ${className}`} />;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded accent-[var(--accent)]" />
      {label}
    </label>
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const badgeTones: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg-muted border-line',
  accent: 'bg-accent-soft text-accent-text border-transparent',
  success: 'bg-success-soft text-success border-success-line',
  warning: 'bg-warning-soft text-warning border-warning-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-medium leading-4 tabular-nums ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-subtle text-fg-muted">{icon}</div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-fg-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Compact usage bar with a numeric "value / max" label. */
export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] tabular-nums text-fg-muted">
        {value}
        <span className="text-fg-subtle"> / {max}</span>
      </span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-subtle ${className}`} aria-hidden />;
}

/** Segmented control for a small set of mutually exclusive options. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-9 items-center rounded-md border border-line-strong bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-full items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition-colors ${
            value === o.value ? 'bg-surface text-fg shadow-[0_0_0_1px_var(--line)]' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-subtle text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <tr>
            {head.map((h, i) => (
              <th key={h || i} scope="col" className={`h-9 px-4 font-medium ${i === head.length - 1 && h === '' ? 'text-right' : ''}`}>
                {h || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&>tr]:h-11 [&>tr:hover]:bg-subtle/60">{children}</tbody>
      </table>
    </div>
  );
}

/** Dropdown menu of actions. Closes on outside click, Escape or selection. */
export function Menu({
  label,
  icon,
  items,
  align = 'end',
}: {
  label: string;
  icon?: React.ReactNode;
  items: { label: string; icon?: React.ReactNode; onSelect: () => void; disabled?: boolean; hint?: string }[];
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <Button icon={icon} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
        {label}
        <ChevronDown size={14} className="-mr-1 text-fg-subtle" aria-hidden />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKey}
          className={`absolute z-30 mt-1 min-w-56 rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[13px] text-fg hover:bg-subtle focus:bg-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-fg-subtle">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-[11px] text-fg-subtle">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- toasts ----------

interface Toast { id: number; tone: 'success' | 'error'; message: string }
const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone: Toast['tone'], message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 print:hidden sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border border-line bg-surface p-3 text-[13px] text-fg shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)]"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 size={16} className="mt-px shrink-0 text-success" aria-hidden />
            ) : (
              <AlertCircle size={16} className="mt-px shrink-0 text-danger" aria-hidden />
            )}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded text-fg-subtle hover:text-fg">
              <X size={15} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- dialogs ----------

/** Keeps a native <dialog> in sync with `open`; Escape calls onClose. */
function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-fg shadow-[0_24px_48px_-12px_rgb(0_0_0/0.35)]"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-sm font-semibold text-fg">
          {title}
        </h2>
        <div className="mt-2 text-[13px] text-fg-muted">{message}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} busy={busy} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

/**
 * Side drawer holding a form. The form's submit button lives in the footer
 * and targets the form by id, so Enter submits from any field.
 */
export function Drawer({
  open,
  title,
  description,
  formId,
  submitLabel,
  busy,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  formId: string;
  submitLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  const ref = useDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes the drawer.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="drawer w-full max-w-md border-l border-line bg-surface p-0 text-fg sm:w-[28rem]"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-fg">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} disabled={busy}>
              <X size={16} aria-hidden />
            </IconButton>
          </div>
          <form id={formId} onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {children}
          </form>
          <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="primary" busy={busy}>
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

// ---------- CSV import ----------

export function CsvImport({ type, columns, onDone }: { type: string; columns: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const res = await api<{ count: number }>(`/api/upload/${type}`, { method: 'POST', body: form });
      toast('success', `Imported ${res.count} ${res.count === 1 ? 'row' : 'rows'}.`);
      onDone();
    } catch (err) {
      toast('error', `Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={onChange} tabIndex={-1} aria-hidden />
      <Button icon={<Upload size={15} aria-hidden />} busy={busy} onClick={() => input.current?.click()} title={`CSV columns: ${columns}`}>
        Import CSV
      </Button>
    </>
  );
}
