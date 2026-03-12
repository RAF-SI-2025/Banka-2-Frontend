import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Landmark, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { employeeService } from '../../services/employeeService';

interface DashboardCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  adminOnly?: boolean;
}

const adminCards: DashboardCard[] = [
  {
    title: 'Lista zaposlenih',
    description: 'Pregledajte, pretražite i upravljajte zaposlenima.',
    icon: <Users className="h-10 w-10" />,
    path: '/admin/employees',
    adminOnly: true,
  },
  {
    title: 'Novi zaposleni',
    description: 'Kreirajte nalog za novog zaposlenog.',
    icon: <UserPlus className="h-10 w-10" />,
    path: '/admin/employees/new',
    adminOnly: true,
  },
];

const userCards: DashboardCard[] = [];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, loading: true });

  useEffect(() => {
    if (!isAdmin) {
      setStats((prev) => ({ ...prev, loading: false }));
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await employeeService.getAll({ limit: 100 });
        const active = response.content.filter((emp) => emp.isActive).length;
        setStats({
          total: response.totalElements || 0,
          active,
          loading: false,
        });
      } catch (error) {
        console.error('Greška pri učitavanju statistike:', error);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [isAdmin]);

  const visibleCards = [
    ...(isAdmin ? adminCards : userCards),
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="text-center mb-8 space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Landmark className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dobrodošli, {user?.firstName}!
        </h1>
        <p className="text-muted-foreground">
          Banka 2025 — Interni portal
        </p>
      </div>

      {/* Statistics Section — samo za admine */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ukupno zaposlenih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.loading ? '-' : stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">u sistemu</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aktivnih zaposlenih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.loading ? '-' : stats.active}</div>
              <p className="text-xs text-muted-foreground mt-1">trenutno aktivnih</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Neaktivnih zaposlenih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.loading ? '-' : stats.total - stats.active}
              </div>
              <p className="text-xs text-muted-foreground mt-1">deaktivovanih</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Cards Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Brze akcije
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => (
            <Card
              key={card.path}
              className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              onClick={() => navigate(card.path)}
              data-testid={`dashboard-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto text-primary mb-2">{card.icon}</div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
