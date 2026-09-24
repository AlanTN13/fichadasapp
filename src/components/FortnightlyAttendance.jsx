import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { getFortnightlyAttendanceSummary } from '../services/supabaseApi';
import {
  formatPeriodLabel,
  getBusinessTodayKey,
  getFortnightRangeForDate,
} from '../lib/dashboardPeriods';
import { formatHoursMinutes } from '../lib/dashboardHours';
import { useAdminSessionState } from '../hooks/useAdminSessionState';

function currentSelection() {
  const today = getBusinessTodayKey();
  return {
    search: '',
    month: today.slice(0, 7),
    half: Number(today.slice(8, 10)) <= 15 ? 'FIRST' : 'SECOND',
    locationId: '',
  };
}

function formatDate(date) {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function matchesEmployee(item, searchTerm) {
  if (!searchTerm) return true;
  return `${item.employee_name} ${item.dni || ''}`.toLowerCase().includes(searchTerm);
}

export default function FortnightlyAttendance() {
  const initialFilters = useMemo(currentSelection, []);
  const [filters, setFilters] = useAdminSessionState('summary.filters', initialFilters);
  const [mobileDraftFilters, setMobileDraftFilters] = useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const period = useMemo(() => {
    const anchor = `${filters.month}-${filters.half === 'FIRST' ? '01' : '16'}`;
    return getFortnightRangeForDate(anchor);
  }, [filters.half, filters.month]);

  const loadData = useCallback(async ({ announce = false } = {}) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      setData(await getFortnightlyAttendanceSummary({
        locationId: filters.locationId,
        startDate: period.startDate,
        endDate: period.endDate,
      }));
      if (announce) setNotice('Datos actualizados.');
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el resumen quincenal');
    } finally {
      setLoading(false);
    }
  }, [filters.locationId, period.endDate, period.startDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const searchTerm = filters.search.trim().toLowerCase();
  const allRows = data?.rows || [];
  const rows = allRows.filter((row) => matchesEmployee(row, searchTerm));
  const absences = (data?.absences || []).filter((absence) => matchesEmployee(absence, searchTerm));
  const irregularities = rows.filter((row) => row.is_irregular);
  const attendance = data?.today_attendance || { clocked_in: 0, scheduled: 0 };
  const activeFilterCount = [
    Boolean(filters.search.trim()),
    Boolean(filters.locationId),
    filters.month !== initialFilters.month || filters.half !== initialFilters.half,
  ].filter(Boolean).length;

  const openFilters = () => {
    setMobileDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setFilters(mobileDraftFilters);
    setFiltersOpen(false);
  };

  const clearMobileFilters = () => {
    setMobileDraftFilters(initialFilters);
    setFilters(initialFilters);
    setFiltersOpen(false);
  };

  const removeMobileFilter = (filterName) => {
    setFilters((current) => {
      if (filterName === 'search') return { ...current, search: '' };
      if (filterName === 'location') return { ...current, locationId: '' };
      return { ...current, month: initialFilters.month, half: initialFilters.half };
    });
  };

  const locationName = data?.locations?.find((location) => location.id === filters.locationId)?.name;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarRange size={22} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Control operativo</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Resumen quincenal</h2>
              <p className="mt-1 text-sm text-slate-500">{formatPeriodLabel(period.startDate, period.endDate)}</p>
            </div>
          </div>
          <button type="button" onClick={openFilters} aria-expanded={filtersOpen} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 md:hidden">
            <SlidersHorizontal size={17} /> {activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}
          </button>
        </div>

        <div className="mt-5 hidden gap-3 md:grid md:grid-cols-[minmax(190px,1.2fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto]">
          <label className="grid gap-1 text-sm text-slate-600">Buscar persona<span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nombre o DNI" className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm text-slate-900" /></span></label>
          <label className="grid gap-1 text-sm text-slate-600">Sede<select value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">Todas las sedes</option>{(data?.locations || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm text-slate-600">Mes<input type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm text-slate-900" /></label>
          <label className="grid gap-1 text-sm text-slate-600">Quincena<select value={filters.half} onChange={(event) => setFilters((current) => ({ ...current, half: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="FIRST">1 al 15</option><option value="SECOND">16 al cierre</option></select></label>
          <div className="flex items-end"><button type="button" onClick={() => loadData({ announce: true })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"><RefreshCw size={17} /> Actualizar</button></div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 md:hidden" aria-label="Filtros activos">
        {filters.search.trim() && <button type="button" onClick={() => removeMobileFilter('search')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{filters.search}<X size={14} /></button>}
        {filters.locationId && <button type="button" onClick={() => removeMobileFilter('location')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{locationName || 'Sede'}<X size={14} /></button>}
        {(filters.month !== initialFilters.month || filters.half !== initialFilters.half) && <button type="button" onClick={() => removeMobileFilter('period')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{formatPeriodLabel(period.startDate, period.endDate)}<X size={14} /></button>}
      </div>

      {(error || notice) && <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Fichadas de hoy</p><p className="mt-1 text-2xl font-bold text-blue-950">{attendance.clocked_in || 0} de {attendance.scheduled || 0} ficharon</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Irregularidades</p><p className="mt-1 text-2xl font-bold text-rose-950">{irregularities.length}</p><p className="mt-1 text-xs text-rose-700">30 minutos o más acumulados según la regla vigente</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Ausencias</p><p className="mt-1 text-2xl font-bold text-amber-950">{absences.length}</p><p className="mt-1 text-xs text-amber-700">Jornada esperada sin fichadas</p></div>
      </section>

      <button type="button" onClick={() => loadData({ announce: true })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 md:hidden"><RefreshCw size={17} /> Actualizar</button>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-bold text-slate-900">Empleados</h3><p className="mt-1 text-xs text-slate-500">Las tardanzas justificadas permanecen visibles y no suman para irregularidad.</p></div>
        {loading && !data ? (
          <p className="p-10 text-center text-sm text-slate-500">Calculando quincena...</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No hay empleados para estos filtros.</p>
        ) : (
          <>
            <p className="border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 md:hidden">Deslizá para ver todos los datos</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="sticky left-0 z-20 min-w-[190px] border-r border-slate-200 bg-slate-50 px-4 py-3 shadow-[7px_0_12px_-10px_rgba(15,23,42,0.7)] md:shadow-none">Empleado</th><th className="px-3 py-3 text-center">Tardanzas</th><th className="px-3 py-3 text-center">Ausencias</th><th className="px-3 py-3 text-center">Sin revisar</th><th className="px-3 py-3 text-center">Justificadas</th><th className="px-3 py-3 text-center">No justificadas</th><th className="px-3 py-3 text-center">Min. tarde</th><th className="px-3 py-3 text-center">Irregularidad</th><th className="px-4 py-3 text-right">Horas</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const explicitUnjustified = Math.max(0, Number(row.unjustified || 0) - Number(row.pending_review || 0));
                    return (
                      <tr key={row.employee_id}>
                        <td className={`sticky left-0 z-10 border-r border-slate-100 px-4 py-3 shadow-[7px_0_12px_-10px_rgba(15,23,42,0.7)] md:shadow-none ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}><p className="font-semibold text-slate-900">{row.employee_name}</p><p className="mt-1 text-xs text-slate-500">DNI {row.dni} · {row.location_name}</p></td>
                        <td className="px-3 py-3 text-center text-slate-700">{row.late_arrivals}</td>
                        <td className="px-3 py-3 text-center text-slate-700">{row.absences}</td>
                        <td className="px-3 py-3 text-center text-amber-700">{row.pending_review || 0}</td>
                        <td className="px-3 py-3 text-center text-blue-700">{row.justified}</td>
                        <td className="px-3 py-3 text-center text-slate-700">{explicitUnjustified}</td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-900">{row.late_minutes}</td>
                        <td className="px-3 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.is_irregular ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{row.is_irregular ? 'Alcanzada' : 'No alcanzada'}</span></td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatHoursMinutes(Number(row.total_hours), '00:00')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-white p-4"><h3 className="font-bold text-slate-900">Irregularidades</h3><p className="mt-1 text-xs text-slate-500">Empleados que alcanzaron el umbral quincenal.</p><div className="mt-3 space-y-2">{irregularities.length === 0 ? <p className="text-sm text-slate-500">Ningún empleado alcanzó 30 minutos.</p> : irregularities.map((row) => <div key={row.employee_id} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2"><span className="text-sm font-semibold text-rose-950">{row.employee_name}</span><span className="text-sm font-bold text-rose-700">{row.late_minutes} min</span></div>)}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4"><h3 className="font-bold text-slate-900">Ausentes</h3><p className="mt-1 text-xs text-slate-500">Jornada esperada sin entrada ni salida.</p><div className="mt-3 space-y-2">{absences.length === 0 ? <p className="text-sm text-slate-500">No hay ausencias en esta quincena.</p> : absences.map((absence) => <div key={`${absence.employee_id}-${absence.business_date}`} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2"><span className="text-sm font-semibold text-amber-950">{absence.employee_name}</span><span className="text-xs font-medium text-amber-700">{formatDate(absence.business_date)}</span></div>)}</div></div>
      </section>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="presentation">
          <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" className="absolute inset-0 bg-slate-950/45" />
          <section role="dialog" aria-modal="true" aria-labelledby="summary-filters-title" className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between gap-3"><h2 id="summary-filters-title" className="text-lg font-bold text-slate-900">Filtros</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar panel de filtros" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700"><X size={20} /></button></div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Buscar persona<span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="search" value={mobileDraftFilters.search} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nombre o DNI" className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-base font-normal" /></span></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Sede<select value={mobileDraftFilters.locationId} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal"><option value="">Todas las sedes</option>{(data?.locations || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Mes<input type="month" value={mobileDraftFilters.month} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, month: event.target.value }))} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-2 font-normal" /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Quincena<select value={mobileDraftFilters.half} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, half: event.target.value }))} className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-2 font-normal"><option value="FIRST">1 al 15</option><option value="SECOND">16 al cierre</option></select></label></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={clearMobileFilters} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Limpiar</button><button type="button" onClick={applyMobileFilters} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Aplicar</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
