import { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { LayoutDashboard, Users, MapPin, RefreshCw, AlertCircle, Calendar, Hash, Clock, FileText } from 'lucide-react';

export default function Dashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi({ action: 'dashboard' });
      if (res.success) setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Registros Hoy', value: data?.hoy || 0, icon: <FileText size={20} />, color: 'bg-blue-50 text-blue-600', gradient: 'from-blue-500 to-blue-600' },
    { label: 'Empleados', value: data?.empleados || 0, icon: <Users size={20} />, color: 'bg-emerald-50 text-emerald-600', gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Sedes', value: data?.sedes || 0, icon: <MapPin size={20} />, color: 'bg-indigo-50 text-indigo-600', gradient: 'from-indigo-500 to-indigo-600' },
    { label: 'Alertas', value: 0, icon: <AlertCircle size={20} />, color: 'bg-rose-50 text-rose-600', gradient: 'from-rose-500 to-rose-600' }
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Sincronizando Datos</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 pb-10">
      {/* Header Contextual */}
      <div className="flex justify-between items-center mb-8">
        <div className="bg-slate-100 p-2 rounded-2xl">
          <LayoutDashboard className="text-slate-500" size={20} />
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={loadData} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center active:scale-90 transition-all text-slate-500">
                <RefreshCw size={18} />
            </button>
            <button onClick={onLogout} className="px-4 py-2 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase shadow-sm border border-rose-100 active:scale-95 transition-all">Salir</button>
        </div>
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-2 gap-3 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm relative overflow-hidden group">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className={`absolute bottom-0 right-0 w-1 h-12 bg-gradient-to-t ${stat.gradient} opacity-20`} />
          </div>
        ))}
      </div>

      {/* Últimas Fichadas */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
                    <Clock size={16} className="text-white" />
                </div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Últimas Fichadas</h2>
            </div>
            <p className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Realtime</p>
        </div>

        <div className="space-y-3">
          {data?.fichadas?.length > 0 ? (
            data.fichadas.map((f, i) => (
              <div key={i} className="bg-white p-4 rounded-[1.75rem] border border-slate-50 shadow-sm flex items-center space-x-4 hover:shadow-md transition-shadow group">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    <UserIcon />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{f.nombre || 'Personal Nahuel'}</p>
                  <div className="flex items-center space-x-2">
                     <span className="text-[9px] font-bold text-slate-400 font-mono">DNI {f.dni || '---'}</span>
                     <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${
                       f.tipo?.includes('Entrada') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                     }`}>
                       {f.tipo}
                     </span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <p className="text-sm font-black text-slate-900 tracking-tighter leading-none mb-1">{f.hora}</p>
                  <div className="flex items-center space-x-1 text-slate-300">
                    <MapPin size={8} />
                    <span className="text-[8px] font-black uppercase italic">{f.ubicacion || 'Central'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <Calendar size={32} className="mx-auto text-slate-300 mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay registros hoy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
