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
      toast.error('Neuspešno učitavanje primalaca.');
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

      toast.success('Primalac je uspešno dodat.');
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

      toast.success('Primalac je uspešno izmenjen.');
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
      `Da li ste sigurni da želite da obrišete primaoca "${recipient.name}"?`
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Primaoci plaćanja</h1>

        <Button onClick={handleToggleCreateForm}>
          {showCreateForm ? 'Zatvori formu' : 'Dodaj primaoca'}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novi primalac</CardTitle>
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
                <Label htmlFor="create-account">Broj računa</Label>
                <Input
                  id="create-account"
                  placeholder="Unesite broj računa"
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
                <Button type="submit" disabled={creating}>
                  {creating ? 'Čuvanje...' : 'Sačuvaj primaoca'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sačuvani primaoci</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Pretraga po imenu, računu, adresi ili telefonu"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <p className="text-muted-foreground">Učitavanje primalaca...</p>
          ) : filteredRecipients.length === 0 ? (
            <p className="text-muted-foreground">
              {searchTerm.trim()
                ? 'Nema primalaca koji odgovaraju pretrazi.'
                : 'Nemate sačuvanih primalaca.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ime</th>
                    <th className="text-left py-2">Broj računa</th>
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
                              placeholder="Broj računa"
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
                              >
                                {updating ? 'Čuvanje...' : 'Sačuvaj'}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={updating}
                              >
                                Otkaži
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={recipient.id} className="border-b">
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
                              {isDeleting ? 'Brisanje...' : 'Obriši'}
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