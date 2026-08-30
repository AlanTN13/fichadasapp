import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { listInconsistencies } from '../services/supabaseApi';
import { getBusinessTodayKey } from '../lib/dashboardPeriods';

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

function defaultDateFrom() {
  const date = new Date(`${getBusinessTodayKey()}T12:00:00`);
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export default function Inconsistencies() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [filters, setFilters] = useState({
    locationId: '',
    dateFrom: defaultDateFrom(),
    dateTo: getBusinessTodayKey(),
    status: 'OPEN',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listInconsistencies(filters);
      setItems(response.inconsistencies || []);
      setLocations(response.locations || []);
      setCounts(response.counts || { open: 0, resolved: 0 });
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar las inconsistencias');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle size={22} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Control diario</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Inconsistencias</h2>
              <p className="mt-1 text-sm text-slate-500">Diferencias entre la jornada esperada y las fichadas reales.</p>
            </div>
          </div>
          <button type="button" onClick={loadData} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">
            <RefreshCw size={17} /> Recalcular
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Desde<input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900" /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Hasta<input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900" /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sede<select value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="">Todas</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Estado<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="OPEN">Pendientes</option><option value="RESOLVED">Resueltas</option><option value="ALL">Todas</option></select></label>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendientes</p><p className="mt-1 text-2xl font-bold text-amber-900">{counts.open || 0}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resueltas</p><p className="mt-1 text-2xl font-bold text-emerald-900">{counts.resolved || 0}</p></div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Revisando jornadas...</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center"><p className="font-semibold text-slate-900">Sin inconsistencias para revisar</p><p className="mt-1 text-sm text-slate-500">No se detectaron diferencias con estos filtros.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                <div><p className="font-semibold text-slate-900">{item.employee_name}</p><p className="mt-1 text-xs text-slate-500">DNI {item.dni} · {item.location_name}</p></div>
                <div><p className="text-sm font-semibold text-amber-700">{TYPE_LABELS[item.type] || item.type}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.business_date)}</p></div>
                <div className="text-sm text-slate-600"><p>Esperado: <strong className="text-slate-900">{item.expected_time || '—'}</strong></p><p>Real: <strong className="text-slate-900">{item.actual_time || 'Sin fichada'}</strong></p></div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.status === 'OPEN' ? 'Pendiente' : 'Resuelta'}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
