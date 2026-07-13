import { describe, expect, it } from 'vitest';
import {
  buildHoursDashboardParams,
  PERIOD_PRESETS,
  getFortnightRangeForDate,
  resolveDashboardPeriod,
} from '../src/lib/dashboardPeriods';

describe('dashboard periods', () => {
  it('usa la primera quincena del 1 al 15', () => {
    expect(getFortnightRangeForDate('2026-07-13')).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      label: 'Primera quincena',
    });
  });

  it('usa la segunda quincena del 16 al ultimo dia', () => {
    expect(getFortnightRangeForDate('2026-07-18')).toEqual({
      startDate: '2026-07-16',
      endDate: '2026-07-31',
      label: 'Segunda quincena',
    });
  });

  it('resuelve esta semana con lunes a domingo', () => {
    const period = resolveDashboardPeriod(PERIOD_PRESETS.THIS_WEEK, {
      today: '2026-07-15',
    });

    expect(period.startDate).toBe('2026-07-13');
    expect(period.endDate).toBe('2026-07-19');
  });

  it('permite periodo personalizado y normaliza fechas invertidas', () => {
    const period = resolveDashboardPeriod(PERIOD_PRESETS.CUSTOM, {
      customStart: '2026-07-20',
      customEnd: '2026-07-10',
    });

    expect(period.startDate).toBe('2026-07-10');
    expect(period.endDate).toBe('2026-07-20');
  });

  it('arma parametros con cambio de sede y cambio de periodo', () => {
    const period = resolveDashboardPeriod(PERIOD_PRESETS.PREVIOUS_WEEK, {
      today: '2026-07-15',
    });

    expect(
      buildHoursDashboardParams({
        email: 'manager@empresa.com',
        locationId: 'loc-2',
        period,
      })
    ).toEqual({
      email: 'manager@empresa.com',
      locationId: 'loc-2',
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      fortnightStartDate: '2026-07-01',
      fortnightEndDate: '2026-07-15',
    });
  });
});
