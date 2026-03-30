import { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { LogOut, LayoutDashboard, Users, FileText, Settings, Loader2, Clock } from 'lucide-react';

export default function Dashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetchApi({ action: 'getDashboardStats' });
        if (response && response.success) {
          setData(response);
        }
      } catch (err) {
        console.error("Error al cargar estadísticas:", err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Generando Reporte</p>
      </div>
    );
  }

  const statCards = [
    { title: "Registros Hoy", value: data?.stats?.totalHoy || 0, icon: FileText, color: "bg-blue-600" },
    { title: "Empleados", value: data?.stats?.activos || 0, icon: Users, color: "bg-emerald-600" },
    { title: "Sedes", value: data?.stats?.sedes || 0, icon: LayoutDashboard, color: "bg-indigo-600" },
    { title: "Alertas", value: data?.stats?.alertas || 0, icon: Settings, color: "bg-rose-500" }
  ];

  return (
    <div className="flex flex-col flex-1 w-full h-full max-w-4xl mx-auto p-1 animate-in fade-in duration-700">
      
      {/* Cards de Stats con más aire */}
      <div className="grid grid-cols-2 gap-3 mb-6 px-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className={`${card.color} w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
              <card.icon size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{card.title}</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm mx-4 mb-10">
        <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Clock size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Últimas Fichadas</h3>
        </div>
        
        <div className="w-full">
          {/* Header de Tabla Mejorado */}
          <div className="flex pb-4 border-b border-gray-100 mb-2 px-3">
            <span className="flex-[2] text-[10px] font-black text-gray-300 uppercase tracking-widest">Colaborador</span>
            <span className="flex-1 text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">Estado</span>
            <span className="flex-1 text-[10px] font-black text-gray-300 uppercase tracking-widest text-right">Hora</span>
          </div>

          <div className="space-y-1">
            {data?.recientes?.map((row, idx) => (
              <div key={idx} className="flex items-center py-4 px-3 hover:bg-slate-50 transition-colors rounded-2xl border-b border-gray-50 last:border-none">
                
                {/* Colaborador (Nombre + DNI + Sede en una misma celda para ganar espacio) */}
                <div className="flex-[2] flex flex-col min-w-0 pr-4">
                  <span className="text-[14px] font-black text-slate-900 uppercase truncate">
                    {row.empleado || "Empleado"}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold text-gray-400">DNI {row.dni}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-md font-black uppercase tracking-tighter">
                        {row.ubicacion}
                    </span>
                  </div>
                </div>

                {/* Estado */}
                <div className="flex-1 flex justify-center">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                    row.tipo.includes('Inicio') 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {row.tipo.split(' ')[0]}
                  </span>
                </div>

                {/* Hora */}
                <div className="flex-1 text-right">
                  <span className="text-[14px] font-black text-slate-900 tracking-tighter">
                    {row.hora}
                  </span>
                  <p className="text-[8px] font-bold text-gray-300 uppercase">hs</p>
                </div>
              </div>
            )) || (
              <div className="py-12 text-center text-gray-200 font-black uppercase tracking-widest text-xs">
                Cargando datos...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
