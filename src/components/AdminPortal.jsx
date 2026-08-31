import { createElement, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock3, LogOut, Users } from 'lucide-react';
import Dashboard from './Dashboard';
import EmployeeManagement from './EmployeeManagement';
import ScheduleManagement from './ScheduleManagement';
import Inconsistencies from './Inconsistencies';

const SECTIONS = [
  { id: 'hours', label: 'Horas', icon: Clock3 },
  { id: 'employees', label: 'Empleados', icon: Users },
  { id: 'schedules', label: 'Jornadas', icon: CalendarClock },
  { id: 'inconsistencies', label: 'Inconsistencias', icon: AlertTriangle },
];

export default function AdminPortal({ context, onLogout }) {
  const [section, setSection] = useState('hours');
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState('');

  const openEmployeeSchedule = (employeeId) => {
    setScheduleEmployeeId(employeeId);
    setSection('schedules');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f5f7fa]">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-600">Lavadero Nahuel</p>
            <h1 className="truncate text-lg font-black uppercase italic tracking-tight text-slate-900">Administración</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-right text-xs text-slate-500 sm:block"><span className="block font-semibold text-slate-700">Román</span>{context.email}</p>
            <button type="button" onClick={onLogout} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700" title="Cerrar sesión">
              <LogOut size={18} /><span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1440px] overflow-x-auto px-2 md:px-4" aria-label="Administración principal">
          {SECTIONS.map(({ id, label, icon }) => (
            <button key={id} type="button" onClick={() => setSection(id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors md:px-4 ${section === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
              {createElement(icon, { size: 17 })} {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {section === 'hours' && <Dashboard />}
        {section === 'employees' && <EmployeeManagement onConfigureSchedule={openEmployeeSchedule} />}
        {section === 'schedules' && <ScheduleManagement initialEmployeeId={scheduleEmployeeId} />}
        {section === 'inconsistencies' && <Inconsistencies />}
      </main>
    </div>
  );
}
