import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Users,
  Calculator,
  ShoppingCart,
  TrendingUp,
  Globe,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import orderService from '@/services/orderService';
import actuaryService from '@/services/actuaryService';
import listingService from '@/services/listingService';
import taxService from '@/services/taxService';

import type { Order, ActuaryInfo } from '@/types/celina3';

/* ---------- helpers ---------- */

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('sr-RS');
}

function formatAmount(value: number): string {
  return value.toLocaleString('sr-RS', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusBadgeVariant(
  status: string
): 'warning' | 'info' | 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'info';
    case 'DONE':
      return 'success';
    case 'DECLINED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/* ---------- skeleton ---------- */

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="relative overflow-hidden">
          <CardHeader className="pb-1">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((__, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- component ---------- */

export default function SupervisorDashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // Stat values ("-" on error)
  const [pendingOrders, setPendingOrders] = useState<string>('-');
  const [activeAgents, setActiveAgents] = useState<string>('-');
  const [dailyVolume, setDailyVolume] = useState<string>('-');
  const [unpaidTax, setUnpaidTax] = useState<string>('-');

  // Data
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [agentsNearLimit, setAgentsNearLimit] = useState<ActuaryInfo[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const results = await Promise.allSettled([
        // 0: Pending orders
        orderService.getAll('PENDING', 0, 1).then((res) => {
          setPendingOrders(String(res.totalElements ?? res.content.length));
        }),

        // 1: Agents
        actuaryService.getAgents().then((agents) => {
          setActiveAgents(String(agents.length));
          setAgentsNearLimit(
            agents.filter((a) => a.dailyLimit > 0 && a.usedLimit / a.dailyLimit > 0.8)
          );
        }),

        // 2: Volume
        listingService.getAll('STOCK', '', 0, 100).then((res) => {
          const total = res.content.reduce((sum, l) => sum + (l.volume ?? 0), 0);
          setDailyVolume(formatVolume(total));
        }),

        // 3: Tax
        taxService.getTaxRecords().then((records) => {
          const total = records.reduce((sum, r) => sum + ((r.taxOwed ?? 0) - (r.taxPaid ?? 0)), 0);
          setUnpaidTax(`${formatAmount(Math.max(0, total))} RSD`);
        }),

        // 4: Recent orders (top 10)
        orderService.getAll('ALL', 0, 10).then((res) => {
          setRecentOrders(res.content);
        }),
      ]);

      // Mark failed fetches with "-"
      if (results[0].status === 'rejected') setPendingOrders('-');
      if (results[1].status === 'rejected') {
        setActiveAgents('-');
        setAgentsNearLimit([]);
      }
      if (results[2].status === 'rejected') setDailyVolume('-');
      if (results[3].status === 'rejected') setUnpaidTax('-');
      if (results[4].status === 'rejected') setRecentOrders([]);

      setLoading(false);
    };

    load();
  }, []);

  /* --- stat card definitions --- */
  const statCards = [
    {
      label: 'Pending orderi',
      value: pendingOrders,
      color: 'amber',
      Icon: ClipboardList,
    },
    {
      label: 'Aktivni agenti',
      value: activeAgents,
      color: 'emerald',
      Icon: Users,
    },
    {
      label: 'Današnji volume',
      value: dailyVolume,
      color: 'indigo',
      Icon: BarChart3,
    },
    {
      label: 'Neplaćen porez',
      value: unpaidTax,
      color: 'rose',
      Icon: Calculator,
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      gradient: 'from-amber-500/10',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      gradient: 'from-emerald-500/10',
    },
    indigo: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-500',
      gradient: 'from-indigo-500/10',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-500',
      gradient: 'from-rose-500/10',
    },
  };

  /* --- quick links --- */
  const quickLinks = [
    { label: 'Orderi', route: '/employee/orders', Icon: ShoppingCart },
    { label: 'Aktuari', route: '/employee/actuaries', Icon: TrendingUp },
    { label: 'Porez', route: '/employee/tax', Icon: Calculator },
    { label: 'Berze', route: '/employee/exchanges', Icon: Globe },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Pregled aktivnosti i statistika sistema
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {statCards.map((card) => {
            const colors = colorMap[card.color];
            return (
              <Card key={card.label} className="relative overflow-hidden">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} to-transparent`}
                />
                <CardHeader className="relative flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-sm text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.bg}`}
                  >
                    <card.Icon className={`h-4 w-4 ${colors.text}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Orders */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              Poslednjih 10 ordera
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/employee/orders')}
              className="text-muted-foreground hover:text-foreground"
            >
              Svi orderi
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Nema ordera</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orderi ce se pojaviti ovde kada budu kreirani.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Smer</TableHead>
                    <TableHead>Kolicina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {order.listingTicker}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.direction === 'BUY' ? 'success' : 'destructive'
                          }
                        >
                          {order.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{order.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agents Near Limit */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              Agenti blizu limita (&gt;80%)
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/employee/actuaries')}
              className="text-muted-foreground hover:text-foreground"
            >
              Svi agenti
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {agentsNearLimit.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Nema agenata blizu limita</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Svi agenti su u okviru bezbednih granica.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentsNearLimit.map((agent) => {
                  const percent =
                    agent.dailyLimit > 0
                      ? Math.round((agent.usedLimit / agent.dailyLimit) * 100)
                      : 0;

                  let progressColor = 'bg-emerald-500';
                  if (percent > 90) progressColor = 'bg-red-500';
                  else if (percent > 80) progressColor = 'bg-amber-500';

                  return (
                    <div key={agent.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{agent.employeeName}</span>
                        <span className="text-muted-foreground">
                          {percent}% &mdash; limit: {formatAmount(agent.dailyLimit)} RSD
                        </span>
                      </div>
                      <Progress
                        value={percent}
                        indicatorClassName={progressColor}
                        className="h-2.5"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Brze akcije</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {quickLinks.map((link) => (
            <Card
              key={link.label}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(link.route)}
            >
              <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <link.Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{link.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
