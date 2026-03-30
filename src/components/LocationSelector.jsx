import { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';

export default function LocationSelector({ onSelectLocation, email }) {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const response = await fetchApi({ action: 'getUbicaciones', email });
        if (isMounted) {
          const data = Array.isArray(response) ? response : (response.ubicaciones || []);
          setLocations(data);
        }
      } catch (err) {
        if (isMounted) setError("Error al cargar las ubicaciones.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchLocations();
    return () => { isMounted = false };
  }, [email]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedLocation) onSelectLocation(selectedLocation);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Cargando Sedes</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 justify-center items-center w-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="mb-8 relative">
        <div className="absolute inset-0 bg-blue-600/10 blur-2xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
          <MapPin size={32} strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">Seleccionar<br/>Ubicación</h2>
        <p className="text-gray-400 font-medium text-sm">Elige el punto de fichaje para hoy</p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full space-y-8">
        <div className="relative group">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="block w-full bg-gray-50 border-2 border-gray-100 text-slate-900 focus:ring-0 focus:border-blue-600 rounded-2xl py-5 px-6 text-xl appearance-none shadow-sm font-bold transition-all duration-300"
            required
          >
            <option value="" disabled>Seleccione una sede</option>
            {locations.map((loc, idx) => (
              <option key={loc.id || idx} value={loc.id || loc.nombre || loc}>
                {loc.nombre || loc.name || loc}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-gray-400 group-focus-within:text-blue-600">
            <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedLocation}
          className="w-full btn-premium btn-utility bg-slate-900 rounded-2xl text-white font-bold py-5 px-8 text-xl flex items-center justify-center transition-all disabled:opacity-30 group"
        >
          <span className="flex items-center tracking-tight">
            Continuar <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
          </span>
        </button>
      </form>
    </div>
  );
}
