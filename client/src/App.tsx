import React, { useState, useEffect, useCallback } from 'react';
import { api, RegisterPayload, LoginPayload, JournalEntryPayload } from './api/client';
import { RegisterView } from './views/RegisterView';
import { LoginView } from './views/LoginView';
import { JournalView } from './views/JournalView';

export type RoutePath = '/login' | '/register' | '/journal';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === '/register' || path === '/login' || path === '/journal') {
      return path;
    }
    return api.getToken() ? '/journal' : '/login';
  });

  const navigate = useCallback((path: RoutePath) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/register' || path === '/login' || path === '/journal') {
        setCurrentPath(path);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleRegister = async (data: RegisterPayload) => {
    await api.register(data);
    await api.login(data);
    navigate('/journal');
  };

  const handleLogin = async (data: LoginPayload) => {
    await api.login(data);
    navigate('/journal');
  };

  const handleLogout = () => {
    api.clearToken();
    navigate('/login');
  };

  const handleSaveEntry = async (entry: JournalEntryPayload) => {
    await api.saveJournalEntry(entry);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 text-slate-100 flex flex-col pt-safe pb-safe pl-safe pr-safe">
      <main className="flex-1 flex flex-col justify-center">
        {currentPath === '/register' && (
          <RegisterView
            onRegister={handleRegister}
            onNavigateToLogin={() => navigate('/login')}
          />
        )}
        {currentPath === '/login' && (
          <LoginView
            onLogin={handleLogin}
            onNavigateToRegister={() => navigate('/register')}
          />
        )}
        {currentPath === '/journal' && (
          <JournalView
            onSave={handleSaveEntry}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
};

export default App;
