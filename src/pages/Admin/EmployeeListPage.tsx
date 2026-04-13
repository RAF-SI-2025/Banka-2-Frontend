import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil,
  Search,
  UserPlus,
  SlidersHorizontal,
  Users,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { Employee, EmployeeFilters } from '../../types';
import { Permission } from '../../types';
import { employeeService } from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

const avatarColors = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-teal-500',
];

function getAvatarColor(id: number): string {
  return avatarColors[id % avatarColors.length];
}

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<EmployeeFilters>({
    email: '',
    firstName: '',
    lastName: '',
    position: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const activeFilters: EmployeeFilters = { page, limit: rowsPerPage };
      if (filters.email) activeFilters.email = filters.email;
      if (filters.firstName) activeFilters.firstName = filters.firstName;
      if (filters.lastName) activeFilters.lastName = filters.lastName;
      if (filters.position) activeFilters.position = filters.position;

      const data = await employeeService.getAll(activeFilters);
      setEmployees(data.content);
      setTotalElements(data.totalElements);
    } catch {
      setError('Greska pri ucitavanju zaposlenih. Pokusajte ponovo.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage]);

  useEffect(() => {
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [fetchEmployees]);

  useEffect(() => {
    setPage(0);
  }, [filters.email, filters.firstName, filters.lastName, filters.position]);

  const isAdmin = (employee: Employee) =>
    employee.permissions.includes(Permission.ADMIN);

  const canEdit = (employee: Employee) => {
    return !isAdmin(employee);
  };

  const handleRowClick = (employee: Employee) => {
    if (canEdit(employee)) {
      navigate(`/admin/employees/${employee.id}`);
    }
  };

  const totalPages = Math.ceil(totalElements / rowsPerPage);
  const from = page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);

  const activeCount = employees.filter(e => e.isActive).length;
  const inactiveCount = employees.filter(e => !e.isActive).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Upravljanje zaposlenima</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pregled, pretraga i upravljanje nalozima zaposlenih
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filteri"
            className="rounded-xl"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200 rounded-xl"
            onClick={() => navigate('/admin/employees/new')}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novi zaposleni
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalElements}</p>
            <p className="text-xs text-muted-foreground">Ukupno</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Aktivni</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{inactiveCount}</p>
            <p className="text-xs text-muted-foreground">Neaktivni</p>
          </div>
        </div>
      </div>

      {/* Filter card */}
      {showFilters && (
        <Card className="p-5 rounded-2xl animate-fade-up">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filteri pretrage</h3>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraga po email-u"
                value={filters.email}
                onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                className="pl-9 w-[220px] rounded-lg"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraga po imenu"
                value={filters.firstName}
                onChange={(e) => setFilters({ ...filters, firstName: e.target.value })}
                className="pl-9 w-[220px] rounded-lg"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraga po prezimenu"
                value={filters.lastName}
                onChange={(e) => setFilters({ ...filters, lastName: e.target.value })}
                className="pl-9 w-[220px] rounded-lg"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraga po poziciji"
                value={filters.position}
                onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                className="pl-9 w-[220px] rounded-lg"
              />
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {loading ? (
        <Card className="overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Ime i prezime</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pozicija</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead className="text-center w-16">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-9 w-9 rounded-full bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-40 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-28 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-4 rounded-full bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell className="text-center"><div className="mx-auto h-8 w-8 rounded-lg bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Ime i prezime</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pozicija</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead className="text-center w-16">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-auto p-0">
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">Nema pronadjenih zaposlenih</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pokusajte da promenite filtere pretrage ili dodajte novog zaposlenog.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className={cn(
                      'transition-all duration-200',
                      canEdit(emp)
                        ? 'cursor-pointer hover:bg-primary/5 hover:shadow-sm hover:-translate-y-[1px]'
                        : 'hover:bg-muted/50',
                      emp.id === user?.id ? 'opacity-60' : ''
                    )}
                    onClick={() => handleRowClick(emp)}
                  >
                    {/* Avatar */}
                    <TableCell>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold ${getAvatarColor(emp.id)}`}>
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.phoneNumber}</TableCell>
                    {/* Status dot */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${emp.isActive ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500 shadow-sm shadow-red-500/50'}`} />
                        <span className="text-xs text-muted-foreground">{emp.isActive ? 'Aktivan' : 'Neaktivan'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin(emp) ? (
                        <Badge variant="warning" className="text-[11px]">Admin</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px]">Zaposleni</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {canEdit(emp) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-600 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/employees/${emp.id}`);
                          }}
                          title="Izmeni zaposlenog"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Redova po stranici:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[70px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {totalElements > 0
                  ? `${from}-${to} od ${totalElements}`
                  : '0 rezultata'}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
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
