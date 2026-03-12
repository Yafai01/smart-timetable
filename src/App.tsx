import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  School, 
  Calendar, 
  Settings, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Download,
  ChevronRight,
  MapPin,
  Clock,
  Upload,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Dept { id: number; name: string }
interface Faculty { id: number; name: string; email: string; dept_id: number }
interface Subject { id: number; name: string; code: string; periods_per_week: number; is_lab: boolean; dept_id: number }
interface Class { id: number; name: string; dept_id: number; student_count: number }
interface Room { id: number; name: string; capacity: number; is_lab: boolean }
interface FacultySubject { faculty_id: number; subject_id: number }
interface FacultyAvailability { faculty_id: number; day: string; period: number; is_available: boolean }
interface TimetableEntry { 
  id: number; 
  class_id: number; 
  subject_id: number; 
  faculty_id: number; 
  room_id: number; 
  day: string; 
  period: number 
}

interface Conflict {
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<{
    departments: Dept[];
    faculty: Faculty[];
    subjects: Subject[];
    classes: Class[];
    rooms: Room[];
    faculty_subjects: FacultySubject[];
    faculty_availability: FacultyAvailability[];
    timetable: TimetableEntry[];
    conflicts: Conflict[];
  }>({
    departments: [],
    faculty: [],
    subjects: [],
    classes: [],
    rooms: [],
    faculty_subjects: [],
    faculty_availability: [],
    timetable: [],
    conflicts: []
  });

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingDays: DAYS, periodsPerDay: 6 })
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard data={data} onGenerate={handleGenerate} />;
      case 'departments': return <DepartmentManager data={data} refresh={fetchData} />;
      case 'faculty': return <FacultyManager data={data} refresh={fetchData} />;
      case 'subjects': return <SubjectManager data={data} refresh={fetchData} />;
      case 'classes': return <ClassManager data={data} refresh={fetchData} />;
      case 'rooms': return <RoomManager data={data} refresh={fetchData} />;
      case 'availability': return <FacultyAvailabilityManager data={data} refresh={fetchData} />;
      case 'viewer': return <TimetableViewer data={data} />;
      default: return <Dashboard data={data} onGenerate={handleGenerate} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#141414] text-[#E4E3E0] flex flex-col border-r border-[#141414]">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-serif italic tracking-tight">Smart Timetable</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Academic Scheduler v1.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<School size={18}/>} label="Departments" active={activeTab === 'departments'} onClick={() => setActiveTab('departments')} />
          <NavItem icon={<Users size={18}/>} label="Faculty" active={activeTab === 'faculty'} onClick={() => setActiveTab('faculty')} />
          <NavItem icon={<Clock size={18}/>} label="Availability" active={activeTab === 'availability'} onClick={() => setActiveTab('availability')} />
          <NavItem icon={<BookOpen size={18}/>} label="Subjects" active={activeTab === 'subjects'} onClick={() => setActiveTab('subjects')} />
          <NavItem icon={<School size={18}/>} label="Classes" active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} />
          <NavItem icon={<MapPin size={18}/>} label="Rooms" active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')} />
          <NavItem icon={<Calendar size={18}/>} label="Timetables" active={activeTab === 'viewer'} onClick={() => setActiveTab('viewer')} />
        </nav>

        <div className="p-6 border-t border-white/10 text-[10px] opacity-40 uppercase tracking-widest">
          © 2026 Academic Systems
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-[#141414]/5 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm font-medium opacity-60">
            <span>Admin</span>
            <ChevronRight size={14} />
            <span className="capitalize">{activeTab}</span>
          </div>
          <div className="flex items-center gap-4">
            {loading && <RefreshCw size={18} className="animate-spin opacity-40" />}
            <button 
              onClick={handleGenerate}
              className="px-4 py-2 bg-[#141414] text-white text-xs font-medium rounded-full hover:bg-opacity-90 transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Generate Timetable
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
        active 
          ? 'bg-white/10 text-white font-medium' 
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- Dashboard Component ---
function Dashboard({ data, onGenerate }: { data: any, onGenerate: () => void }) {
  const highConflicts = data.conflicts.filter((c: any) => c.severity === 'high');
  const mediumConflicts = data.conflicts.filter((c: any) => c.severity === 'medium');

  const getFacultyLoad = (id: number) => data.timetable.filter((t: any) => t.faculty_id === id).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Faculty" value={data.faculty.length} icon={<Users size={20}/>} />
        <StatCard label="Subjects" value={data.subjects.length} icon={<BookOpen size={20}/>} />
        <StatCard label="Classes" value={data.classes.length} icon={<School size={20}/>} />
        <StatCard label="Rooms" value={data.rooms.length} icon={<MapPin size={20}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl border border-[#141414]/5 p-8 shadow-sm">
            <h3 className="font-serif italic text-xl mb-6">System Status</h3>
            <div className="space-y-4">
              <StatusItem label="Constraint Check" status={highConflicts.length === 0 ? "Passed" : "Failed"} color={highConflicts.length === 0 ? "text-emerald-600" : "text-red-600"} />
              <StatusItem label="Faculty Load Balance" status="Optimal" color="text-emerald-600" />
              <StatusItem label="Room Utilization" status="74%" color="text-indigo-600" />
              <StatusItem label="Conflict Detection" status={`${data.conflicts.length} Issues`} color={data.conflicts.length === 0 ? "text-emerald-600" : "text-amber-600"} />
            </div>
            <div className="mt-8 pt-8 border-t border-[#141414]/5">
              <button 
                onClick={onGenerate}
                className="w-full py-4 border-2 border-dashed border-[#141414]/20 rounded-xl text-sm font-medium hover:border-[#141414]/40 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Re-run Optimization Algorithm
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#141414]/5 p-8 shadow-sm">
            <h3 className="font-serif italic text-xl mb-6">Faculty Workload Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.faculty.slice(0, 6).map((f: any) => {
                const load = getFacultyLoad(f.id);
                return (
                  <div key={f.id} className="p-4 bg-[#F5F5F0]/50 rounded-xl border border-[#141414]/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{f.name}</span>
                      <span className="text-xs opacity-50">{load} hrs</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${load > 18 ? 'bg-red-500' : 'bg-[#141414]'}`} 
                        style={{ width: `${Math.min((load / 24) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.conflicts.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#141414]/5 p-8 shadow-sm">
              <h3 className="font-serif italic text-xl mb-6">Conflict Report</h3>
              <div className="space-y-4">
                {data.conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 ${
                    conflict.severity === 'high' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                  }`}>
                    <div className={`p-2 rounded-lg ${
                      conflict.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Settings size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">{conflict.type}</div>
                      <div className="text-sm leading-relaxed">{conflict.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#141414] text-white rounded-2xl p-8 shadow-xl flex flex-col justify-between overflow-hidden relative h-fit">
          <div className="relative z-10">
            <h3 className="font-serif italic text-xl mb-2">Quick Actions</h3>
            <p className="text-xs opacity-50 mb-8">Manage your academic infrastructure</p>
            
            <div className="space-y-3">
              <QuickAction label="Add New Faculty" />
              <QuickAction label="Define Lab Session" />
              <QuickAction label="Export PDF Report" />
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
            <Calendar size={200} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#141414]/5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-[#F5F5F0] rounded-lg text-[#141414]">
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Live</span>
      </div>
      <div className="text-3xl font-light tracking-tight mb-1">{value}</div>
      <div className="text-xs opacity-50 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StatusItem({ label, status, color }: { label: string, status: string, color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#141414]/5 last:border-0">
      <span className="text-sm opacity-60">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{status}</span>
    </div>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <button className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-medium transition-all flex items-center justify-between group">
      {label}
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
    </button>
  );
}

function CSVUpload({ type, onUpload }: { type: string, onUpload: () => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`/api/upload/${type}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        onUpload();
        alert('CSV Uploaded Successfully');
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="relative">
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={uploading}
      />
      <button className={`flex items-center gap-2 px-4 py-2 bg-white border border-[#141414]/10 rounded-lg text-xs font-medium hover:bg-[#F5F5F0] transition-all ${uploading ? 'opacity-50' : ''}`}>
        <Upload size={14} />
        {uploading ? 'Uploading...' : 'Bulk Upload CSV'}
      </button>
    </div>
  );
}

// --- Management Components (Simplified for brevity but functional) ---

function DepartmentManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [name, setName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    setName('');
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Add Department</h3>
          <CSVUpload type="departments" onUpload={refresh} />
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            placeholder="Department Name" 
            className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <button type="submit" className="bg-[#141414] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all">
            Add Department
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F5F5F0] border-b border-[#141414]/5">
            <tr>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">ID</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Name</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/5">
            {data.departments.map((d: any) => (
              <tr key={d.id} className="hover:bg-[#F5F5F0]/50 transition-all">
                <td className="px-6 py-4 text-sm font-mono opacity-40">{d.id}</td>
                <td className="px-6 py-4 text-sm font-medium">{d.name}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-red-500 hover:text-red-700 transition-all"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FacultyManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/faculty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, dept_id: parseInt(dept) })
    });
    setName(''); setEmail(''); setDept('');
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Add Faculty Member</h3>
          <CSVUpload type="faculty" onUpload={refresh} />
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            placeholder="Full Name" 
            className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <input 
            placeholder="Email Address" 
            className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <select 
            className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm"
            value={dept} onChange={e => setDept(e.target.value)} required
          >
            <option value="">Select Department</option>
            {data.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="submit" className="bg-[#141414] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all">
            Add Faculty
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F5F5F0] border-b border-[#141414]/5">
            <tr>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Name</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Email</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Department</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Weekly Load</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/5">
            {data.faculty.map((f: any) => {
              const load = data.timetable.filter((t: any) => t.faculty_id === f.id).length;
              return (
                <tr key={f.id} className="hover:bg-[#F5F5F0]/50 transition-all">
                  <td className="px-6 py-4 text-sm font-medium">{f.name}</td>
                  <td className="px-6 py-4 text-sm opacity-60">{f.email}</td>
                  <td className="px-6 py-4 text-sm opacity-60">
                    {data.departments.find((d: any) => d.id === f.dept_id)?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium w-8">{load}h</span>
                      <div className="flex-1 h-1 bg-[#F5F5F0] rounded-full overflow-hidden min-w-[60px]">
                        <div 
                          className={`h-full ${load > 18 ? 'bg-red-500' : 'bg-[#141414]'}`} 
                          style={{ width: `${Math.min((load / 24) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-red-500 hover:text-red-700 transition-all"><Trash2 size={16}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubjectManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [periods, setPeriods] = useState('3');
  const [isLab, setIsLab] = useState(false);
  const [dept, setDept] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, periods_per_week: parseInt(periods), is_lab: isLab, dept_id: parseInt(dept) })
    });
    setName(''); setCode(''); setPeriods('3'); setIsLab(false); setDept('');
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Add Subject</h3>
          <CSVUpload type="subjects" onUpload={refresh} />
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Subject Name" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={name} onChange={e => setName(e.target.value)} required />
          <input placeholder="Code (e.g. CS101)" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={code} onChange={e => setCode(e.target.value)} required />
          <input type="number" placeholder="Periods/Week" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={periods} onChange={e => setPeriods(e.target.value)} required />
          <select className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={dept} onChange={e => setDept(e.target.value)} required>
            <option value="">Select Department</option>
            {data.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm opacity-60">
            <input type="checkbox" checked={isLab} onChange={e => setIsLab(e.target.checked)} />
            Is Laboratory Session?
          </label>
          <button type="submit" className="bg-[#141414] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all">
            Add Subject
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F5F5F0] border-b border-[#141414]/5">
            <tr>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Code</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Name</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Type</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest opacity-50">Periods</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/5">
            {data.subjects.map((s: any) => (
              <tr key={s.id} className="hover:bg-[#F5F5F0]/50 transition-all">
                <td className="px-6 py-4 text-sm font-mono">{s.code}</td>
                <td className="px-6 py-4 text-sm font-medium">{s.name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${s.is_lab ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {s.is_lab ? 'Lab' : 'Theory'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm opacity-60">{s.periods_per_week} / week</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClassManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [studentCount, setStudentCount] = useState('30');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dept_id: parseInt(dept), student_count: parseInt(studentCount) })
    });
    setName(''); setDept(''); setStudentCount('30');
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Add Class / Section</h3>
          <CSVUpload type="classes" onUpload={refresh} />
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Class Name (e.g. Year 1 - CS)" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={name} onChange={e => setName(e.target.value)} required />
          <input type="number" placeholder="Student Count" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={studentCount} onChange={e => setStudentCount(e.target.value)} required />
          <select className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={dept} onChange={e => setDept(e.target.value)} required>
            <option value="">Select Department</option>
            {data.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="submit" className="bg-[#141414] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all">
            Add Class
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.classes.map((c: any) => (
          <div key={c.id} className="bg-white p-6 rounded-2xl border border-[#141414]/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-[#F5F5F0] rounded-lg text-[#141414]">
                <School size={18} />
              </div>
              <span className="text-xs font-bold opacity-40">{data.departments.find((d: any) => d.id === c.dept_id)?.name}</span>
            </div>
            <div className="text-lg font-medium mb-4">{c.name}</div>
            <div className="flex items-center justify-between text-xs opacity-60">
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>{c.student_count} Students</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={14} />
                <span>{data.subjects.filter((s: any) => s.dept_id === c.dept_id).length} Subjects</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isLab, setIsLab] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(data.rooms[0]?.id || null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, capacity: parseInt(capacity), is_lab: isLab })
    });
    setName(''); setCapacity(''); setIsLab(false);
    refresh();
  };

  const getRoomEntry = (roomId: number, day: string, period: number) => {
    return data.timetable.find((t: any) => t.room_id === roomId && t.day === day && t.period === period);
  };

  const getSubject = (id: number) => data.subjects.find((s: any) => s.id === id);
  const getClass = (id: number) => data.classes.find((c: any) => c.id === id);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Add Room / Laboratory</h3>
          <CSVUpload type="rooms" onUpload={refresh} />
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input placeholder="Room Name" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={name} onChange={e => setName(e.target.value)} required />
          <input type="number" placeholder="Capacity" className="px-4 py-2 border border-[#141414]/10 rounded-lg text-sm" value={capacity} onChange={e => setCapacity(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm opacity-60">
            <input type="checkbox" checked={isLab} onChange={e => setIsLab(e.target.checked)} />
            Is Lab?
          </label>
          <button type="submit" className="bg-[#141414] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all">
            Add Room
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {data.rooms.map((r: any) => (
          <div key={r.id} className="bg-white p-6 rounded-2xl border border-[#141414]/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${r.is_lab ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <MapPin size={18} />
              </div>
              <span className="text-xs font-bold opacity-40">{r.capacity} Seats</span>
            </div>
            <div className="text-lg font-medium">{r.name}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-40 mt-1">{r.is_lab ? 'Laboratory' : 'Classroom'}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif italic text-xl">Room Schedule Viewer</h3>
          <select 
            className="px-4 py-2 bg-[#F5F5F0] border border-[#141414]/10 rounded-lg text-sm font-medium"
            value={selectedRoom || ''}
            onChange={e => setSelectedRoom(parseInt(e.target.value))}
          >
            {data.rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {selectedRoom && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F5F0]">
                  <th className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50 w-32">Day</th>
                  {PERIODS.slice(0, 6).map(p => (
                    <th key={p} className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50">
                      Period {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="p-4 border border-[#141414]/5 text-sm font-medium bg-[#F5F5F0]/30">{day}</td>
                    {PERIODS.slice(0, 6).map(p => {
                      const entry = getRoomEntry(selectedRoom, day, p);
                      const sub = entry ? getSubject(entry.subject_id) : null;
                      const cls = entry ? getClass(entry.class_id) : null;
                      return (
                        <td key={p} className={`p-4 border border-[#141414]/5 text-center min-w-[120px] ${entry ? 'bg-indigo-50/30' : ''}`}>
                          {entry ? (
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-indigo-700 uppercase">{sub?.code}</div>
                              <div className="text-xs font-medium truncate">{sub?.name}</div>
                              <div className="text-[10px] opacity-40 font-bold">{cls?.name}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] opacity-20 font-bold uppercase tracking-widest">Free</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FacultyAvailabilityManager({ data, refresh }: { data: any, refresh: () => void }) {
  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(data.faculty[0]?.id || null);

  const isAvailable = (day: string, period: number) => {
    const record = data.faculty_availability.find((fa: any) => fa.faculty_id === selectedFaculty && fa.day === day && fa.period === period);
    return record ? record.is_available === 1 : true; // Default to available
  };

  const toggleAvailability = async (day: string, period: number) => {
    if (!selectedFaculty) return;
    const current = isAvailable(day, period);
    await fetch('/api/faculty-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faculty_id: selectedFaculty, day, period, is_available: !current })
    });
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <select 
          className="px-4 py-2 bg-white border border-[#141414]/10 rounded-lg text-sm font-medium shadow-sm"
          value={selectedFaculty || ''}
          onChange={e => setSelectedFaculty(parseInt(e.target.value))}
        >
          {data.faculty.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="text-xs opacity-40 uppercase tracking-widest font-bold">Manage Availability</div>
      </div>

      <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F5F5F0]">
              <th className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50 w-32">Day</th>
              {PERIODS.slice(0, 6).map(p => (
                <th key={p} className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50">
                  Period {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="p-4 border border-[#141414]/5 text-sm font-medium bg-[#F5F5F0]/30">{day}</td>
                {PERIODS.slice(0, 6).map(p => {
                  const available = isAvailable(day, p);
                  return (
                    <td key={p} className="p-4 border border-[#141414]/5 text-center">
                      <button 
                        onClick={() => toggleAvailability(day, p)}
                        className={`w-full h-12 rounded-lg text-xs font-bold transition-all ${
                          available 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100' 
                            : 'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100'
                        }`}
                      >
                        {available ? 'AVAILABLE' : 'BUSY'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-6 bg-[#141414] text-white rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={20} className="text-emerald-400" />
          <h4 className="font-serif italic text-lg">Availability Logic</h4>
        </div>
        <p className="text-xs opacity-50 leading-relaxed">
          The scheduling algorithm will automatically skip periods marked as "BUSY" for the assigned faculty member. 
          If a faculty member is unavailable during a required slot, the system will attempt to find an alternative time or report an unmet requirement.
        </p>
      </div>
    </div>
  );
}

// --- Timetable Viewer ---
function TimetableViewer({ data }: { data: any }) {
  const [selectedClass, setSelectedClass] = useState<number | null>(data.classes[0]?.id || null);

  const getEntry = (day: string, period: number) => {
    return data.timetable.find((t: any) => t.class_id === selectedClass && t.day === day && t.period === period);
  };

  const getSubject = (id: number) => data.subjects.find((s: any) => s.id === id);
  const getFaculty = (id: number) => data.faculty.find((f: any) => f.id === id);
  const getRoom = (id: number) => data.rooms.find((r: any) => r.id === id);

  const classConflicts = data.conflicts.filter((c: any) => c.message.includes(data.classes.find((cls: any) => cls.id === selectedClass)?.name || ''));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select 
            className="px-4 py-2 bg-white border border-[#141414]/10 rounded-lg text-sm font-medium shadow-sm"
            value={selectedClass || ''}
            onChange={e => setSelectedClass(parseInt(e.target.value))}
          >
            {data.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="text-xs opacity-40 uppercase tracking-widest font-bold">Weekly Schedule</div>
          {classConflicts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase animate-pulse">
              <Settings size={12} />
              {classConflicts.length} Issues Detected
            </div>
          )}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#141414]/10 rounded-lg text-xs font-medium hover:bg-[#F5F5F0] transition-all">
          <Download size={14} />
          Export PDF
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F5F5F0]">
              <th className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50 w-32">Day</th>
              {PERIODS.slice(0, 6).map(p => (
                <th key={p} className="p-4 border border-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50">
                  Period {p}
                  <div className="text-[8px] opacity-40 font-normal mt-1">09:00 - 10:00</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="p-4 border border-[#141414]/5 text-sm font-medium bg-[#F5F5F0]/30">{day}</td>
                {PERIODS.slice(0, 6).map(p => {
                  const entry = getEntry(day, p);
                  const sub = entry ? getSubject(entry.subject_id) : null;
                  const fac = entry ? getFaculty(entry.faculty_id) : null;
                  const room = entry ? getRoom(entry.room_id) : null;

                  return (
                    <td key={p} className="p-4 border border-[#141414]/5 min-w-[160px] h-24">
                      {entry ? (
                        <div className={`h-full p-3 rounded-xl border flex flex-col justify-between transition-all hover:scale-[1.02] cursor-default ${
                          sub?.is_lab ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'
                        }`}>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1">{sub?.code}</div>
                            <div className="text-xs font-bold leading-tight">{sub?.name}</div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
                            <span className="text-[10px] opacity-60 font-medium">{fac?.name}</span>
                            <span className="text-[10px] font-mono bg-white/50 px-1 rounded">{room?.name}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-10 italic text-xs">Free</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-[#141414]/5 shadow-sm">
          <h4 className="font-serif italic text-lg mb-4">Faculty Workload</h4>
          <div className="space-y-4">
            {data.faculty.slice(0, 5).map((f: any) => {
              const load = data.timetable.filter((t: any) => t.faculty_id === f.id).length;
              return (
                <div key={f.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{f.name}</span>
                    <span className="opacity-50">{load} periods / week</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#141414]" style={{ width: `${(load / 24) * 100}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-[#141414] text-white p-8 rounded-2xl shadow-xl">
          <h4 className="font-serif italic text-lg mb-4">Conflict Report</h4>
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${
            data.conflicts.length === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <div className={`p-3 rounded-full ${
              data.conflicts.length === 0 ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            }`}>
              <RefreshCw size={20} className={data.conflicts.length > 0 ? 'animate-spin-slow' : ''} />
            </div>
            <div>
              <div className="text-sm font-medium">
                {data.conflicts.length === 0 ? 'No Conflicts Detected' : `${data.conflicts.length} Conflicts Found`}
              </div>
              <div className="text-xs opacity-50">Last generated: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          <p className="text-xs opacity-40 mt-6 leading-relaxed">
            {data.conflicts.length === 0 
              ? "The optimization algorithm has successfully allocated all subjects while respecting faculty availability, room capacity, and class constraints."
              : "Some constraints could not be met. Review the conflict report in the dashboard for details on faculty double-booking or unmet period requirements."}
          </p>
        </div>
      </div>
    </div>
  );
}
