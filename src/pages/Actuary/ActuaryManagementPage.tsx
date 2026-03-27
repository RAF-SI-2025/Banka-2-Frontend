import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, RefreshCw, Scale, Search, SlidersHorizontal, Users } from 'lucide-react';
import actuaryService from '@/services/actuaryService';
import type { ActuaryInfo } from '@/types/celina3';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type FilterState = {
  email: string;
  firstName: string;
  lastName: string;
};

const DEFAULT_FILTERS: FilterState = {
  email: '',
  firstName: '',
  lastName: '',
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { firstName: '-', lastName: '-' };
  }

  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: '-' };
  }

  return {
    firstName: tokens.slice(0, -1).join(' '),
    lastName: tokens[tokens.length - 1],
  };
}

function usagePercent(usedLimit: number, dailyLimit: number): number {
  if (dailyLimit <= 0) {
    return 0;
  }
  const value = (usedLimit / dailyLimit) * 100;
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export default function ActuaryManagementPage() {
  const [agents, setAgents] = useState<ActuaryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [editingAgent, setEditingAgent] = useState<ActuaryInfo | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editNeedApproval, setEditNeedApproval] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingAgentId, setResettingAgentId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await actuaryService.getAgents(
        debouncedFilters.email || undefined,
        debouncedFilters.firstName || undefined,
        debouncedFilters.lastName || undefined
      );
      setAgents(data);
    } catch {
      setError('Greska pri ucitavanju aktuarnih podataka. Pokusajte ponovo.');
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters.email, debouncedFilters.firstName, debouncedFilters.lastName]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const openEditDialog = (agent: ActuaryInfo) => {
    setEditingAgent(agent);
    setEditDailyLimit(String(agent.dailyLimit));
    setEditNeedApproval(agent.needApproval);
  };

  const closeEditDialog = () => {
    if (savingEdit) {
      return;
    }
    setEditingAgent(null);
    setEditDailyLimit('');
    setEditNeedApproval(false);
  };

  const handleSaveEdit = async () => {
    if (!editingAgent) {
      return;
    }

    const parsedDailyLimit = Number(editDailyLimit);
    if (!Number.isFinite(parsedDailyLimit) || parsedDailyLimit < 0) {
      toast.error('Dnevni limit mora biti nenegativan broj.');
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await actuaryService.updateLimit(editingAgent.employeeId, {
        dailyLimit: parsedDailyLimit,
        needApproval: editNeedApproval,
      });

      setAgents((current) =>
        current.map((agent) => (agent.employeeId === updated.employeeId ? updated : agent))
      );
      toast.success('Limit je uspesno azuriran.');
      closeEditDialog();
    } catch {
      toast.error('Azuriranje limita nije uspelo.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetLimit = async (agent: ActuaryInfo) => {
    const confirmed = window.confirm(
      `Da li ste sigurni da zelite da resetujete iskoriscen limit za ${agent.employeeName}?`
    );

    if (!confirmed) {
      return;
    }

    setResettingAgentId(agent.employeeId);
    try {
      const updated = await actuaryService.resetLimit(agent.employeeId);
      setAgents((current) =>
        current.map((item) => (item.employeeId === updated.employeeId ? updated : item))
      );
      toast.success('Limit je uspesno resetovan.');
    } catch {
      toast.error('Reset limita nije uspeo.');
    } finally {
      setResettingAgentId(null);
    }
  };

  const mappedAgents = useMemo(
    () =>
      agents.map((agent) => {
        const names = splitName(agent.employeeName);
        return {
          ...agent,
          firstName: names.firstName,
          lastName: names.lastName,
          usage: usagePercent(agent.usedLimit, agent.dailyLimit),
        };
      }),
    [agents]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Upravljanje aktuarima</h1>
            <p className="text-sm text-muted-foreground">
              Pregled agenata, filteri i kontrola dnevnih limita
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters((current) => !current)}
            title="Filteri"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => void loadAgents()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Osvezi
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Filteri pretrage</h3>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraga po email-u"
                value={filters.email}
                onChange={(e) => setFilters((current) => ({ ...current, email: e.target.value }))}
                className="w-[230px] pl-9"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraga po imenu"
                value={filters.firstName}
                onChange={(e) => setFilters((current) => ({ ...current, firstName: e.target.value }))}
                className="w-[230px] pl-9"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraga po prezimenu"
                value={filters.lastName}
                onChange={(e) => setFilters((current) => ({ ...current, lastName: e.target.value }))}
                className="w-[230px] pl-9"
              />
            </div>
            <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Ocisti filtere
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime</TableHead>
              <TableHead>Prezime</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pozicija</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Iskorisceno</TableHead>
              <TableHead>Need Approval</TableHead>
              <TableHead className="text-center">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: 8 }).map((__, colIndex) => (
                    <TableCell key={`skeleton-col-${colIndex}`}>
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : mappedAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-auto p-0">
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">Nema pronadjenih agenata</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pokusajte da promenite filtere ili osvezite prikaz.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              mappedAgents.map((agent) => (
                <TableRow key={agent.employeeId}>
                  <TableCell className="font-medium">{agent.firstName}</TableCell>
                  <TableCell>{agent.lastName}</TableCell>
                  <TableCell>{agent.employeeEmail}</TableCell>
                  <TableCell>
                    <Badge variant={agent.actuaryType === 'SUPERVISOR' ? 'info' : 'outline'}>
                      {agent.actuaryType === 'SUPERVISOR' ? 'Supervizor' : 'Agent'}
                    </Badge>
                  </TableCell>
                  <TableCell>{agent.dailyLimit.toLocaleString('sr-RS')} RSD</TableCell>
                  <TableCell className="min-w-[230px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {agent.usedLimit.toLocaleString('sr-RS')} / {agent.dailyLimit.toLocaleString('sr-RS')}
                        </span>
                        <span>{Math.round(agent.usage)}%</span>
                      </div>
                      <Progress
                        value={agent.usage}
                        className="h-2"
                        indicatorClassName={
                          agent.usage >= 90
                            ? 'bg-red-500'
                            : agent.usage >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.needApproval ? 'warning' : 'success'}>
                      {agent.needApproval ? 'Da' : 'Ne'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(agent)}
                        title="Izmeni limit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleResetLimit(agent)}
                        disabled={resettingAgentId === agent.employeeId}
                      >
                        Resetuj limit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md space-y-4 p-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Scale className="h-5 w-5 text-primary" />
                Izmena limita
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {editingAgent.employeeName} ({editingAgent.employeeEmail})
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Novi dnevni limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                min={0}
                value={editDailyLimit}
                onChange={(e) => setEditDailyLimit(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                id="needApproval"
                checked={editNeedApproval}
                onCheckedChange={(checked) => setEditNeedApproval(Boolean(checked))}
              />
              <Label htmlFor="needApproval" className="cursor-pointer">
                Potrebno odobrenje supervizora
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEditDialog} disabled={savingEdit}>
                Otkazi
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
                Sacuvaj
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
