import { useCallback, useState } from 'react';

const PREFIX = 'fichadas.admin.';

export function useAdminSessionState(key, initialValue) {
  const storageKey = `${PREFIX}${key}`;
  const [value, setValue] = useState(() => {
    try {
      const storedValue = window.sessionStorage.getItem(storageKey);
      return storedValue === null ? initialValue : JSON.parse(storedValue);
    } catch {
      return initialValue;
    }
  });

  const updateValue = useCallback((nextValue) => {
    setValue((currentValue) => {
      const resolvedValue = typeof nextValue === 'function'
        ? nextValue(currentValue)
        : nextValue;

      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(resolvedValue));
      } catch {
        // Session persistence is an enhancement; the screen remains usable without it.
      }

      return resolvedValue;
    });
  }, [storageKey]);

  return [value, updateValue];
}

export function clearAdminSessionState() {
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Logout must continue even if storage is unavailable.
  }
}
