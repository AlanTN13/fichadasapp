export const ENTRY_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  WORKING: 'WORKING',
  COMPLETED: 'COMPLETED',
};

export const ENTRY_ACTIONS = {
  START: 'START',
  END: 'END',
  NONE: 'NONE',
};

export function deriveEntryState({ startAt, endAt }) {
  if (!startAt) {
    return {
      state: ENTRY_STATES.NOT_STARTED,
      allowedAction: ENTRY_ACTIONS.START,
    };
  }

  if (!endAt) {
    return {
      state: ENTRY_STATES.WORKING,
      allowedAction: ENTRY_ACTIONS.END,
    };
  }

  return {
    state: ENTRY_STATES.COMPLETED,
    allowedAction: ENTRY_ACTIONS.NONE,
  };
}

export function getRequestedEventForAction(action) {
  if (action === ENTRY_ACTIONS.START) return 'START';
  if (action === ENTRY_ACTIONS.END) return 'END';
  return null;
}

export function calculateWorkedHours(startAt, endAt) {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return (end - start) / (1000 * 60 * 60);
}

export function formatWorkedHours(hours) {
  if (hours == null) return 'En curso';
  const roundedMinutes = Math.round(hours * 60);
  const hh = String(Math.floor(roundedMinutes / 60)).padStart(2, '0');
  const mm = String(roundedMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
