import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function Dashboard({ userEmail }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [filters, setFilters] = useState({
    locationId: '',
    periodPreset: PERIOD_PRESETS.THIS_WEEK,
    customStart: '',
    customEnd: '',
  });

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

  const totalGeneralLabel = useMemo(
    () => formatHoursMinutes(dashboard?.summary?.total_period_hours, '00:00'),
    [dashboard?.summary?.total_period_hours]
  );

  const employeesCount = dashboard?.summary?.employee_count ?? tableRows.length;
  const showEmptyEntriesMessage = tableRows.length > 0 && !hasAnyEntries(tableRows);
  const periodTotalLabel = getPeriodTotalLabel(filters.periodPreset);

  if (loading) {
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#f5f7fa] px-3 py-3 md:px-5 md:py-4">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Horas trabajadas</h1>
              <p className="mt-1 text-sm text-slate-500">
                {selectedPeriod.displayLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto]">
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
            <div className="mt-3 grid gap-3 md:grid-cols-2">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-3">
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

        {tableRows.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No hay empleados para la sede seleccionada.
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
            {showEmptyEntriesMessage && (
              <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
                No hay fichadas para el periodo seleccionado.
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-collapse text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                      Empleado
                    </th>
                    {dateColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`min-w-[92px] border-b border-r border-slate-200 px-3 py-3 text-center font-semibold ${
                          column.isWeekend ? 'bg-slate-100 text-slate-700' : 'bg-slate-50'
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="min-w-[110px] border-b border-r border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
                      {periodTotalLabel}
                    </th>
                    <th className="min-w-[120px] border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
                      Total quincena
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.employeeId} className="odd:bg-white even:bg-slate-50/40">
                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-4 align-middle">
                        <div className="font-medium text-slate-900">{row.employeeName}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.dni}</div>
                      </td>
                      {row.dayCells.map((cell) => (
                        <td
                          key={`${row.employeeId}-${cell.key}`}
                          className={`border-b border-r border-slate-200 px-3 py-4 text-center ${
                            cell.isWeekend ? 'bg-slate-100/70' : ''
                          } ${cell.displayValue === 'Sin cierre' ? 'text-amber-700' : 'text-slate-700'}`}
                        >
                          {cell.displayValue}
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
    </div>
  );
}
