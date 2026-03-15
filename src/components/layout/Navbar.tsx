import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Users, LogOut, User, Sun, Moon, Monitor,
  Wallet, CreditCard, ArrowLeftRight, RefreshCw, Receipt, BookUser,
  Building2, ShieldCheck, FileText, History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Početna',
    path: '/home',
    icon: <Home className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Računi',
    path: '/accounts',
    icon: <Wallet className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Plaćanja',
    path: '/payments/new',
    icon: <Receipt className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Primaoci',
    path: '/payments/recipients',
    icon: <BookUser className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Prenosi',
    path: '/transfers',
    icon: <ArrowLeftRight className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Istorija',
    path: '/payments/history',
    icon: <History className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Menjačnica',
    path: '/exchange',
    icon: <RefreshCw className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Kartice',
    path: '/cards',
    icon: <CreditCard className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Krediti',
    path: '/loans',
    icon: <FileText className="mr-2 h-4 w-4" />,
  },
  {
    label: 'Zaposleni',
    path: '/admin/employees',
    icon: <Users className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Portal računa',
    path: '/employee/accounts',
    icon: <Building2 className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Portal kartica',
    path: '/employee/cards',
    icon: <CreditCard className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Portal klijenata',
    path: '/employee/clients',
    icon: <BookUser className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Zahtevi',
    path: '/employee/loan-requests',
    icon: <ShieldCheck className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Svi krediti',
    path: '/employee/loans',
    icon: <FileText className="mr-2 h-4 w-4" />,
    adminOnly: true,
  },
];

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary text-primary-foreground">
      <div className="flex h-14 w-full items-center gap-3 px-4 lg:px-6">
        <div
          className="mr-2 flex shrink-0 cursor-pointer items-center gap-2 font-bold"
          onClick={() => navigate('/home')}
        >
          <img src="/logo.svg" alt="Banka 2025" className="h-9 w-9" />
          <span className="text-lg">BANKA 2025 <span className="opacity-50">•</span> TIM 2</span>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
          {visibleItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              className={cn(
                'shrink-0 px-3 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                isActive(item.path) &&
                  'bg-primary-foreground/15 text-primary-foreground'
              )}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 hover:bg-primary-foreground/10"
          onClick={() => {
            const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
            setTheme(next);
          }}
          title={`Tema: ${theme === 'light' ? 'Svetla' : theme === 'dark' ? 'Tamna' : 'Sistemska'}`}
        >
          {theme === 'light' && <Sun className="h-4 w-4" />}
          {theme === 'dark' && <Moon className="h-4 w-4" />}
          {theme === 'system' && <Monitor className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-primary-foreground/10"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Odjavi se</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
