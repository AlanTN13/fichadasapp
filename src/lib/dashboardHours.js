function sanitizeHours(hours) {
  if (typeof hours !== 'number' || Number.isNaN(hours) || hours < 0) {
    return null;
  }

  return hours;
}

export function formatHoursMinutes(hours, fallback = '00:00') {
  const safeHours = sanitizeHours(hours);
  if (safeHours == null) return fallback;

  const totalMinutes = Math.round(safeHours * 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDailyHoursCell(day) {
  if (!day) {
    return '—';
  }

  if (day.state === 'WORKING') {
    return 'Sin cierre';
  }

  const safeHours = sanitizeHours(day.worked_hours);
  if (safeHours == null) {
    return '—';
  }

  return formatHoursMinutes(safeHours);
}

export function sumWorkedHours(items) {
  return items.reduce((total, item) => {
    const value =
      typeof item === 'number' || item == null ? item : item?.worked_hours ?? null;
    const safeHours = sanitizeHours(value);
    return total + (safeHours || 0);
  }, 0);
}

export function buildHoursDashboardRows(rows, dateColumns) {
  return rows.map((row) => {
    const dayMap = new Map(
      (row.days || []).map((day) => [
        day.date,
        {
          ...day,
          displayValue: formatDailyHoursCell(day),
        },
      ])
    );

    const dayCells = dateColumns.map((column) => {
      const day = dayMap.get(column.key) || null;

      return {
        ...column,
        state: day?.state || 'NOT_STARTED',
        workedHours: sanitizeHours(day?.worked_hours ?? null),
        displayValue: day?.displayValue || '—',
        hasEntry: Boolean(day) && (day.state === 'WORKING' || sanitizeHours(day.worked_hours) != null),
      };
    });

    return {
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      dni: row.dni,
      locationId: row.location_id,
      locationName: row.location_name,
      dayCells,
      periodTotalHours: sumWorkedHours([{ worked_hours: row.period_total_hours }]),
      periodTotalLabel: formatHoursMinutes(row.period_total_hours, '00:00'),
      fortnightTotalHours: sumWorkedHours([{ worked_hours: row.fortnight_total_hours }]),
      fortnightTotalLabel: formatHoursMinutes(row.fortnight_total_hours, '00:00'),
    };
  });
}

export function hasAnyEntries(tableRows) {
  return tableRows.some((row) => row.dayCells.some((cell) => cell.hasEntry));
}
