// FE2-14a: Employee portal - pregled svih racuna sa filterima

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  CreditCard,
  Search,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import type { Account, AccountStatus, AccountType } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
};

const accountTypeBadgeVariant: Record<string, 'info' | 'success' | 'warning'> = {
  TEKUCI: 'info',
  DEVIZNI: 'success',
  POSLOVNI: 'warning',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktivan',
  BLOCKED: 'Blokiran',
  INACTIVE: 'Neaktivan',
};

const statusVariant: Record<string, 'success' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
  INACTIVE: 'secondary',
};

function formatBalance(amount: number, currency: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

export default function AccountsPortalPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [accountType, setAccountType] = useState<AccountType | undefined>(undefined);
  const [status, setStatus] = useState<AccountStatus | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await accountService.getAll({
        ownerEmail: ownerEmail || undefined,
        accountType,
        status,
        page,
        limit: rowsPerPage,
      });
      setAccounts(Array.isArray(response.content) ? response.content : []);
      setTotalElements(response.totalElements ?? 0);
      setTotalPages(response.totalPages ?? 0);
    } catch {
      setError('Greska pri ucitavanju racuna.');
      setAccounts([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [ownerEmail, accountType, status, page, rowsPerPage]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setPage(0);
  }, [ownerEmail, accountType, status]);

  const changeStatus = async (accountId: number, nextStatus: AccountStatus) => {
    try {
      await accountService.changeStatus(accountId, nextStatus);
      toast.success('Status racuna je azuriran.');
      await loadAccounts();
    } catch {
      toast.error('Promena statusa nije uspela.');
    }
  };

  const from = totalElements > 0 ? page * rowsPerPage + 1 : 0;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Portal racuna</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filteri"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/employee/accounts/new')}>
            <Plus className="mr-2 h-4 w-4" /> Kreiraj racun
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email vlasnika</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretrazi po emailu..."
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tip racuna</label>
              <Select
                value={accountType ?? 'ALL'}
                onValueChange={(val) => setAccountType(val === 'ALL' ? undefined : val as AccountType)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Svi tipovi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi tipovi</SelectItem>
                  <SelectItem value="TEKUCI">Tekuci</SelectItem>
                  <SelectItem value="DEVIZNI">Devizni</SelectItem>
                  <SelectItem value="POSLOVNI">Poslovni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={status ?? 'ALL'}
                onValueChange={(val) => setStatus(val === 'ALL' ? undefined : val as AccountStatus)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi statusi</SelectItem>
                  <SelectItem value="ACTIVE">Aktivan</SelectItem>
                  <SelectItem value="BLOCKED">Blokiran</SelectItem>
                  <SelectItem value="INACTIVE">Neaktivan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Accounts table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vlasnik</TableHead>
                <TableHead>Broj racuna</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Stanje</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nema pronadjenih racuna
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.ownerName}</TableCell>
                    <TableCell className="font-medium">
                      {formatAccountNumber(account.accountNumber)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={accountTypeBadgeVariant[account.accountType]}>
                        {accountTypeLabels[account.accountType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatBalance(account.availableBalance, account.currency)}
                    </TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[account.status]}>
                        {statusLabels[account.status] || account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {account.status === 'ACTIVE' && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(account.id, 'BLOCKED')}>
                            Blokiraj
                          </Button>
                        )}
                        {account.status === 'BLOCKED' && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(account.id, 'ACTIVE')}>
                            Aktiviraj
                          </Button>
                        )}
                        {account.status !== 'INACTIVE' && (
                          <Button size="sm" variant="destructive" onClick={() => changeStatus(account.id, 'INACTIVE')}>
                            Deaktiviraj
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/employee/accounts/${account.id}/cards`)}
                          title="Kartice"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(
                            account.accountType === 'POSLOVNI'
                              ? `/accounts/${account.id}/business`
                              : `/accounts/${account.id}`
                          )}
                        >
                          Detalji
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              {totalElements > 0
                ? `${from}–${to} od ${totalElements}`
                : '0 rezultata'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Strana {page + 1} / {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
