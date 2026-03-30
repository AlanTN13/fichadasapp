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
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center overflow-hidden font-['Montserrat']">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/30 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/30 blur-[160px] rounded-full animate-pulse delay-1000" />
      </div>

      <main className="app-container">
        
        {/* Header Branding */}
        {view !== 'kiosk' && (
          <header className="px-8 pt-10 pb-6 text-center relative flex-shrink-0 bg-white">
            <div className="absolute top-10 right-6 z-50">
              {view !== 'login' && (
                <button
                  onClick={() => setView('login')}
                  className="w-11 h-11 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-100 transition-all active:scale-90 border border-rose-100 shadow-sm"
                  title="Cerrar Sesión"
                >
                  <LogOut size={20} strokeWidth={2.5} />
                </button>
              )}
            </div>
            
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-600/10 rounded-full mb-4">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-blue-600 tracking-widest uppercase">ID SMART SYSTEM</span>
            </div>
            
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-[0.85] uppercase italic italic">
              LAVADERO<br />
              <span className="text-blue-600">NAHUEL</span>
            </h1>
          </header>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
          {view === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
          {view === 'location' && <LocationSelector onSelectLocation={handleLocationSelect} email={userEmail} />}
          {view === 'kiosk' && <KioskMode locationId={locationId} onLogout={() => setView('login')} />}
          {view === 'dashboard' && <Dashboard onLogout={() => setView('login')} email={userEmail} />}
        </div>
        
        {view !== 'kiosk' && (
           <footer className="py-6 bg-white shrink-0">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] text-center">
               © 2026 NAHUEL • BUILT BY ID SMART
             </p>
           </footer>
        )}
      </main>
    </div>
  );
}

export default App;
