export const DNI_MIN_LENGTH = 7;
export const DNI_MAX_LENGTH = 8;

export function sanitizeDni(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, DNI_MAX_LENGTH);
}

export function isValidDni(value) {
  return new RegExp(`^\\d{${DNI_MIN_LENGTH},${DNI_MAX_LENGTH}}$`).test(String(value));
}
