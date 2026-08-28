import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import Login from './components/Login';
import LocationSelector from './components/LocationSelector';
import KioskMode from './components/KioskMode';
import AdminPortal from './components/AdminPortal';
import LoadingSplash from './components/LoadingSplash';
import {
  getAdminContext,
  getCurrentSession,
  onAuthStateChange,
  signOut,
} from './services/supabaseApi';
import { clearConfirmedQueueItems, syncQueuedEntries } from './queue';

function App() {
  const [authInitializing, setAuthInitializing] = useState(true);
  const [splashReady, setSplashReady] = useState(false);
  const [view, setView] = useState('login');
  const [locationId, setLocationId] = useState(null);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [adminContext, setAdminContext] = useState(null);

  const routeAuthenticatedUser = (context) => {
    setAdminContext(context);
    setView(context.role === 'super_admin' ? 'admin' : 'location');
  };

  const clearSessionState = () => {
    setAdminContext(null);
    setLocationId(null);
    setSelectedLocationName('');
    setView('login');
  };

  useEffect(() => {
    let active = true;
    let minimumElapsed = false;
    let logoReady = false;
    const logo = new Image();
    const finishLoading = () => {
      logoReady = true;
      if (active && minimumElapsed) setSplashReady(true);
    };

    logo.src = '/nahuel-logo.png';
    if (logo.complete) finishLoading();
    else {
      logo.addEventListener('load', finishLoading, { once: true });
      logo.addEventListener('error', finishLoading, { once: true });
    }

    const minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      if (active && logoReady) setSplashReady(true);
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(minimumTimer);
      logo.removeEventListener('load', finishLoading);
      logo.removeEventListener('error', finishLoading);
    };
  }, []);

  useEffect(() => {
    let active = true;

    getCurrentSession()
      .then(async (session) => {
        if (!session) return;
        const context = await getAdminContext();
        if (active) routeAuthenticatedUser(context);
      })
      .catch(async () => {
        await signOut().catch(() => {});
        if (active) clearSessionState();
      })
      .finally(() => active && setAuthInitializing(false));

    const { data: authListener } = onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) clearSessionState();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    syncQueuedEntries().then(clearConfirmedQueueItems).catch(() => {});
    const interval = window.setInterval(() => {
      syncQueuedEntries().then(clearConfirmedQueueItems).catch(() => {});
    }, 5000);
    const handleOnline = () => syncQueuedEntries().then(clearConfirmedQueueItems).catch(() => {});
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogout = async () => {
    await signOut().catch(() => {});
    clearSessionState();
  };

  const handleLocationSelect = (selectedId) => {
    const selectedLocation = adminContext?.locations?.find((location) => location.id === selectedId);
    setLocationId(selectedId);
    setSelectedLocationName(selectedLocation?.name || 'Sede seleccionada');
    setView('kiosk');
  };

  if (authInitializing || !splashReady) {
    return <LoadingSplash />;
  }

  if (view === 'admin' && adminContext) {
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col font-['Montserrat']">
        <AdminPortal context={adminContext} onLogout={handleLogout} />
      </div>
    );
  }

  const showAppHeader = view !== 'kiosk';

  return (
    <div className="relative flex min-h-[100dvh] items-start justify-center overflow-x-hidden bg-[#020617] font-['Montserrat']">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-blue-600/30 blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full bg-indigo-600/30 blur-[160px]" />
      </div>

      <main className="app-container">
        {showAppHeader && (
          <header className="relative shrink-0 bg-white px-8 pb-6 pt-10 text-center">
            {view !== 'login' && (
              <button onClick={handleLogout} className="absolute right-6 top-10 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-500" title="Cerrar sesión">
                <LogOut size={20} strokeWidth={2.5} />
              </button>
            )}
            <div className="mb-4 inline-flex items-center space-x-2 rounded-full bg-blue-600/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Sistema de fichadas</span>
            </div>
            <h1 className="text-4xl font-black uppercase italic leading-[0.85] tracking-tighter text-slate-900">
              Lavadero<br /><span className="text-blue-600">Nahuel</span>
            </h1>
          </header>
        )}

        <div className="relative flex flex-1 flex-col bg-white">
          {view === 'login' && <Login onLoginSuccess={routeAuthenticatedUser} />}
          {view === 'location' && adminContext && (
            <LocationSelector
              onSelectLocation={handleLocationSelect}
              initialLocations={adminContext.locations || []}
              loading={false}
            />
          )}
          {view === 'kiosk' && (
            <KioskMode
              locationId={locationId}
              locationName={selectedLocationName}
              onLogout={handleLogout}
              onBackToLocations={() => setView('location')}
            />
          )}
        </div>

        {showAppHeader && (
          <footer className="shrink-0 bg-white py-6">
            <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">© 2026 Nahuel · NexOps</p>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;
