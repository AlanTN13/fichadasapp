import { describe, expect, it } from 'vitest';
import { isValidDni, sanitizeDni } from '../src/lib/dni';

describe('DNI', () => {
  it('conserva solamente dígitos y respeta el máximo de ocho', () => {
    expect(sanitizeDni('12.345.6789')).toBe('12345678');
    expect(sanitizeDni(1234567)).toBe('1234567');
  });

  it('valida únicamente strings de siete u ocho dígitos', () => {
    expect(isValidDni('1234567')).toBe(true);
    expect(isValidDni('12345678')).toBe(true);
    expect(isValidDni('123456')).toBe(false);
    expect(isValidDni('12a45678')).toBe(false);
    expect(isValidDni('123456789')).toBe(false);
  });
});
