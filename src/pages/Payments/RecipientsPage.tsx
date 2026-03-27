import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import type { PaymentRecipient } from '@/types/celina2';
import {
  createRecipientSchema,
  editRecipientSchema,
  type CreateRecipientFormData,
  type EditRecipientFormData,
} from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const createForm = useForm<CreateRecipientFormData>({
    resolver: zodResolver(createRecipientSchema),
    defaultValues: {
      name: '',
      accountNumber: '',
      address: '',
      phoneNumber: '',
    },
  });

  const editForm = useForm<EditRecipientFormData>({
    resolver: zodResolver(editRecipientSchema),
    defaultValues: {
      name: '',
      accountNumber: '',
      address: '',
      phoneNumber: '',
    },
  });

  const loadRecipients = async () => {
    setLoading(true);

    try {
      const data = await paymentRecipientService.getAll();
      setRecipients(asArray<PaymentRecipient>(data));
    } catch {
      toast.error('Neuspesno ucitavanje primalaca.');
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, []);

  const filteredRecipients = useMemo(() => {
    const term = normalizeValue(searchTerm);
    const safeRecipients = asArray<PaymentRecipient>(recipients);

    if (!term) return safeRecipients;

    return safeRecipients.filter((recipient) => {
      const name = normalizeValue(recipient.name);
      const accountNumber = normalizeValue(recipient.accountNumber);
      const address = normalizeValue(recipient.address);
      const phoneNumber = normalizeValue(recipient.phoneNumber);

      return (
        name.includes(term) ||
        accountNumber.includes(term) ||
        address.includes(term) ||
        phoneNumber.includes(term)
      );
    });
  }, [recipients, searchTerm]);

  const handleToggleCreateForm = () => {
    const nextValue = !showCreateForm;
    setShowCreateForm(nextValue);

    if (!nextValue) {
      createForm.reset({
        name: '',
        accountNumber: '',
        address: '',
        phoneNumber: '',
      });
    }
  };

  const handleCreate = async (data: CreateRecipientFormData) => {
    setCreating(true);

    try {
      await paymentRecipientService.create({
        name: data.name.trim(),
        accountNumber: data.accountNumber.trim(),
        address: data.address?.trim() || '',
        phoneNumber: data.phoneNumber?.trim() || '',
      });

      toast.success('Primalac je uspesno dodat.');
      createForm.reset({
        name: '',
        accountNumber: '',
        address: '',
        phoneNumber: '',
      });
      setShowCreateForm(false);
      await loadRecipients();
    } catch {
      toast.error('Dodavanje primaoca nije uspelo.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (recipient: PaymentRecipient) => {
    setEditingRecipientId(recipient.id);

    editForm.reset({
      name: recipient.name,
      accountNumber: recipient.accountNumber,
      address: recipient.address || '',
      phoneNumber: recipient.phoneNumber || '',
    });
  };

  const cancelEdit = () => {
    setEditingRecipientId(null);
    editForm.reset({
      name: '',
      accountNumber: '',
      address: '',
      phoneNumber: '',
    });
  };

  const handleEdit = async (data: EditRecipientFormData) => {
    if (!editingRecipientId) return;

    setUpdating(true);

    try {
      await paymentRecipientService.update(editingRecipientId, {
        name: data.name.trim(),
        accountNumber: data.accountNumber.trim(),
        address: data.address?.trim() || '',
        phoneNumber: data.phoneNumber?.trim() || '',
      });

      toast.success('Primalac je uspesno izmenjen.');
      cancelEdit();
      await loadRecipients();
    } catch {
      toast.error('Izmena primaoca nije uspela.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (recipient: PaymentRecipient) => {
    const confirmed = window.confirm(
      `Da li ste sigurni da zelite da obrisete primaoca "${recipient.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(recipient.id);

    try {
      await paymentRecipientService.delete(recipient.id);
      toast.success('Primalac je obrisan.');

      if (editingRecipientId === recipient.id) {
        cancelEdit();
      }

      await loadRecipients();
    } catch {
      toast.error('Brisanje primaoca nije uspelo.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Primaoci placanja</h1>
            <p className="text-sm text-muted-foreground">Upravljajte listom sacuvanih primalaca za brza placanja.</p>
          </div>
        </div>

        <Button
          onClick={handleToggleCreateForm}
          className={showCreateForm ? '' : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all'}
          variant={showCreateForm ? 'outline' : 'default'}
        >
          {showCreateForm ? 'Zatvori formu' : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Dodaj primaoca
            </>
          )}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Novi primalac</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={createForm.handleSubmit(handleCreate)}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="create-name">Ime</Label>
                <Input
                  id="create-name"
                  placeholder="Unesite ime primaoca"
                  {...createForm.register('name')}
                  disabled={creating}
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-account">Broj racuna</Label>
                <Input
                  id="create-account"
                  placeholder="Unesite broj racuna"
                  {...createForm.register('accountNumber')}
                  disabled={creating}
                />
                {createForm.formState.errors.accountNumber && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.accountNumber.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-address">Adresa</Label>
                <Input
                  id="create-address"
                  placeholder="Unesite adresu"
                  {...createForm.register('address')}
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-phone">Telefon</Label>
                <Input
                  id="create-phone"
                  placeholder="Unesite telefon"
                  {...createForm.register('phoneNumber')}
                  disabled={creating}
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  {creating ? 'Cuvanje...' : 'Sacuvaj primaoca'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Sacuvani primaoci</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Pretraga po imenu, racunu, adresi ili telefonu"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-8 w-28 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {searchTerm.trim() ? 'Nema rezultata pretrage' : 'Nema sacuvanih primalaca'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim()
                  ? 'Nema primalaca koji odgovaraju pretrazi.'
                  : 'Dodajte prvog primaoca klikom na dugme iznad.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ime</th>
                    <th className="text-left py-2">Broj racuna</th>
                    <th className="text-left py-2">Adresa</th>
                    <th className="text-left py-2">Telefon</th>
                    <th className="text-left py-2">Akcije</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecipients.map((recipient) => {
                    const isEditing = editingRecipientId === recipient.id;
                    const isDeleting = deletingId === recipient.id;

                    if (isEditing) {
                      return (
                        <tr key={recipient.id} className="border-b bg-muted/20">
                          <td className="py-2 align-top">
                            <Input
                              id={`edit-name-${recipient.id}`}
                              placeholder="Ime"
                              {...editForm.register('name')}
                              disabled={updating}
                            />
                            {editForm.formState.errors.name && (
                              <p className="mt-1 text-sm text-destructive">
                                {editForm.formState.errors.name.message}
                              </p>
                            )}
                          </td>

                          <td className="py-2 align-top">
                            <Input
                              id={`edit-account-${recipient.id}`}
                              placeholder="Broj racuna"
                              {...editForm.register('accountNumber')}
                              disabled={updating}
                            />
                            {editForm.formState.errors.accountNumber && (
                              <p className="mt-1 text-sm text-destructive">
                                {editForm.formState.errors.accountNumber.message}
                              </p>
                            )}
                          </td>

                          <td className="py-2 align-top">
                            <Input
                              id={`edit-address-${recipient.id}`}
                              placeholder="Adresa"
                              {...editForm.register('address')}
                              disabled={updating}
                            />
                          </td>

                          <td className="py-2 align-top">
                            <Input
                              id={`edit-phone-${recipient.id}`}
                              placeholder="Telefon"
                              {...editForm.register('phoneNumber')}
                              disabled={updating}
                            />
                          </td>

                          <td className="py-2 align-top">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={editForm.handleSubmit(handleEdit)}
                                disabled={updating}
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                              >
                                {updating ? 'Cuvanje...' : 'Sacuvaj'}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={updating}
                              >
                                Otkazi
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={recipient.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2">{recipient.name}</td>
                        <td className="py-2">{recipient.accountNumber}</td>
                        <td className="py-2">{recipient.address || '-'}</td>
                        <td className="py-2">{recipient.phoneNumber || '-'}</td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(recipient)}
                              disabled={isDeleting}
                            >
                              Izmeni
                            </Button>

                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(recipient)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Brisanje...' : 'Obrisi'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
