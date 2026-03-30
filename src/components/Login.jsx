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
    <div className="flex flex-col flex-1 justify-center items-center w-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-10 duration-700">
      
      {/* Icono animado */}
      <div className="mb-10 relative">
        <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white shadow-2xl shadow-blue-600/30 transform hover:scale-105 transition-all duration-500 border border-white/20">
          <KeyRound size={44} strokeWidth={2} />
        </div>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-brand-deep mb-3">Bienvenido</h2>
        <p className="text-gray-500 font-medium">Ingresa para gestionar el sistema</p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="w-full relative group">
          <label htmlFor="email" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-2">
            E-mail Corporativo
          </label>
          <div className="relative overflow-hidden rounded-2xl border-2 border-gray-100 group-focus-within:border-brand-primary transition-all duration-300">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors duration-300">
              <Mail size={20} />
            </div>
            <input
              type="email"
              id="email"
              className="pl-12 block w-full bg-white text-gray-900 border-none focus:ring-0 py-5 text-lg placeholder:text-gray-300 placeholder:font-medium"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm py-3 px-4 bg-red-50 rounded-2xl animate-in slide-in-from-top-2 border border-red-100">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full mt-6 btn-premium btn-utility bg-brand-deep rounded-2xl text-white font-bold py-5 px-8 text-xl flex items-center justify-center transition-all disabled:opacity-30 group shadow-[0_15px_30px_-5px_rgba(15,23,42,0.4)]"
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <span className="flex items-center tracking-tight">
              Ingresar <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
