const PERIOD_PRESETS = {
  THIS_WEEK: 'THIS_WEEK',
  PREVIOUS_WEEK: 'PREVIOUS_WEEK',
  FIRST_FORTNIGHT: 'FIRST_FORTNIGHT',
  SECOND_FORTNIGHT: 'SECOND_FORTNIGHT',
  CUSTOM: 'CUSTOM',
};

const PRESET_LABELS = {
  [PERIOD_PRESETS.THIS_WEEK]: 'Esta semana',
  [PERIOD_PRESETS.PREVIOUS_WEEK]: 'Semana anterior',
  [PERIOD_PRESETS.FIRST_FORTNIGHT]: 'Primera quincena',
  [PERIOD_PRESETS.SECOND_FORTNIGHT]: 'Segunda quincena',
  [PERIOD_PRESETS.CUSTOM]: 'Personalizado',
};

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTH_LABELS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function getBusinessDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function toBusinessDate(date) {
  const businessDate = getBusinessDateParts(date);
  return new Date(
    businessDate.year,
    businessDate.month - 1,
    businessDate.day,
    12,
    0,
    0,
    0
  );
}

/**
 * @param {Date | string | number} [dateLike]
 */
function toSafeDate(dateLike = new Date()) {
  if (dateLike instanceof Date) {
    return new Date(
      dateLike.getFullYear(),
      dateLike.getMonth(),
      dateLike.getDate(),
      12,
      0,
      0,
      0
    );
  }

  if (typeof dateLike === 'string') {
    const [year, month, day] = dateLike.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  }

  return toSafeDate(new Date(dateLike));
}

function addDays(date, amount) {
  const next = toSafeDate(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getStartOfWeek(dateLike) {
  const date = toSafeDate(dateLike);
  const currentDay = date.getDay();
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  return addDays(date, offset);
}

function getEndOfWeek(dateLike) {
  return addDays(getStartOfWeek(dateLike), 6);
}

function getMonthEnd(dateLike) {
  const date = toSafeDate(dateLike);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
}

export function formatDateKey(dateLike) {
  const date = toSafeDate(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFortnightRangeForDate(dateLike) {
  const date = toSafeDate(dateLike);
  const dayOfMonth = date.getDate();
  const start =
    dayOfMonth <= 15
      ? new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)
      : new Date(date.getFullYear(), date.getMonth(), 16, 12, 0, 0, 0);
  const end =
    dayOfMonth <= 15
      ? new Date(date.getFullYear(), date.getMonth(), 15, 12, 0, 0, 0)
      : getMonthEnd(date);

  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end),
    label: dayOfMonth <= 15 ? 'Primera quincena' : 'Segunda quincena',
  };
}

export function buildDateColumns(startDate, endDate) {
  const columns = [];
  let cursor = toSafeDate(startDate);
  const end = toSafeDate(endDate);

  while (cursor <= end) {
    columns.push({
      key: formatDateKey(cursor),
      label: `${WEEKDAY_LABELS[cursor.getDay()]} ${cursor.getDate()}`,
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
    });
    cursor = addDays(cursor, 1);
  }

  return columns;
}

export function formatPeriodLabel(startDate, endDate) {
  const start = toSafeDate(startDate);
  const end = toSafeDate(endDate);

  if (formatDateKey(start) === formatDateKey(end)) {
    return `${start.getDate()} de ${MONTH_LABELS[start.getMonth()]}`;
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} al ${end.getDate()} de ${MONTH_LABELS[start.getMonth()]}`;
  }

  return `${start.getDate()} de ${MONTH_LABELS[start.getMonth()]} al ${end.getDate()} de ${MONTH_LABELS[end.getMonth()]}`;
}

export function getPresetLabel(preset) {
  return PRESET_LABELS[preset] || PRESET_LABELS[PERIOD_PRESETS.THIS_WEEK];
}

export function getPeriodTotalLabel(preset) {
  if (
    preset === PERIOD_PRESETS.THIS_WEEK ||
    preset === PERIOD_PRESETS.PREVIOUS_WEEK
  ) {
    return 'Total semana';
  }

  if (
    preset === PERIOD_PRESETS.FIRST_FORTNIGHT ||
    preset === PERIOD_PRESETS.SECOND_FORTNIGHT
  ) {
    return 'Total quincena';
  }

  return 'Total periodo';
}

/**
 * @param {string} preset
 * @param {{ today?: Date | string | number, customStart?: string, customEnd?: string }} [options]
 */
export function resolveDashboardPeriod(
  preset,
  { today = new Date(), customStart = '', customEnd = '' } = {}
) {
  const referenceDate = today instanceof Date ? toBusinessDate(today) : toSafeDate(today);

  if (preset === PERIOD_PRESETS.PREVIOUS_WEEK) {
    const thisWeekStart = getStartOfWeek(referenceDate);
    const start = addDays(thisWeekStart, -7);
    const end = addDays(start, 6);
    const fortnight = getFortnightRangeForDate(start);

    return {
      preset,
      label: PRESET_LABELS[preset],
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
      fortnightStartDate: fortnight.startDate,
      fortnightEndDate: fortnight.endDate,
      displayLabel: `${PRESET_LABELS[preset]} · ${formatPeriodLabel(start, end)}`,
    };
  }

  if (preset === PERIOD_PRESETS.FIRST_FORTNIGHT) {
    const start = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      1,
      12,
      0,
      0,
      0
    );
    const end = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      15,
      12,
      0,
      0,
      0
    );

    return {
      preset,
      label: PRESET_LABELS[preset],
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
      fortnightStartDate: formatDateKey(start),
      fortnightEndDate: formatDateKey(end),
      displayLabel: `${PRESET_LABELS[preset]} · ${formatPeriodLabel(start, end)}`,
    };
  }

  if (preset === PERIOD_PRESETS.SECOND_FORTNIGHT) {
    const start = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      16,
      12,
      0,
      0,
      0
    );
    const end = getMonthEnd(referenceDate);

    return {
      preset,
      label: PRESET_LABELS[preset],
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
      fortnightStartDate: formatDateKey(start),
      fortnightEndDate: formatDateKey(end),
      displayLabel: `${PRESET_LABELS[preset]} · ${formatPeriodLabel(start, end)}`,
    };
  }

  if (preset === PERIOD_PRESETS.CUSTOM) {
    const start = customStart ? toSafeDate(customStart) : referenceDate;
    const end = customEnd ? toSafeDate(customEnd) : start;
    const normalizedStart = start <= end ? start : end;
    const normalizedEnd = start <= end ? end : start;
    const fortnight = getFortnightRangeForDate(normalizedStart);

    return {
      preset,
      label: PRESET_LABELS[preset],
      startDate: formatDateKey(normalizedStart),
      endDate: formatDateKey(normalizedEnd),
      fortnightStartDate: fortnight.startDate,
      fortnightEndDate: fortnight.endDate,
      displayLabel: `${PRESET_LABELS[preset]} · ${formatPeriodLabel(
        normalizedStart,
        normalizedEnd
      )}`,
    };
  }

  const start = getStartOfWeek(referenceDate);
  const end = getEndOfWeek(referenceDate);
  const fortnight = getFortnightRangeForDate(start);

  return {
    preset: PERIOD_PRESETS.THIS_WEEK,
    label: PRESET_LABELS[PERIOD_PRESETS.THIS_WEEK],
    startDate: formatDateKey(start),
    endDate: formatDateKey(end),
    fortnightStartDate: fortnight.startDate,
    fortnightEndDate: fortnight.endDate,
    displayLabel: `${PRESET_LABELS[PERIOD_PRESETS.THIS_WEEK]} · ${formatPeriodLabel(
      start,
      end
    )}`,
  };
}

export function buildHoursDashboardParams({ email, locationId, period }) {
  return {
    email,
    locationId: locationId || null,
    startDate: period.startDate,
    endDate: period.endDate,
    fortnightStartDate: period.fortnightStartDate,
    fortnightEndDate: period.fortnightEndDate,
  };
}

export { PERIOD_PRESETS };
