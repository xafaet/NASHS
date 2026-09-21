import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { apiFetch } from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (emailOrPhone: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isMember: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nash_token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user if token exists
  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem('nash_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiFetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('nash_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Session verification paused:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (emailOrPhone: string, pass: string): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('nash_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Login error:', err);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('nash_token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = !!(user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'event_manager' || user.role === 'content_manager'));
  const isMember = !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isMember }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
