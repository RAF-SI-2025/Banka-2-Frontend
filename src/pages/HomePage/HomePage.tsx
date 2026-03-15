// TODO [FE2-01a] @Marta - Pocetna strana: Pregled racuna i poslednjih 5 transakcija
// TODO [FE2-01b] @Marta - Pocetna strana: Brzo placanje widget
// TODO [FE2-01c] @Marta - Pocetna strana: Kursna lista widget
//
// Ova stranica je glavna strana nakon logina. Prikazuje:
// 1. Listu korisnikovih racuna sa stanjem (accountService.getMyAccounts)
// 2. Poslednjih 5 transakcija (transactionService.getAll sa limit=5)
// 3. Brzo placanje widget (skracena forma za placanje, otvara NewPaymentPage)
// 4. Kursna lista widget (currencyService.getExchangeRates)

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import { Users, UserPlus, Building2, BookUser, ShieldCheck, FileText, TrendingUp } from 'lucide-react';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import { transactionService } from '@/services/transactionService';
import { employeeService } from '@/services/employeeService';
import type { Account, ExchangeRate, PaymentRecipient, Transaction } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('sr-RS');
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface AdminCard {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
}

const adminCards: AdminCard[] = [
  {
    title: 'Lista zaposlenih',
    description: 'Pregled i upravljanje zaposlenima.',
    path: '/admin/employees',
    icon: <Users className="h-7 w-7" />,
  },
  {
    title: 'Novi zaposleni',
    description: 'Kreiranje naloga za zaposlenog.',
    path: '/admin/employees/new',
    icon: <UserPlus className="h-7 w-7" />,
  },
  {
    title: 'Portal računa',
    description: 'Otvaranje i pregled klijentskih računa.',
    path: '/employee/accounts',
    icon: <Building2 className="h-7 w-7" />,
  },
  {
    title: 'Portal klijenata',
    description: 'Pregled klijenata i njihovih računa.',
    path: '/employee/clients',
    icon: <BookUser className="h-7 w-7" />,
  },
  {
    title: 'Zahtevi za kredit',
    description: 'Obrada klijentskih zahteva za kredit.',
    path: '/employee/loan-requests',
    icon: <ShieldCheck className="h-7 w-7" />,
  },
  {
    title: 'Svi krediti',
    description: 'Pregled svih aktivnih i završenih kredita.',
    path: '/employee/loans',
    icon: <FileText className="h-7 w-7" />,
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState({ total: 0, active: 0, loading: false });

  const [quickFrom, setQuickFrom] = useState('');
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [myAccounts, recentTransactions, savedRecipients, rates] = await Promise.all([
          accountService.getMyAccounts(),
          transactionService.getAll({ page: 0, limit: 5 }),
          paymentRecipientService.getAll(),
          currencyService.getExchangeRates(),
        ]);

        const safeAccounts = asArray<Account>(myAccounts);
        const txSource = (recentTransactions as { content?: unknown } | undefined)?.content ?? recentTransactions;
        const safeTransactions = asArray<Transaction>(txSource);
        const safeRecipients = asArray<PaymentRecipient>(savedRecipients);
        const safeRates = asArray<ExchangeRate>(rates);

        setAccounts(safeAccounts);
        setTransactions(safeTransactions);
        setRecipients(safeRecipients);
        setExchangeRates(safeRates.slice(0, 8));

        if (safeAccounts.length > 0) {
          setQuickFrom(safeAccounts[0].accountNumber ?? '');
        }
      } catch {
        toast.error('Neuspešno učitavanje početnih podataka.');
        setAccounts([]);
        setTransactions([]);
        setRecipients([]);
        setExchangeRates([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const loadAdminStats = async () => {
      setAdminStats((prev) => ({ ...prev, loading: true }));
      try {
        const response = await employeeService.getAll({ limit: 100 });
        const allEmployees = Array.isArray(response?.content) ? response.content : [];
        const activeEmployees = allEmployees.filter((emp) => emp?.isActive).length;
        setAdminStats({
          total: Number(response?.totalElements) || allEmployees.length,
          active: activeEmployees,
          loading: false,
        });
      } catch {
        setAdminStats((prev) => ({ ...prev, loading: false }));
      }
    };

    loadAdminStats();
  }, [isAdmin]);

  const goToQuickPayment = () => {
    if (!quickFrom || !quickRecipient || !quickAmount) {
      toast.error('Popunite sva polja za brzo plaćanje.');
      return;
    }

    const selectedRecipient = recipients.find((r) => String(r.id) === quickRecipient);
    if (!selectedRecipient) {
      toast.error('Izaberite primaoca.');
      return;
    }

    navigate(
      `/payments/new?from=${encodeURIComponent(quickFrom)}&to=${encodeURIComponent(selectedRecipient.accountNumber)}&recipient=${encodeURIComponent(selectedRecipient.name)}&amount=${encodeURIComponent(quickAmount)}`
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Dobrodošli{user?.firstName ? `, ${user.firstName}` : ''}</h1>

      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Banka 2025" className="h-7 w-7" />
            <h2 className="text-xl font-semibold">Admin pregled</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ukupno zaposlenih</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.loading ? '-' : adminStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aktivnih zaposlenih</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{adminStats.loading ? '-' : adminStats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Neaktivnih zaposlenih</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {adminStats.loading ? '-' : Math.max(adminStats.total - adminStats.active, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-7 w-7" />
              Brze admin akcije
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminCards.map((card) => (
                <Card
                  key={card.path}
                  className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                  onClick={() => navigate(card.path)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-primary">{card.icon}</span>
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{card.description}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">Moji računi</h2>
        {loading ? (
          <p className="text-muted-foreground">Učitavanje računa...</p>
        ) : accounts.length === 0 ? (
          <p className="text-muted-foreground">Nemate otvorenih računa.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="cursor-pointer" onClick={() => navigate(`/accounts/${account.id}`)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{account.name || `${account.accountType} račun`}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>{account.accountNumber}</p>
                  <p>Tip: <span className="font-medium">{account.accountType}</span></p>
                  <p>Stanje: <span className="font-medium">{formatAmount(account.balance)} {account.currency}</span></p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Poslednje transakcije</h2>
          <Button variant="outline" onClick={() => navigate('/payments/history')}>Vidi sve</Button>
        </div>
        {loading ? (
          <p className="text-muted-foreground">Učitavanje transakcija...</p>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground">Nema nedavnih transakcija.</p>
        ) : (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Datum</th>
                    <th className="text-left py-2">Primalac</th>
                    <th className="text-left py-2">Iznos</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b">
                      <td className="py-2">{formatDateTime(tx.createdAt)}</td>
                      <td className="py-2">{tx.recipientName}</td>
                      <td className="py-2">{formatAmount(tx.amount)} {tx.currency}</td>
                      <td className="py-2">{tx.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Brzo plaćanje</h2>
        <Card>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="quickFrom">Račun</Label>
              <select
                id="quickFrom"
                title="Račun"
                value={quickFrom}
                onChange={(e) => setQuickFrom(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Izaberite račun</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber}>{account.accountNumber}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quickRecipient">Primalac</Label>
              <select
                id="quickRecipient"
                title="Primalac"
                value={quickRecipient}
                onChange={(e) => setQuickRecipient(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Izaberite primaoca</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quickAmount">Iznos</Label>
              <Input id="quickAmount" type="number" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button onClick={goToQuickPayment}>Plati</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Kursna lista</h2>
          <Button variant="outline" onClick={() => navigate('/exchange')}>Menjačnica</Button>
        </div>
        {loading ? (
          <p className="text-muted-foreground">Učitavanje kurseva...</p>
        ) : exchangeRates.length === 0 ? (
          <p className="text-muted-foreground">Kursna lista nije dostupna.</p>
        ) : (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Valuta</th>
                    <th className="text-left py-2">Kupovni</th>
                    <th className="text-left py-2">Prodajni</th>
                    <th className="text-left py-2">Srednji</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangeRates.map((rate) => (
                    <tr key={rate.currency} className="border-b">
                      <td className="py-2">{rate.currency}</td>
                      <td className="py-2">{formatAmount(rate.buyRate, 4)}</td>
                      <td className="py-2">{formatAmount(rate.sellRate, 4)}</td>
                      <td className="py-2">{formatAmount(rate.middleRate, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

