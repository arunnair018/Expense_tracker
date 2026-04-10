import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,             setUser]            = useState(null);
  const [loading,          setLoading]         = useState(true);
  const [savedPdfPassword, setSavedPdfPassword] = useState(null);  // decrypted, in memory only

  // Fetch saved PDF password (called after login / on session restore)
  const fetchPdfPassword = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/pdf-password');
      setSavedPdfPassword(data.password ?? null);
    } catch {
      setSavedPdfPassword(null);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => {
          setUser(data.user);
          fetchPdfPassword();
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchPdfPassword]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    await fetchPdfPassword();
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setSavedPdfPassword(null);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSavedPdfPassword(null);
  };

  const savePdfPassword = async (password) => {
    await api.put('/auth/pdf-password', { password });
    setSavedPdfPassword(password);
  };

  const clearPdfPassword = async () => {
    await api.delete('/auth/pdf-password');
    setSavedPdfPassword(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, register, logout,
      savedPdfPassword, savePdfPassword, clearPdfPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
