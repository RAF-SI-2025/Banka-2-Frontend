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

const PAGE_SIZE = 10;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function getErrorMessage(defaultMessage: string, error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null &&
    'status' in ((error as { response?: { status?: unknown } }).response ?? {})
  ) {
    const status = (error as { response?: { status?: number } }).response?.status;

    if (status === 403) {
      return 'Nemate dozvolu za pristup ovoj funkcionalnosti.';
    }

    if (status === 404) {
      return 'Trazeni resurs nije pronadjen.';
    }
  }

  return defaultMessage;
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
      toast.error(getErrorMessage('Neuspesno ucitavanje klijenata.', error));
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
      toast.error(getErrorMessage('Neuspesno ucitavanje klijenta iz rute.', error));
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
      toast.success('Klijent uspešno kreiran.');
      setShowCreateForm(false);
      setCreateForm({ ...emptyEditForm, password: '' });
      await loadClients();
    } catch (error) {
      toast.error(getErrorMessage('Kreiranje klijenta nije uspelo.', error));
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
      toast.error(getErrorMessage('Izmena klijenta nije uspela.', error));
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
        <div>
          <div className="flex items-center gap-2">
            <BookUser className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Portal klijenata</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pretrazujte, pregledajte i uredujte podatke klijenata.
          </p>
        </div>
        {!showCreateForm && (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novi klijent
          </Button>
        )}
      </div>

      {/* Create new client */}
      {showCreateForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <UserPlus className="h-4 w-4 text-indigo-500" />
              <CardTitle>Novi klijent</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)} title="Zatvori">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ime *</Label>
                <Input value={createForm.firstName} onChange={handleCreateFieldChange('firstName')} />
              </div>
              <div className="space-y-2">
                <Label>Prezime *</Label>
                <Input value={createForm.lastName} onChange={handleCreateFieldChange('lastName')} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={createForm.email} onChange={handleCreateFieldChange('email')} />
              </div>
              <div className="space-y-2">
                <Label>Lozinka *</Label>
                <Input type="password" value={createForm.password} onChange={handleCreateFieldChange('password')} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={createForm.phoneNumber} onChange={handleCreateFieldChange('phoneNumber')} placeholder="+381 60 1234567" />
              </div>
              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input value={createForm.address} onChange={handleCreateFieldChange('address')} />
              </div>
              <div className="space-y-2">
                <Label>Datum rodjenja</Label>
                <Input type="date" value={createForm.dateOfBirth} onChange={handleCreateFieldChange('dateOfBirth')} />
              </div>
              <div className="space-y-2">
                <Label>Pol</Label>
                <Input value={createForm.gender} onChange={handleCreateFieldChange('gender')} placeholder="M / F" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Otkazi
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={creating}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
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

      {/* Client list */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <Search className="h-4 w-4 text-indigo-500" />
            <CardTitle>Pretraga i lista klijenata</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraga po imenu, prezimenu ili email-u"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {listLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime i prezime</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-center">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-40 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell className="text-center"><div className="mx-auto h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime i prezime</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-center">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-auto p-0">
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">Nema klijenata za prikaz</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Pokusajte sa drugim terminom pretrage.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => handleOpenDetails(client.id)}
                    >
                      <TableCell className="font-medium">
                        {client.firstName} {client.lastName}
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phoneNumber || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(client.id);
                          }}
                        >
                          Detalji
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">
              Strana {page + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || listLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1 || listLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client details */}
      {selectedClient && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <BookUser className="h-4 w-4 text-indigo-500" />
              <CardTitle>
                Detalji klijenta: {selectedClient.firstName} {selectedClient.lastName}
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleBackToList} title="Zatvori detalje">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {detailsLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-16 rounded bg-muted/70 animate-pulse" />
                    <div className="h-10 w-full rounded-md bg-muted/50 animate-pulse" />
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-last-name">Prezime</Label>
                <Input
                  id="client-last-name"
                  value={editForm.lastName}
                  onChange={handleEditFieldChange('lastName')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  value={editForm.email}
                  onChange={handleEditFieldChange('email')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefon</Label>
                <Input
                  id="client-phone"
                  value={editForm.phoneNumber}
                  onChange={handleEditFieldChange('phoneNumber')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-address">Adresa</Label>
                <Input
                  id="client-address"
                  value={editForm.address}
                  onChange={handleEditFieldChange('address')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-date-of-birth">Datum rodjenja</Label>
                <Input
                  id="client-date-of-birth"
                  value={editForm.dateOfBirth}
                  onChange={handleEditFieldChange('dateOfBirth')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-gender">Pol</Label>
                <Input
                  id="client-gender"
                  value={editForm.gender}
                  onChange={handleEditFieldChange('gender')}
                  disabled={!isEditing || saving}
                />
              </div>
            </div>

            <div className="flex gap-3 border-t pt-4">
              {!isEditing ? (
                <Button variant="outline" onClick={handleStartEdit} disabled={detailsLoading}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Izmeni
                </Button>
              ) : (
                <>
                  <Button
                    onClick={saveClient}
                    disabled={saving}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Cuvanje...' : 'Sacuvaj'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                    Otkazi
                  </Button>
                </>
              )}
            </div>

            {/* Client accounts */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
                        <TableCell className="font-medium">{formatAmount(account.balance)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              account.status === 'ACTIVE'
                                ? 'success'
                                : account.status === 'BLOCKED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {account.status === 'ACTIVE'
                              ? 'Aktivan'
                              : account.status === 'BLOCKED'
                                ? 'Blokiran'
                                : account.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
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
    </div>
  );
}
