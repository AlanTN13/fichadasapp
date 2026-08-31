import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
import { listEmployees, saveEmployee } from '../services/supabaseApi';

const EMPTY_FORM = {
  id: null,
  dni: '',
  firstName: '',
  lastName: '',
  locationId: '',
  active: true,
};

export default function EmployeeManagement({ onConfigureSchedule }) {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listEmployees({ includeInactive: true });
      setEmployees(response.employees || []);
      setLocations(response.locations || []);
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar la nómina');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!showInactive && !employee.active) return false;
      if (!term) return true;
      return `${employee.first_name} ${employee.last_name} ${employee.dni}`
        .toLowerCase()
        .includes(term);
    });
  }, [employees, search, showInactive]);

  const openNew = () => {
    setNotice('');
    setError('');
    setForm({ ...EMPTY_FORM, locationId: locations[0]?.id || '' });
  };

  const openEdit = (employee) => {
    setNotice('');
    setError('');
    setForm({
      id: employee.id,
      dni: employee.dni,
      firstName: employee.first_name,
      lastName: employee.last_name,
      locationId: employee.location_id,
      active: employee.active,
    });
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const configureAfterSave = event.nativeEvent.submitter?.value === 'schedule';
    setSavingId(form.id || 'new');
    setError('');
    setNotice('');
    try {
      const savedEmployee = await saveEmployee(form);
      setNotice(form.id ? 'Datos del empleado actualizados.' : 'Empleado incorporado correctamente.');
      setForm(null);
      await loadData();
      if (configureAfterSave) onConfigureSchedule?.(savedEmployee.id);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el empleado');
    } finally {
      setSavingId(null);
    }
  };

  const toggleEmployee = async (employee) => {
    setSavingId(employee.id);
    setError('');
    setNotice('');
    try {
      await saveEmployee({
        id: employee.id,
        dni: employee.dni,
        firstName: employee.first_name,
        lastName: employee.last_name,
        locationId: employee.location_id,
        active: !employee.active,
      });
      setNotice(
        employee.active
          ? 'Empleado desactivado. Su historial permanece disponible.'
          : 'Empleado activado nuevamente.'
      );
      await loadData();
    } catch (toggleError) {
      setError(toggleError.message || 'No se pudo cambiar el estado');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Nómina</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Empleados</h2>
          <p className="mt-1 text-sm text-slate-500">Altas, datos, sede y estado operativo.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          <Plus size={18} /> Nuevo empleado
        </button>
      </header>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o DNI"
              className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm"
            />
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Cargando empleados...</p>
        ) : filteredEmployees.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No hay empleados para esta búsqueda.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((employee) => (
              <article key={employee.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{employee.first_name} {employee.last_name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${employee.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {employee.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">DNI {employee.dni} · {employee.location_name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onConfigureSchedule?.(employee.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 px-3 text-sm font-medium text-blue-700"
                  >
                    Jornada
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(employee)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEmployee(employee)}
                    disabled={savingId === employee.id}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${employee.active ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}
                  >
                    {employee.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    {employee.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form onSubmit={submitForm} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{form.id ? 'Editar' : 'Alta'}</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{form.id ? 'Datos del empleado' : 'Nuevo empleado'}</h3>
              </div>
              <button type="button" onClick={() => setForm(null)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Nombre
                <input required value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Apellido
                <input required value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                DNI
                <input required inputMode="numeric" pattern="[0-9]{7,9}" value={form.dni} onChange={(event) => setForm((current) => ({ ...current, dni: event.target.value.replace(/\D/g, '').slice(0, 9) }))} className="min-h-11 rounded-xl border border-slate-300 px-3" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Sede
                <select required value={form.locationId} onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
            </div>

            {form.id && (
              <label className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                Empleado activo y habilitado para fichar
              </label>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setForm(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="submit" value="save" disabled={Boolean(savingId)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">
                {savingId ? 'Guardando...' : 'Guardar empleado'}
              </button>
              <button type="submit" value="schedule" disabled={Boolean(savingId)} className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">
                {savingId ? 'Guardando...' : 'Guardar y configurar jornada'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
