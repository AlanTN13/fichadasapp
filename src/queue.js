import { fetchApi } from './api';

const STORAGE_KEY = 'fichadas_queue_v1';
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5000;

let isProcessing = false;

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error leyendo cola de fichadas:', error);
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('fichadas-queue-updated', { detail: queue }));
}

function updateItem(queue, id, updater) {
  return queue.map((item) => (item.id === id ? updater(item) : item));
}

function getBackoffMs(attempts) {
  return RETRY_BASE_MS * Math.max(1, attempts);
}

export function enqueueFichada(payload) {
  const queue = readQueue();
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    status: 'pending',
    lastError: null,
    payload,
  };

  queue.push(item);
  writeQueue(queue);
  return item;
}

export function getQueueSummary() {
  const queue = readQueue();
  const activeItems = queue.filter((item) => item.status !== 'sent');

  return {
    total: activeItems.length,
    pending: activeItems.filter((item) => item.status === 'pending').length,
    failed: activeItems.filter((item) => item.status === 'failed').length,
  };
}

async function processQueueItem(item) {
  let usuarioId = item.payload.usuario_id ?? null;

  if (!usuarioId) {
    const validation = await fetchApi(
      { action: 'validarDNI', dni: item.payload.dni },
      { timeout: 8000 }
    );

    if (!validation.success || !validation.usuario_id) {
      throw new Error(validation.error || 'No se pudo validar el DNI');
    }

    usuarioId = validation.usuario_id;
  }

  const result = await fetchApi(
    {
      action: 'fichar',
      ...item.payload,
      usuario_id: usuarioId,
    },
    { timeout: 12000 }
  );

  if (!result.success) {
    throw new Error(result.error || 'No se pudo sincronizar la fichada');
  }
}

export async function processFichadasQueue() {
  if (isProcessing) return;

  const queue = readQueue();
  const nextItem = queue.find(
    (item) => item.status !== 'sent' && Date.now() >= (item.nextAttemptAt ?? 0)
  );

  if (!nextItem) return;

  isProcessing = true;

  try {
    writeQueue(
      updateItem(queue, nextItem.id, (item) => ({
        ...item,
        status: 'processing',
        lastError: null,
      }))
    );

    await processQueueItem(nextItem);

    const updatedQueue = readQueue().filter((item) => item.id !== nextItem.id);
    writeQueue(updatedQueue);
  } catch (error) {
    console.error('Error procesando cola de fichadas:', error);

    const currentQueue = readQueue();
    const attempts = (nextItem.attempts ?? 0) + 1;
    const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

    writeQueue(
      updateItem(currentQueue, nextItem.id, (item) => ({
        ...item,
        attempts,
        status,
        lastError: error.message,
        nextAttemptAt: Date.now() + getBackoffMs(attempts),
      }))
    );
  } finally {
    isProcessing = false;

    const stillPending = readQueue().some(
      (item) => item.status !== 'sent' && item.status !== 'failed' && Date.now() >= (item.nextAttemptAt ?? 0)
    );

    if (stillPending) {
      setTimeout(() => {
        processFichadasQueue();
      }, 0);
    }
  }
}
