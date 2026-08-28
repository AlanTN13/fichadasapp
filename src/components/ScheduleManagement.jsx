import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Save } from 'lucide-react';
import { getEmployeeSchedule, listEmployees, saveEmployeeSchedule } from '../services/supabaseApi';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function emptySchedule() {
  return DAY_NAMES.map((_, index) => ({
    weekday: index + 1,
    working_day: false,
    expected_start: '08:00',
    expected_end: '17:00',
    tolerance_minutes: 0,
  }));
}

export default function ScheduleManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [schedule, setSchedule] = useState(emptySchedule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listEmployees({ includeInactive: true });
      setEmployees(response.employees || []);
      setSelectedId((current) => current || response.employees?.[0]?.id || '');
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los empleados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoading(true);
    setError('');
    getEmployeeSchedule(selectedId)
      .then((response) => {
        if (!active) return;
        setSchedule((response.schedule || emptySchedule()).map((day) => ({
          ...day,
          expected_start: day.expected_start || '08:00',
          expected_end: day.expected_end || '17:00',
        })));
      })
      .catch((loadError) => active && setError(loadError.message || 'No se pudo cargar la jornada'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedId]);

  const updateDay = (index, field, value) => {
    setSchedule((current) => current.map((day, dayIndex) => (
      dayIndex === index ? { ...day, [field]: value } : day
    )));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveEmployeeSchedule(selectedId, schedule.map((day) => ({
        weekday: day.weekday,
        working_day: day.working_day,
        expected_start: day.working_day ? day.expected_start : null,
        expected_end: day.working_day ? day.expected_end : null,
        tolerance_minutes: day.working_day ? Number(day.tolerance_minutes || 0) : 0,
      })));
      setNotice('Jornada semanal guardada. Los cambios rigen desde hoy.');
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la jornada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarClock size={22} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Configuración</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Jornadas esperadas</h2>
          </div>
        </div>
        <label className="mt-5 grid max-w-md gap-1.5 text-sm font-medium text-slate-700">
          Empleado
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.last_name}, {employee.first_name}{employee.active ? '' : ' · Inactivo'}
              </option>
            ))}
          </select>
        </label>
      </header>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Cargando jornada...</p>
        ) : !selectedId ? (
          <p className="py-10 text-center text-sm text-slate-500">Primero incorporá un empleado.</p>
        ) : (
          <>
            <div className="space-y-3">
              {schedule.map((day, index) => (
                <article key={day.weekday} className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[160px_1fr_1fr_150px] md:items-end ${day.working_day ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50/60'}`}>
                  <label className="flex min-h-11 items-center gap-3 font-semibold text-slate-900">
                    <input type="checkbox" checked={day.working_day} onChange={(event) => updateDay(index, 'working_day', event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
                    {DAY_NAMES[index]}
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ingreso esperado
                    <input type="time" disabled={!day.working_day} value={day.expected_start} onChange={(event) => updateDay(index, 'expected_start', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Salida esperada
                    <input type="time" disabled={!day.working_day} value={day.expected_end} onChange={(event) => updateDay(index, 'expected_end', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tolerancia (min)
                    <input type="number" min="0" max="180" disabled={!day.working_day} value={day.tolerance_minutes} onChange={(event) => updateDay(index, 'tolerance_minutes', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
                  </label>
                </article>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={handleSave} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">
                <Save size={17} /> {saving ? 'Guardando...' : 'Guardar jornada'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
