import React, { useState } from 'react';
import { ApiError, LoginPayload } from '../api/client';

export interface LoginViewProps {
  onLogin: (data: LoginPayload) => Promise<unknown>;
  onNavigateToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Wprowadź adres email i hasło.');
      return;
    }

    setLoading(true);
    try {
      await onLogin({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'INVALID_CREDENTIALS':
            setError('Niepoprawny email lub hasło.');
            break;
          case 'VALIDATION_ERROR':
            setError('Niepoprawne dane. Upewnij się, że format emaila i hasła są prawidłowe.');
            break;
          case 'RATE_LIMITED':
            setError('Zbyt wiele prób logowania. Spróbuj ponownie za minutę.');
            break;
          default:
            setError(err.message || 'Błąd logowania.');
        }
      } else {
        setError('Brak połączenia z serwerem. Spróbuj ponownie.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 flex flex-col justify-center">
      <div className="bg-white rounded-2xl border border-[#e8e4dc] p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#171513] tracking-tight">Witaj ponownie</h1>
          <p className="text-sm text-[#70685f] mt-1">Zaloguj się do swojego dziennika</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 text-sm rounded-lg bg-[#fdf2f0] border border-[#f5c6cb] text-[#8c2a1c]"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-[#4a3525] mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-base placeholder-[#70685f]/60"
              placeholder="twoj@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-[#4a3525] mb-1">
              Hasło
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-base placeholder-[#70685f]/60"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[#141311] hover:bg-[#2b2724] font-semibold text-[#faf9f6] transition active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer shadow-sm"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="text-sm text-[#3b2314] hover:text-[#141311] font-medium underline cursor-pointer"
          >
            Nie masz konta? Zarejestruj się
          </button>
        </div>
      </div>
    </div>
  );
};
