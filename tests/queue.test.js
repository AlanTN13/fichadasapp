import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConfirmedQueueItems,
  enqueueFichada,
  getQueueItems,
  getQueueSummary,
  markQueueItemRetry,
  syncQueuedEntries,
} from '../src/queue';

vi.mock('../src/services/supabaseApi', () => ({
  recordTimeEntry: vi.fn(),
  uploadTimeEntryPhoto: vi.fn(),
}));

vi.mock('../src/lib/photo', () => ({
  compressPhoto: vi.fn(async (dataUrl) => dataUrl),
}));

const { recordTimeEntry, uploadTimeEntryPhoto } = await import(
  '../src/services/supabaseApi'
);

describe('sync queue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(uploadTimeEntryPhoto).mockResolvedValue({
      photoPath: 'entries/test/photo.jpg',
      photoWarning: null,
    });
  });

  it('encola eventos como pending con idempotency key', async () => {
    const item = await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    expect(item.status).toBe('pending');
    expect(item.idempotencyKey).toBeTruthy();
    expect(getQueueSummary().pending).toBe(1);
  });

  it('confirma una fichada y la deja marcada como confirmed', async () => {
    vi.mocked(recordTimeEntry).mockResolvedValue({
      success: true,
      state: { employee_name: 'Nahuel Molina' },
    });

    await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    await syncQueuedEntries();

    expect(getQueueItems()[0].status).toBe('confirmed');
  });

  it('permite limpiar confirmados luego de sincronizar', async () => {
    vi.mocked(recordTimeEntry).mockResolvedValue({
      success: true,
      state: { employee_name: 'Nahuel Molina' },
    });

    await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    await syncQueuedEntries();
    clearConfirmedQueueItems();

    expect(getQueueItems()).toHaveLength(0);
  });

  it('si falla backend no consolida y guarda error', async () => {
    vi.mocked(recordTimeEntry).mockRejectedValue(new Error('backend caido'));

    await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    await syncQueuedEntries();

    expect(getQueueItems()[0].status).toBe('pending');
    expect(getQueueItems()[0].lastError).toBe('backend caido');
  });

  it('marcar retry vuelve el item a pending', async () => {
    vi.mocked(recordTimeEntry).mockRejectedValue(new Error('backend caido'));

    const item = await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    await syncQueuedEntries();
    markQueueItemRetry(item.id);

    expect(getQueueItems()[0].status).toBe('pending');
    expect(getQueueItems()[0].lastError).toBeNull();
  });

  it('un resultado idempotente no duplica en la cola local', async () => {
    vi.mocked(recordTimeEntry).mockResolvedValue({
      success: true,
      idempotent: true,
      state: { employee_name: 'Nahuel Molina' },
    });

    await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    await syncQueuedEntries();
    expect(getQueueItems()[0].status).toBe('confirmed');
  });

  it('dos sync simultaneos no procesan dos veces', async () => {
    /** @type {null | ((value: any) => void)} */
    let resolver = null;
    vi.mocked(recordTimeEntry).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        })
    );

    await enqueueFichada({
      dni: '40732253',
      locationId: 'loc-1',
      requestedEvent: 'START',
      photoDataUrl: 'data:image/jpeg;base64,abc',
    });

    const first = syncQueuedEntries();
    const second = syncQueuedEntries();
    await Promise.resolve();
    if (resolver) {
      resolver({ success: true, state: { employee_name: 'Nahuel Molina' } });
    }

    await first;
    await second;

    expect(recordTimeEntry).toHaveBeenCalledTimes(1);
  });
});
