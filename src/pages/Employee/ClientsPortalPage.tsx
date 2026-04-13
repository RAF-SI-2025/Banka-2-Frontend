import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BookUser,
  Inbox,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Loader2,
  ArrowRight,
  Mail,
  Phone,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { clientService } from '@/services/clientService';
import type { Client, PaginatedResponse } from '@/types';
import type { Account, ClientFilters } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { asArray, formatAmount, getErrorMessage } from '@/utils/formatters';

const PAGE_SIZE = 10;

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

const avatarColors = [
  'from-indigo-400 to-indigo-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
];

function getAvatarColor(id: number): string {
  return avatarColors[id % avatarColors.length];
}

type EditFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
};

const emptyEditForm: EditFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  dateOfBirth: '',
  gender: '',
};

function mapClientToEditForm(client: Client): EditFormState {
  return {
    firstName: client.firstName ?? '',
    lastName: client.lastName ?? '',
    email: client.email ?? '',
    phoneNumber: client.phoneNumber ?? '',
    address: client.address ?? '',
    dateOfBirth: client.dateOfBirth ?? '',
    gender: client.gender ?? '',
  };
}

export default function ClientsPortalPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<Client[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAccounts, setClientAccounts] = useState<Account[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<EditFormState & { password: string }>({ ...emptyEditForm, password: '' });
  const [creating, setCreating] = useState(false);

  const selectedClientId = useMemo(() => {
    const parsed = Number(id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [id]);

  const filters = useMemo<ClientFilters>(
    () => ({
      firstName: search || undefined,
      lastName: search || undefined,
      email: search || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [page, search]
  );

  const fillEditForm = (client: Client) => {
    setEditForm(mapClientToEditForm(client));
  };

  const resetDetailsState = () => {
    setSelectedClient(null);
    setClientAccounts([]);
    setIsEditing(false);
    setEditForm(emptyEditForm);
  };

  const loadClients = async () => {
    setListLoading(true);

    try {
      const response: PaginatedResponse<Client> = await clientService.getAll(filters);
      setClients(asArray<Client>(response.content));
      setTotalPages(Math.max(1, response.totalPages ?? 1));
    } catch (error) {
      setClients([]);
      setTotalPages(1);
      toast.error(getErrorMessage(error, 'Neuspesno ucitavanje klijenata.'));
    } finally {
      setListLoading(false);
    }
  };

  const loadClientAccounts = async (clientId: number) => {
    const raw = await accountService.getByClientId(clientId);
    return asArray<Account>(raw).map((a) => ({
      ...a,
      currency: a.currency || (a as unknown as Record<string, unknown>).currencyCode || 'RSD',
    })) as Account[];
  };

  const loadClientFromRoute = async (clientId: number) => {
    setDetailsLoading(true);

    try {
      const client = await clientService.getById(clientId);
      setSelectedClient(client);
      fillEditForm(client);
      setIsEditing(false);

      const accounts = await loadClientAccounts(client.id);
      setClientAccounts(accounts);
    } catch (error) {
      resetDetailsState();
      toast.error(getErrorMessage(error, 'Neuspesno ucitavanje klijenta iz rute.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenDetails = (clientId: number) => {
    navigate(`/employee/clients/${clientId}`);
  };

  const handleBackToList = () => {
    navigate('/employee/clients');
  };

  const handleEditFieldChange =
    (field: keyof EditFormState) => (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setEditForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleCreateClient = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      toast.error('Popunite obavezna polja (ime, prezime, email, lozinka).');
      return;
    }
    setCreating(true);
    try {
      await clientService.create({
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phoneNumber: createForm.phoneNumber || undefined,
        address: createForm.address || undefined,
        dateOfBirth: createForm.dateOfBirth || undefined,
        gender: createForm.gender || undefined,
        password: createForm.password,
      });
      toast.success('Klijent uspesno kreiran.');
      setShowCreateForm(false);
      setCreateForm({ ...emptyEditForm, password: '' });
      await loadClients();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Kreiranje klijenta nije uspelo.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFieldChange =
    (field: string) => (e: ChangeEvent<HTMLInputElement>) => {
      setCreateForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleStartEdit = () => {
    if (!selectedClient) return;
    fillEditForm(selectedClient);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedClient) return;
    fillEditForm(selectedClient);
    setIsEditing(false);
  };

  const saveClient = async () => {
    if (!selectedClient) return;

    setSaving(true);

    try {
      const updatedClient = await clientService.update(selectedClient.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        address: editForm.address,
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
      });

      setSelectedClient(updatedClient);
      fillEditForm(updatedClient);
      setIsEditing(false);
      toast.success('Klijent uspesno izmenjen.');

      await loadClients();
      const accounts = await loadClientAccounts(updatedClient.id);
      setClientAccounts(accounts);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Izmena klijenta nije uspela.'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!id) {
      resetDetailsState();
      return;
    }

    if (!selectedClientId) {
      resetDetailsState();
      toast.error('Neispravan ID klijenta.');
      return;
    }

    loadClientFromRoute(selectedClientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedClientId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <BookUser className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portal klijenata</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pretrazujte, pregledajte i uredujte podatke klijenata
            </p>
          </div>
        </div>
        {!showCreateForm && (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200 rounded-xl"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novi klijent
          </Button>
        )}
      </div>

      {/* Create new client */}
      {showCreateForm && (
        <Card className="rounded-2xl border-indigo-500/20 shadow-lg shadow-indigo-500/5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <UserPlus className="h-4 w-4 text-indigo-500" />
              <CardTitle>Novi klijent</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)} title="Zatvori" className="rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ime *</Label>
                <Input value={createForm.firstName} onChange={handleCreateFieldChange('firstName')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Prezime *</Label>
                <Input value={createForm.lastName} onChange={handleCreateFieldChange('lastName')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={createForm.email} onChange={handleCreateFieldChange('email')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Lozinka *</Label>
                <Input type="password" value={createForm.password} onChange={handleCreateFieldChange('password')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={createForm.phoneNumber} onChange={handleCreateFieldChange('phoneNumber')} placeholder="+381 60 1234567" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input value={createForm.address} onChange={handleCreateFieldChange('address')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Datum rodjenja</Label>
                <Input type="date" value={createForm.dateOfBirth} onChange={handleCreateFieldChange('dateOfBirth')} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Pol</Label>
                <Input value={createForm.gender} onChange={handleCreateFieldChange('gender')} placeholder="M / F" className="rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setShowCreateForm(false)} className="rounded-lg">
                Otkazi
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={creating}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all rounded-lg"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {creating ? 'Kreiranje...' : 'Kreiraj klijenta'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search - prominent centered */}
      <div className="flex justify-center">
        <div className={`relative w-full max-w-xl transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${searchFocused ? 'text-indigo-500' : 'text-muted-foreground'}`} />
          <Input
            placeholder="Pretrazite klijente po imenu, prezimenu ili email-u..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`pl-12 pr-4 py-6 text-base rounded-2xl border-2 transition-all duration-200 ${searchFocused ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'border-input'}`}
          />
        </div>
      </div>

      {/* Client cards grid */}
      {listLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-3 w-36 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nema klijenata za prikaz</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pokusajte sa drugim terminom pretrage.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, index) => (
            <div
              key={client.id}
              className="group rounded-2xl border bg-card p-5 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300"
              onClick={() => handleOpenDetails(client.id)}
              style={{ animation: `fadeUp 0.4s ease-out ${index * 0.05}s both` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(client.id)} text-white font-bold text-sm shadow-md`}>
                    {getInitials(client.firstName, client.lastName)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{client.firstName} {client.lastName}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{client.email}</span>
                    </div>
                    {client.phoneNumber && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{client.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Strana {page + 1} / {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0 || listLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={page >= totalPages - 1 || listLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Client details */}
      {selectedClient && (
        <Card className="rounded-2xl" style={{ animation: 'fadeUp 0.3s ease-out' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(selectedClient.id)} text-white font-bold text-sm`}>
                {getInitials(selectedClient.firstName, selectedClient.lastName)}
              </div>
              <div>
                <CardTitle>
                  {selectedClient.firstName} {selectedClient.lastName}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedClient.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleBackToList} title="Zatvori detalje" className="rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {detailsLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-16 rounded bg-muted/70 animate-pulse" />
                    <div className="h-10 w-full rounded-lg bg-muted/50 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-first-name">Ime</Label>
                <Input
                  id="client-first-name"
                  value={editForm.firstName}
                  onChange={handleEditFieldChange('firstName')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-last-name">Prezime</Label>
                <Input
                  id="client-last-name"
                  value={editForm.lastName}
                  onChange={handleEditFieldChange('lastName')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  value={editForm.email}
                  onChange={handleEditFieldChange('email')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefon</Label>
                <Input
                  id="client-phone"
                  value={editForm.phoneNumber}
                  onChange={handleEditFieldChange('phoneNumber')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-address">Adresa</Label>
                <Input
                  id="client-address"
                  value={editForm.address}
                  onChange={handleEditFieldChange('address')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-date-of-birth">Datum rodjenja</Label>
                <Input
                  id="client-date-of-birth"
                  value={editForm.dateOfBirth}
                  onChange={handleEditFieldChange('dateOfBirth')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-gender">Pol</Label>
                <Input
                  id="client-gender"
                  value={editForm.gender}
                  onChange={handleEditFieldChange('gender')}
                  disabled={!isEditing || saving}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t pt-4">
              {!isEditing ? (
                <Button variant="outline" onClick={handleStartEdit} disabled={detailsLoading} className="rounded-lg">
                  <Pencil className="mr-2 h-4 w-4" />
                  Izmeni
                </Button>
              ) : (
                <>
                  <Button
                    onClick={saveClient}
                    disabled={saving}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all rounded-lg"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Cuvanje...' : 'Sacuvaj'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="rounded-lg">
                    Otkazi
                  </Button>
                </>
              )}
            </div>

            {/* Client accounts */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Racuni klijenta
              </h3>

              {clientAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="mt-3 font-medium text-muted-foreground">Nema racuna za ovog klijenta</p>
                  <p className="text-sm text-muted-foreground mt-1">Klijent trenutno nema otvorene racune.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broj racuna</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Valuta</TableHead>
                      <TableHead>Stanje</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Akcija</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientAccounts.map((account) => (
                      <TableRow key={account.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono text-sm">{account.accountNumber}</TableCell>
                        <TableCell>
                          <Badge variant="info">{account.accountType}</Badge>
                        </TableCell>
                        <TableCell>{account.currency}</TableCell>
                        <TableCell className="font-semibold">{formatAmount(account.balance)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${
                              account.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : account.status === 'BLOCKED'
                                  ? 'bg-red-500'
                                  : 'bg-muted-foreground'
                            }`} />
                            <span className="text-xs">
                              {account.status === 'ACTIVE'
                                ? 'Aktivan'
                                : account.status === 'BLOCKED'
                                  ? 'Blokiran'
                                  : account.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                            onClick={() =>
                              navigate(
                                account.accountType === 'POSLOVNI'
                                  ? `/accounts/${account.id}/business`
                                  : `/accounts/${account.id}`
                              )
                            }
                          >
                            Otvori
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
