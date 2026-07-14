import { getSupabaseClient } from '../lib/supabase';
import { appEnv } from '../lib/env';
import { dataUrlToBlob } from '../lib/photo';

function normalizeRpcError(error, fallbackMessage) {
  return new Error(error?.message || fallbackMessage);
}

export async function loginWithEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('login_with_email', {
    p_email: email,
  });

  if (error) throw normalizeRpcError(error, 'No se pudo iniciar sesión');
  if (!data?.success) {
    throw new Error(data?.error || 'Email no autorizado o inactivo.');
  }

  return data;
}

export async function getLocationsForEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_locations_for_email', {
    p_email: email,
  });

  if (error) throw normalizeRpcError(error, 'No se pudieron cargar las sedes');
  return data?.locations || [];
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

export async function getDashboardSummary({ email, locationId, businessDate, status }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_email: email,
    p_location_id: locationId || null,
    p_business_date: businessDate || null,
    p_status: status || null,
    p_timezone: appEnv.businessTimezone,
  });

  if (error) throw normalizeRpcError(error, 'No se pudo cargar el dashboard');
  return data;
}

export async function getHoursDashboard({
  email,
  locationId,
  startDate,
  endDate,
  fortnightStartDate,
  fortnightEndDate,
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_hours_dashboard_range', {
    p_email: email,
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
