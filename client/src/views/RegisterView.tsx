import React, { useState } from 'react';
import { ApiError, RegisterPayload } from '../api/client';

export interface RegisterViewProps {
  onRegister: (data: RegisterPayload) => Promise<unknown>;
  onNavigateToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onNavigateToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Wszystkie pola są wymagane.');
      return;
    }

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }

    setLoading(true);
    try {
      await onRegister({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'EMAIL_EXISTS':
            setError('Konto z tym adresem email już istnieje.');
            break;
          case 'PASSWORD_COMPROMISED':
            setError('To hasło wyciekło do sieci. Wybierz inne, bezpieczniejsze hasło.');
            break;
          case 'VALIDATION_ERROR':
            setError('Niepoprawne dane formularza. Hasło musi mieć od 8 do 72 znaków.');
            break;
          case 'RATE_LIMITED':
            setError('Zbyt wiele prób. Spróbuj ponownie później.');
            break;
          default:
            setError(err.message || 'Wystąpił nieoczekiwany błąd.');
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
          <h1 className="text-2xl font-bold text-[#171513] tracking-tight">Utwórz konto</h1>
          <p className="text-sm text-[#70685f] mt-1">Twój codzienny dziennik myśli i nastroju</p>
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
            <label htmlFor="register-email" className="block text-xs font-medium text-[#4a3525] mb-1">
              Email
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-password" className="block text-xs font-medium text-[#4a3525] mb-1">
              Hasło (min. 8 znaków)
            </label>
            <input
              id="register-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-base placeholder-[#70685f]/60"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[#141311] hover:bg-[#2b2724] font-semibold text-[#faf9f6] transition active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer shadow-sm"
          >
            {loading ? 'Rejestracja...' : 'Zarejestruj się'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="text-sm text-[#3b2314] hover:text-[#141311] font-medium underline cursor-pointer"
          >
            Masz już konto? Zaloguj się
          </button>
        </div>
      </div>
    </div>
  );
};
