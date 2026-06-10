import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Wallet,
  Receipt,
  BookUser,
  ArrowLeftRight,
  History,
  RefreshCw,
  CreditCard,
  FileText,
  Building2,
  ShieldCheck,
  Users,
  LogOut,
  TrendingUp,
  Briefcase,
  ShoppingCart,
  Calculator,
  Globe,
  Landmark,
  Handshake,
  PiggyBank,
  Vault,
  Percent,
  MapPin,
  Gamepad2,
  Bookmark,
  BellRing,
  Repeat,
  ScrollText,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import WatchlistQuickAccess from '../watchlist/WatchlistQuickAccess';

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export default function ClientSidebar() {
  // FE-AUTH-05: koristimo `isAdmin/isSupervisor/isAgent` iskljucivo iz AuthContext-a.
  // Stari pristup (lokalno parsiranje `user?.role` + `userType` fallback +
  // `perms.includes('AGENT')`) je duplirao logiku iz AuthContext-a i dozvoljavao
  // divergenciju (npr. AuthContext racuna isAdmin po permission-u, lokalni kod
  // gleda samo `role`). `userType` fallback grana je dead — AuthUser tip nema
  // to polje, pa je `(user as { ... userType }).userType` uvek undefined.
  const { user, logout, isAdmin, isSupervisor, isAgent } = useAuth();
  const [open, setOpen] = useState(false);

  // Employee/admin se gledaju po role-u na user objektu. AuthContext computed
  // isAdmin pokriva permission-based admin path (ADMIN permission bez role='ADMIN').
  const isEmployeeOrAdmin = isAdmin || user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return '?';
  };

  const getRoleName = () => {
    if (isAdmin) return 'Administrator';
    if (isSupervisor) return 'Supervizor';
    if (isAgent) return 'Agent';
    if (user?.role === 'EMPLOYEE') return 'Zaposleni';
    return 'Klijent';
  };

  // OTC linkovi: po Celini 4 (Nova) §145-148, samo SUPERVIZORI (od zaposlenih)
  // i KLIJENTI sa permisijom TRADE_STOCKS smeju da vide. Agenti ne.
  // T4A-017 fix: klijent sad mora imati eksplicitnu TRADE_STOCKS permisiju
  // (mapiranu iz canTradeStocks polja u Client entity-ju). Default true za
  // backwards-compat, supervizor moze revokovati preko PATCH /clients/{id}/trading.
  //
  // FE-AUTH-05: `isAgent` dolazi iz AuthContext-a. Ranija lokalna derivacija
  // `perms.includes('AGENT') && !isSupervisor && !isAdmin` je reimplementirala
  // istu logiku — sad samo proveravamo `isAgent && !isSupervisor && !isAdmin`
  // (dual-role agent+supervisor zadrzava OTC pristup po istom pravilu kao
  // u ProtectedRoute `noAgentOnly` matcher-u).
  const perms: string[] = Array.isArray(user?.permissions) ? (user!.permissions as string[]) : [];
  const agentBlocked = isAgent && !isSupervisor && !isAdmin;
  const clientCanTrade = user?.role === 'CLIENT' && perms.includes('TRADE_STOCKS');
  const canAccessOtc = !agentBlocked && (isSupervisor || isAdmin || clientCanTrade);

  // Trgovinski feature-i (Watchlist, Cenovni alarmi, Trajni nalozi/DCA)
  // dostupni su svim koji mogu da trguju — klijenti (sa TRADE_STOCKS),
  // supervizori i admin. Agenti su iskljuceni po istom pravilu kao OTC.
  const canAccessTradingFeatures = !agentBlocked && (isSupervisor || isAdmin || clientCanTrade);

  // R2-388: "Marzni racuni" je trgovinski feature (margin trading) — klijent BEZ
  // TRADE_STOCKS ne moze da otvori margin racun ni da trguje preko njega, pa link
  // ne treba da vidi. Gejtujemo ga iza `canAccessTradingFeatures` (isto pravilo
  // kao Berza/Portfolio); ostali finansijski linkovi su za sve klijente.
  const clientLinks: SidebarItem[] = useMemo(
    () => {
      const links: SidebarItem[] = [
        { label: 'Racuni', path: '/accounts', icon: <Wallet className="h-4 w-4" /> },
        { label: 'Placanja', path: '/payments/new', icon: <Receipt className="h-4 w-4" /> },
        { label: 'Primaoci', path: '/payments/recipients', icon: <BookUser className="h-4 w-4" /> },
        { label: 'Prenosi', path: '/transfers', icon: <ArrowLeftRight className="h-4 w-4" /> },
        { label: 'Istorija prenosa', path: '/transfers/history', icon: <ArrowLeftRight className="h-4 w-4" /> },
        { label: 'Istorija placanja', path: '/payments/history', icon: <History className="h-4 w-4" /> },
        { label: 'Menjacnica', path: '/exchange', icon: <RefreshCw className="h-4 w-4" /> },
        { label: 'Kartice', path: '/cards', icon: <CreditCard className="h-4 w-4" /> },
        { label: 'Krediti', path: '/loans', icon: <FileText className="h-4 w-4" /> },
      ];
      if (canAccessTradingFeatures) {
        links.push({ label: 'Marzni racuni', path: '/margin-accounts', icon: <Landmark className="h-4 w-4" /> });
      }
      links.push(
        { label: 'Stednja', path: '/savings', icon: <PiggyBank className="h-4 w-4" /> },
        { label: 'Lokacije', path: '/branches', icon: <MapPin className="h-4 w-4" /> },
      );
      return links;
    },
    [canAccessTradingFeatures]
  );

  const tradingLinks: SidebarItem[] = useMemo(
    () => {
      const base: SidebarItem[] = [];
      // P1-fe-mobile-authz-1 (1761): Berza/Portfolio/Moji-orderi su RANIJE bili
      // UVEK vidljivi (cak i klijentu bez TRADE_STOCKS) dok su Watchlist/OTC bili
      // skriveni za istog klijenta — kontradikcija koja je vodila klijenta kroz
      // ceo order+OTP flow do BE 403. Sad su i base linkovi uslovljeni
      // `canAccessTradingFeatures` (isto pravilo kao rute: admin/supervizor ili
      // klijent sa TRADE_STOCKS; agenti iskljuceni).
      if (canAccessTradingFeatures) {
        base.push(
          { label: 'Berza', path: '/securities', icon: <TrendingUp className="h-4 w-4" /> },
          { label: 'Portfolio', path: '/portfolio', icon: <Briefcase className="h-4 w-4" /> },
          { label: 'Moji orderi', path: '/orders/my', icon: <ShoppingCart className="h-4 w-4" /> },
          { label: 'Watchlist', path: '/watchlist', icon: <Bookmark className="h-4 w-4" /> },
          { label: 'Cenovni alarmi', path: '/price-alerts', icon: <BellRing className="h-4 w-4" /> },
          { label: 'Trajni nalozi', path: '/recurring-orders', icon: <Repeat className="h-4 w-4" /> },
        );
      }
      if (canAccessOtc) {
        base.push(
          { label: 'OTC trgovina', path: '/otc', icon: <Handshake className="h-4 w-4" /> },
        );
      }
      // NAPOMENA: "Investicioni fondovi" je IZVADJEN iz tradingLinks u zaseban
      // uvek-vidljiv blok (vidi render ispod). Razlog: ova sekcija je gejtovana
      // `showTradingSection` koji ISKLJUCUJE agente (EMPLOYEE bez supervisora),
      // a spec (Celina 4 Nova) trazi da agenti vide fondove (discovery & details).
      // Da je ostao ovde, agent ga nikad ne bi video — bug L48.
      return base;
    },
    [canAccessOtc, canAccessTradingFeatures]
  );

  // R2-389: "Berza" sekcija se ranije renderovala UVEK — pa je i obican zaposleni
  // (EMPLOYEE bez supervisor/admin/aktuar uloge), koji nije trgovinska rola, video
  // sekciju iako za njega nema relevantnog sadrzaja. Sada:
  //  - klijenti je uvek vide (Investicioni fondovi su za sve + njihovi trgovinski
  //    linkovi ako mogu da trguju),
  //  - od zaposlenih je vide samo supervizor/admin (koji realno koriste Berza/OTC/
  //    Profit), ne i obican zaposleni.
  const showTradingSection = !isEmployeeOrAdmin || isSupervisor;

  // L48: "Investicioni fondovi" (discovery & details) vidljivi su klijentima,
  // AGENTIMA, supervizorima i adminima — ali NE obicnom zaposlenom (R2-389: za
  // base employee fondovi nemaju namenu). Agent je EMPLOYEE pa ga showTradingSection
  // iskljucuje; zato poseban uslov koji eksplicitno ukljucuje `isAgent`.
  const showFundsLink = !isEmployeeOrAdmin || isSupervisor || isAdmin || isAgent;

  const employeeLinks: SidebarItem[] = useMemo(
    () => {
      const links: SidebarItem[] = [];

      // Dashboard only for supervisors and admins
      if (isSupervisor) {
        links.push({ label: 'Dashboard', path: '/employee/dashboard', icon: <TrendingUp className="h-4 w-4" /> });
      }

      // Admin-only links
      if (isAdmin) {
        links.push({ label: 'Zaposleni', path: '/admin/employees', icon: <Users className="h-4 w-4" /> });
      }

      // All employees can see these
      links.push(
        { label: 'Portal racuna', path: '/employee/accounts', icon: <Building2 className="h-4 w-4" /> },
        { label: 'Zahtevi za racune', path: '/employee/account-requests', icon: <Wallet className="h-4 w-4" /> },
        { label: 'Portal kartica', path: '/employee/cards', icon: <CreditCard className="h-4 w-4" /> },
        { label: 'Zahtevi za kartice', path: '/employee/card-requests', icon: <CreditCard className="h-4 w-4" /> },
        { label: 'Portal klijenata', path: '/employee/clients', icon: <Users className="h-4 w-4" /> },
        { label: 'Zahtevi za kredit', path: '/employee/loan-requests', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'Svi krediti', path: '/employee/loans', icon: <FileText className="h-4 w-4" /> },
      );

      // Supervisor-only links (admin is also supervisor per spec)
      if (isSupervisor) {
        links.push(
          { label: 'Orderi', path: '/employee/orders', icon: <ShoppingCart className="h-4 w-4" /> },
          { label: 'Aktuari', path: '/employee/actuaries', icon: <TrendingUp className="h-4 w-4" /> },
          { label: 'Porez', path: '/employee/tax', icon: <Calculator className="h-4 w-4" /> },
          { label: 'Profit Banke', path: '/employee/profit-bank', icon: <Landmark className="h-4 w-4" /> },
          { label: 'Svi depoziti', path: '/admin/savings/deposits', icon: <Vault className="h-4 w-4" /> },
          { label: 'Audit log', path: '/audit-log', icon: <ScrollText className="h-4 w-4" /> },
          // Napomena: "Kreiraj fond" se pristupa preko /funds stranice (dugme gore desno).
          // Zaseban sidebar link napravio bi koliziju sa postojecim Cypress regex
          // testovima (/novi|dodaj|kreiraj/i) na Admin Employee flow-u.
        );
      }

      // Admin-only savings links
      if (isAdmin) {
        links.push(
          { label: 'Kamatne stope', path: '/admin/savings/rates', icon: <Percent className="h-4 w-4" /> },
        );
      }

      // R1 534 (P2-authz-method-1): Spark output exposure (analytics + fraud alerts).
      // BE matcher /admin/analytics/** i /admin/fraud-alerts/** je ADMIN+SUPERVISOR
      // (deliberate W3-T2, paritet sa /audit/**), pa link prikazujemo supervizorima
      // (isSupervisor ukljucuje admina). Ranije adminOnly → supervizor (legitiman po
      // BE-u) nije video link ni stranicu; sad FE+BE konzistentni (paritet sa Audit log).
      if (isSupervisor) {
        links.push(
          { label: 'Analitike', path: '/admin/analytics', icon: <BarChart3 className="h-4 w-4" /> },
          { label: 'Fraud alerts', path: '/admin/fraud-alerts', icon: <ShieldAlert className="h-4 w-4" /> },
        );
      }

      // All employees can see exchanges
      links.push({ label: 'Berze', path: '/employee/exchanges', icon: <Globe className="h-4 w-4" /> });

      return links;
    },
    [isAdmin, isSupervisor]
  );

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-1 text-sm transition-all duration-200',
      isActive
        ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm border border-indigo-500/20'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  return (
    <>
      <div className="border-b p-3 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Zatvori navigaciju' : 'Otvori navigaciju'}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-dvh w-64 border-r bg-background/95 backdrop-blur-sm p-4 transition-transform md:translate-x-0 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
          'transform'
        )}
      >
        <div className="mb-4 flex items-center justify-between md:hidden">
          <p className="text-sm font-semibold">Navigacija</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Zatvori navigaciju"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="shrink-0 mb-6 flex items-center gap-3 rounded-xl border bg-gradient-to-r from-indigo-500/5 to-violet-500/5 p-3">
          <Avatar className="h-11 w-11 ring-2 ring-indigo-500/20">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{getRoleName()}</p>
          </div>
          {/* FE1: NotificationBell ide direktno u sidebar user kartici
              (po Lukinoj direktivi 25.05.2026 — NE u Header.tsx). */}
          <NotificationBell />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-hidden">
          <div className="space-y-1">
            <NavLink
              to="/home"
              className={linkClassName}
              onClick={() => setOpen(false)}
            >
              <Home className="h-4 w-4" />
              <span>Pocetna</span>
            </NavLink>
            <NavLink
              to="/soba-za-cekanje"
              className={linkClassName}
              onClick={() => setOpen(false)}
            >
              <Gamepad2 className="h-4 w-4" />
              <span>Soba za cekanje</span>
            </NavLink>
          </div>

          {!isEmployeeOrAdmin && (
          <div className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Moje finansije
            </p>

            <div className="space-y-0.5">
              {clientLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={linkClassName}
                  onClick={() => setOpen(false)}
                  end={item.path === '/transfers'}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
          )}

          {showTradingSection && (
          <div className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Berza
            </p>

            <div className="space-y-0.5">
              {tradingLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={linkClassName}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {/* "Investicioni fondovi" sedi unutar Berza sekcije (bez razmaka
                  ispod OTC trgovine). showTradingSection => showFundsLink uvek vazi,
                  pa je bezuslovno tacno ovde za sve koji vide sekciju. */}
              <NavLink
                to="/funds"
                className={linkClassName}
                onClick={() => setOpen(false)}
              >
                <PiggyBank className="h-4 w-4" />
                <span>Investicioni fondovi</span>
              </NavLink>
            </div>
          </div>
          )}

          {/* Investicioni fondovi za AGENTA: agent (EMPLOYEE+AGENT, !supervizor)
              ne vidi Berza sekciju iznad, pa mu fondove (koje spec trazi — L48)
              prikazujemo kao zaseban link. Za sve ostale je vec u Berza sekciji. */}
          {!showTradingSection && showFundsLink && (
          <div className="space-y-0.5">
            <NavLink
              to="/funds"
              className={linkClassName}
              onClick={() => setOpen(false)}
            >
              <PiggyBank className="h-4 w-4" />
              <span>Investicioni fondovi</span>
            </NavLink>
          </div>
          )}

          {isEmployeeOrAdmin && (
            <div className="space-y-2">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Employee portal
              </p>

              <div className="space-y-0.5">
                {employeeLinks.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={linkClassName}
                    onClick={() => setOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* FE2: Watchlist Quick Access — kompaktan widget iznad logout dugmeta */}
        <div className="shrink-0 mt-3">
          <WatchlistQuickAccess />
        </div>

        <div className="shrink-0 space-y-2 border-t pt-4 mt-auto">
          {/*
            Theme toggle: 3-state cycle button (System -> Light -> Dark -> ...).
            Single click cycle umesto dropdown-a — UX consistency sa testovima
            koji eksplicitno verifikuju ciklus, plus to je standardni pattern u
            ostatku app-a (vidi ThemeToggle.tsx). data-testid="theme-toggle" je
            inline u komponenti.
          */}
          <ThemeToggle variant="full" className="w-full justify-start" />

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              logout();
              setOpen(false);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Odjavi se
          </Button>
        </div>
      </aside>
    </>
  );
}
