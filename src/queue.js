import { getDeviceId } from './lib/device';
import { compressPhoto } from './lib/photo';
import { setCachedKioskState } from './lib/kioskCache';
import { recordTimeEntry, uploadTimeEntryPhoto } from './services/supabaseApi';

const STORAGE_KEY = 'fichadas_queue_v2';
const BACKOFF_BASE_MS = 4000;
const MAX_ATTEMPTS = 6;

let isSyncing = false;

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error leyendo cola:', error);
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('fichadas-queue-updated', { detail: queue }));
}

function getBackoffMs(attempts) {
  return BACKOFF_BASE_MS * Math.max(1, attempts);
}

function replaceItem(queue, itemId, updater) {
  return queue.map((item) => (item.id === itemId ? updater(item) : item));
}

export function getQueueItems() {
  return readQueue();
}

export function getQueueSummary() {
  const items = readQueue();
  return {
    pending: items.filter((item) => item.status === 'pending').length,
    syncing: items.filter((item) => item.status === 'syncing').length,
    failed: items.filter((item) => item.status === 'failed').length,
    confirmed: items.filter((item) => item.status === 'confirmed').length,
    items,
  };
}

export async function enqueueFichada(payload) {
  const queue = readQueue();
  const compressedPhoto = await compressPhoto(payload.photoDataUrl);
  const item = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAttemptAt: null,
    attempts: 0,
    status: 'pending',
    lastError: null,
    requestedEvent: payload.requestedEvent,
    payload: {
      ...payload,
      photoDataUrl: compressedPhoto,
      deviceId: payload.deviceId || getDeviceId(),
      syncSource: payload.syncSource || 'kiosk-web',
    },
  };

  queue.push(item);
  writeQueue(queue);
  return item;
}

export function markQueueItemRetry(itemId) {
  const queue = readQueue();
  writeQueue(
    replaceItem(queue, itemId, (item) => ({
      ...item,
      status: 'pending',
      lastError: null,
      updatedAt: new Date().toISOString(),
    }))
  );
}

export function clearConfirmedQueueItems() {
  const queue = readQueue().filter((item) => item.status !== 'confirmed');
  writeQueue(queue);
}

async function syncQueueItem(item) {
  const { payload } = item;

  const photoUpload = await uploadTimeEntryPhoto({
    dataUrl: payload.photoDataUrl,
    employeeId: payload.employeeId,
    businessDate: payload.businessDate,
    idempotencyKey: item.idempotencyKey,
  });

  const result = await recordTimeEntry({
    dni: payload.dni,
    locationId: payload.locationId,
    requestedEvent: payload.requestedEvent,
    idempotencyKey: item.idempotencyKey,
    photoPath: photoUpload.photoPath,
    latitude: payload.latitude,
    longitude: payload.longitude,
    deviceId: payload.deviceId,
    syncSource: payload.syncSource,
  });

  return {
    result,
    photoWarning: photoUpload.photoWarning,
  };
}

/**
 * @param {{onItemConfirmed?: (item: any, result: any, photoWarning: string | null) => void, onItemFailed?: (item: any, error: Error) => void}=} callbacks
 */
export async function syncQueuedEntries({ onItemConfirmed, onItemFailed } = {}) {
  if (isSyncing) return [];

  const queue = readQueue();
  const candidates = queue.filter(
    (item) =>
      item.status === 'pending' ||
      (item.status === 'failed' && item.attempts < MAX_ATTEMPTS)
  );

  if (candidates.length === 0) return [];

  isSyncing = true;
  const confirmations = [];

  try {
    for (const candidate of candidates) {
      writeQueue(
        replaceItem(readQueue(), candidate.id, (item) => ({
          ...item,
          status: 'syncing',
          lastError: null,
          updatedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        }))
      );

      try {
        const { result, photoWarning } = await syncQueueItem(candidate);
        confirmations.push(result);
        setCachedKioskState(candidate.payload.dni, result.state);

        writeQueue(
          replaceItem(readQueue(), candidate.id, (item) => ({
            ...item,
            status: 'confirmed',
            lastError: photoWarning,
            updatedAt: new Date().toISOString(),
            serverResult: result,
          }))
        );

        if (onItemConfirmed) {
          onItemConfirmed(candidate, result, photoWarning);
        }
      } catch (error) {
        const attempts = candidate.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        writeQueue(
          replaceItem(readQueue(), candidate.id, (item) => ({
            ...item,
            attempts,
            status,
            lastError: error.message,
            nextRetryAt: Date.now() + getBackoffMs(attempts),
            updatedAt: new Date().toISOString(),
          }))
        );

        if (onItemFailed) {
          onItemFailed(candidate, error);
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return confirmations;
}
