import { useState } from 'react';
import { LogOut } from 'lucide-react';
import Login from './components/Login';
import LocationSelector from './components/LocationSelector';
import KioskMode from './components/KioskMode';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState('login'); // 'login', 'location', 'kiosk', 'dashboard'
  const [userRole, setUserRole] = useState(null);
  const [locationId, setLocationId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  const handleLoginSuccess = (role, email) => {
    setUserRole(role);
    setUserEmail(email);
    if (role === 'super_admin') {
      setView('dashboard');
    } else {
      setView('location');
    }
  };

  const handleLocationSelect = (locId) => {
    setLocationId(locId);
    setView('kiosk');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4 overflow-x-hidden">
      {/* Fondo con resplandor premium */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-1/3 h-1/3 bg-blue-600/20 blur-[130px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-1/3 h-1/3 bg-indigo-600/20 blur-[130px] rounded-full" />
      </div>

      <main className="w-full sm:max-w-[480px] min-h-screen sm:min-h-[850px] sm:h-auto bg-slate-50 relative flex flex-col shadow-2xl sm:rounded-[3rem] overflow-hidden border-x border-white/5 z-10 transition-all duration-500">

        {/* Header - solo en vistas que no son kiosco para dar mas aire */}
        {view !== 'kiosk' && (
          <header className="px-8 pt-10 pb-4 text-center relative flex-shrink-0">
            <div className="absolute top-8 right-6">
              {view !== 'login' && (
                <button
                  onClick={() => setView('login')}
                  className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95 border border-red-50 shadow-sm"
                  title="Cerrar Sesión"
                >
                  <LogOut size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <div className="inline-block px-4 py-1 bg-blue-600/10 rounded-full mb-3">
              <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase font-black">Sistema de Fichadas</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">LAVADERO<br />NAHUEL</h1>
          </header>
        )}

        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto">
          {view === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
          {view === 'location' && <LocationSelector onSelectLocation={handleLocationSelect} email={userEmail} />}
          {view === 'kiosk' && <KioskMode locationId={locationId} onLogout={() => setView('login')} />}
          {view === 'dashboard' && <Dashboard onLogout={() => setView('login')} />}
        </div>
      </main>

      <footer className="py-6 sm:mt-2 text-white/30 text-[10px] uppercase tracking-[0.2em] font-black z-20 text-center">
        © 2026 LAVADERO NAHUEL • ID SMART
      </footer>
    </div>
  );
}

export default App;
