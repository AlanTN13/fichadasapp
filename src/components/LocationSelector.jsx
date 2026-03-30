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
    <div className="flex flex-col flex-1 justify-center items-center w-full max-w-sm mx-auto px-6 fade-up">
      <div className="mb-10 relative">
        <div className="absolute inset-0 bg-blue-600/10 blur-[60px] rounded-full scale-150 animate-pulse" />
        <div className="relative w-24 h-24 rounded-3xl bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-900/30">
          <MapPin size={40} strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter uppercase italic">BIENVENIDO</h2>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Selecciona tu punto de fichaje</p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full space-y-10">
        <div className="relative group">
          <div className="absolute -top-3 left-6 px-3 bg-white text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] z-10 border-l border-r border-slate-100">
            Sedes Disponibles
          </div>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="block w-full bg-slate-50 border-2 border-slate-100 text-slate-900 focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 rounded-[2rem] py-6 px-8 text-xl appearance-none shadow-sm font-black transition-all duration-500 cursor-pointer italic"
            required
          >
            <option value="" disabled className="font-sans not-italic text-slate-400">--- Elegir Sede ---</option>
            {locations.map((loc, idx) => (
              <option key={loc.id || idx} value={loc.id || loc.nombre || loc} className="font-sans not-italic text-slate-900 py-4">
                {loc.nombre || loc.name || loc}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-8 text-blue-600">
            <svg className="fill-current h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedLocation}
          className="w-full btn-premium bg-slate-900 rounded-[2rem] text-white font-black py-6 px-8 text-lg flex items-center justify-center transition-all shadow-2xl shadow-slate-900/30 active:translate-y-1 uppercase tracking-widest italic"
        >
          <span className="flex items-center">
            INGRESAR <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
          </span>
        </button>
      </form>
    </div>
  );
}
