import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  isStaff: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('stockpilot_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('stockpilot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      api.getMe()
        .then(({ data }) => {
          setUser(data);
          localStorage.setItem('stockpilot_user', JSON.stringify(data));
        })
        .catch(() => {
          setUser(null);
          setToken(null);
          localStorage.removeItem('stockpilot_token');
          localStorage.removeItem('stockpilot_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('stockpilot_token', newToken);
    localStorage.setItem('stockpilot_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors during logout
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('stockpilot_token');
      localStorage.removeItem('stockpilot_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAdmin: () => user?.role === 'admin',
        isStaff: () => user?.role === 'staff' || user?.role === 'admin',
      }}
    >
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
