import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Inconsistencies from '../src/components/Inconsistencies';
import FortnightlyAttendance from '../src/components/FortnightlyAttendance';
import {
  getFortnightlyAttendanceSummary,
  listInconsistencies,
  reviewInconsistency,
} from '../src/services/supabaseApi';

vi.mock('../src/services/supabaseApi', () => ({
  getFortnightlyAttendanceSummary: vi.fn(),
  listInconsistencies: vi.fn(),
  reviewInconsistency: vi.fn(),
}));

const getSummaryMock = vi.mocked(getFortnightlyAttendanceSummary);
const listInconsistenciesMock = vi.mocked(listInconsistencies);
const reviewInconsistencyMock = vi.mocked(reviewInconsistency);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => Promise.resolve());
  await act(async () => Promise.resolve());
}

describe('attendance review', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    reviewInconsistencyMock.mockResolvedValue({ success: true });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('clasifica una inconsistencia sin modificar la fichada original', async () => {
    listInconsistenciesMock.mockResolvedValue({
      counts: { open: 1, resolved: 0, justified: 0, unjustified: 1 },
      locations: [],
      inconsistencies: [{
        id: 'inc-1',
        employee_name: 'Ana Pérez',
        dni: '123',
        location_name: 'Planta',
        business_date: '2026-09-20',
        type: 'LATE_ARRIVAL',
        expected_time: '08:00',
        actual_time: '08:35',
        late_minutes: 35,
        status: 'OPEN',
        review_status: null,
      }],
    });

    await act(async () => root.render(<Inconsistencies />));
    await flush();

    const justifyButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Justificada');
    await act(async () => justifyButton.click());

    expect(reviewInconsistencyMock).toHaveBeenCalledWith('inc-1', 'JUSTIFIED');
    expect(container.textContent).toContain('35 min');
  });

  it('muestra por separado irregularidades, ausentes, fichadas y horas quincenales', async () => {
    getSummaryMock.mockResolvedValue({
      locations: [],
      today_attendance: { clocked_in: 25, scheduled: 26 },
      rows: [{
        employee_id: 'employee-1',
        employee_name: 'Ana Pérez',
        dni: '123',
        location_name: 'Planta',
        late_arrivals: 2,
        absences: 1,
        justified: 1,
        unjustified: 2,
        pending_review: 0,
        late_minutes: 30,
        is_irregular: true,
        total_hours: 72.5,
      }],
      absences: [{
        employee_id: 'employee-1',
        employee_name: 'Ana Pérez',
        business_date: '2026-09-18',
      }],
    });

    await act(async () => root.render(<FortnightlyAttendance />));
    await flush();

    expect(container.textContent).toContain('25 de 26 ficharon');
    expect(container.textContent).toContain('Alcanzada');
    expect(container.textContent).toContain('72:30');
    expect(container.textContent).toContain('Jornada esperada sin entrada ni salida');
  });
});
