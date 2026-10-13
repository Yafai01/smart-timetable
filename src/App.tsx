import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Building2, CalendarDays, Clock, DoorOpen, GraduationCap, LayoutDashboard, Loader2, Menu, RefreshCw, Users, X } from 'lucide-react';
import { api } from './api';
import { EMPTY_DATA, type AppData, type Intent, type Page, type ScheduleSettings, type Conflict } from './types';
import { Button, ToastProvider, useToast } from './ui';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Faculty from './pages/Faculty';
import Availability from './pages/Availability';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import Rooms from './pages/Rooms';
import Timetables from './pages/Timetables';

const NAV: { page: Page; label: string; icon: React.ReactNode; description: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} aria-hidden />, description: 'Overview, issues and timetable generation.' },
  { page: 'departments', label: 'Departments', icon: <Building2 size={18} aria-hidden />, description: 'Academic departments that own subjects, classes and faculty.' },
  { page: 'faculty', label: 'Faculty', icon: <Users size={18} aria-hidden />, description: 'Teaching staff and their weekly load.' },
  { page: 'availability', label: 'Availability', icon: <Clock size={18} aria-hidden />, description: 'Periods when each faculty member cannot teach.' },
  { page: 'subjects', label: 'Subjects', icon: <BookOpen size={18} aria-hidden />, description: 'Courses, weekly periods and assigned teachers.' },
  { page: 'classes', label: 'Classes', icon: <GraduationCap size={18} aria-hidden />, description: 'Student groups and their size.' },
  { page: 'rooms', label: 'Rooms', icon: <DoorOpen size={18} aria-hidden />, description: 'Classrooms and labs with seating capacity.' },
  { page: 'timetables', label: 'Timetables', icon: <CalendarDays size={18} aria-hidden />, description: 'Weekly schedules by class, faculty or room.' },
];

function Shell() {
  const toast = useToast();
  const [page, setPage] = useState<Page>('dashboard');
  const [intent, setIntent] = useState<Intent>(null);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [settings, setSettings] = useState<ScheduleSettings>(EMPTY_DATA.settings);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await api<AppData>('/api/data');
      setData(d);
      setStatus('ready');
    } catch (err) {
      setLoadError((err as Error).message);
      setStatus((s) => (s === 'ready' ? s : 'error'));
      if (status === 'ready') toast('error', `Could not refresh data: ${(err as Error).message}`);
    }
  }, [status, toast]);

  useEffect(() => {
    api<AppData>('/api/data')
      .then((d) => {
        setData(d);
        setSettings(d.settings);
        setStatus('ready');
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setStatus('error');
      });
  }, []);

  const navigate = (p: Page, i: Intent = null) => {
    setPage(p);
    setIntent(i);
    setMenuOpen(false);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api<{ count: number; conflicts: Conflict[] }>('/api/generate', { method: 'POST', body: JSON.stringify(settings) });
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

  const current = NAV.find((n) => n.page === page)!;

  const content = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard data={data} settings={settings} onSettingsChange={setSettings} onGenerate={generate} generating={generating} navigate={navigate} />;
      case 'departments':
        return <Departments data={data} refresh={refresh} />;
      case 'faculty':
        return <Faculty data={data} refresh={refresh} focusForm={intent === 'new-faculty'} />;
      case 'availability':
        return <Availability data={data} refresh={refresh} />;
      case 'subjects':
        return <Subjects data={data} refresh={refresh} newLab={intent === 'new-lab-subject'} />;
      case 'classes':
        return <Classes data={data} refresh={refresh} />;
      case 'rooms':
        return <Rooms data={data} refresh={refresh} />;
      case 'timetables':
        return <Timetables data={data} printAll={intent === 'print-all'} onPrinted={() => setIntent(null)} />;
    }
  };

  const nav = (
    <nav aria-label="Main" className="space-y-0.5 p-3">
      {NAV.map((n) => (
        <button
          key={n.page}
          type="button"
          onClick={() => navigate(n.page)}
          aria-current={page === n.page ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            page === n.page ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {n.icon}
          {n.label}
        </button>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <CalendarDays size={18} aria-hidden />
      </div>
      <span className="text-sm font-semibold text-slate-900">Smart Timetable</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white print:hidden lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">{brand}</div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-slate-200 bg-white">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              {brand}
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X size={20} aria-hidden />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-60 print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur print:hidden sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900">{current.label}</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{current.description}</p>
            </div>
          </div>
          <Button variant="primary" icon={<RefreshCw size={16} aria-hidden />} busy={generating} onClick={generate} disabled={status !== 'ready' || settings.workingDays.length === 0}>
            <span className="hidden sm:inline">Generate timetable</span>
            <span className="sm:hidden">Generate</span>
          </Button>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 print:max-w-none print:p-0">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden /> Loading data…
            </div>
          )}
          {status === 'error' && (
            <div role="alert" className="mx-auto mt-12 max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
              <AlertCircle size={24} className="mx-auto text-red-600" aria-hidden />
              <p className="mt-3 font-medium text-slate-900">Could not load data</p>
              <p className="mt-1 text-sm text-slate-600">{loadError}</p>
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
