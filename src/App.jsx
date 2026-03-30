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
    <div className="w-full h-screen overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background Decorative Blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-brand-accent/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg h-full max-h-[850px] premium-card flex flex-col relative z-10 transition-all duration-500 transform overflow-hidden scale-100 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)]">
        
        {/* Header - solo en vistas que no son kiosco para dar mas aire */}
        {view !== 'kiosk' && (
          <header className="px-8 pt-10 pb-2 text-center relative">
            <div className="absolute top-8 right-6">
              {view !== 'login' && (
                <button 
                  onClick={() => setView('login')} 
                  className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95 border border-red-50"
                  title="Cerrar Sesión"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <div className="inline-block px-4 py-1 bg-blue-600/10 rounded-full mb-2">
              <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase font-black">Sistema de Fichadas</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">LAVADERO<br/>NAHUEL</h1>
          </header>
        )}
        
        <main className="flex-1 flex flex-col p-8 overflow-y-auto overflow-x-hidden">
          {view === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
          {view === 'location' && <LocationSelector onSelectLocation={handleLocationSelect} email={userEmail} />}
          {view === 'kiosk' && <KioskMode locationId={locationId} onLogout={() => setView('login')} />}
          {view === 'dashboard' && <Dashboard onLogout={() => setView('login')} />}
        </main>
      </div>
      
      <footer className="mt-6 text-white/30 text-[10px] uppercase tracking-[0.2em] font-medium z-20">
        © 2026 Plataforma de Fichaje Inteligente
      </footer>
    </div>
  );
}

export default App;
