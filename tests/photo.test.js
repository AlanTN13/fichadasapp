import { describe, expect, it, vi } from 'vitest';
import { compressPhoto } from '../src/lib/photo';

describe('photo helpers', () => {
  it('devuelve null cuando la captura esta vacia', async () => {
    await expect(compressPhoto('data:,')).resolves.toBeNull();
  });

  it('devuelve null cuando la imagen no se puede cargar', async () => {
    const originalImage = globalThis.Image;

    class BrokenImage {
      /** @type {((event: Event) => void) | null} */
      onerror = null;

      set src(_value) {
        queueMicrotask(() => {
          this.onerror?.(new Event('error'));
        });
      }
    }

    vi.stubGlobal('Image', BrokenImage);

    await expect(compressPhoto('data:image/jpeg;base64,broken')).resolves.toBeNull();

    if (originalImage) {
      vi.stubGlobal('Image', originalImage);
    } else {
      vi.unstubAllGlobals();
    }
  });
});
