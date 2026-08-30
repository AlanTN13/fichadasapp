import { getSupabaseClient } from '../lib/supabase';
import { appEnv } from '../lib/env';
import { dataUrlToBlob } from '../lib/photo';

function normalizeRpcError(error, fallbackMessage) {
  return new Error(error?.message || fallbackMessage);
}

export async function signInWithPassword(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '')) {
    throw new Error('Tu correo todavía no fue confirmado. Revisá tu email y abrí el enlace de Supabase.');
  }

  if (error) throw new Error('Email o contraseña incorrectos.');
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeRpcError(error, 'No se pudo cerrar la sesión');
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeRpcError(error, 'No se pudo recuperar la sesión');
  return data.session;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange(callback);
}

export async function getAdminContext() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_admin_context');

  if (error) throw normalizeRpcError(error, 'La cuenta no tiene acceso administrativo');
  if (!data?.success) throw new Error(data?.error || 'Cuenta no autorizada.');
  return data;
}

export async function getKioskState({ dni, locationId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_kiosk_state_by_dni', {
    p_dni: String(dni),
    p_location_id: locationId,
    p_timezone: appEnv.businessTimezone,
  });

  if (error) throw normalizeRpcError(error, 'No se pudo consultar el estado');
  return data;
}

export async function uploadTimeEntryPhoto({ dataUrl, employeeId, businessDate, idempotencyKey }) {
  if (!dataUrl) {
    return { photoPath: null, photoWarning: null };
  }

  const supabase = getSupabaseClient();
  const blob = await dataUrlToBlob(dataUrl);
  const safeDate = String(businessDate || new Date().toISOString().slice(0, 10));
  const path = `entries/${safeDate}/${employeeId || 'unknown'}/${idempotencyKey}.jpg`;

  const { error } = await supabase.storage
    .from(appEnv.photoBucket)
    .upload(path, blob, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    return {
      photoPath: null,
      photoWarning: error.message || 'No se pudo subir la foto',
    };
  }

  return {
    photoPath: path,
    photoWarning: null,
  };
}

export async function recordTimeEntry(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('record_time_entry', {
    p_dni: payload.dni,
    p_location_id: payload.locationId,
    p_requested_event: payload.requestedEvent,
    p_idempotency_key: payload.idempotencyKey,
    p_photo_path: payload.photoPath,
    p_latitude: payload.latitude,
    p_longitude: payload.longitude,
    p_device_id: payload.deviceId,
    p_sync_source: payload.syncSource,
    p_timezone: appEnv.businessTimezone,
  });

  if (error) throw normalizeRpcError(error, 'No se pudo registrar la fichada');
  if (!data?.success) throw new Error(data?.error || 'No se pudo registrar la fichada');
  return data;
}

export async function getHoursDashboard({
  locationId,
  startDate,
  endDate,
  fortnightStartDate,
  fortnightEndDate,
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_hours_dashboard_range', {
    p_location_id: locationId || null,
    p_period_start: startDate,
    p_period_end: endDate,
    p_fortnight_start: fortnightStartDate,
    p_fortnight_end: fortnightEndDate,
    p_timezone: appEnv.businessTimezone,
  });

  if (error) throw normalizeRpcError(error, 'No se pudo cargar las horas');
  if (!data?.success) throw new Error(data?.error || 'No se pudo cargar las horas');
  return data;
}

export async function listEmployees({ includeInactive = true, locationId = null } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_employees', {
    p_include_inactive: includeInactive,
    p_location_id: locationId,
  });
  if (error) throw normalizeRpcError(error, 'No se pudo cargar la nómina');
  if (!data?.success) throw new Error(data?.error || 'No se pudo cargar la nómina');
  return data;
}

export async function saveEmployee(employee) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('save_employee', {
    p_employee_id: employee.id || null,
    p_dni: employee.dni,
    p_first_name: employee.firstName,
    p_last_name: employee.lastName,
    p_location_id: employee.locationId,
    p_active: employee.active,
  });
  if (error) throw normalizeRpcError(error, 'No se pudo guardar el empleado');
  if (!data?.success) throw new Error(data?.error || 'No se pudo guardar el empleado');
  return data.employee;
}

export async function getEmployeeSchedule(employeeId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_employee_schedule', {
    p_employee_id: employeeId,
  });
  if (error) throw normalizeRpcError(error, 'No se pudo cargar la jornada');
  if (!data?.success) throw new Error(data?.error || 'No se pudo cargar la jornada');
  return data;
}

export async function saveEmployeeSchedule(employeeId, schedule) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('save_employee_schedule', {
    p_employee_id: employeeId,
    p_schedule: schedule,
    p_timezone: appEnv.businessTimezone,
  });
  if (error) throw normalizeRpcError(error, 'No se pudo guardar la jornada');
  if (!data?.success) throw new Error(data?.error || 'No se pudo guardar la jornada');
  return data;
}

export async function listInconsistencies({ locationId, dateFrom, dateTo, status = 'OPEN' }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_inconsistencies', {
    p_location_id: locationId || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_status: status,
    p_timezone: appEnv.businessTimezone,
  });
  if (error) throw normalizeRpcError(error, 'No se pudieron cargar las inconsistencias');
  if (!data?.success) throw new Error(data?.error || 'No se pudieron cargar las inconsistencias');
  return data;
}
