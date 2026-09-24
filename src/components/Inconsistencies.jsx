import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { listInconsistencies, reviewInconsistency } from '../services/supabaseApi';
import {
  getPresetLabel,
  PERIOD_PRESETS,
  resolveDashboardPeriod,
} from '../lib/dashboardPeriods';
import { useAdminSessionState } from '../hooks/useAdminSessionState';

const TYPE_LABELS = {
  LATE_ARRIVAL: 'Llegada tarde',
  EARLY_DEPARTURE: 'Salida anticipada',
  MISSING_END: 'Sin fichada de salida',
  MISSING_START: 'Sin fichada de inicio',
};

function formatDate(date) {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

const PERIOD_OPTIONS = [
  PERIOD_PRESETS.THIS_WEEK,
  PERIOD_PRESETS.PREVIOUS_WEEK,
  PERIOD_PRESETS.FIRST_FORTNIGHT,
  PERIOD_PRESETS.SECOND_FORTNIGHT,
  PERIOD_PRESETS.CUSTOM,
];

const DEFAULT_FILTERS = {
  search: '',
  locationId: '',
  periodPreset: PERIOD_PRESETS.THIS_WEEK,
  customStart: '',
  customEnd: '',
  status: 'OPEN',
};

export default function Inconsistencies() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useAdminSessionState('inconsistencies.filters', DEFAULT_FILTERS);
  const [mobileDraftFilters, setMobileDraftFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const filtersButtonRef = useRef(null);

  const selectedPeriod = useMemo(
    () => resolveDashboardPeriod(filters.periodPreset, {
      customStart: filters.customStart,
      customEnd: filters.customEnd,
    }),
    [filters.customEnd, filters.customStart, filters.periodPreset]
  );

  const requestFilters = useMemo(() => ({
    locationId: filters.locationId,
    dateFrom: selectedPeriod.startDate,
    dateTo: selectedPeriod.endDate,
    status: 'ALL',
  }), [filters.locationId, selectedPeriod.endDate, selectedPeriod.startDate]);

  const visibleItems = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.status !== 'ALL' && item.status !== filters.status) return false;
      if (!searchTerm) return true;
      return `${item.employee_name} ${item.dni}`.toLowerCase().includes(searchTerm);
    });
  }, [filters.search, filters.status, items]);

  const counts = useMemo(() => ({
    open: items.filter((item) => item.status === 'OPEN').length,
    resolved: items.filter((item) => item.status === 'RESOLVED').length,
    unreviewed: items.filter((item) => !item.review_status).length,
    justified: items.filter((item) => item.review_status === 'JUSTIFIED').length,
    unjustified: items.filter((item) => item.review_status === 'UNJUSTIFIED').length,
  }), [items]);

  const activeFilterCount = [
    Boolean(filters.search.trim()),
    Boolean(filters.locationId),
    filters.periodPreset !== PERIOD_PRESETS.THIS_WEEK,
    filters.status !== 'OPEN',
  ].filter(Boolean).length;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listInconsistencies(requestFilters);
      setItems(response.inconsistencies || []);
      setLocations(response.locations || []);
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar las inconsistencias');
    } finally {
      setLoading(false);
    }
  }, [requestFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveReview = async (inconsistencyId, reviewStatus) => {
    setSavingId(inconsistencyId);
    setError('');
    try {
      await reviewInconsistency(inconsistencyId, reviewStatus);
      await loadData();
      setFeedback({
        id: inconsistencyId,
        text: reviewStatus === 'JUSTIFIED' ? 'Clasificada como justificada.' : 'Clasificada como no justificada.',
      });
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la justificación');
    } finally {
      setSavingId('');
    }
  };

  const openFilters = () => {
    setMobileDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setFilters(mobileDraftFilters);
    setFiltersOpen(false);
  };

  const clearMobileFilters = () => {
    setMobileDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  const removeMobileFilter = (filterName) => {
    setFilters((current) => {
      if (filterName === 'search') return { ...current, search: '' };
      if (filterName === 'location') return { ...current, locationId: '' };
      if (filterName === 'period') return { ...current, periodPreset: PERIOD_PRESETS.THIS_WEEK, customStart: '', customEnd: '' };
      return { ...current, status: 'OPEN' };
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle size={22} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Control diario</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Inconsistencias</h2>
              <p className="mt-1 text-sm text-slate-500">Diferencias entre la jornada esperada y las fichadas reales.</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button ref={filtersButtonRef} type="button" onClick={openFilters} aria-expanded={filtersOpen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 md:hidden">
              <SlidersHorizontal size={17} /> {activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}
            </button>
            <button type="button" onClick={loadData} className="hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 md:inline-flex">
              <RefreshCw size={17} /> Recalcular
            </button>
          </div>
        </div>

        <div className="mt-5 hidden gap-3 md:grid md:grid-cols-4">
          <label className="grid gap-1 text-sm text-slate-600">Buscar persona<span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nombre o DNI" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900" /></span></label>
          <label className="grid gap-1 text-sm text-slate-600">Sede<select value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">Todas las sedes</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm text-slate-600">Periodo<select value={filters.periodPreset} onChange={(event) => setFilters((current) => ({ ...current, periodPreset: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">{PERIOD_OPTIONS.map((periodOption) => <option key={periodOption} value={periodOption}>{getPresetLabel(periodOption)}</option>)}</select></label>
          <label className="grid gap-1 text-sm text-slate-600">Estado<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="OPEN">Pendientes</option><option value="RESOLVED">Resueltas</option><option value="ALL">Todas</option></select></label>
        </div>

        {filters.periodPreset === PERIOD_PRESETS.CUSTOM && (
          <div className="mt-3 hidden gap-3 md:grid md:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600">Desde<input type="date" value={filters.customStart} onChange={(event) => setFilters((current) => ({ ...current, customStart: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>
            <label className="grid gap-1 text-sm text-slate-600">Hasta<input type="date" value={filters.customEnd} onChange={(event) => setFilters((current) => ({ ...current, customEnd: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2 md:hidden" aria-label="Filtros activos">
        {filters.search.trim() && <button type="button" onClick={() => removeMobileFilter('search')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{filters.search}<X size={14} /></button>}
        {filters.locationId && <button type="button" onClick={() => removeMobileFilter('location')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{locations.find((location) => location.id === filters.locationId)?.name || 'Sede'}<X size={14} /></button>}
        {filters.periodPreset !== PERIOD_PRESETS.THIS_WEEK && <button type="button" onClick={() => removeMobileFilter('period')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{getPresetLabel(filters.periodPreset)}<X size={14} /></button>}
        {filters.status !== 'OPEN' && <button type="button" onClick={() => removeMobileFilter('status')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">{filters.status === 'RESOLVED' ? 'Resueltas' : 'Todos los estados'}<X size={14} /></button>}
      </div>

      <section className="grid gap-3 lg:grid-cols-[2fr_3fr]">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Estado de proceso</p><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendientes</p><p className="mt-1 text-2xl font-bold text-amber-900">{counts.open}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resueltas</p><p className="mt-1 text-2xl font-bold text-emerald-900">{counts.resolved}</p></div></div></div>
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Clasificación</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-amber-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Sin revisar</p><p className="mt-1 text-2xl font-bold text-slate-900">{counts.unreviewed}</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Justificadas</p><p className="mt-1 text-2xl font-bold text-blue-900">{counts.justified}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">No justificadas</p><p className="mt-1 text-2xl font-bold text-slate-900">{counts.unjustified}</p></div></div></div>
      </section>

      <button type="button" onClick={loadData} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 md:hidden"><RefreshCw size={17} /> Recalcular</button>

      <div className="sr-only" aria-live="polite">{feedback?.text || ''}</div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Revisando jornadas...</p>
        ) : visibleItems.length === 0 ? (
          <div className="p-10 text-center"><p className="font-semibold text-slate-900">Sin inconsistencias para revisar</p><p className="mt-1 text-sm text-slate-500">No se detectaron diferencias con estos filtros.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleItems.map((item) => (
              <article key={item.id} className="grid gap-3 p-4 lg:grid-cols-[1.25fr_0.9fr_0.9fr_1.4fr] lg:items-center">
                <div><p className="font-semibold text-slate-900">{item.employee_name}</p><p className="mt-1 text-xs text-slate-500">DNI {item.dni} · {item.location_name}</p></div>
                <div><p className="text-sm font-semibold text-amber-700">{TYPE_LABELS[item.type] || item.type}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.business_date)}{item.type === 'LATE_ARRIVAL' ? ` · ${item.late_minutes || 0} min` : ''}</p></div>
                <div className="text-sm text-slate-600"><p>Esperado: <strong className="text-slate-900">{item.expected_time || '—'}</strong></p><p>Real: <strong className="text-slate-900">{item.actual_time || 'Sin fichada'}</strong></p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => saveReview(item.id, 'JUSTIFIED')}
                    className={`min-h-10 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50 ${item.review_status === 'JUSTIFIED' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}
                  >
                    Justificada
                  </button>
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => saveReview(item.id, 'UNJUSTIFIED')}
                    className={`min-h-10 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50 ${item.review_status === 'UNJUSTIFIED' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    No justificada
                  </button>
                  {!item.review_status && <span className="text-xs font-medium text-amber-700">Sin revisar</span>}
                  {feedback?.id === item.id && <span className="basis-full text-xs font-semibold text-emerald-700" aria-live="polite">{feedback.text}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="presentation">
          <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" className="absolute inset-0 bg-slate-950/45" />
          <section role="dialog" aria-modal="true" aria-labelledby="inconsistency-filters-title" className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between gap-3"><h2 id="inconsistency-filters-title" className="text-lg font-bold text-slate-900">Filtros</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar panel de filtros" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700"><X size={20} /></button></div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Buscar persona<span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="search" value={mobileDraftFilters.search} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nombre o DNI" className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-base font-normal" /></span></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Sede<select value={mobileDraftFilters.locationId} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal"><option value="">Todas las sedes</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Periodo<select value={mobileDraftFilters.periodPreset} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, periodPreset: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal">{PERIOD_OPTIONS.map((periodOption) => <option key={periodOption} value={periodOption}>{getPresetLabel(periodOption)}</option>)}</select></label>
              {mobileDraftFilters.periodPreset === PERIOD_PRESETS.CUSTOM && <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Desde<input type="date" value={mobileDraftFilters.customStart} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, customStart: event.target.value }))} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-2 font-normal" /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Hasta<input type="date" value={mobileDraftFilters.customEnd} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, customEnd: event.target.value }))} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-2 font-normal" /></label></div>}
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Estado<select value={mobileDraftFilters.status} onChange={(event) => setMobileDraftFilters((current) => ({ ...current, status: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal"><option value="OPEN">Pendientes</option><option value="RESOLVED">Resueltas</option><option value="ALL">Todos los estados</option></select></label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={clearMobileFilters} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Limpiar</button><button type="button" onClick={applyMobileFilters} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Aplicar</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
