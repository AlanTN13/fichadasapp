import { describe, expect, it } from 'vitest';
import {
  buildHoursDashboardRows,
  formatDailyHoursCell,
  formatHoursMinutes,
  hasAnyEntries,
  sumWorkedHours,
} from '../src/lib/dashboardHours';

const dateColumns = [
  { key: '2026-07-13', label: 'Lun 13', isWeekend: false },
  { key: '2026-07-14', label: 'Mar 14', isWeekend: false },
];

describe('dashboard hours helpers', () => {
  it('calcula horas por dia en HH:MM', () => {
    expect(formatHoursMinutes(8.0833)).toBe('08:05');
  });

  it('devuelve sin cierre cuando falta END', () => {
    expect(formatDailyHoursCell({ state: 'WORKING', worked_hours: null })).toBe(
      'Sin cierre'
    );
  });

  it('muestra ausencia como raya', () => {
    expect(formatDailyHoursCell({ state: 'NOT_STARTED', worked_hours: null })).toBe(
      '—'
    );
  });

  it('no suma horas negativas', () => {
    expect(sumWorkedHours([8, -3, null, 1.5])).toBe(9.5);
  });

  it('arma filas con total semanal y quincenal', () => {
    const rows = buildHoursDashboardRows(
      [
        {
          employee_id: 'emp-1',
          employee_name: 'Roman Molina',
          dni: '30711813',
          location_id: 'loc-1',
          location_name: 'Planta',
          period_total_hours: 15.75,
          fortnight_total_hours: 40.5,
          days: [
            {
              date: '2026-07-13',
              state: 'COMPLETED',
              worked_hours: 8.0833,
            },
            {
              date: '2026-07-14',
              state: 'WORKING',
              worked_hours: null,
            },
          ],
        },
      ],
      dateColumns
    );

    expect(rows[0].dayCells[0].displayValue).toBe('08:05');
    expect(rows[0].dayCells[1].displayValue).toBe('Sin cierre');
    expect(rows[0].periodTotalLabel).toBe('15:45');
    expect(rows[0].fortnightTotalLabel).toBe('40:30');
  });

  it('detecta cuando no hay fichadas en el periodo', () => {
    const rows = buildHoursDashboardRows(
      [
        {
          employee_id: 'emp-1',
          employee_name: 'Roman Molina',
          dni: '30711813',
          location_id: 'loc-1',
          location_name: 'Planta',
          period_total_hours: 0,
          fortnight_total_hours: 0,
          days: [
            { date: '2026-07-13', state: 'NOT_STARTED', worked_hours: null },
            { date: '2026-07-14', state: 'NOT_STARTED', worked_hours: null },
          ],
        },
      ],
      dateColumns
    );

    expect(hasAnyEntries(rows)).toBe(false);
  });
});
