import { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../api';
import { MapPin, User, ChevronRight, Delete, CheckCircle2, History, Camera, LogOut, Loader2, PlayCircle, StopCircle, Coffee, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function KioskMode({ locationId, onLogout }) {
  const [dni, setDni] = useState('');
  const [step, setStep] = useState('dni'); // 'dni', 'actions', 'photo', 'loading', 'success'
  const [selectedAction, setSelectedAction] = useState(null);
  const [validatedUserId, setValidatedUserId] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [error, setError] = useState('');
  const [lastEntry, setLastEntry] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (step !== 'dni') return;
      if (e.key >= '0' && e.key <= '9') {
        if (dni.length < 8) setDni(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setDni(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (dni.length >= 7) handleValidate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dni, step]);

  useEffect(() => {
    if (step === 'photo' || step === 'dni') {
        startCamera();
    }
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    return null;
  };

  const handleValidate = async () => {
    if (dni.length < 7) {
      setError('DNI demasiado corto');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setStep('loading');
    setError('');
    
    try {
      const resDni = await fetchApi({ action: 'validarDNI', dni });
      if (!resDni.success) {
        setError(resDni.error || 'DNI no encontrado');
        setStep('dni');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      setValidatedUserId(resDni.usuario_id);
      setStep('actions');
    } catch (err) {
      setError('Error de conexión');
      setStep('dni');
    }
  };

  const confirmAndSend = async () => {
    const photo = takePhoto();
    setCapturedPhoto(photo);
    setStep('loading');
    setError('');

    try {
      const pos = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, () => resolve({ coords: { latitude: 0, longitude: 0 } }));
      });

      const resFichada = await fetchApi({
        action: 'fichar',
        usuario_id: validatedUserId,
        dni: dni,
        locationId,
        tipo: selectedAction.value,
        foto_base64: photo,
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude
      });

      if (resFichada.success) {
        setLastEntry({ nombre: "Personal Nahuel", tipo: selectedAction.label, hora: new Date().toLocaleTimeString() });
        setStep('success');
        setDni('');
        setSelectedAction(null);
        setTimeout(() => setStep('dni'), 4000);
      } else {
          setError(resFichada.error || 'Error al fichar');
          setStep('photo');
      }
    } catch (err) {
      setError('Error de envío');
      setStep('photo');
    }
  };

  if (step === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-slate-900/90 backdrop-blur-md fade-up">
        <div className="relative mb-12">
          {/* Pulse Effect */}
          <div className="absolute inset-[-40px] bg-blue-500/20 rounded-full animate-pulse scale-150" />
          <div className="absolute inset-[-20px] bg-blue-600/10 rounded-full animate-ping scale-125" />
          
          <div className="relative w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl">
            <Loader2 className="animate-spin text-blue-600" size={40} strokeWidth={2.5} />
          </div>
        </div>
        <h3 className="text-3xl font-black text-white tracking-widest uppercase italic">VERIFICANDO</h3>
        <p className="text-blue-400 font-bold text-[10px] uppercase tracking-[0.4em] mt-4 opacity-70">Enviando datos al servidor</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white fade-up text-center">
        <div className="w-24 h-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/30 animate-bounce">
          <CheckCircle2 size={48} className="text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase leading-none mb-6">REGISTRADO</h2>
        <div className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col space-y-3">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Acción</span>
                <span className="text-slate-900">{lastEntry?.tipo.replace('\n', ' ')}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Hora</span>
                <span className="text-slate-900">{lastEntry?.hora}</span>
            </div>
        </div>
      </div>
    );
  }

  if (step === 'actions') {
      const actions = [
          { label: 'Inicio de\nJornada', value: 'Inicio de Jornada', icon: <PlayCircle size={44} strokeWidth={1} />, color: 'border-emerald-500/20 bg-emerald-50/30 text-emerald-900' },
          { label: 'Fin de\nJornada', value: 'Fin de Jornada', icon: <StopCircle size={44} strokeWidth={1} />, color: 'border-rose-500/20 bg-rose-50/30 text-rose-900' },
          { label: 'Inicio\nBreak', value: 'Inicio Break', icon: <Coffee size={44} strokeWidth={1} />, color: 'border-amber-500/20 bg-amber-50/30 text-amber-900' },
          { label: 'Fin\nBreak', value: 'Fin Break', icon: <History size={44} strokeWidth={1} />, color: 'border-blue-500/20 bg-blue-50/40 text-blue-900' },
      ];

      return (
          <div className="flex-1 flex flex-col p-8 fade-up bg-white">
              <header className="mb-10 text-center">
                   <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">REGISTRO</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">Selecciona tu actividad</p>
              </header>

              <div className="flex-1 grid grid-cols-2 gap-5 place-content-center">
                  {actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedAction(act); setStep('photo'); }}
                        className={`aspect-square group p-8 rounded-[3rem] border-2 ${act.color} flex flex-col items-center justify-center text-center space-y-5 active:scale-95 transition-all duration-300 shadow-xl shadow-slate-100 flex-shrink-0`}
                      >
                        <div className="transition-transform group-hover:scale-110 duration-500">
                            {act.icon}
                        </div>
                        <span className="text-[11px] font-extrabold uppercase tracking-widest leading-tight whitespace-pre-line">
                            {act.label}
                        </span>
                      </button>
                  ))}
              </div>

              <div className="mt-8 flex justify-center">
                <button onClick={() => setStep('dni')} className="flex items-center space-x-3 px-8 py-3 bg-slate-50 text-slate-400 rounded-full border border-slate-100/50 hover:text-blue-600 transition-colors">
                    <ArrowLeft size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">Volver atrás</span>
                </button>
              </div>
          </div>
      );
  }

  if (step === 'photo') {
      return (
          <div className="flex-1 flex flex-col p-8 fade-up bg-white">
              <header className="mb-8 flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-extrabold text-slate-900 leading-none">VALIDAR FOTO</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Paso final de seguridad</p>
                </div>
                <button onClick={() => setStep('actions')} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <ArrowLeft size={20} />
                </button>
              </header>

              <div className="relative flex-1 rounded-[3rem] overflow-hidden bg-slate-900 shadow-2xl mb-8 border-4 border-white">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[10%]" />
                  <div className="absolute inset-0 border-[20px] border-black/10 pointer-events-none" />
                  <div className="absolute top-6 left-6 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest leading-none">REC START</span>
                  </div>
              </div>

              <button 
                onClick={confirmAndSend}
                className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-bold uppercase tracking-widest text-sm flex items-center justify-center space-x-4 shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                <Camera size={20} />
                <span>Confirmar Identidad</span>
              </button>
          </div>
      );
  }

  return (
    <div className="flex flex-col flex-1 pb-6 px-6 fade-up">
      <div className="text-center mt-6 mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase leading-none mb-2 italic">IDENTIFICACIÓN</h2>
        <p className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">Ingresa tu DNI para comenzar</p>
      </div>

      <div className="mb-10 bg-slate-50 p-4 rounded-[2.5rem] border border-slate-100 flex items-center shadow-inner shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
              <User size={24} />
          </div>
          <div className="flex-1 px-5">
              <p className={`text-3xl font-bold tracking-[0.05em] leading-none ${!dni ? 'text-slate-200' : 'text-slate-900'}`}>
                  {dni || '00.000.000'}
              </p>
          </div>
          {dni.length > 0 && (
              <button onClick={() => setDni('')} className="w-10 h-10 flex items-center justify-center text-slate-300"><Delete size={20} /></button>
          )}
      </div>

      <div className="flex-1 grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'BORRAR', 0, 'SIGUIENTE'].map((key) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'BORRAR') setDni(prev => prev.slice(0, -1));
              else if (key === 'SIGUIENTE') handleValidate();
              else if (dni.length < 8) setDni(prev => prev + key);
            }}
            className={`rounded-[2rem] text-2xl font-bold transition-all flex items-center justify-center active:scale-90 border ${
              key === 'SIGUIENTE' 
                ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-100 flex-col py-4' 
                : key === 'BORRAR' 
                  ? 'bg-slate-50 text-slate-500 border-transparent text-[10px] font-black uppercase' 
                  : 'bg-white text-slate-900 border-slate-100 shadow-sm'
            }`}
          >
            {key === 'SIGUIENTE' ? <><ChevronRight size={24} /><span className="text-[7px] font-black uppercase tracking-tighter mt-1">Siguiente</span></> : key === 'BORRAR' ? <Delete size={20} /> : key}
          </button>
        ))}
      </div>

      <div className="h-0 overflow-hidden"><video ref={videoRef} autoPlay playsInline muted /></div>

      {error && (
        <div className="mt-4 p-4 bg-rose-50 text-rose-600 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest border border-rose-100 animate-bounce">{error}</div>
      )}
      
      <div className="mt-auto py-4 text-center">
          <button onClick={onLogout} className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] hover:text-blue-600 transition-all uppercase">--- CAMBIAR PUNTO ---</button>
      </div>
    </div>
  );
}
