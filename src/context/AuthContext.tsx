import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AuthUser, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { Permission } from '../types';
import { decodeJwt } from '../utils/jwt';
import { employeeService } from '../services/employeeService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAgent: boolean;
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

    const emailName = payload.sub.split('@')[0];
    const nameParts = emailName.split('.');
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    let permissions: Permission[] = [];
    let employeeId = 0;
    let firstName = nameParts[0] ? capitalize(nameParts[0]) : '';
    let lastName = nameParts[1] ? capitalize(nameParts[1]) : '';

    // For ADMIN role, always include ADMIN permission
    if (payload.role === 'ADMIN') {
      permissions.push(Permission.ADMIN);
    }

    // For employees (ADMIN or EMPLOYEE role), fetch real permissions from backend
    if (payload.role === 'ADMIN' || payload.role === 'EMPLOYEE') {
      try {
        const employeesResponse = await employeeService.getAll({ email: payload.sub, page: 0, limit: 1 });
        const employees = employeesResponse.content;
        if (employees.length > 0) {
          const emp = employees[0];
          permissions = (emp.permissions ?? []) as Permission[];
          employeeId = emp.id;
          firstName = emp.firstName || firstName;
          lastName = emp.lastName || lastName;
          // Admins always have ADMIN permission even if not in backend list
          if (payload.role === 'ADMIN' && !permissions.includes(Permission.ADMIN)) {
            permissions.push(Permission.ADMIN);
          }
        }
      } catch {
        // If fetching fails, fallback: only ADMIN role gets ADMIN permission
        if (payload.role === 'ADMIN') {
          permissions = [Permission.ADMIN];
        }
      }
    }

    const authUser: AuthUser = {
      id: employeeId,
      email: payload.sub,
      username: emailName,
      firstName,
      lastName,
      role: payload.role,
      permissions,
    };

    sessionStorage.setItem('user', JSON.stringify(authUser));
    setUser(authUser);
  };

  const logout = async () => {
    // Opc.1 — POST /auth/logout pre lokalnog clean-up-a, da BE blacklist-uje
    // JWT (Caffeine 20min TTL). Best-effort: ako BE puca, ipak cisti session.
    // Axios interceptor automatski dodaje Bearer header, pa BE zna koji token
    // se blacklist-uje.
    if (sessionStorage.getItem('accessToken')) {
      try {
        await authService.logout();
      } catch {
        // BE moze biti unreachable, isteklim tokenom, etc. Lokalna sesija ide
        // u cleanup nezavisno — bezbednost je defense-in-depth.
      }
    }
    sessionStorage.clear();
    setUser(null);
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  };

  const isAdmin = !!(
    (Array.isArray(user?.permissions) && user.permissions.includes(Permission.ADMIN)) ||
    user?.role === 'ADMIN'
  );

  const isSupervisor = !!(
    isAdmin ||
    (Array.isArray(user?.permissions) && user.permissions.includes(Permission.SUPERVISOR))
  );

  const isAgent = !!(
    Array.isArray(user?.permissions) && user.permissions.includes(Permission.AGENT)
  );

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
        isSupervisor,
        isAgent,
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
