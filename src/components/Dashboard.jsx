import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { getHoursDashboard } from '../services/supabaseApi';
import {
  buildHoursDashboardParams,
  buildDateColumns,
  getPeriodTotalLabel,
  getPresetLabel,
  PERIOD_PRESETS,
  resolveDashboardPeriod,
} from '../lib/dashboardPeriods';
import {
  buildHoursDashboardRows,
  formatHoursMinutes,
  hasAnyEntries,
} from '../lib/dashboardHours';

const PERIOD_OPTIONS = [
  PERIOD_PRESETS.THIS_WEEK,
  PERIOD_PRESETS.PREVIOUS_WEEK,
  PERIOD_PRESETS.FIRST_FORTNIGHT,
  PERIOD_PRESETS.SECOND_FORTNIGHT,
  PERIOD_PRESETS.CUSTOM,
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'working', label: 'Trabajando' },
  { value: 'completed', label: 'Jornada cerrada' },
  { value: 'not_started', label: 'Sin fichadas' },
];

const DEFAULT_FILTERS = {
  locationId: '',
  periodPreset: PERIOD_PRESETS.THIS_WEEK,
  customStart: '',
  customEnd: '',
  status: 'all',
};

export default function Dashboard({ userEmail }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [mobileDraftFilters, setMobileDraftFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const filtersButtonRef = useRef(null);
  const firstFilterRef = useRef(null);
  const restoreFilterFocusRef = useRef(false);

  const selectedPeriod = useMemo(
    () =>
      resolveDashboardPeriod(filters.periodPreset, {
        customStart: filters.customStart,
        customEnd: filters.customEnd,
      }),
    [filters.customEnd, filters.customStart, filters.periodPreset]
  );

  const dateColumns = useMemo(
    () => buildDateColumns(selectedPeriod.startDate, selectedPeriod.endDate),
    [selectedPeriod.endDate, selectedPeriod.startDate]
  );

  const requestParams = useMemo(
    () =>
      buildHoursDashboardParams({
        email: userEmail,
        locationId: filters.locationId || null,
        period: selectedPeriod,
      }),
    [filters.locationId, selectedPeriod, userEmail]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getHoursDashboard(requestParams);

      setDashboard(response);
      setLocationOptions(response.locations || []);
    } catch (loadError) {
      console.error('Error cargando horas trabajadas:', loadError);
      setError(loadError.message || 'No se pudo cargar la tabla de horas');
    } finally {
      setLoading(false);
    }
  }, [requestParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tableRows = useMemo(
    () => buildHoursDashboardRows(dashboard?.rows || [], dateColumns),
    [dashboard?.rows, dateColumns]
  );

  const visibleTableRows = useMemo(() => {
    if (filters.status === 'all') return tableRows;

    return tableRows.filter((row) => {
      if (filters.status === 'working') {
        return row.dayCells.some((cell) => cell.state === 'WORKING');
      }

      if (filters.status === 'completed') {
        return row.dayCells.some((cell) => cell.state === 'COMPLETED');
      }

      return row.dayCells.every((cell) => cell.state === 'NOT_STARTED');
    });
  }, [filters.status, tableRows]);

  const totalGeneralLabel = useMemo(
    () => formatHoursMinutes(dashboard?.summary?.total_period_hours, '00:00'),
    [dashboard?.summary?.total_period_hours]
  );

  const employeesCount = dashboard?.summary?.employee_count ?? tableRows.length;
  const showEmptyEntriesMessage = tableRows.length > 0 && !hasAnyEntries(tableRows);
  const periodTotalLabel = getPeriodTotalLabel(filters.periodPreset);
  const activeFilterCount = [
    Boolean(filters.locationId),
    filters.periodPreset !== PERIOD_PRESETS.THIS_WEEK,
    filters.status !== 'all',
  ].filter(Boolean).length;

  const selectedLocationLabel =
    locationOptions.find((location) => location.id === filters.locationId)?.name || 'Sede';
  const selectedStatusLabel =
    STATUS_OPTIONS.find((option) => option.value === filters.status)?.label || 'Estado';

  const closeFilters = useCallback(() => {
    restoreFilterFocusRef.current = true;
    setFiltersOpen(false);
  }, []);

  const openFilters = () => {
    setMobileDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setFilters(mobileDraftFilters);
    closeFilters();
  };

  const clearMobileFilters = () => {
    setMobileDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    closeFilters();
  };

  const removeMobileFilter = (filterName) => {
    setFilters((current) => {
      if (filterName === 'location') return { ...current, locationId: '' };
      if (filterName === 'period') {
        return {
          ...current,
          periodPreset: PERIOD_PRESETS.THIS_WEEK,
          customStart: '',
          customEnd: '',
        };
      }
      return { ...current, status: 'all' };
    });
  };

  useEffect(() => {
    if (!filtersOpen) return undefined;

    const focusTimer = window.setTimeout(() => firstFilterRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeFilters();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeFilters, filtersOpen]);

  useEffect(() => {
    if (loading || filtersOpen || !restoreFilterFocusRef.current) return;

    const focusFrame = window.requestAnimationFrame(() => {
      filtersButtonRef.current?.focus();
      restoreFilterFocusRef.current = false;
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [filtersOpen, loading]);

  if (loading && !dashboard) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f7fa] px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center text-sm text-slate-500">
          Cargando horas trabajadas...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-[#f5f7fa] px-6 py-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-4 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f5f7fa] px-3 py-2 md:overflow-hidden md:px-5 md:py-4">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 md:min-h-0 md:flex-1 md:gap-3">
        <header className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5">
          <div className="flex items-start justify-between gap-3 md:block">
            <div>
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Horas trabajadas</h1>
              <p className="mt-1 text-sm text-slate-500">
                {selectedPeriod.displayLabel}
              </p>
            </div>

            <button
              ref={filtersButtonRef}
              type="button"
              onClick={openFilters}
              aria-expanded={filtersOpen}
              aria-controls="mobile-dashboard-filters"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 md:hidden"
            >
              <SlidersHorizontal aria-hidden="true" size={17} />
              {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
            </button>
          </div>

          <div className="mt-4 hidden gap-3 md:grid md:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto]">
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              <span className="font-medium">Sede</span>
              <select
                value={filters.locationId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    locationId: event.target.value,
                  }))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Todas las sedes</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-600">
              <span className="font-medium">Periodo</span>
              <select
                value={filters.periodPreset}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    periodPreset: event.target.value,
                  }))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {PERIOD_OPTIONS.map((periodOption) => (
                  <option key={periodOption} value={periodOption}>
                    {getPresetLabel(periodOption)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Actualizar
              </button>
            </div>
          </div>

          {filters.periodPreset === PERIOD_PRESETS.CUSTOM && (
            <div className="mt-3 hidden gap-3 md:grid md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span className="font-medium">Desde</span>
                <input
                  type="date"
                  value={filters.customStart}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      customStart: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <span className="font-medium">Hasta</span>
                <input
                  type="date"
                  value={filters.customEnd}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      customEnd: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
          )}
        </header>

        <div className="flex flex-wrap gap-2 md:hidden" aria-label="Filtros activos">
          {filters.locationId && (
            <button
              type="button"
              onClick={() => removeMobileFilter('location')}
              aria-label={`Quitar filtro de sede ${selectedLocationLabel}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white"
            >
              {selectedLocationLabel}
              <X aria-hidden="true" size={14} />
            </button>
          )}
          {filters.periodPreset !== PERIOD_PRESETS.THIS_WEEK && (
            <button
              type="button"
              onClick={() => removeMobileFilter('period')}
              aria-label={`Quitar filtro de fecha ${getPresetLabel(filters.periodPreset)}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white"
            >
              {getPresetLabel(filters.periodPreset)}
              <X aria-hidden="true" size={14} />
            </button>
          )}
          {filters.status !== 'all' && (
            <button
              type="button"
              onClick={() => removeMobileFilter('status')}
              aria-label={`Quitar filtro de estado ${selectedStatusLabel}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white"
            >
              {selectedStatusLabel}
              <X aria-hidden="true" size={14} />
            </button>
          )}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5">
          <div className="md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Empleados</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{employeesCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Horas</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{totalGeneralLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSummaryOpen((current) => !current)}
              aria-expanded={summaryOpen}
              aria-controls="mobile-dashboard-summary"
              className="mt-1 flex min-h-11 w-full items-center justify-between text-sm font-semibold text-slate-700"
            >
              {summaryOpen ? 'Ocultar resumen' : 'Ver resumen'}
              <ChevronDown
                aria-hidden="true"
                size={18}
                className={`transition-transform ${summaryOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {summaryOpen && (
              <div id="mobile-dashboard-summary" className="border-t border-slate-100 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Periodo seleccionado
                </p>
                <p className="mt-1 text-sm text-slate-900">{selectedPeriod.displayLabel}</p>
              </div>
            )}
          </div>

          <div className="hidden gap-3 md:grid md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Periodo seleccionado
              </p>
              <p className="mt-1 text-base text-slate-900">{selectedPeriod.displayLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Empleados
              </p>
              <p className="mt-1 text-base text-slate-900">{employeesCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total general horas
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {totalGeneralLabel}
              </p>
            </div>
          </div>
        </section>

        {visibleTableRows.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {tableRows.length === 0
              ? 'No hay empleados para la sede seleccionada.'
              : 'No hay empleados para los filtros seleccionados.'}
          </section>
        ) : (
          <section className="flex flex-none flex-col rounded-2xl border border-slate-200 bg-white md:min-h-0 md:flex-1">
            {showEmptyEntriesMessage && (
              <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
                No hay fichadas para el periodo seleccionado.
              </div>
            )}

            <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500 md:hidden">
              Deslizá para ver más días
            </p>

            <div className="max-h-[calc(100dvh-12rem)] overflow-auto md:min-h-0 md:max-h-none md:flex-1">
              <table className="min-w-full border-collapse text-sm text-slate-700">
                <thead className="sticky top-0 z-20 md:static">
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-30 min-w-[176px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-700 shadow-[7px_0_12px_-10px_rgba(15,23,42,0.7)] md:min-w-[220px] md:px-4 md:py-3 md:shadow-none">
                      Empleado
                    </th>
                    {dateColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`min-w-[84px] border-b border-r border-slate-200 px-2 py-2.5 text-center font-semibold md:min-w-[92px] md:px-3 md:py-3 ${
                          column.isWeekend ? 'bg-slate-100 text-slate-700' : 'bg-slate-50'
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="min-w-[100px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2.5 text-center font-semibold text-slate-700 md:min-w-[110px] md:px-3 md:py-3">
                      {periodTotalLabel}
                    </th>
                    <th className="min-w-[108px] border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center font-semibold text-slate-700 md:min-w-[120px] md:px-3 md:py-3">
                      Total quincena
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTableRows.map((row, rowIndex) => (
                    <tr key={row.employeeId} className="odd:bg-white even:bg-slate-50/40">
                      <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-3 align-middle shadow-[7px_0_12px_-10px_rgba(15,23,42,0.7)] md:px-4 md:py-4 md:shadow-none ${
                        rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      }`}>
                        <div className="font-medium text-slate-900">{row.employeeName}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.dni}</div>
                      </td>
                      {row.dayCells.map((cell) => (
                        <td
                          key={`${row.employeeId}-${cell.key}`}
                          className={`border-b border-r border-slate-200 px-2 py-3 text-center md:px-3 md:py-4 ${
                            cell.isWeekend ? 'bg-slate-100/70' : ''
                          } text-slate-700`}
                        >
                          <div className="mx-auto flex min-w-[76px] max-w-[88px] flex-col gap-0.5 text-left md:min-w-[88px] md:max-w-[104px] md:gap-1">
                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                              <span>Ing</span>
                              <span className="font-medium text-slate-600">{cell.details.entryLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                              <span>Sal</span>
                              <span
                                className={`font-medium ${
                                  cell.details.exitLabel === 'Sin cierre'
                                    ? 'text-amber-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {cell.details.exitLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1 text-[10px] uppercase tracking-wide text-slate-400">
                              <span>Hs</span>
                              <span className="font-semibold text-slate-900">{cell.details.hoursLabel}</span>
                            </div>
                          </div>
                        </td>
                      ))}
                      <td className="border-b border-r border-slate-200 px-3 py-4 text-center font-medium text-slate-900">
                        {row.periodTotalLabel}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-4 text-center font-medium text-slate-900">
                        {row.fortnightTotalLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="presentation">
          <button
            type="button"
            onClick={closeFilters}
            aria-label="Cerrar filtros"
            className="absolute inset-0 bg-slate-950/45"
          />

          <section
            id="mobile-dashboard-filters"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-dashboard-filters-title"
            className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3">
              <h2 id="mobile-dashboard-filters-title" className="text-lg font-bold text-slate-900">
                Filtros
              </h2>
              <button
                type="button"
                onClick={closeFilters}
                aria-label="Cerrar panel de filtros"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="flex flex-col gap-1.5 text-sm text-slate-700">
                <span className="font-semibold">Fecha</span>
                <select
                  ref={firstFilterRef}
                  value={mobileDraftFilters.periodPreset}
                  onChange={(event) =>
                    setMobileDraftFilters((current) => ({
                      ...current,
                      periodPreset: event.target.value,
                    }))
                  }
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                >
                  {PERIOD_OPTIONS.map((periodOption) => (
                    <option key={periodOption} value={periodOption}>
                      {getPresetLabel(periodOption)}
                    </option>
                  ))}
                </select>
              </label>

              {mobileDraftFilters.periodPreset === PERIOD_PRESETS.CUSTOM && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex min-w-0 flex-col gap-1.5 text-sm text-slate-700">
                    <span className="font-semibold">Desde</span>
                    <input
                      type="date"
                      value={mobileDraftFilters.customStart}
                      onChange={(event) =>
                        setMobileDraftFilters((current) => ({
                          ...current,
                          customStart: event.target.value,
                        }))
                      }
                      className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-sm text-slate-700">
                    <span className="font-semibold">Hasta</span>
                    <input
                      type="date"
                      value={mobileDraftFilters.customEnd}
                      onChange={(event) =>
                        setMobileDraftFilters((current) => ({
                          ...current,
                          customEnd: event.target.value,
                        }))
                      }
                      className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-900"
                    />
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1.5 text-sm text-slate-700">
                <span className="font-semibold">Sede</span>
                <select
                  value={mobileDraftFilters.locationId}
                  onChange={(event) =>
                    setMobileDraftFilters((current) => ({
                      ...current,
                      locationId: event.target.value,
                    }))
                  }
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                >
                  <option value="">Todas las sedes</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm text-slate-700">
                <span className="font-semibold">Estado</span>
                <select
                  value={mobileDraftFilters.status}
                  onChange={(event) =>
                    setMobileDraftFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                >
                  {STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={clearMobileFilters}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={applyMobileFilters}
                className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
              >
                Aplicar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
