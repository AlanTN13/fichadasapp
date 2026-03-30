import { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { 
  Clock, 
  LayoutDashboard,
  User,
  Fingerprint,
} from 'lucide-react';

export default function Dashboard({ userEmail }) {
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const res = await fetchApi({ action: 'getDashboardStats', email: userEmail });
      if (res.success) {
        setRecientes(res.recientes || []);
      }
    } catch (err) {
      console.error("Error cargando dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white fade-up uppercase">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 tracking-widest">Cargando...</p>
      </div>
    );
  }

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
              {recientes.length === 0 ? (
                <div className="p-20 text-center">
                   <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Sin actividad registrada</p>
                </div>
              ) : (
                recientes.map((f, i) => (
                  <div key={i} className={`px-8 py-8 flex flex-col border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors`}>
                    
                    {/* Header: Acción y Hora */}
                    <div className="flex items-center justify-between mb-4">
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${
                          f.tipo?.includes('Inicio') || f.tipo?.includes('Entrada') 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                          {f.tipo}
                        </div>
                        <div className="flex items-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl">
                            <Clock size={12} className="mr-2" />
                            <span>{f.hora || '--:--'} hs</span>
                        </div>
                    </div>

                    {/* Cuerpo: Nombre Principal */}
                    <div className="mb-3">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                            {f.nombre || 'Nombre No Encontrado'}
                        </h4>
                    </div>

                    {/* Footer: Identificación DNI */}
                    <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        <Fingerprint size={12} className="mr-2 text-blue-500" />
                        <span>DNI REGISTRADO: {f.dni || f.nombre?.slice(0,8) || '---'}</span>
                    </div>

                  </div>
                ))
              )}
            </div>
        </div>
      </section>
    </div>
  );
}
