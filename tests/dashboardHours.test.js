import { describe, expect, it } from 'vitest';
import {
  buildDailyHoursCell,
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
      '—'
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

    expect(rows[0].dayCells[0].details.entryLabel).toBe('—');
    expect(rows[0].dayCells[0].details.hoursLabel).toBe('08:05');
    expect(rows[0].dayCells[1].details.exitLabel).toBe('Sin cierre');
    expect(rows[0].dayCells[1].details.hoursLabel).toBe('—');
    expect(rows[0].periodTotalLabel).toBe('15:45');
    expect(rows[0].fortnightTotalLabel).toBe('40:30');
  });

  it('muestra ingreso, salida y horas cuando la jornada esta completa', () => {
    expect(
      buildDailyHoursCell({
        state: 'COMPLETED',
        start_time: '08:11',
        end_time: '17:03',
        worked_hours: 8.8666,
      })
    ).toEqual({
      entryLabel: '08:11',
      exitLabel: '17:03',
      hoursLabel: '08:52',
      status: 'COMPLETED',
      hasEntry: true,
    });
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
