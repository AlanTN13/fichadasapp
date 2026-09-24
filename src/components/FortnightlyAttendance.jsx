import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, RefreshCw } from 'lucide-react';
import { getFortnightlyAttendanceSummary } from '../services/supabaseApi';
import {
  formatPeriodLabel,
  getBusinessTodayKey,
  getFortnightRangeForDate,
} from '../lib/dashboardPeriods';
import { formatHoursMinutes } from '../lib/dashboardHours';

function currentSelection() {
  const today = getBusinessTodayKey();
  return {
    month: today.slice(0, 7),
    half: Number(today.slice(8, 10)) <= 15 ? 'FIRST' : 'SECOND',
  };
}

function formatDate(date) {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export default function FortnightlyAttendance() {
  const initialSelection = useMemo(currentSelection, []);
  const [month, setMonth] = useState(initialSelection.month);
  const [half, setHalf] = useState(initialSelection.half);
  const [locationId, setLocationId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const period = useMemo(() => {
    const anchor = `${month}-${half === 'FIRST' ? '01' : '16'}`;
    return getFortnightRangeForDate(anchor);
  }, [half, month]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getFortnightlyAttendanceSummary({
        locationId,
        startDate: period.startDate,
        endDate: period.endDate,
      }));
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el resumen quincenal');
    } finally {
      setLoading(false);
    }
  }, [locationId, period.endDate, period.startDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = data?.rows || [];
  const absences = data?.absences || [];
  const irregularities = rows.filter((row) => row.is_irregular);
  const attendance = data?.today_attendance || { clocked_in: 0, scheduled: 0 };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarRange size={22} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Control operativo</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Resumen quincenal</h2>
              <p className="mt-1 text-sm text-slate-500">{formatPeriodLabel(period.startDate, period.endDate)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900" /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Quincena<select value={half} onChange={(event) => setHalf(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="FIRST">1 al 15</option><option value="SECOND">16 al cierre</option></select></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sede<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="">Todas</option>{(data?.locations || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          </div>
        </div>

        <button type="button" onClick={loadData} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">
          <RefreshCw size={17} /> Actualizar
        </button>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Fichadas de hoy</p><p className="mt-1 text-2xl font-bold text-blue-950">{attendance.clocked_in || 0} de {attendance.scheduled || 0} ficharon</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Irregularidades</p><p className="mt-1 text-2xl font-bold text-rose-950">{irregularities.length}</p><p className="mt-1 text-xs text-rose-700">30 minutos o más de tardanzas no justificadas</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Ausencias</p><p className="mt-1 text-2xl font-bold text-amber-950">{absences.length}</p><p className="mt-1 text-xs text-amber-700">Jornada esperada sin fichadas</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-bold text-slate-900">Empleados</h3><p className="mt-1 text-xs text-slate-500">Las tardanzas justificadas permanecen visibles y no suman para irregularidad.</p></div>
        {loading && !data ? (
          <p className="p-10 text-center text-sm text-slate-500">Calculando quincena...</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No hay empleados para esta selección.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Empleado</th><th className="px-3 py-3 text-center">Tardanzas</th><th className="px-3 py-3 text-center">Ausencias</th><th className="px-3 py-3 text-center">Justificadas</th><th className="px-3 py-3 text-center">No justificadas</th><th className="px-3 py-3 text-center">Min. tarde</th><th className="px-3 py-3 text-center">Irregularidad</th><th className="px-4 py-3 text-right">Horas</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.employee_id}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.employee_name}</p><p className="mt-1 text-xs text-slate-500">DNI {row.dni} · {row.location_name}</p></td>
                    <td className="px-3 py-3 text-center text-slate-700">{row.late_arrivals}</td>
                    <td className="px-3 py-3 text-center text-slate-700">{row.absences}</td>
                    <td className="px-3 py-3 text-center text-blue-700">{row.justified}</td>
                    <td className="px-3 py-3 text-center text-slate-700">{row.unjustified}</td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-900">{row.late_minutes}</td>
                    <td className="px-3 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.is_irregular ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{row.is_irregular ? 'Alcanzada' : 'No alcanzada'}</span></td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatHoursMinutes(Number(row.total_hours), '00:00')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-white p-4"><h3 className="font-bold text-slate-900">Irregularidades</h3><p className="mt-1 text-xs text-slate-500">Empleados que alcanzaron el umbral quincenal.</p><div className="mt-3 space-y-2">{irregularities.length === 0 ? <p className="text-sm text-slate-500">Ningún empleado alcanzó 30 minutos.</p> : irregularities.map((row) => <div key={row.employee_id} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2"><span className="text-sm font-semibold text-rose-950">{row.employee_name}</span><span className="text-sm font-bold text-rose-700">{row.late_minutes} min</span></div>)}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4"><h3 className="font-bold text-slate-900">Ausentes</h3><p className="mt-1 text-xs text-slate-500">Jornada esperada sin entrada ni salida.</p><div className="mt-3 space-y-2">{absences.length === 0 ? <p className="text-sm text-slate-500">No hay ausencias en esta quincena.</p> : absences.map((absence) => <div key={`${absence.employee_id}-${absence.business_date}`} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2"><span className="text-sm font-semibold text-amber-950">{absence.employee_name}</span><span className="text-xs font-medium text-amber-700">{formatDate(absence.business_date)}</span></div>)}</div></div>
      </section>
    </div>
  );
}
