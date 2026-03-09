import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { Permission } from '../types';

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

    const authUser: AuthUser = {
      id: response.user.id,
      email: response.user.email,
      username: response.user.username,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
      permissions: response.user.permissions,
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
