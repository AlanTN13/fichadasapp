import { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../api';
import { MapPin, User, ChevronRight, Delete, CheckCircle2, History, Camera } from 'lucide-react';

export default function KioskMode({ locationId, onLogout }) {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validatedUserId, setValidatedUserId] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null); // Nuevo: guardamos la imagen acá
  const [error, setError] = useState('');
  const [lastEntry, setLastEntry] = useState(null);
  const videoRef = useRef(null);

  // MANEJO DE TECLADO FÍSICO (RESTAURADO PERMANENTE)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (loading || success) return;
      if (e.key >= '0' && e.key <= '9') {
        if (dni.length < 8) {
            setDni(prev => prev + e.key);
            setIsValidated(false);
        }
      } else if (e.key === 'Backspace') {
        setDni(prev => prev.slice(0, -1));
        setIsValidated(false);
      } else if (e.key === 'Enter') {
        if (dni.length >= 7) handleValidate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dni, loading, success]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError("Permiso de cámara denegado");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const handleValidate = async () => {
    if (dni.length < 7) {
      setError('DNI demasiado corto');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      // 1. CAPTURAMOS LA FOTO PRIMERO (Localmente es instantáneo)
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const fotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(fotoBase64);
      }

      // 2. VALIDAMOS CON EL SERVIDOR
      const resDni = await fetchApi({ action: 'validarDNI', dni });
      if (!resDni.success) {
        setError(resDni.error || 'DNI no encontrado');
        setLoading(false);
        return;
      }
      
      setValidatedUserId(resDni.usuario_id);
      setIsValidated(true);
    } catch (err) {
      console.error("Error en validación:", err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (tipo) => {
    setLoading(true);
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
        tipo,
        foto_base64: capturedPhoto, // <--- Usamos la foto que ya sacamos
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude
      });

      if (resFichada.success) {
        setLastEntry({ nombre: "Personal Nahuel", tipo, hora: new Date().toLocaleTimeString() });
        setSuccess(true);
        setDni('');
        setIsValidated(false);
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch (err) {
      setError('Error de envío');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#0f172a]/80 backdrop-blur-xl animate-in fade-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping scale-150 duration-[2000ms]" />
          <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center space-y-6 border border-white/20">
            <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-inner" />
            <div className="text-center">
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Verificando</h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-slate-50 animate-in zoom-in duration-500">
        <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center mb-10 shadow-2xl shadow-emerald-500/40 animate-bounce">
          <CheckCircle2 size={64} className="text-white" />
        </div>
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none italic italic">¡LISTO!</h2>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center space-x-6 mt-8">
            <div className="text-right pr-6 border-r border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase">Hora</p>
                <p className="text-sm font-black text-slate-900">{lastEntry?.hora}</p>
            </div>
            <div className="text-left">
                <p className="text-[9px] font-black text-gray-400 uppercase">Acción</p>
                <p className="text-sm font-black text-emerald-600 uppercase italic italic">{lastEntry?.tipo}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 space-y-3 px-1 pb-2">
      <div className={`relative h-[220px] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 transition-all duration-500 flex-shrink-0 ${isValidated ? 'border-blue-500 scale-[1.02]' : 'border-white'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[30%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
        
        {isValidated && (
            <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] flex items-center justify-center">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center space-x-2 animate-bounce shadow-xl">
                    <Camera size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Foto Capturada</span>
                </div>
            </div>
        )}

        <div className="absolute top-3 left-4 flex items-center space-x-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/10">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          <span className="text-[8px] font-black text-white uppercase tracking-widest">LIVE REC</span>
        </div>
        
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div className="flex flex-col">
                <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-0.5">DNI</h4>
                <p className="text-xl font-black text-white uppercase tracking-tight leading-none italic drop-shadow-md">
                    {dni || '--------'}
                </p>
            </div>
            <div className="flex items-center space-x-1.5 text-blue-400 pb-0.5">
                <MapPin size={10} />
                <span className="text-[8px] font-black uppercase tracking-widest">Geo-Sync</span>
            </div>
        </div>
      </div>

      <div className="bg-white p-1.5 rounded-2xl border border-gray-100 flex items-center shadow-sm flex-shrink-0 mx-1">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
          <User size={18} />
        </div>
        <div className="flex-1 px-3">
          <p className="text-xl font-black text-slate-900 tracking-[0.18em] leading-none font-mono">
            {dni || <span className="text-gray-100">00000000</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 flex-shrink-0 px-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'OK'].map((key) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'DEL') { setDni(prev => prev.slice(0, -1)); setIsValidated(false); }
              else if (key === 'OK') { handleValidate(); }
              else if (dni.length < 8) { setDni(prev => prev + key); setIsValidated(false); }
            }}
            className={`h-11 sm:h-12 rounded-2xl text-lg font-black transition-all flex items-center justify-center shadow-sm active:scale-90 ${
              key === 'OK' ? 'bg-blue-600 text-white' : key === 'DEL' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-900 border border-gray-100'
            }`}
          >
            {key === 'DEL' ? <Delete size={18} /> : key === 'OK' ? <div className="flex flex-col items-center"><span className="text-[8px] font-black uppercase leading-none">Tomar Foto</span></div> : key}
          </button>
        ))}
      </div>

      <div className={`space-y-2 flex-shrink-0 pt-1 transition-all duration-500 ${isValidated ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-2 pointer-events-none grayscale'}`}>
        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleAction('Inicio Jornada')} className="py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-500/20">Ingreso Jornada</button>
            <button onClick={() => handleAction('Cierre Jornada')} className="py-3 bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-rose-500/20">Fin Jornada</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleAction('Inicio Break')} className="py-2.5 bg-amber-100 text-amber-700 rounded-xl font-black uppercase text-[9px] flex items-center justify-center space-x-2"><History size={14} /><span>Inicio Break</span></button>
            <button onClick={() => handleAction('Fin Break')} className="py-2.5 bg-blue-100 text-blue-700 rounded-xl font-black uppercase text-[9px] flex items-center justify-center space-x-2"><CheckCircle2 size={14} /><span>Fin Break</span></button>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-500 text-white rounded-2xl text-center text-[10px] font-black uppercase">{error}</div>}
      
      <div className="text-center pt-1">
          <button onClick={onLogout} className="text-[9px] font-black text-blue-600 uppercase tracking-widest px-6 py-2 bg-blue-50 rounded-full">Cambiar Ubicación</button>
      </div>
    </div>
  );
}
