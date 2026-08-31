import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Save } from 'lucide-react';
import { getEmployeeSchedule, listEmployees, saveEmployeeSchedule } from '../services/supabaseApi';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonday() {
  const date = new Date();
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return formatLocalDate(date);
}

function emptyWeek(cycleWeek, source = null) {
  return DAY_NAMES.map((_, index) => {
    const sourceDay = source?.find((day) => day.weekday === index + 1);
    return {
      cycle_week: cycleWeek,
      weekday: index + 1,
      working_day: sourceDay?.working_day || false,
      expected_start: sourceDay?.expected_start || '08:00',
      expected_end: sourceDay?.expected_end || '17:00',
      tolerance_minutes: sourceDay?.tolerance_minutes || 0,
    };
  });
}

function emptySchedule(cycleWeeks = 1) {
  return Array.from({ length: cycleWeeks }, (_, index) => emptyWeek(index + 1)).flat();
}

function normalizeSchedule(response) {
  const cycleWeeks = response.cycle_weeks === 2 ? 2 : 1;
  const received = response.schedule || [];
  return {
    cycleWeeks,
    anchorDate: response.cycle_anchor_date || currentMonday(),
    days: Array.from({ length: cycleWeeks }, (_, index) => {
      const cycleWeek = index + 1;
      return emptyWeek(cycleWeek, received.filter((day) => (day.cycle_week || 1) === cycleWeek));
    }).flat(),
  };
}

function isMonday(dateValue) {
  if (!dateValue) return false;
  return new Date(`${dateValue}T00:00:00Z`).getUTCDay() === 1;
}

export default function ScheduleManagement({ initialEmployeeId = '' }) {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(initialEmployeeId);
  const [cycleWeeks, setCycleWeeks] = useState(1);
  const [activeWeek, setActiveWeek] = useState(1);
  const [anchorDate, setAnchorDate] = useState(currentMonday);
  const [schedule, setSchedule] = useState(() => emptySchedule(1));
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
      setSelectedId((current) => initialEmployeeId || current || response.employees?.[0]?.id || '');
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los empleados');
    } finally {
      setLoading(false);
    }
  }, [initialEmployeeId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (initialEmployeeId) setSelectedId(initialEmployeeId);
  }, [initialEmployeeId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    getEmployeeSchedule(selectedId)
      .then((response) => {
        if (!active) return;
        const normalized = normalizeSchedule(response);
        setCycleWeeks(normalized.cycleWeeks);
        setActiveWeek(1);
        setAnchorDate(normalized.anchorDate);
        setSchedule(normalized.days);
      })
      .catch((loadError) => active && setError(loadError.message || 'No se pudo cargar la jornada'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedId]);

  const visibleDays = useMemo(
    () => schedule.filter((day) => day.cycle_week === activeWeek),
    [activeWeek, schedule]
  );

  const changeCycle = (nextCycleWeeks) => {
    setCycleWeeks(nextCycleWeeks);
    setActiveWeek(1);
    setSchedule((current) => {
      const weekOne = current.filter((day) => day.cycle_week === 1);
      return nextCycleWeeks === 2
        ? [...emptyWeek(1, weekOne), ...emptyWeek(2, weekOne)]
        : emptyWeek(1, weekOne);
    });
  };

  const updateDay = (weekday, field, value) => {
    setSchedule((current) => current.map((day) => (
      day.cycle_week === activeWeek && day.weekday === weekday
        ? { ...day, [field]: value }
        : day
    )));
  };

  const copyWeekA = () => {
    const weekOne = schedule.filter((day) => day.cycle_week === 1);
    setSchedule((current) => [
      ...current.filter((day) => day.cycle_week === 1),
      ...emptyWeek(2, weekOne),
    ]);
    setActiveWeek(2);
    setNotice('Semana A copiada. Ajustá los francos y días rotativos de la Semana B.');
  };

  const handleSave = async () => {
    if (cycleWeeks === 2 && !isMonday(anchorDate)) {
      setError('Elegí un lunes como inicio de la Semana A.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveEmployeeSchedule(selectedId, {
        cycleWeeks,
        cycleAnchorDate: anchorDate,
        days: schedule.map((day) => ({
          cycle_week: day.cycle_week,
          weekday: day.weekday,
          working_day: day.working_day,
          expected_start: day.working_day ? day.expected_start : null,
          expected_end: day.working_day ? day.expected_end : null,
          tolerance_minutes: day.working_day ? Number(day.tolerance_minutes || 0) : 0,
        })),
      });
      setNotice(cycleWeeks === 2
        ? 'Rotación de dos semanas guardada. El sistema alternará automáticamente.'
        : 'Jornada semanal guardada. Los cambios rigen desde hoy.');
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
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Tipo de jornada</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-4 ${cycleWeeks === 1 ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="cycle" checked={cycleWeeks === 1} onChange={() => changeCycle(1)} className="mr-2" />
                  <span className="font-semibold text-slate-900">Semanal fija</span>
                  <p className="ml-6 mt-1 text-sm text-slate-500">Los mismos días y horarios todas las semanas.</p>
                </label>
                <label className={`cursor-pointer rounded-xl border p-4 ${cycleWeeks === 2 ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="cycle" checked={cycleWeeks === 2} onChange={() => changeCycle(2)} className="mr-2" />
                  <span className="font-semibold text-slate-900">Rotación de 2 semanas</span>
                  <p className="ml-6 mt-1 text-sm text-slate-500">Semana A y Semana B se alternan automáticamente.</p>
                </label>
              </div>
            </fieldset>

            {cycleWeeks === 2 && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <label className="grid max-w-xs gap-1.5 text-sm font-semibold text-slate-800">
                  Lunes de inicio de la Semana A
                  <input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal" />
                </label>
                <p className="mt-2 text-sm text-slate-600">Desde ese lunes, el sistema alternará A, B, A, B sin que Román tenga que cambiarla cada semana.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[1, 2].map((week) => (
                    <button key={week} type="button" onClick={() => setActiveWeek(week)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${activeWeek === week ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>
                      Semana {week === 1 ? 'A' : 'B'}
                    </button>
                  ))}
                  <button type="button" onClick={copyWeekA} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
                    <Copy size={16} /> Copiar A en B
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {visibleDays.map((day) => (
                <article key={`${day.cycle_week}-${day.weekday}`} className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[160px_1fr_1fr_150px] md:items-end ${day.working_day ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50/60'}`}>
                  <label className="flex min-h-11 items-center gap-3 font-semibold text-slate-900">
                    <input type="checkbox" checked={day.working_day} onChange={(event) => updateDay(day.weekday, 'working_day', event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
                    {DAY_NAMES[day.weekday - 1]}
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ingreso esperado
                    <input type="time" disabled={!day.working_day} value={day.expected_start} onChange={(event) => updateDay(day.weekday, 'expected_start', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Salida esperada
                    <input type="time" disabled={!day.working_day} value={day.expected_end} onChange={(event) => updateDay(day.weekday, 'expected_end', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tolerancia (min)
                    <input type="number" min="0" max="180" disabled={!day.working_day} value={day.tolerance_minutes} onChange={(event) => updateDay(day.weekday, 'tolerance_minutes', event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50" />
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
