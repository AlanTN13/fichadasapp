import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  Delete,
  Loader2,
  MapPin,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  StopCircle,
  User,
} from 'lucide-react';
import {
  clearConfirmedQueueItems,
  enqueueFichada,
  syncQueuedEntries,
} from '../queue';
import { getCachedKioskState, setCachedKioskState } from '../lib/kioskCache';
import { getDeviceId } from '../lib/device';
import { DNI_MAX_LENGTH, isValidDni, sanitizeDni } from '../lib/dni';
import { appEnv } from '../lib/env';
import { getKioskState } from '../services/supabaseApi';
import FlowStepIndicator from './FlowStepIndicator';

const FALLBACK_POSITION = { coords: { latitude: 0, longitude: 0 } };
const RESET_DELAY_MS = 3500;

const ACTIONS = {
  START: {
    label: 'Iniciar jornada',
    shortLabel: 'Inicio de jornada',
    value: 'START',
    icon: <PlayCircle size={24} strokeWidth={1.9} />,
    accent: 'emerald',
    description: 'Registra el inicio de la jornada laboral.',
  },
  END: {
    label: 'Finalizar jornada',
    shortLabel: 'Fin de jornada',
    value: 'END',
    icon: <StopCircle size={24} strokeWidth={1.9} />,
    accent: 'emerald',
    description: 'Cierra la jornada y calcula las horas finales.',
  },
};

function getActionConfig(allowedAction) {
  return allowedAction && ACTIONS[allowedAction] ? ACTIONS[allowedAction] : null;
}

function getActionTone(accent) {
  if (accent === 'emerald') {
    return {
      card: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: 'bg-emerald-100 text-emerald-700',
      button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    };
  }

  return {
    card: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: 'bg-rose-100 text-rose-700',
    button: 'bg-rose-600 text-white hover:bg-rose-700',
  };
}

function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: appEnv.businessTimezone,
  }).format(date);
}

function formatDisplayTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: appEnv.businessTimezone,
  }).format(date);
}

function getLookupErrorMessage(state, fallbackError) {
  if (state?.error) return state.error;
  return fallbackError?.message || 'No se pudo validar el estado';
}

function getCameraErrorMessage(status) {
  if (status === 'denied') {
    return 'Permiso de cámara denegado. Habilitalo para continuar.';
  }
  if (status === 'unavailable') {
    return 'No encontramos una cámara disponible en este dispositivo.';
  }
  return 'La cámara no está lista todavía.';
}

function StatusNotice({
  tone = 'slate',
  title,
  description,
  actionLabel = null,
  onAction = null,
}) {
  const toneClass = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone];

  return (
    <div className={`w-full min-w-0 max-w-full break-words rounded-2xl border px-3 py-2.5 text-sm sm:px-4 sm:py-3 ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 leading-6 opacity-90">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-sm font-semibold underline underline-offset-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function KioskMode({
  locationId,
  locationName,
  onLogout,
  onBackToLocations,
}) {
  const [dni, setDni] = useState('');
  const [step, setStep] = useState('dni');
  const [selectedAction, setSelectedAction] = useState(null);
  const [error, setError] = useState('');
  const [lastEntry, setLastEntry] = useState(null);
  const [stateLookup, setStateLookup] = useState(null);
  const [lookupSource, setLookupSource] = useState('server');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [currentTimeLabel, setCurrentTimeLabel] = useState(formatDisplayTime());
  const videoRef = useRef(null);
  const resetTimerRef = useRef(null);
  const lookupInFlightRef = useRef(false);

  const availableAction = useMemo(
    () => getActionConfig(stateLookup?.allowed_action),
    [stateLookup]
  );

  const actionTone = getActionTone(availableAction?.accent);

  const resetFlow = useCallback(() => {
    setDni('');
    setStep('dni');
    setSelectedAction(null);
    setError('');
    setStateLookup(null);
    setCapturedPhoto(null);
    setCameraStatus('idle');
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraStatus('loading');
    setCapturedPhoto(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unavailable');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('ready');
    } catch (cameraError) {
      console.error('Camera error:', cameraError);
      if (
        cameraError?.name === 'NotAllowedError' ||
        cameraError?.name === 'PermissionDeniedError'
      ) {
        setCameraStatus('denied');
      } else {
        setCameraStatus('unavailable');
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeLabel(formatDisplayTime());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 'actions' || step === 'photo') {
      startCamera();
      return () => stopCamera();
    }

    stopCamera();
    return undefined;
  }, [startCamera, step, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [stopCamera]);

  const resolveKioskState = useCallback(async () => {
    setLookupLoading(true);
    setError('');

    try {
      const response = await getKioskState({ dni, locationId });
      setStateLookup(response);
      setCachedKioskState(dni, response);
      setLookupSource('server');
      return response;
    } catch (lookupError) {
      const cached = getCachedKioskState(dni);
      if (cached) {
        setStateLookup(cached);
        setLookupSource('cache');
        setError('Sin conexión: mostramos el último estado conocido.');
        return cached;
      }
      throw lookupError;
    } finally {
      setLookupLoading(false);
    }
  }, [dni, locationId]);

  const handleValidate = useCallback(async (event) => {
    event?.preventDefault();

    if (!isValidDni(dni)) {
      setError('Ingresá un DNI válido de 7 u 8 dígitos.');
      return;
    }

    if (lookupInFlightRef.current) return;
    lookupInFlightRef.current = true;

    try {
      const state = await resolveKioskState();
      if (!state?.success) {
        setError(getLookupErrorMessage(state));
        return;
      }

      if (state.allowed_action === 'NONE') {
        setError('La jornada de hoy ya fue completada.');
        return;
      }

      setSelectedAction(getActionConfig(state.allowed_action));
      setStep('actions');
      setError('');
    } catch (lookupError) {
      console.error('Error resolviendo estado del kiosco:', lookupError);
      setError(getLookupErrorMessage(null, lookupError));
    } finally {
      lookupInFlightRef.current = false;
    }
  }, [dni, resolveKioskState]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (step !== 'dni') return;

      if (event.key >= '0' && event.key <= '9') {
        setDni((prev) => sanitizeDni(`${prev}${event.key}`));
        setError('');
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setDni((prev) => prev.slice(0, -1));
      } else if (event.key === 'Enter' && isValidDni(dni)) {
        event.preventDefault();
        handleValidate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dni, handleValidate, step]);

  const capturePhoto = () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setError('La cámara todavía no está lista para capturar la foto.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (dataUrl === 'data:,') {
      setError('No se pudo capturar la foto. Probá nuevamente.');
      return;
    }

    setCapturedPhoto(dataUrl);
    setCameraStatus('captured');
    setError('');
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const getPositionFast = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(FALLBACK_POSITION);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        () => resolve(FALLBACK_POSITION),
        {
          enableHighAccuracy: false,
          timeout: 1500,
          maximumAge: 60000,
        }
      );
    });

  const confirmAndSend = async () => {
    if (!capturedPhoto) {
      setError('Antes de confirmar, capturá una foto.');
      return;
    }

    setStep('loading');
    setError('');

    try {
      const position = await getPositionFast();
      const queuedItem = await enqueueFichada({
        dni,
        locationId,
        employeeId: stateLookup?.employee_id,
        businessDate: stateLookup?.business_date,
        requestedEvent: selectedAction.value,
        photoDataUrl: capturedPhoto,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        deviceId: getDeviceId(),
        syncSource: 'kiosk-web',
      });

      /** @type {{ result: { state: Record<string, any> }, photoWarning: string | null } | null} */
      let confirmationResult = null;
      /** @type {Error | null} */
      let syncError = null;

      await syncQueuedEntries({
        onItemConfirmed(item, result, photoWarning) {
          if (item.id === queuedItem.id) {
            confirmationResult = { result, photoWarning };
          }
        },
        onItemFailed(item, errorObject) {
          if (item.id === queuedItem.id) {
            syncError = errorObject;
          }
        },
      });

      clearConfirmedQueueItems();

      if (confirmationResult?.result) {
        setStateLookup(confirmationResult.result.state);
        setCachedKioskState(dni, confirmationResult.result.state);
        setLookupSource('server');
        setLastEntry({
          name: confirmationResult.result.state.employee_name || `DNI ${dni}`,
          action: selectedAction.shortLabel,
          hour:
            confirmationResult.result.state.last_event_at_label ||
            formatDisplayTime(),
          status: confirmationResult.photoWarning
            ? 'Registrado con advertencia de foto'
            : 'Registrado correctamente',
        });
      } else {
        setLastEntry({
          name: stateLookup?.employee_name || `DNI ${dni}`,
          action: selectedAction.shortLabel,
          hour: formatDisplayTime(),
          status: syncError ? 'Pendiente de sincronización' : 'Guardado para sincronizar',
        });
      }

      setStep('success');
      resetTimerRef.current = setTimeout(() => {
        resetFlow();
      }, RESET_DELAY_MS);
    } catch (submitError) {
      console.error('Error registrando fichada:', submitError);
      setError(submitError.message || 'No se pudo registrar la fichada.');
      setStep('photo');
    }
  };

  const employeeName = stateLookup?.employee_name || 'Empleado identificado';
  const currentBusinessDate = stateLookup?.business_date
    ? formatDisplayDate(new Date(`${stateLookup.business_date}T12:00:00`))
    : formatDisplayDate();

  if (step === 'loading' || lookupLoading) {
    return (
      <div className="flex min-w-0 max-w-full flex-1 flex-col items-center justify-center gap-5 px-4 text-center fade-up sm:px-6">
        <FlowStepIndicator currentStep={2} />
        <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white shadow-lg shadow-slate-200/70">
          <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {lookupLoading ? 'Validando DNI' : 'Registrando fichada'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {lookupLoading
              ? 'Estamos verificando el estado actual del empleado.'
              : 'Guardando foto, ubicación y evento en el sistema.'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="flex min-w-0 max-w-full flex-1 flex-col bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 fade-up sm:px-6 sm:pb-6 sm:pt-4">
        <div className="mx-auto flex h-full min-w-0 w-full max-w-4xl flex-col gap-3 sm:gap-5">
          <FlowStepIndicator currentStep={3} />

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-6 text-center shadow-sm sm:rounded-[2rem] sm:px-6 sm:py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-600 text-white shadow-lg shadow-emerald-200">
              <CheckCircle2 size={40} strokeWidth={2.2} />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Confirmación
            </p>
            <h2 className="mt-3 max-w-full break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {selectedAction?.shortLabel === 'Fin de jornada'
                ? 'Jornada finalizada correctamente'
                : 'Jornada iniciada correctamente'}
            </h2>
            <p className="mt-3 text-base text-slate-600">
              {lastEntry?.hour} · {locationName}
            </p>

            <div className="mt-6 w-full rounded-[1.5rem] border border-white/80 bg-white/80 p-4 text-left">
              <p className="text-sm font-semibold text-slate-900">{lastEntry?.name}</p>
              <p className="mt-1 text-sm text-slate-500">{lastEntry?.status}</p>
            </div>

            <button
              type="button"
              onClick={resetFlow}
              className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'actions') {
    const showCameraError = cameraStatus === 'denied' || cameraStatus === 'unavailable';

    return (
      <div className="flex min-w-0 max-w-full flex-1 flex-col bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 fade-up sm:px-6 sm:pb-6 sm:pt-4">
        <div className="mx-auto flex h-full min-w-0 w-full max-w-4xl flex-col gap-3 sm:gap-5">
          <FlowStepIndicator currentStep={1} />

          <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                    Estado actual
                  </p>
                  <h2 className="mt-2 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {employeeName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {locationName} · {currentBusinessDate} · {currentTimeLabel}
                  </p>
                </div>
                <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left sm:w-auto sm:shrink-0 sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Estado
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {stateLookup?.status_label || 'Sin datos'}
                  </p>
                </div>
              </div>

              {lookupSource === 'cache' && (
                <StatusNotice
                  tone="amber"
                  title="Usando estado guardado localmente"
                  description="No hubo conexión en tiempo real, así que mostramos la última información conocida para no cortar el flujo."
                />
              )}
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-5 lg:grid-cols-2">
            <section className={`min-w-0 rounded-[1.5rem] border p-3 shadow-sm sm:rounded-[2rem] sm:p-5 ${actionTone.card}`}>
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${actionTone.icon}`}>
                  {availableAction?.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
                    Acción disponible
                  </p>
                  <h3 className="mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl">
                    {availableAction?.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {availableAction?.description}
                  </p>
                  <div className="mt-4 rounded-[1.3rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
                    Último estado: {stateLookup?.status_label || 'Sin registros para hoy'}
                  </div>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  Validación con foto
                </p>
                <p className="mt-1 text-sm text-slate-500">Mirá a cámara y tomá la foto para confirmar.</p>
              </div>

              <div className="relative mx-auto w-full min-w-0 max-w-xs overflow-hidden rounded-[1.25rem] bg-slate-900 sm:rounded-[1.5rem]">
                {capturedPhoto ? (
                  <img src={capturedPhoto} alt="Foto capturada" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="pointer-events-none absolute inset-[10%] rounded-[1.5rem] border-2 border-white/80" />
              </div>

              <div className="mt-3 grid gap-3">
                {showCameraError && (
                  <StatusNotice
                    tone="rose"
                    title={getCameraErrorMessage(cameraStatus)}
                    actionLabel="Reintentar cámara"
                    onAction={startCamera}
                  />
                )}
                {error && <StatusNotice tone="rose" title="No pudimos continuar" description={error} />}

                {!capturedPhoto ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={cameraStatus !== 'ready'}
                    className="flex w-full items-center justify-center gap-3 rounded-[1.2rem] bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {cameraStatus === 'loading' ? <Loader2 className="animate-spin" size={19} /> : <Camera size={19} />}
                    {cameraStatus === 'loading' ? 'Preparando cámara' : 'Tomar foto'}
                  </button>
                ) : (
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700"
                    >
                      Repetir
                    </button>
                    <button
                      type="button"
                      onClick={confirmAndSend}
                      className="rounded-[1.2rem] bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white"
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-auto grid gap-3">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep('dni');
                }}
                className="w-full min-w-0 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cambiar DNI
              </button>
              <button
                type="button"
                onClick={onBackToLocations || onLogout}
                className="w-full min-w-0 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cambiar sede
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'photo') {
    const showCameraError = cameraStatus === 'denied' || cameraStatus === 'unavailable';

    return (
      <div className="flex min-w-0 max-w-full flex-1 flex-col bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 fade-up sm:px-6 sm:pb-6 sm:pt-4">
        <div className="mx-auto flex h-full min-w-0 w-full max-w-md flex-col gap-3 sm:gap-5">
          <FlowStepIndicator currentStep={2} />

          <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <ShieldCheck size={22} strokeWidth={1.9} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Paso 3
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  Validación con cámara
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Mirá a cámara y mantené el rostro dentro del marco. Primero tomamos la foto y después confirmás si querés usarla.
                </p>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{employeeName}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedAction?.shortLabel} · {locationName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCapturedPhoto(null);
                  setError('');
                  setStep('actions');
                }}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"
              >
                <ArrowLeft size={18} />
              </button>
            </div>

            <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] bg-slate-900 sm:rounded-[1.75rem]">
              {capturedPhoto ? (
                <img src={capturedPhoto} alt="Foto capturada" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/5] w-full object-cover"
                />
              )}

              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-[14%] top-[12%] bottom-[12%] rounded-[2rem] border-2 border-white/80" />
                <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                  {capturedPhoto
                    ? 'Foto capturada'
                    : cameraStatus === 'loading'
                      ? 'Cámara cargando'
                      : 'Vista previa'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {showCameraError ? (
                <StatusNotice
                  tone="rose"
                  title={getCameraErrorMessage(cameraStatus)}
                  description="Podés reintentar cuando la cámara esté disponible o volver al paso anterior."
                  actionLabel="Reintentar cámara"
                  onAction={startCamera}
                />
              ) : cameraStatus === 'loading' ? (
                <StatusNotice
                  tone="blue"
                  title="Preparando la cámara"
                  description="Esperá un segundo mientras iniciamos la vista previa."
                />
              ) : capturedPhoto ? (
                <StatusNotice
                  tone="emerald"
                  title="Foto lista para validar"
                  description="Si quedó bien, confirmá. Si no, repetila antes de registrar la fichada."
                />
              ) : (
                <StatusNotice
                  tone="slate"
                  title="Instrucciones rápidas"
                  description="Mirá a cámara y mantené el rostro dentro del marco para capturar una imagen nítida."
                />
              )}

              {error && (
                <StatusNotice
                  tone="rose"
                  title="No pudimos continuar"
                  description={error}
                />
              )}
            </div>
          </section>

          <div className="mt-auto grid gap-3">
            {!capturedPhoto ? (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraStatus !== 'ready'}
                className="flex w-full items-center justify-center gap-3 rounded-[1.3rem] bg-slate-900 px-5 py-4 text-base font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Camera size={20} />
                Tomar foto
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={confirmAndSend}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.3rem] bg-slate-900 px-5 py-4 text-base font-semibold text-white transition-all"
                >
                  <ShieldCheck size={20} />
                  Usar esta foto
                </button>
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700"
                >
                  <RefreshCcw size={18} />
                  Repetir
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-1 flex-col bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 fade-up sm:px-6 sm:pb-8 sm:pt-4 lg:px-10 lg:pb-10 lg:pt-8">
      <form onSubmit={handleValidate} className="mx-auto grid min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] flex-1 gap-3 sm:gap-5 lg:max-w-[1050px] lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="min-w-0 lg:col-span-2">
          <FlowStepIndicator currentStep={1} />
        </div>

        <section className="min-w-0 max-w-full rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/15 sm:h-14 sm:w-14 sm:rounded-2xl">
              <User className="h-5 w-5 sm:h-[26px] sm:w-[26px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                Paso 2
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl">
                Ingresá el DNI
              </h2>
              <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">
                La fichada completa se hace en segundos. Confirmá el DNI y seguí con la foto de validación.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:mt-4 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 border border-slate-200">
                  <MapPin size={14} />
                  {locationName}
                </span>
                <span className="hidden items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:inline-flex">
                  {currentBusinessDate}
                </span>
                <span className="hidden items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:inline-flex">
                  {currentTimeLabel}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 max-w-full rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-2.5 sm:rounded-[1.75rem] sm:px-4 sm:py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white sm:h-12 sm:w-12 sm:rounded-2xl">
                <User size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  DNI
                </p>
                <p className={`mt-1 text-3xl font-semibold tracking-[0.06em] sm:mt-2 sm:text-4xl ${dni ? 'text-slate-900' : 'text-slate-300'}`}>
                  {dni || '00.000.000'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDni('')}
                disabled={!dni}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 disabled:opacity-40 sm:p-3"
              >
                <Delete size={18} />
              </button>
            </div>
          </div>

          <div className="mt-3 grid min-w-0 w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5 sm:mt-4 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'BORRAR', 0].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'BORRAR') {
                    setDni((prev) => prev.slice(0, -1));
                  } else {
                    setDni((prev) => sanitizeDni(`${prev}${key}`));
                    setError('');
                  }
                }}
                className={`flex h-12 items-center justify-center rounded-[1rem] border text-lg font-semibold transition-all active:scale-95 sm:h-16 sm:rounded-[1.35rem] sm:text-xl ${
                  key === 'BORRAR'
                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                    : 'border-slate-200 bg-white text-slate-900 shadow-sm'
                }`}
              >
                {key === 'BORRAR' ? <Delete size={20} /> : key}
              </button>
            ))}
          </div>

          <div className="mt-2 grid gap-2 sm:mt-4 sm:gap-3">
            {error && (
              <StatusNotice
                tone="rose"
                title="No pudimos avanzar"
                description={error}
              />
            )}

            {!error && dni.length > 0 && dni.length < 7 && (
              <StatusNotice
                tone="amber"
                title="DNI incompleto"
                description="Todavía faltan números para poder validar el empleado."
              />
            )}
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3 lg:col-span-2">
          <button
            type="submit"
            disabled={!isValidDni(dni) || lookupLoading}
            className="flex w-full items-center justify-center gap-3 rounded-[1.1rem] bg-slate-900 px-5 py-3.5 text-base font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-[1.3rem] sm:py-4"
          >
            Continuar
            <ChevronRight size={18} />
          </button>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToLocations || onLogout}
              className="w-full min-w-0 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Cambiar sede
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full min-w-0 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
