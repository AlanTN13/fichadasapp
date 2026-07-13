import { describe, expect, it } from 'vitest';
import {
  calculateWorkedHours,
  deriveEntryState,
  ENTRY_ACTIONS,
  ENTRY_STATES,
  formatWorkedHours,
  getRequestedEventForAction,
} from '../src/lib/timeEntryState';

describe('time entry state rules', () => {
  it('empleado sin fichadas permite START', () => {
    expect(deriveEntryState({ startAt: null, endAt: null })).toEqual({
      state: ENTRY_STATES.NOT_STARTED,
      allowedAction: ENTRY_ACTIONS.START,
    });
  });

  it('empleado con START permite END', () => {
    expect(
      deriveEntryState({
        startAt: '2026-07-13T11:00:00.000Z',
        endAt: null,
      })
    ).toEqual({
      state: ENTRY_STATES.WORKING,
      allowedAction: ENTRY_ACTIONS.END,
    });
  });

  it('empleado con START y END bloquea nuevas fichadas', () => {
    expect(
      deriveEntryState({
        startAt: '2026-07-13T11:00:00.000Z',
        endAt: '2026-07-13T19:00:00.000Z',
      })
    ).toEqual({
      state: ENTRY_STATES.COMPLETED,
      allowedAction: ENTRY_ACTIONS.NONE,
    });
  });

  it('mapea accion START al evento correcto', () => {
    expect(getRequestedEventForAction(ENTRY_ACTIONS.START)).toBe('START');
  });

  it('mapea accion END al evento correcto', () => {
    expect(getRequestedEventForAction(ENTRY_ACTIONS.END)).toBe('END');
  });

  it('retorna null para acciones invalidas', () => {
    expect(getRequestedEventForAction('OTHER')).toBeNull();
  });

  it('calcula horas trabajadas', () => {
    expect(
      calculateWorkedHours(
        '2026-07-13T11:00:00.000Z',
        '2026-07-13T19:30:00.000Z'
      )
    ).toBe(8.5);
  });

  it('devuelve null para jornada en curso', () => {
    expect(calculateWorkedHours('2026-07-13T11:00:00.000Z', null)).toBeNull();
  });

  it('formatea horas completas', () => {
    expect(formatWorkedHours(8.5)).toBe('08:30');
  });

  it('muestra En curso sin fin', () => {
    expect(formatWorkedHours(null)).toBe('En curso');
  });
});
