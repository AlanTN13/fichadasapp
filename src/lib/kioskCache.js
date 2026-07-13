const STORAGE_KEY = 'fichadas_server_state_cache_v1';

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Error leyendo cache de estado kiosco:', error);
    return {};
  }
}

function writeCache(cache) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getCachedKioskState(dni) {
  if (!dni) return null;
  return readCache()[dni] ?? null;
}

export function setCachedKioskState(dni, state) {
  if (!dni || !state) return;
  const cache = readCache();
  cache[dni] = {
    ...state,
    cachedAt: new Date().toISOString(),
  };
  writeCache(cache);
}
