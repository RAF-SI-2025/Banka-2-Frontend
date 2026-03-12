import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { Permission } from '../types';
import { decodeJwt } from '../utils/jwt';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Pri loadovanju proverimo da li postoji token u sessionStorage
    const token = sessionStorage.getItem('accessToken');
    const storedUser = sessionStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        sessionStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (data: LoginRequest) => {
    // MOCK LOGIN — odkomentarisati za lokalno testiranje bez backend-a
    // Kredencijali: test@test.test / test (sve permisije)
    // if (data.email === 'test@test.test' && data.password === 'test') {
    //   const mockUser: AuthUser = {
    //     id: 0,
    //     email: 'test@test.test',
    //     username: 'testuser',
    //     firstName: 'Test',
    //     lastName: 'User',
    //     permissions: Object.values(Permission),
    //   };
    //   sessionStorage.setItem('accessToken', 'mock-token');
    //   sessionStorage.setItem('refreshToken', 'mock-refresh');
    //   sessionStorage.setItem('user', JSON.stringify(mockUser));
    //   setUser(mockUser);
    //   return;
    // }

    const response = await authService.login(data);

    sessionStorage.setItem('accessToken', response.accessToken);
    sessionStorage.setItem('refreshToken', response.refreshToken);

    const payload = decodeJwt(response.accessToken);
    if (!payload) {
      throw new Error('Neispravan token');
    }

    // JWT sadrži: sub (email), role (ADMIN/CLIENT), active
    // ADMIN role daje ADMIN permisiju za pristup admin stranicama
    const permissions: Permission[] = payload.role === 'ADMIN' ? [Permission.ADMIN] : [];

    // Izvlačimo ime iz email-a (marko.petrovic@banka.rs → Marko Petrovic)
    const emailName = payload.sub.split('@')[0];
    const nameParts = emailName.split('.');
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const authUser: AuthUser = {
      id: 0,
      email: payload.sub,
      username: emailName,
      firstName: nameParts[0] ? capitalize(nameParts[0]) : '',
      lastName: nameParts[1] ? capitalize(nameParts[1]) : '',
      permissions,
    };

    sessionStorage.setItem('user', JSON.stringify(authUser));
    setUser(authUser);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  const isAdmin = user?.permissions.includes(Permission.ADMIN) ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
