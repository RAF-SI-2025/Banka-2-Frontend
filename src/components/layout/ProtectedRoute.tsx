import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Permission } from '../../types';

interface ProtectedRouteProps {
  requiredPermission?: Permission;
  adminOnly?: boolean;
  employeeOnly?: boolean;
  // Defense-in-depth: ruta dostupna samo supervizorima (i adminima jer su svi
  // admini i supervizori po spec-u Celine 3). Koristi se za /employee/orders,
  // /employee/actuaries, /employee/tax, /employee/profit-bank, /funds/create.
  supervisorOnly?: boolean;
  // Defense-in-depth: ruta NIJE dostupna agentima. Po Celini 4 (Nova) §137-141
  // agenti nemaju OTC pristup; sidebar krije linkove ali ovo blokira direktni URL.
  noAgentOnly?: boolean;
  // P1-fe-mobile-authz-1 (1761): ruta za plasiranje naloga. Dozvoljeno za one
  // koji STVARNO mogu da trguju: admin/supervizor (kupuju u ime fonda) ili
  // klijent sa TRADE_STOCKS permisijom. Agenti su iskljuceni. Klijent bez
  // TRADE_STOCKS dobija /403 PRE nego sto prodje ceo order+OTP flow (umesto
  // BE 403 na kraju).
  tradeGate?: boolean;
}

export default function ProtectedRoute({
  requiredPermission,
  adminOnly = false,
  employeeOnly = false,
  supervisorOnly = false,
  noAgentOnly = false,
  tradeGate = false,
}: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, isAdmin, isSupervisor, isAgent } = useAuth();

  if (isLoading) {
    // Spec UX polish: umesto blank-page prikazujemo loading splash sa
    // gradient halo + spinner. AuthContext fetcha employee permisije
    // posle login-a — ovo se prikazuje tih ~200-500ms.
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background"
        data-testid="auth-loading-splash"
        role="status"
        aria-live="polite"
        aria-label="Ucitavanje..."
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 opacity-30" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Ucitavanje sesije...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/403" replace />;
  }

  // employeeOnly: allow any employee (ADMIN or EMPLOYEE role)
  if (employeeOnly && user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
    return <Navigate to="/403" replace />;
  }

  // supervisorOnly: admin je takodje supervizor po spec-u (Celina 3)
  if (supervisorOnly && !isSupervisor) {
    return <Navigate to="/403" replace />;
  }

  // noAgentOnly: agent koji nije ujedno i supervizor/admin se odbija
  if (noAgentOnly && isAgent && !isSupervisor && !isAdmin) {
    return <Navigate to="/403" replace />;
  }

  // tradeGate (1761): mogu da trguju admin/supervizor (u ime fonda) ili klijent
  // sa TRADE_STOCKS. Svi ostali (klijent bez permisije, cist EMPLOYEE bez
  // supervizor/admin, agent) → /403 fail-closed.
  if (tradeGate) {
    const canTrade = isAdmin || isSupervisor || hasPermission(Permission.TRADE_STOCKS);
    if (!canTrade) {
      return <Navigate to="/403" replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
