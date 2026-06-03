import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { Permission } from '../types';
import { decodeJwt } from '../utils/jwt';
import { employeeService } from '../services/employeeService';
import { clientService } from '../services/clientService';
import { AUTH_UNAUTHORIZED_EVENT } from '../services/authEvents';

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
  /** True ako je korisnik zaposleni banke (role ADMIN ili EMPLOYEE), nije CLIENT. */
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FE-AUTH-02: provera JWT exp-a pre rehydratacije iz sessionStorage. Bez ovoga,
// cached `sessionStorage.user` se "ucitava" iako je token istekao — user
// izgleda autentifikovan dok prvi API poziv ne vrati 401, sto izaziva
// neocekivane redirect-e i flash polu-renderovanih UI stanja.
function isAccessTokenStale(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') {
    // Nemamo validan payload ili exp claim — tretiraj kao stale (safer default).
    return true;
  }
  return payload.exp * 1000 <= Date.now();
}

function getInitialUser(): AuthUser | null {
  const token = sessionStorage.getItem('accessToken');
  const storedUser = sessionStorage.getItem('user');
  if (!token || !storedUser) {
    return null;
  }
  // FE-AUTH-02: ako JWT exp je u proslosti, ocisti sesiju i ne ucitavaj user-a.
  if (isAccessTokenStale(token)) {
    sessionStorage.clear();
    return null;
  }
  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    sessionStorage.clear();
    return null;
  }
}

// FE-AUTH-01: pomocnica za fetch permisija zaposlenog. Vraca strukturu
// ({permissions, userId, firstName, lastName}) — immutable izvor istine
// koji se kombinuje sa ADMIN baseline-om u login(). Ranija inline mutacija
// `permissions.push(...)` + reassign preko `await` boundary brisala je
// prethodne push-eve (race), pa je sad razdvojeno: prvo izracunaj sve
// async izvore, pa kompozuj kao immutable lista.
// FE-AUTH-07: lista validnih Permission enum vrednosti, prekoputa u Set
// za O(1) lookup. Koristi se kao runtime filter — BE moze (teoretski)
// vratiti nepoznat string u `permissions` listi (npr. dodat permission na
// BE pre FE deploy-a, schema drift, manuelna DB modifikacija). Bez
// validacije, `as Permission[]` cast je laz prema TypeScript-u i moze
// proci kroz codebase do mesta gde se ocekuje strogi enum.
const VALID_PERMISSIONS = new Set<string>(Object.values(Permission));

function filterValidPermissions(rawPermissions: unknown): Permission[] {
  if (!Array.isArray(rawPermissions)) return [];
  const filtered: Permission[] = [];
  for (const p of rawPermissions) {
    if (typeof p === 'string' && VALID_PERMISSIONS.has(p)) {
      filtered.push(p as Permission);
    } else if (typeof p === 'string') {
      // Log za debug — neocekivan permission string sa BE-a.
      // eslint-disable-next-line no-console
      console.warn('[AuthContext] BE vratio nepoznat permission, ignorisan:', p);
    }
  }
  return filtered;
}

async function fetchEmployeePermissions(email: string): Promise<{
  permissions: Permission[];
  userId: number;
  firstName?: string;
  lastName?: string;
  position?: string;
}> {
  try {
    const employeesResponse = await employeeService.getAll({ email, page: 0, limit: 1 });
    const employees = employeesResponse.content;
    if (employees.length > 0) {
      const emp = employees[0];
      return {
        // FE-AUTH-07: filter umesto unsafe `as Permission[]` cast-a.
        permissions: filterValidPermissions(emp.permissions),
        userId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        // P1-fe-mobile-authz-1 (1760): dedicirano `position` polje (SUPERVISOR/AGENT)
        // kao pouzdan izvor za isSupervisor/isAgent (vidi AuthUser.position).
        position: emp.position,
      };
    }
  } catch {
    // Fail-safe: ako BE puca, vrati prazne permisije — caller dodaje ADMIN
    // baseline ako je ADMIN role.
  }
  return { permissions: [], userId: 0 };
}

async function fetchClientInfo(_email: string): Promise<{
  permissions: Permission[];
  userId: number;
  firstName?: string;
  lastName?: string;
}> {
  // T4A-017: ako BE javi canTradeStocks=false, klijent NE dobija TRADE_STOCKS.
  // Default je true radi backwards-compat (stari klijenti bez polja).
  // FIX: koristi /clients/me self-lookup — CLIENT NEMA pravo na /clients?email=...
  // (rezervisano za ADMIN/EMPLOYEE per GlobalSecurityConfig); 403 spam u konzoli.
  try {
    const cli = await clientService.getMe();
    const canTrade = (cli as unknown as { canTradeStocks?: boolean }).canTradeStocks;
    return {
      permissions: canTrade !== false ? [Permission.TRADE_STOCKS] : [],
      userId: cli.id,
      firstName: cli.firstName,
      lastName: cli.lastName,
    };
  } catch {
    // P1-fe-mobile-authz-1 (1560/1598): FAIL-CLOSED. Ranije se ovde vracao
    // `[TRADE_STOCKS]` po default-u → revokovan klijent (canTradeStocks=false)
    // ciji `/clients/me` padne (ili je tek dobio 403/timeout) dobijao bi pun
    // trading UI (OTC/Berza/orderi) + `userId:0` (sto otvara isMe-by-name footgun
    // u otcUtils). BE je autoritativan i odbice trgovinu, ali UI ne sme da
    // prikaze akcije koje korisnik nema pravo da koristi. Ako lookup padne ne
    // dodeljujemo nijednu permisiju — korisnik vidi samo bankarski deo.
    return { permissions: [], userId: 0 };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  // FE-AUTH-03: dodaje setter koji se trigger-uje pri async login/logout-u,
  // pa ProtectedRoute splash branch radi (ranije: `const [isLoading]` bez
  // setter-a = dead state).
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // FE-SHR-01: api.ts emit-uje `auth:unauthorized` event kad refresh padne.
  // AuthProvider hvata + radi clean logout + SPA navigate. Ranije:
  // `window.location.href = '/login'` u api.ts → full page reload, wipe
  // React state, breaks Cypress + AuthLoadingSplash.
  useEffect(() => {
    const handleUnauthorized = () => {
      sessionStorage.clear();
      setUser(null);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate]);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
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
      const fallbackFirstName = nameParts[0] ? capitalize(nameParts[0]) : '';
      const fallbackLastName = nameParts[1] ? capitalize(nameParts[1]) : '';

      // FE-AUTH-01: immutable construction. Skupimo sve izvore async-no,
      // pa kompozujemo finalnu listu sa `new Set` (dedup). Nema mutiranja
      // preko `await` boundary.
      const adminBaseline: Permission[] = payload.role === 'ADMIN' ? [Permission.ADMIN] : [];

      let fetchedPerms: Permission[] = [];
      let userId = 0;
      let firstName = fallbackFirstName;
      let lastName = fallbackLastName;
      let position: string | undefined;

      if (payload.role === 'ADMIN' || payload.role === 'EMPLOYEE') {
        const empResult = await fetchEmployeePermissions(payload.sub);
        fetchedPerms = empResult.permissions;
        userId = empResult.userId;
        if (empResult.firstName) firstName = empResult.firstName;
        if (empResult.lastName) lastName = empResult.lastName;
        position = empResult.position;
      } else if (payload.role === 'CLIENT') {
        const cliResult = await fetchClientInfo(payload.sub);
        fetchedPerms = cliResult.permissions;
        userId = cliResult.userId;
        if (cliResult.firstName) firstName = cliResult.firstName;
        if (cliResult.lastName) lastName = cliResult.lastName;
      }

      const permissions: Permission[] = Array.from(new Set([...adminBaseline, ...fetchedPerms]));

      const authUser: AuthUser = {
        id: userId,
        email: payload.sub,
        username: emailName,
        firstName,
        lastName,
        role: payload.role,
        permissions,
        position,
      };

      sessionStorage.setItem('user', JSON.stringify(authUser));
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
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
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  };

  const isAdmin = !!(
    (Array.isArray(user?.permissions) && user.permissions.includes(Permission.ADMIN)) ||
    user?.role === 'ADMIN'
  );

  // P1-fe-mobile-authz-1 (1760): izvodimo supervizor/agent flag iz DEDICIRANOG
  // `position` polja (autoritativan izvor iz `/employees` DTO-a) PORED
  // `permissions` liste. Ranije se oslanjalo iskljucivo na `Permission.SUPERVISOR`
  // string u permissions — ako BE schema drift-uje (position=SUPERVISOR a literal
  // string ne stigne u permissions), supervizor bi bio tretiran kao obican
  // EMPLOYEE i izgubio pristup /employee/orders, /employee/tax, /audit-log itd.
  const positionUpper = (user?.position ?? '').toUpperCase();

  const isSupervisor = !!(
    isAdmin ||
    positionUpper === 'SUPERVISOR' ||
    (Array.isArray(user?.permissions) && user.permissions.includes(Permission.SUPERVISOR))
  );

  const isAgent = !!(
    !isSupervisor &&
    (positionUpper === 'AGENT' ||
      (Array.isArray(user?.permissions) && user.permissions.includes(Permission.AGENT)))
  );

  // R1-857: jedinstven izvor istine za "zaposleni banke" (role ADMIN ili
  // EMPLOYEE). Ranije se isti `role === 'ADMIN' || role === 'EMPLOYEE'`
  // magic-string proveravao inline po stranicama (npr. MyOrdersPage za
  // commission=0). CLIENT-i nisu zaposleni.
  const isEmployee = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';

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
        isEmployee,
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
