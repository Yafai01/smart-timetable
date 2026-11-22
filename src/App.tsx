import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, Building2, CalendarDays, Clock, DoorOpen, GraduationCap, LayoutDashboard, Menu as MenuIcon, Monitor, Moon, RefreshCw, Sun, Users, X } from 'lucide-react';
import { api, send } from './api';
import { EMPTY_DATA, type AppData, type Intent, type Page, type ScheduleSettings, type Conflict } from './types';
import { useTheme, type ThemePref } from './theme';
import { Button, Skeleton, ToastProvider, useToast } from './ui';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Faculty from './pages/Faculty';
import Availability from './pages/Availability';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import Rooms from './pages/Rooms';
import Timetables from './pages/Timetables';

const NAV: { page: Page; label: string; icon: React.ReactNode; description: string; group: 'plan' | 'data' }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} aria-hidden />, description: 'Overview, issues and timetable generation', group: 'plan' },
  { page: 'timetables', label: 'Timetables', icon: <CalendarDays size={16} aria-hidden />, description: 'Weekly schedules by class, teacher or room', group: 'plan' },
  { page: 'availability', label: 'Availability', icon: <Clock size={16} aria-hidden />, description: 'Periods when each faculty member cannot teach', group: 'plan' },
  { page: 'departments', label: 'Departments', icon: <Building2 size={16} aria-hidden />, description: 'Academic departments that own subjects, classes and faculty', group: 'data' },
  { page: 'faculty', label: 'Faculty', icon: <Users size={16} aria-hidden />, description: 'Teaching staff and their weekly load', group: 'data' },
  { page: 'subjects', label: 'Subjects', icon: <BookOpen size={16} aria-hidden />, description: 'Courses, weekly periods and assigned teachers', group: 'data' },
  { page: 'classes', label: 'Classes', icon: <GraduationCap size={16} aria-hidden />, description: 'Student groups and their size', group: 'data' },
  { page: 'rooms', label: 'Rooms', icon: <DoorOpen size={16} aria-hidden />, description: 'Classrooms and labs with seating capacity', group: 'data' },
];

const pageFromHash = (): Page => {
  const p = window.location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.page === p) ? (p as Page) : 'dashboard';
};

/** Hash-based routing: each page has a URL, and back/forward work. */
function useHashPage() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((p: Page) => {
    if (pageFromHash() !== p) window.location.hash = `/${p}`;
    setPage(p);
  }, []);
  return [page, go] as const;
}

function ThemeSwitch({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const opts: { v: ThemePref; icon: React.ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun size={14} aria-hidden />, label: 'Light theme' },
    { v: 'system', icon: <Monitor size={14} aria-hidden />, label: 'Match system theme' },
    { v: 'dark', icon: <Moon size={14} aria-hidden />, label: 'Dark theme' },
  ];
  return (
    <div role="group" aria-label="Theme" className="flex rounded-md border border-line bg-subtle p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          aria-label={o.label}
          title={o.label}
          onClick={() => onChange(o.v)}
          className={`flex h-6 flex-1 items-center justify-center rounded ${value === o.v ? 'bg-surface text-fg shadow-[0_0_0_1px_var(--line)]' : 'text-fg-subtle hover:text-fg'}`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading data">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[84px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function Shell() {
  const toast = useToast();
  const [page, go] = useHashPage();
  const [theme, setTheme] = useTheme();
  const [intent, setIntent] = useState<Intent>(null);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [settings, setSettings] = useState<ScheduleSettings>(EMPTY_DATA.settings);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const load = useCallback(async (initial = false) => {
    try {
      const d = await api<AppData>('/api/data');
      setData(d);
      if (initial) setSettings(d.settings);
      setStatus('ready');
    } catch (err) {
      const message = (err as Error).message;
      // Once data is on screen, a failed refresh is a toast, not a full-page error.
      if (statusRef.current === 'ready') toast('error', `Could not refresh data: ${message}`);
      else {
        setLoadError(message);
        setStatus('error');
      }
    }
  }, [toast]);
  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const label = NAV.find((n) => n.page === page)?.label;
    document.title = page === 'dashboard' ? 'Smart Timetable — conflict-free college scheduling' : `${label} · Smart Timetable`;
  }, [page]);

  const navigate = (p: Page, i: Intent = null) => {
    go(p);
    setIntent(i);
    setMenuOpen(false);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api<{ count: number; conflicts: Conflict[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ workingDays: settings.workingDays, periodsPerDay: settings.periodsPerDay }),
      });
      await refresh();
      toast(
        'success',
        res.conflicts.length === 0
          ? `Timetable generated: ${res.count} periods scheduled with no issues.`
          : `Timetable generated: ${res.count} periods scheduled, ${res.conflicts.length} ${res.conflicts.length === 1 ? 'issue' : 'issues'} to review.`,
      );
    } catch (err) {
      toast('error', `Generation failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveTimes = async (t: { startTime: string; periodMinutes: number }) => {
    try {
      await send('PUT', '/api/settings', t);
      await refresh();
      toast('success', 'Period times saved.');
      return true;
    } catch (err) {
      toast('error', (err as Error).message);
      return false;
    }
  };

  const current = NAV.find((n) => n.page === page)!;
  const clearIntent = () => setIntent(null);

  const content = () => {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            data={data}
            settings={settings}
            onSettingsChange={setSettings}
            onSaveTimes={saveTimes}
            onGenerate={generate}
            generating={generating}
            navigate={navigate}
          />
        );
      case 'departments':
        return <Departments data={data} refresh={refresh} />;
      case 'faculty':
        return <Faculty data={data} refresh={refresh} openForm={intent === 'new-faculty'} navigate={navigate} />;
      case 'availability':
        return <Availability data={data} refresh={refresh} navigate={navigate} />;
      case 'subjects':
        return <Subjects data={data} refresh={refresh} newLab={intent === 'new-lab-subject'} navigate={navigate} />;
      case 'classes':
        return <Classes data={data} refresh={refresh} openForm={intent === 'new-class'} navigate={navigate} />;
      case 'rooms':
        return <Rooms data={data} refresh={refresh} />;
      case 'timetables':
        return <Timetables data={data} printAll={intent === 'print-all'} onPrinted={clearIntent} navigate={navigate} onGenerate={generate} generating={generating} />;
    }
  };

  const issueCount = data.conflicts.length;
  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {(['plan', 'data'] as const).map((group) => (
        <div key={group}>
          <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{group === 'plan' ? 'Schedule' : 'Data'}</div>
          <div className="space-y-px">
            {NAV.filter((n) => n.group === group).map((n) => (
              <a
                key={n.page}
                href={`#/${n.page}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(n.page);
                }}
                aria-current={page === n.page ? 'page' : undefined}
                className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                  page === n.page ? 'bg-subtle text-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg'
                }`}
              >
                <span className={page === n.page ? 'text-accent-text' : 'text-fg-subtle'}>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {n.page === 'dashboard' && issueCount > 0 && status === 'ready' && (
                  <span className="rounded bg-warning-soft px-1.5 text-[11px] font-medium tabular-nums text-warning" title={`${issueCount} issues`}>
                    {issueCount}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-6 w-6" />
      <span className="text-[13px] font-semibold tracking-tight text-fg">Smart Timetable</span>
    </div>
  );

  const sidebarFooter = (
    <div className="space-y-2 border-t border-line p-3">
      <ThemeSwitch value={theme} onChange={setTheme} />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-fg print:bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-surface print:hidden lg:flex">
        <div className="flex h-12 items-center border-b border-line px-4">{brand}</div>
        {nav}
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface">
            <div className="flex h-12 items-center justify-between border-b border-line px-4">
              {brand}
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-fg-subtle hover:bg-subtle hover:text-fg">
                <X size={18} aria-hidden />
              </button>
            </div>
            {nav}
            {sidebarFooter}
          </aside>
        </div>
      )}

      <div className="lg:pl-56 print:pl-0">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur print:hidden sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="-ml-1.5 rounded-md p-1.5 text-fg-muted hover:bg-subtle lg:hidden">
              <MenuIcon size={18} aria-hidden />
            </button>
            <h1 className="truncate text-sm font-semibold text-fg">{current.label}</h1>
            <span className="hidden truncate text-[13px] text-fg-subtle md:inline">· {current.description}</span>
          </div>
          <Button
            size="sm"
            variant="primary"
            icon={<RefreshCw size={14} aria-hidden />}
            busy={generating}
            onClick={generate}
            disabled={status !== 'ready' || settings.workingDays.length === 0}
          >
            <span className="hidden sm:inline">Generate timetable</span>
            <span className="sm:hidden">Generate</span>
          </Button>
        </header>

        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 print:max-w-none print:p-0">
          {status === 'loading' && <LoadingSkeleton />}
          {status === 'error' && (
            <div role="alert" className="mx-auto mt-12 max-w-md rounded-lg border border-line bg-surface p-6 text-center">
              <AlertCircle size={22} className="mx-auto text-danger" aria-hidden />
              <p className="mt-3 text-sm font-medium text-fg">Could not load data</p>
              <p className="mt-1 text-[13px] text-fg-muted">{loadError}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          )}
          {status === 'ready' && content()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
