import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleManagement from '../src/components/ScheduleManagement';
import {
  getEmployeeSchedule,
  listEmployees,
  saveEmployeeSchedule,
} from '../src/services/supabaseApi';

vi.mock('../src/services/supabaseApi', () => ({
  getEmployeeSchedule: vi.fn(),
  listEmployees: vi.fn(),
  saveEmployeeSchedule: vi.fn(),
}));

const getEmployeeScheduleMock = vi.mocked(getEmployeeSchedule);
const listEmployeesMock = vi.mocked(listEmployees);
const saveEmployeeScheduleMock = vi.mocked(saveEmployeeSchedule);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const weeklySchedule = Array.from({ length: 7 }, (_, index) => ({
  cycle_week: 1,
  weekday: index + 1,
  working_day: index < 6,
  expected_start: '06:00',
  expected_end: '14:00',
  tolerance_minutes: 5,
}));

describe('ScheduleManagement', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    listEmployeesMock.mockResolvedValue({
      employees: [{ id: 'employee-1', first_name: 'Alan', last_name: 'Vega', active: true }],
    });
    getEmployeeScheduleMock.mockResolvedValue({
      cycle_weeks: 1,
      cycle_anchor_date: '2026-08-31',
      schedule: weeklySchedule,
    });
    saveEmployeeScheduleMock.mockResolvedValue({ success: true });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('convierte una jornada semanal en una rotación configurable de dos semanas', async () => {
    await act(async () => {
      root.render(<ScheduleManagement initialEmployeeId="employee-1" />);
    });
    await act(async () => Promise.resolve());

    const rotationOption = container.querySelectorAll('input[name="cycle"]')[1];
    await act(async () => rotationOption.click());

    const saveButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Guardar jornada'));
    await act(async () => saveButton.click());

    expect(saveEmployeeScheduleMock).toHaveBeenCalledTimes(1);
    const [employeeId, configuration] = saveEmployeeScheduleMock.mock.calls[0];
    expect(employeeId).toBe('employee-1');
    expect(configuration.cycleWeeks).toBe(2);
    expect(configuration.cycleAnchorDate).toBe('2026-08-31');
    expect(configuration.days).toHaveLength(14);
    expect(configuration.days.filter((day) => day.cycle_week === 2)).toHaveLength(7);
  });
});
