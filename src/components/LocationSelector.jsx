import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, MapPin, Warehouse } from 'lucide-react';
import { getLocationsForEmail } from '../services/supabaseApi';
import FlowStepIndicator from './FlowStepIndicator';

function getLocationLabel(location) {
  return location?.nombre || location?.name || location || 'Sede';
}

function getLocationDescription(name) {
  if (/garage/i.test(name)) return 'Punto secundario de fichaje';
  if (/planta/i.test(name)) return 'Acceso principal del lavadero';
  return 'Punto disponible para registrar fichadas';
}

export default function LocationSelector({
  onSelectLocation,
  email,
  initialLocations = [],
  loading = false,
  onRetry,
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setLocations(initialLocations);
  }, [initialLocations]);

  useEffect(() => {
    if (initialLocations.length > 0) {
      return;
    }

    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const response = await getLocationsForEmail(email);
        if (isMounted) {
          setLocations(response);
          setError(null);
        }
      } catch {
        if (isMounted) setError('No se pudieron cargar las sedes.');
      }
    };

    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, [email, initialLocations]);

  const normalizedLocations = useMemo(
    () =>
      locations.map((location, index) => ({
        id: location?.id || location?.nombre || location || `loc-${index}`,
        label: getLocationLabel(location),
      })),
    [locations]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (selectedLocation) onSelectLocation(selectedLocation);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Cargando sedes</p>
          <p className="mt-1 text-sm text-slate-400">Preparando el punto de fichaje.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-1 flex-col bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 fade-up sm:px-6 sm:pb-6 sm:pt-4">
      <div className="mx-auto flex h-full min-w-0 w-full max-w-4xl flex-col gap-3 sm:gap-5">
        <FlowStepIndicator currentStep={0} />

        <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/15 sm:h-14 sm:w-14 sm:rounded-2xl">
              <MapPin size={26} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                Paso 1
              </p>
              <h2 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl">
                Elegí la sede
              </h2>
              <p className="mt-2 break-words text-sm leading-5 text-slate-500 sm:leading-6">
                Seleccioná el punto desde donde se va a realizar la fichada. El flujo sigue recién cuando haya una sede marcada.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="flex min-w-0 max-w-full flex-1 flex-col gap-3 sm:gap-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-medium">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 text-sm font-semibold text-blue-700"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {normalizedLocations.map((location) => {
              const isSelected = selectedLocation === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedLocation(location.id)}
                  className={`group flex min-w-0 max-w-full items-center gap-3 rounded-[1.5rem] border px-3 py-3 text-left transition-all duration-200 sm:gap-4 sm:rounded-[1.75rem] sm:px-4 sm:py-4 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100/60'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Warehouse size={22} strokeWidth={1.8} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-slate-900">{location.label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {getLocationDescription(location.label)}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className="text-blue-600" size={24} strokeWidth={2.2} />
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-slate-300 bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto min-w-0 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[1.75rem] sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Selección actual
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900 sm:text-base">
                  {selectedLocation
                    ? normalizedLocations.find((location) => location.id === selectedLocation)?.label
                    : 'Todavía no seleccionaste una sede'}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedLocation || normalizedLocations.length === 0}
              className="flex w-full items-center justify-center gap-3 rounded-[1.25rem] bg-slate-900 px-5 py-4 text-base font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
