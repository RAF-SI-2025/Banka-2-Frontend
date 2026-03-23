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
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';



interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export default function ClientSidebar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const permissions = Array.isArray((user as { permissions?: unknown[] } | null)?.permissions)
    ? ((user as { permissions?: string[] } | null)?.permissions ?? [])
    : [];

  const role = String(
    (user as { role?: string; userType?: string } | null)?.role ??
    (user as { role?: string; userType?: string } | null)?.userType ??
    ''
  ).toUpperCase();

  const isEmployeeOrAdmin =
    permissions.includes('ADMIN') ||
    permissions.includes('EMPLOYEE') ||
    role === 'ADMIN' ||
    role === 'EMPLOYEE';

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return '?';
  };

  const getRoleName = () => {
    if (role === 'ADMIN') return 'Administrator';
    if (role === 'EMPLOYEE') return 'Zaposleni';
    return 'Klijent';
  };

  const clientLinks: SidebarItem[] = useMemo(
    () => [
      { label: 'Računi', path: '/accounts', icon: <Wallet className="h-4 w-4" /> },
      { label: 'Plaćanja', path: '/payments/new', icon: <Receipt className="h-4 w-4" /> },
      { label: 'Primaoci', path: '/payments/recipients', icon: <BookUser className="h-4 w-4" /> },
      { label: 'Prenosi', path: '/transfers', icon: <ArrowLeftRight className="h-4 w-4" /> },
      { label: 'Istorija', path: '/payments/history', icon: <History className="h-4 w-4" /> },
      { label: 'Menjačnica', path: '/exchange', icon: <RefreshCw className="h-4 w-4" /> },
      { label: 'Kartice', path: '/cards', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Krediti', path: '/loans', icon: <FileText className="h-4 w-4" /> },
    ],
    []
  );

  const employeeLinks: SidebarItem[] = useMemo(
    () => [
      { label: 'Portal računa', path: '/employee/accounts', icon: <Building2 className="h-4 w-4" /> },
      { label: 'Zahtevi za račune', path: '/employee/account-requests', icon: <Wallet className="h-4 w-4" /> },
      { label: 'Portal kartica', path: '/employee/cards', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Zahtevi za kartice', path: '/employee/card-requests', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Portal klijenata', path: '/employee/clients', icon: <Users className="h-4 w-4" /> },
      { label: 'Zahtevi za kredit', path: '/employee/loan-requests', icon: <ShieldCheck className="h-4 w-4" /> },
      { label: 'Svi krediti', path: '/employee/loans', icon: <FileText className="h-4 w-4" /> },
      { label: 'Upravljanje aktuarima', path: '/employee/actuaries', icon: <Users className="h-4 w-4" /> },
      { label: 'Praćenje poreza', path: '/employee/tax', icon: <Receipt className="h-4 w-4" /> },
    ],
    []
  );

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
      isActive && 'bg-primary/10 text-primary font-medium'
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
          'fixed left-0 top-0 z-50 h-full w-64 border-r bg-muted/40 p-4 transition-transform md:sticky md:top-0 md:block md:min-h-screen md:translate-x-0 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:transform-none'
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

        {/* User Profile Section */}
        <div className="mb-6 flex items-center gap-3 rounded-lg border bg-background p-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{getRoleName()}</p>
          </div>
        </div>

        {/* Navigation and Theme */}
        <nav className="flex-1 space-y-6 overflow-y-auto">
          <div className="space-y-1 mb-2">
            <NavLink
              to="/home"
              className={linkClassName}
              onClick={() => setOpen(false)}
            >
              <Home className="h-4 w-4" />
              <span>Početna</span>
            </NavLink>
          </div>

          {!isEmployeeOrAdmin && (
            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Moje finansije
              </p>

              <div className="space-y-1">
                {clientLinks.map((item) => (
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

          {isEmployeeOrAdmin && (
            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employee portal
              </p>

              <div className="space-y-1">
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

        {/* Theme Selector and Logout */}
        <div className="space-y-2 border-t pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start">
                {theme === 'light' && <Sun className="mr-2 h-4 w-4" />}
                {theme === 'dark' && <Moon className="mr-2 h-4 w-4" />}
                {theme === 'system' && <Monitor className="mr-2 h-4 w-4" />}
                <span className="text-xs">{theme === 'system' ? 'Sistem' : theme === 'light' ? 'Svetlo' : 'Tamno'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Svetlo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Tamno
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                Sistem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              logout();
              setOpen(false);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Odjavi se
          </Button>
        </div>
      </aside >
    </>
  );
}
