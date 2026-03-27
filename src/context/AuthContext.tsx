import { createContext, useContext, useState, type ReactNode } from 'react';
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

function getInitialUser(): AuthUser | null {
  const token = sessionStorage.getItem('accessToken');
  const storedUser = sessionStorage.getItem('user');
  if (token && storedUser) {
    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      sessionStorage.clear();
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [isLoading] = useState(false);

  const login = async (data: LoginRequest) => {
    const response = await authService.login(data);

    sessionStorage.setItem('accessToken', response.accessToken);
    sessionStorage.setItem('refreshToken', response.refreshToken);

    const payload = decodeJwt(response.accessToken);
    if (!payload) {
      throw new Error('Neispravan token');
    }

    // JWT sadrži: sub (email), role (ADMIN/CLIENT), active
    // ADMIN role daje ADMIN permisiju za pristup admin stranicama
    const permissions: Permission[] = [];
    if (payload.role === 'ADMIN') permissions.push(Permission.ADMIN);
    if (payload.role === 'EMPLOYEE') permissions.push(Permission.ADMIN); // Employee ima iste portale kao admin

    // Izvlačimo ime iz email-a (marko.petrovic@banka.rs -> Marko Petrovic)
    const emailName = payload.sub.split('@')[0];
    const nameParts = emailName.split('.');
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const authUser: AuthUser = {
      id: 0,
      email: payload.sub,
      username: emailName,
      firstName: nameParts[0] ? capitalize(nameParts[0]) : '',
      lastName: nameParts[1] ? capitalize(nameParts[1]) : '',
      role: payload.role,
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

  const isAdmin = user?.permissions?.includes(Permission.ADMIN) || user?.role === 'ADMIN' || user?.role === 'EMPLOYEE' ? true : false;

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

