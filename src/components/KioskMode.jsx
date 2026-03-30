import { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../api';
import { Camera, MapPin, CheckCircle, Loader2, LogOut, Delete, Check, ShieldCheck, User, ArrowRight } from 'lucide-react';

export default function KioskMode({ locationId, onLogout }) {
  const [step, setStep] = useState('keyboard');
  const [dni, setDni] = useState('');
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [error, setError] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  // Escuchar teclado físico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (step !== 'keyboard') return;
      if (/[0-9]/.test(e.key)) handleKeyPress(e.key);
      if (e.key === 'Backspace') handleDelete();
      if (e.key === 'Enter') handleConfirmDni();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dni, step]);
  
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  const handleKeyPress = (num) => {
    if (dni.length < 10) {
      setDni(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setDni(prev => prev.slice(0, -1));
  };

  const handleConfirmDni = async () => {
    if (dni.length < 6) {
      setError("DNI demasiado corto");
      return;
    }
    setStep('validating');
    setError(null);
    try {
      const response = await fetchApi({ action: 'validarDNI', dni, locationId });
      if (response && response.success) {
        setEmployeeInfo({ nombre: response.nombre, usuario_id: response.usuario_id });
        setStep('options');
      } else {
        setError(response.error || "DNI no registrado");
        setStep('keyboard');
      }
    } catch (err) {
      setError("Error de red");
      setStep('keyboard');
    }
  };

  const getPosition = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) resolve({ lat: 0, lng: 0 });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 0, lng: 0 }),
        { timeout: 5000 }
      );
    });
  };

  const startCamera = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(videoStream);
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        await videoRef.current.play();
      }
      return videoStream;
    } catch (err) { return null; }
  };

  const takePhoto = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleAction = async (type) => {
    setActionType(type);
    setStep('processing');
    let localStream = stream;
    try {
      const coords = await getPosition();
      
      // Asegurar cámara
      if (!localStream) {
        localStream = await startCamera();
        // Esperamos 1 segundo para que la cámara estabilice brillo/foco
        await new Promise(r => setTimeout(r, 1200)); 
      }
      
      const photoBase64 = takePhoto();
      
      // Apagar cámara
      if (localStream) { 
        localStream.getTracks().forEach(t => t.stop()); 
        setStream(null); 
      }
      
      const response = await fetchApi({
        action: 'fichar',
        dni,
        usuario_id: employeeInfo.usuario_id || dni,
        tipo: type,
        ubicacion_id: locationId,
        latitud: coords.lat,
        longitud: coords.lng,
        foto_base64: photoBase64 // El nombre exacto que espera tu GAS
      });

      if (response && response.success) {
        setStep('success');
        setTimeout(() => resetKiosk(), 3000);
      } else {
        setError(response.error || "Error al fichar");
        setStep('options');
      }
    } catch (err) {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setStep('options');
    }
  };

  const resetKiosk = () => {
    setDni('');
    setEmployeeInfo(null);
    setError(null);
    setStep('keyboard');
  };

  const renderKeyboard = () => (
    <div className="flex flex-col items-center flex-1 w-full animate-in fade-in duration-500 max-h-full">
      {/* Header Premium Renovado */}
      <div className="w-full h-20 flex justify-between items-center mb-6 px-2 border-b border-gray-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <ShieldCheck size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">REGISTRO</h2>
            <p className="text-[11px] text-blue-600 font-extrabold uppercase tracking-[0.2em]">Lavadero Nahuel</p>
          </div>
        </div>
        <button onClick={onLogout} className="group w-12 h-12 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all duration-300">
          <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="w-full text-center h-20 flex items-center justify-center mb-4">
        <div className={`text-5xl font-black tracking-[0.1em] ${dni ? 'text-slate-900' : 'text-gray-100 font-normal opacity-50'}`}>
          {dni || "DNI"}
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 font-bold text-xs mb-4 px-4 py-2 bg-red-50 rounded-xl w-full text-center border border-red-100">
          {error}
        </div>
      )}

      {/* Teclado redimensionado para que entre en la pantalla */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px] pb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="w-full aspect-square bg-white hover:bg-gray-50 text-slate-900 text-2xl font-black rounded-2xl transition-all shadow-[0_4px_0_0_#e2e8f0] active:shadow-none active:translate-y-1 border border-gray-100"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleDelete}
          className="w-full aspect-square bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center shadow-[0_4px_0_0_#cbd5e1] active:translate-y-1 active:shadow-none"
        >
          <Delete size={24} />
        </button>
        <button
          onClick={() => handleKeyPress('0')}
          className="w-full aspect-square bg-white hover:bg-gray-50 text-slate-900 text-2xl font-black rounded-2xl shadow-[0_4px_0_0_#e2e8f0] active:translate-y-1 active:shadow-none border border-gray-100"
        >
          0
        </button>
        <button
          onClick={handleConfirmDni}
          disabled={dni.length < 6}
          className="w-full aspect-square bg-slate-900 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center disabled:opacity-20 shadow-[0_4px_0_0_#020617] active:translate-y-1 active:shadow-none"
        >
          <Check size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );

  const renderOptions = () => (
    <div className="flex flex-col flex-1 w-full animate-in fade-in slide-in-from-right-20 duration-500">
      <div className="flex justify-between items-center mb-6">
        <button onClick={resetKiosk} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl flex items-center justify-center">
          <ArrowRight className="rotate-180" size={18} />
        </button>
        <div className="px-3 py-1 bg-gray-100 rounded-lg">
          <p className="text-xs font-bold text-slate-900 leading-none">DNI: {dni}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">
        <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-blue-600/20 mb-6">
          <User size={48} className="text-white" strokeWidth={1} />
        </div>
        
        <div className="text-center mb-8">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase">
            {employeeInfo.nombre.split(' ')[0]}
          </h3>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Identidad Confirmada</p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full">
          <button onClick={() => handleAction('Inicio Jornada')} className="btn-premium btn-start rounded-3xl py-6 px-8 text-xl flex flex-col items-center">
            <span className="uppercase text-[8px] tracking-[0.3em] font-black opacity-70">Marcar</span>
            Inicio Jornada
          </button>
          
          <button onClick={() => handleAction('Salida Jornada')} className="btn-premium btn-end rounded-3xl py-6 px-8 text-xl flex flex-col items-center">
            <span className="uppercase text-[8px] tracking-[0.3em] font-black opacity-70">Marcar</span>
            Salida Jornada
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => handleAction('Inicio Break')} className="btn-premium btn-break rounded-2xl py-4 text-base">Almuerzo</button>
            <button onClick={() => handleAction('Fin Break')} className="btn-premium btn-utility bg-indigo-500 rounded-2xl py-4 text-base font-bold">Retorno</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center flex-1 space-y-8 animate-in fade-in duration-500">
      <video ref={videoRef} autoPlay playsInline muted className="w-48 h-48 rounded-[3rem] object-cover ring-4 ring-white shadow-2xl scale-x-[-1]" />
      <div className="text-center group">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <h3 className="text-2xl font-black text-slate-900 mb-1 leading-none uppercase">Procesando</h3>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Lavadero Nahuel</p>
      </div>
    </div>
  );

  const renderSuccess = () => (
     <div className="flex flex-col items-center justify-center flex-1 animate-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-16 h-16 text-emerald-500" strokeWidth={3} />
      </div>
      <h2 className="text-3xl font-black text-slate-900 leading-tight mb-2">¡EXITOSO!</h2>
      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{actionType}</p>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col justify-center relative bg-white rounded-3xl">
      {step === 'keyboard' && renderKeyboard()}
      {step === 'validating' && <div className="flex flex-col items-center justify-center flex-1"><Loader2 className="animate-spin text-blue-600 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verificando</p></div>}
      {step === 'options' && renderOptions()}
      {step === 'processing' && renderProcessing()}
      {step === 'success' && renderSuccess()}
    </div>
  );
}
