import { useState } from 'react';
import { fetchApi } from '../api';
import { Mail, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Por favor, ingrese su email");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchApi({ action: "login", email });
      if (response && response.success) {
        onLoginSuccess(response.role, email);
      } else {
        setError(response.error || "Email no autorizado o inactivo.");
      }
    } catch (err) {
      setError("Error de conexión con el servidor.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 justify-center items-center w-full max-w-sm mx-auto px-6 pt-12 pb-32 fade-up min-h-max">
      
      {/* Animated Icon Container */}
      <div className="mb-12 relative">
        <div className="absolute inset-0 bg-blue-600/10 blur-[80px] rounded-full scale-150 animate-pulse" />
        <div className="relative w-28 h-28 rounded-[2.75rem] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-white shadow-2xl shadow-slate-900/40 transform hover:scale-105 transition-all duration-500 border border-white/10">
          <KeyRound size={48} strokeWidth={2} />
        </div>
      </div>

      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight italic">BIENVENIDO</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal de Administración</p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="w-full relative group">
          <label htmlFor="email" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 pl-2">
            E-mail Corporativo
          </label>
          <div className="relative overflow-hidden rounded-3xl border-2 border-slate-100 group-focus-within:border-blue-600 group-focus-within:shadow-xl group-focus-within:shadow-blue-600/5 transition-all duration-500 bg-slate-50/50">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors duration-300">
              <Mail size={22} />
            </div>
            <input
              type="email"
              id="email"
              className="pl-14 block w-full bg-transparent text-slate-900 border-none focus:ring-0 py-6 text-lg font-bold placeholder:text-slate-300 placeholder:font-bold"
              placeholder="admin@nahuel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 text-rose-600 text-[11px] py-4 px-5 bg-rose-50 rounded-2xl border border-rose-100 font-bold uppercase tracking-wider fade-up">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full mt-4 btn-premium bg-slate-900 rounded-[2rem] text-white font-black py-6 px-8 text-lg flex items-center justify-center transition-all shadow-2xl shadow-slate-900/30 group hover:shadow-slate-900/40 active:translate-y-1 uppercase tracking-widest italic"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <span className="flex items-center">
              ENTRAR <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
