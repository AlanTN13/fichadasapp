import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import Login from './components/Login';
import LocationSelector from './components/LocationSelector';
import KioskMode from './components/KioskMode';
import Dashboard from './components/Dashboard';
import { getLocationsForEmail } from './services/supabaseApi';
import { clearConfirmedQueueItems, syncQueuedEntries } from './queue';

function App() {
  const [view, setView] = useState('login'); // 'login', 'location', 'kiosk', 'dashboard'
  const [locationId, setLocationId] = useState(null);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [userEmail, setUserEmail] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const loadLocations = async (email) => {
    setLocationsLoading(true);

    try {
      const data = await getLocationsForEmail(email);
      setLocations(data);
      return data;
    } catch (error) {
      console.error('Error precargando sedes:', error);
      setLocations([]);
      throw error;
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleLoginSuccess = async (loginContext, email) => {
    setUserEmail(email);
    if (loginContext.role === 'super_admin') {
      setView('dashboard');
    } else {
      setView('location');
      if (Array.isArray(loginContext.locations) && loginContext.locations.length > 0) {
        setLocations(loginContext.locations);
      } else {
        loadLocations(email).catch(() => {});
      }
    }
  };

  const handleLogout = () => {
    setUserEmail(null);
    setLocations([]);
    setLocationsLoading(false);
    setLocationId(null);
    setSelectedLocationName('');
    setView('login');
  };

  const handleRetryLocations = () => {
    if (!userEmail) return;

    loadLocations(userEmail).catch(() => {});
  };

  useEffect(() => {
    if (view !== 'location' || !userEmail || locations.length > 0 || locationsLoading) {
      return;
    }

    loadLocations(userEmail).catch(() => {});
  }, [view, userEmail, locations.length, locationsLoading]);

  const handleLocationSelect = (locId) => {
    const selectedLocation = locations.find((location) => location.id === locId);
    setLocationId(locId);
    setSelectedLocationName(
      selectedLocation?.name || selectedLocation?.nombre || 'Sede seleccionada'
    );
    setView('kiosk');
  };

  const handleBackToLocations = () => {
    setView('location');
  };

  useEffect(() => {
    syncQueuedEntries().then(() => {
      clearConfirmedQueueItems();
    }).catch(() => {});

    const interval = setInterval(() => {
      syncQueuedEntries().then(() => {
        clearConfirmedQueueItems();
      }).catch(() => {});
    }, 5000);

    const handleOnline = () => {
      syncQueuedEntries().then(() => {
        clearConfirmedQueueItems();
      }).catch(() => {});
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const isDashboard = view === 'dashboard';
  const showCompactDashboardHeader = isDashboard;
  const showCompactAppHeader = view !== 'kiosk' && !isDashboard;

  return (
    <div className={`${isDashboard ? 'fixed inset-0 items-center overflow-hidden' : 'relative min-h-[100dvh] items-start overflow-x-hidden'} bg-[#020617] flex justify-center font-['Montserrat']`}>

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/30 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/30 blur-[160px] rounded-full animate-pulse delay-1000" />
      </div>

      <main className={isDashboard ? 'dashboard-container' : 'app-container'}>

        {showCompactAppHeader && (
          <header className="px-8 pt-10 pb-6 text-center relative flex-shrink-0 bg-white">
            <div className="absolute top-10 right-6 z-50">
              {view !== 'login' && (
                <button
                  onClick={handleLogout}
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

        {showCompactDashboardHeader && (
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Lavadero Nahuel
              </p>
              <h1 className="truncate text-lg font-black uppercase italic tracking-tight text-slate-900 md:text-xl">
                Horas trabajadas
              </h1>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              title="Cerrar Sesión"
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">
                <LogOut size={18} strokeWidth={2.25} />
              </span>
            </button>
          </header>
        )}

        <div className={`relative flex flex-1 flex-col ${isDashboard ? 'overflow-hidden bg-[#f5f7fa]' : 'bg-white'}`}>
          {view === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
          {view === 'location' && (
            <LocationSelector
              onSelectLocation={handleLocationSelect}
              email={userEmail}
              initialLocations={locations}
              loading={locationsLoading}
              onRetry={handleRetryLocations}
            />
          )}
          {view === 'kiosk' && (
            <KioskMode
              locationId={locationId}
              locationName={selectedLocationName}
              onLogout={handleLogout}
              onBackToLocations={handleBackToLocations}
            />
          )}
          {view === 'dashboard' && (
            <Dashboard userEmail={userEmail} onLogout={handleLogout} />
          )}
        </div>

        {showCompactAppHeader && (
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
