import { useState } from 'react';
import { MapPin, ChevronRight, LogOut, Building2, Warehouse, Construction } from 'lucide-react';

const SEDES = [
  { id: 'central', name: 'Oficina Central', icon: <Building2 className="text-blue-500" /> },
  { id: 'obra_b', name: 'Sitio Construcción B', icon: <Construction className="text-amber-500" /> },
  { id: 'deposito', name: 'Depósito Sur', icon: <Warehouse className="text-emerald-500" /> }
];

export default function LocationSelect({ onSelect, onAdminLogout }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="flex flex-col flex-1 h-full max-w-sm mx-auto">
      {/* Header Contextual */}
      <div className="flex justify-between items-start mb-10 pt-4">
        <div className="bg-blue-50 px-4 py-1.5 rounded-full">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sistema de Fichadas</p>
        </div>
        <button 
          onClick={onAdminLogout}
          className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm active:scale-90 transition-all border border-rose-100"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-8 flex flex-col justify-center pb-20">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-[0.9] italic">
            LAVADERO<br/>NAHUEL
          </h1>
          <div className="flex flex-col items-center">
            <div className="w-12 h-1 bg-blue-600 rounded-full mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Configurar Terminal</p>
          </div>
        </div>

        {/* Lista de Sedes Premium */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Seleccione Ubicación</h2>
          <div className="space-y-2.5">
            {SEDES.map((sede) => (
              <button
                key={sede.id}
                onClick={() => setSelected(sede.id)}
                className={`w-full group flex items-center p-4 rounded-[1.75rem] transition-all duration-300 border-2 text-left ${
                  selected === sede.id 
                    ? 'bg-white border-blue-600 shadow-xl shadow-blue-500/10 -translate-y-1' 
                    : 'bg-white/60 border-transparent hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  selected === sede.id ? 'bg-blue-50 scale-110' : 'bg-slate-50'
                }`}>
                  {sede.icon}
                </div>
                
                <div className="flex-1 ml-4">
                  <p className={`font-black uppercase tracking-tight text-sm transition-colors ${
                    selected === sede.id ? 'text-slate-900' : 'text-slate-600'
                  }`}>
                    {sede.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{sede.id === 'central' ? 'Sede Principal' : 'Sucursal Activa'}</p>
                </div>

                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  selected === sede.id ? 'bg-blue-600 text-white translate-x-0 opacity-100' : 'bg-slate-100 text-slate-300 -translate-x-2 opacity-0'
                }`}>
                  <ChevronRight size={16} strokeWidth={3} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Botón de Continuar */}
        <div className="pt-4 transition-all duration-500" style={{ opacity: selected ? 1 : 0.3, pointerEvents: selected ? 'auto' : 'none' }}>
          <button
            onClick={() => onSelect(selected)}
            className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-600/30 flex items-center justify-center space-x-3 active:scale-95 transition-transform"
          >
            <span>Activar Terminal</span>
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
