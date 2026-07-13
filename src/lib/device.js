const STORAGE_KEY = 'fichadas_device_id_v1';

export function getDeviceId() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return current;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
