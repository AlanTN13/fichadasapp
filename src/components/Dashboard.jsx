import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  LayoutDashboard,
  Fingerprint,
} from 'lucide-react';
import { getDashboardSummary } from '../services/supabaseApi';
import { formatWorkedHours } from '../lib/timeEntryState';
import { getQueueSummary, markQueueItemRetry } from '../queue';

export default function Dashboard({ userEmail }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date: '',
    locationId: '',
    status: '',
  });

  const loadData = useCallback(async () => {
    try {
      const res = await getDashboardSummary({
        email: userEmail,
        locationId: filters.locationId || null,
        businessDate: filters.date || null,
        status: filters.status || null,
      });
      setDashboard(res);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [filters.date, filters.locationId, filters.status, userEmail]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white fade-up uppercase">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 tracking-widest">Cargando...</p>
      </div>
    );
  }

  const queueSummary = getQueueSummary();
  const rows = dashboard?.rows || [];
  const metrics = dashboard?.metrics || {};
  const locationOptions = dashboard?.locations || [];
  const isFilteredDate = Boolean(filters.date);

  return (
    <div className="flex flex-col flex-1 bg-[#f8fafc] overflow-y-auto fade-up">
      {/* Header Premium Limpio */}
      <header className="p-8 pb-4">
        <div className="flex items-center justify-between">
           <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 italic">Sistema de Gestión</p>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">DASHBOARD</h1>
           </div>
           <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-300">
              <LayoutDashboard size={20} />
           </div>
        </div>
      </header>

      <section className="px-8 mt-4 grid grid-cols-2 gap-4">
        {[
          [isFilteredDate ? 'Ficharon en fecha' : 'Ficharon hoy', metrics.checked_in_today ?? 0],
          ['No ficharon', metrics.not_checked_in ?? 0],
          ['Trabajando', metrics.working ?? 0],
          ['Finalizada', metrics.completed ?? 0],
          [isFilteredDate ? 'Horas de la fecha' : 'Horas del dia', metrics.total_worked_hours_label ?? '00:00'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-[1.75rem] border border-slate-100 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="px-8 mt-4">
        <div className="bg-white rounded-[2rem] border border-slate-100 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3">
            <input
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold"
            />
            <select
              value={filters.locationId}
              onChange={(event) => setFilters((prev) => ({ ...prev, locationId: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold"
            >
              <option value="">Todas las sedes</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold"
            >
              <option value="">Todos los estados</option>
              <option value="NOT_CHECKED_IN">No fichó</option>
              <option value="WORKING">Trabajando</option>
              <option value="COMPLETED">Jornada finalizada</option>
              <option value="PENDING_SYNC">Pendiente sincronización</option>
              <option value="SYNC_ERROR">Error sincronización</option>
            </select>
          </div>
        </div>
      </section>

      <section className="px-8 mt-4">
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Sincronizacion</h3>
            <button onClick={loadData} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Actualizar</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pendientes</p>
              <p className="text-xl font-black text-slate-900">{queueSummary.pending}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Syncing</p>
              <p className="text-xl font-black text-slate-900">{queueSummary.syncing}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fallidos</p>
              <p className="text-xl font-black text-slate-900">{queueSummary.failed}</p>
            </div>
          </div>
          <div className="space-y-2">
            {queueSummary.items.filter((item) => item.status === 'failed' || item.status === 'pending').slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                    {item.payload.dni} · {item.requestedEvent}
                  </p>
                  <p className="text-[10px] text-slate-400">{item.lastError || 'Pendiente de sincronizacion'}</p>
                </div>
                <button
                  onClick={() => {
                    markQueueItemRetry(item.id);
                    loadData();
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600"
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listado de Actividad Humano-Legible */}
      <section className="flex-1 px-8 pb-10 mt-4">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Seguimiento en Vivo</h3>
                <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Online</span>
                </div>
            </div>

            <div className="flex flex-col">
              {rows.length === 0 ? (
                <div className="p-20 text-center">
                   <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Sin actividad registrada</p>
                </div>
              ) : (
                rows.map((f, i) => {
                  const isHistoricalIncomplete = f.status_label === 'Jornada incompleta';

                  return (
                    <div key={i} className={`px-8 py-8 flex flex-col border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors`}>
                      {/* Header: Acción y Hora */}
                      <div className="flex items-center justify-between mb-4">
                          <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${
                            isHistoricalIncomplete
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : f.status === 'WORKING'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : f.status === 'COMPLETED'
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : f.status === 'PENDING_SYNC'
                                ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {f.status_label || f.status}
                          </div>
                          <div className="flex items-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl">
                              <Clock size={12} className="mr-2" />
                              <span>{f.start_time || '--:--'} / {f.end_time || (isHistoricalIncomplete ? 'Sin cierre' : 'En curso')}</span>
                          </div>
                      </div>

                      {/* Cuerpo: Nombre Principal */}
                      <div className="mb-3">
                          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                              {f.employee_name || 'Nombre No Encontrado'}
                          </h4>
                      </div>

                      {/* Footer: Identificación DNI */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] gap-4">
                        <div className="flex items-center">
                          <Fingerprint size={12} className="mr-2 text-blue-500" />
                          <span>DNI REGISTRADO: {f.dni || '---'}</span>
                        </div>
                        <span>{formatWorkedHours(f.worked_hours)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </div>
      </section>
    </div>
  );
}
