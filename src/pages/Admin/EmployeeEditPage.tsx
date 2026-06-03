/*
  Spec Celina 4 (Nova) §3797-3879:
  "Ako admin ukloni isSupervisor permisiju supervizoru koji upravlja
   fondovima, vlasnistvo fondova prebacuje se na tog admina."

  BE: `EmployeeService.updateEmployee` detektuje uklanjanje SUPERVISOR/ADMIN
  permisije i automatski poziva `InvestmentFundService.reassignFundManager(...)`.
  FE samo treba potvrdu pre PATCH-a kako admin ne bi slucajno preoteo fondove.
*/
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2, User, Phone, Briefcase, Shield, UserX, Mail, AlertTriangle, PiggyBank } from 'lucide-react';
import { editEmployeeSchema, type EditEmployeeFormData } from '../../utils/validationSchemas';
import { employeeService } from '../../services/employeeService';
import investmentFundService from '../../services/investmentFundService';
import type { Employee } from '../../types';
import type { InvestmentFundDetail } from '@/types/celina4';
import { Permission } from '../../types';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { formatAmount } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import * as Dialog from '@radix-ui/react-dialog';

const ALL_PERMISSIONS = Object.values(Permission);

// R3 1628: "Selektuj sve" NE sme bulk-dodeliti ADMIN (privilege escalation).
// ADMIN se mora dodeliti namerno, pojedinacnim checkbox-om. Ako je ADMIN vec
// bio dodeljen, "Selektuj sve" ga zadrzava (ne oduzima), samo ga ne UVODI.
const NON_ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p !== Permission.ADMIN);

const POSITIONS = [
  'Software Developer',
  'Project Manager',
  'Team Lead',
  'QA Engineer',
  'Business Analyst',
  'DevOps Engineer',
  'HR Manager',
  'Accountant',
  'Actuary',
  'Supervisor',
];

const DEPARTMENTS = [
  'IT',
  'Finance',
  'HR',
  'Marketing',
  'Operations',
  'Legal',
  'Risk Management',
];

function EditPageSkeleton() {
  return (
    <div className="space-y-6" data-testid="employee-edit-skeleton">
      <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-9 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-[28rem] max-w-full animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[1, 2].map(col => (
          <div key={col} className="space-y-6">
            {[1, 2].map(card => (
              <Card key={card} className="rounded-2xl">
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 animate-pulse rounded-full bg-muted" />
                    <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                    <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
                  </div>
                  <div className="h-4 w-56 max-w-full animate-pulse rounded-md bg-muted/60" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                        <div className="h-11 w-full animate-pulse rounded-md bg-muted/50" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EmployeeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [managedFunds, setManagedFunds] = useState<InvestmentFundDetail[]>([]);
  const [pendingFormData, setPendingFormData] = useState<EditEmployeeFormData | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!id) return;

      try {
        const data = await employeeService.getById(Number(id));
        setEmployee(data);
        setPermissions(data.permissions);

        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          position: data.position,
          phoneNumber: data.phoneNumber,
          isActive: data.isActive,
          address: data.address,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          department: data.department,
        });

        // Spec Celina 4 (Nova) §3797-3879: ako edited employee upravlja
        // fondovima, treba nam broj fondova radi confirmation dialoga.
        if ((data.permissions ?? []).includes(Permission.SUPERVISOR)) {
          try {
            const funds = await investmentFundService.listByManager(data.id);
            setManagedFunds(funds);
          } catch {
            setManagedFunds([]);
          }
        }
      } catch {
        setError('Greska pri ucitavanju podataka o zaposlenom.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id, reset]);

  const handlePermissionToggle = (permission: Permission) => {
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const performUpdate = async (data: EditEmployeeFormData) => {
    if (!id) return;

    setSaving(true);
    setError('');

    try {
      // FE-AUTH-06: Jedinstven PUT zahtev koji obuhvata SVA polja ukljucujuci
      // `isActive`. Ranije: 2 sekvencijalna poziva (deactivate -> update).
      // Problem starog pristupa: ako deactivate uspe (PUT 1) a update padne
      // (PUT 2), nalog ostaje deaktiviran ali ostale promene (ime, telefon,
      // permisije) se gube — DB u nekonzistentnom stanju.
      //
      // BE `PUT /employees/{id}` vec prihvata `active` polje u istom request
      // body-ju (verifikovano u EmployeeServiceImpl.updateEmployee:137 sa
      // `if (request.getActive() != null) employee.setActive(request.getActive());`),
      // pa jedan poziv pokriva i deaktivaciju i profile update atomicno.
      const updateData = { ...data, permissions };
      await employeeService.update(Number(id), updateData);

      const removedSupervisor =
        (employee?.permissions ?? []).includes(Permission.SUPERVISOR) &&
        !permissions.includes(Permission.SUPERVISOR);
      if (removedSupervisor && managedFunds.length > 0) {
        toast.success(`Vlasnistvo nad ${managedFunds.length} fondom preneto na vas.`);
      }
      toast.success('Zaposleni uspesno azuriran!');
      navigate('/admin/employees');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || 'Greska pri cuvanju izmena.');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (data: EditEmployeeFormData) => {
    if (!id) return;

    const oldPermissions = employee?.permissions ?? [];
    const isRemovingSupervisor =
      oldPermissions.includes(Permission.SUPERVISOR) &&
      !permissions.includes(Permission.SUPERVISOR);

    if (isRemovingSupervisor && managedFunds.length > 0) {
      setPendingFormData(data);
      setShowReassignDialog(true);
      return;
    }

    await performUpdate(data);
  };

  const handleConfirmReassign = async () => {
    setShowReassignDialog(false);
    if (pendingFormData) {
      const data = pendingFormData;
      setPendingFormData(null);
      await performUpdate(data);
    }
  };

  const handleCancelReassign = () => {
    setShowReassignDialog(false);
    setPendingFormData(null);
    // Vrati SUPERVISOR permisiju u checked stanje da bi user video da je odustao.
    setPermissions((prev) =>
      prev.includes(Permission.SUPERVISOR) ? prev : [...prev, Permission.SUPERVISOR],
    );
  };

  if (loading) {
    return <EditPageSkeleton />;
  }

  if (!employee) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <UserX className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Zaposleni nije pronadjen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trazeni zaposleni ne postoji ili je uklonjen iz sistema.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad na listu
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <Button variant="ghost" onClick={() => navigate('/admin/employees')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Nazad na listu
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Izmeni zaposlenog: {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Azurirajte licne podatke, kontakt informacije, radnu poziciju i permisije zaposlenog.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-6"
        data-testid="employee-edit-form"
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Left column - Personal + Contact */}
          <div className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-indigo-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                  <User className="h-4 w-4 text-indigo-500" />
                  <CardTitle>Licni podaci</CardTitle>
                </div>
                <CardDescription>Osnovne informacije o zaposlenom.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Ime</Label>
                    <Input id="firstName" className="h-11" {...register('firstName')} />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Prezime</Label>
                    <Input id="lastName" className="h-11" {...register('lastName')} />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Datum rodjenja</Label>
                    <Controller
                      name="dateOfBirth"
                      control={control}
                      render={({ field }) => (
                        <DateInput
                          id="dateOfBirth"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Pol</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Izaberite pol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Muski</SelectItem>
                            <SelectItem value="F">Zenski</SelectItem>
                            <SelectItem value="O">Ostalo</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && (
                      <p className="text-sm text-destructive">{errors.gender.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={employee.username || ''} disabled className="h-11 bg-muted/50" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
                  <Phone className="h-4 w-4 text-blue-500" />
                  <CardTitle>Kontakt</CardTitle>
                </div>
                <CardDescription>Kontakt podaci i adresa zaposlenog.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-xs text-muted-foreground font-normal">(ne moze se menjati)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      {/*
                       * Spec §30 dozvoljava izmenu "svih osim ID-a i passworda" ali Plan
                       * Manuelnog Testiranja + Bug T1-009/T1-010 (prijavljen 12.05.2026)
                       * traze read-only ponasanje. Email je identitet zaposlenog (login key,
                       * email links, audit log) i ne sme se menjati bez admin procedure.
                       * BE EmployeeService.updateEmployee dodatno odbija email change (defense
                       * in depth ako neko zaobide disabled FE polje preko DevTools-a).
                       */}
                      <Input
                        id="email"
                        type="email"
                        className="h-11 pl-9 bg-muted/40 cursor-not-allowed"
                        {...register('email')}
                        disabled
                        aria-readonly
                        data-testid="employee-edit-email-disabled"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Broj telefona</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="phoneNumber" className="h-11 pl-9" {...register('phoneNumber')} />
                    </div>
                    {errors.phoneNumber && (
                      <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">Adresa</Label>
                    <Input id="address" className="h-11" {...register('address')} />
                    {errors.address && (
                      <p className="text-sm text-destructive">{errors.address.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Work + Permissions */}
          <div className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-violet-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
                  <Briefcase className="h-4 w-4 text-violet-500" />
                  <CardTitle>Posao</CardTitle>
                </div>
                <CardDescription>Pozicija, odeljenje i status zaposlenog.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pozicija</Label>
                    <Controller
                      name="position"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Izaberite poziciju" />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITIONS.map((pos) => (
                              <SelectItem key={pos} value={pos}>
                                {pos}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.position && (
                      <p className="text-sm text-destructive">{errors.position.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Odeljenje</Label>
                    <Controller
                      name="department"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Izaberite odeljenje" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((dep) => (
                              <SelectItem key={dep} value={dep}>
                                {dep}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.department && (
                      <p className="text-sm text-destructive">{errors.department.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold">Status zaposlenog</p>
                    <p className="text-sm text-muted-foreground">
                      Odredite da li je zaposleni trenutno aktivan u sistemu.
                    </p>
                  </div>

                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-3">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                        <Badge
                          variant={field.value ? 'default' : 'destructive'}
                          className={field.value ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' : ''}
                        >
                          {field.value ? 'Aktivan' : 'Neaktivan'}
                        </Badge>
                      </div>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-l-4 border-l-amber-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-amber-500 to-orange-600" />
                  <Shield className="h-4 w-4 text-amber-500" />
                  <CardTitle>Permisije</CardTitle>
                </div>
                <CardDescription>Izaberite dozvole koje zaposleni ima u sistemu.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {permissions.length} od {ALL_PERMISSIONS.length} selektovano
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      // R3 1628: bulk select ne uvodi ADMIN; zadrzava ga ako je vec dodeljen.
                      onClick={() =>
                        setPermissions((prev) =>
                          prev.includes(Permission.ADMIN)
                            ? [Permission.ADMIN, ...NON_ADMIN_PERMISSIONS]
                            : [...NON_ADMIN_PERMISSIONS]
                        )
                      }
                    >
                      Selektuj sve
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPermissions([])}
                    >
                      Ponisti sve
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm}
                      htmlFor={`perm-${perm}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:bg-primary/5 ${
                        permissions.includes(perm)
                          ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30'
                          : ''
                      }`}
                    >
                      <Checkbox
                        id={`perm-${perm}`}
                        checked={permissions.includes(perm)}
                        onCheckedChange={() => handlePermissionToggle(perm)}
                      />
                      <span className="text-sm font-normal">{perm}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-red-500">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-red-600 dark:text-red-400">Opasna zona</p>
                    <p className="text-sm text-muted-foreground">
                      Deaktivacija zaposlenog ce trajno onemoguciti pristup sistemu.
                      Koristite prekidac iznad za promenu statusa pre cuvanja.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 rounded-t-xl border-t bg-background/80 px-4 py-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-lg sm:-mx-6 sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/employees')}
            >
              Otkazi
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Cuvanje...' : 'Sacuvaj izmene'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog.Root
        open={showReassignDialog}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleCancelReassign();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl"
            data-testid="reassign-funds-dialog"
          >
            <div className="flex items-start gap-3 border-b p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                <PiggyBank className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold">
                  Prebacivanje vlasnistva nad fondovima
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Ovaj supervizor upravlja sa{' '}
                  <span className="font-semibold">{managedFunds.length}{' '}
                    {managedFunds.length === 1 ? 'fondom' : 'fondova'}
                  </span>
                  . Uklanjanjem permisije, vlasnistvo se prebacuje na vas.
                </Dialog.Description>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border-b px-6 py-4 space-y-2">
              {managedFunds.map((fund) => {
                const accountSuffix = fund.accountNumber
                  ? fund.accountNumber.slice(-4)
                  : '—';
                return (
                  <div
                    key={fund.id}
                    className="rounded-lg border bg-muted/20 p-3"
                    data-testid={`reassign-fund-item-${fund.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span className="font-semibold truncate">{fund.name}</span>
                        </div>
                        {fund.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {fund.description}
                          </p>
                        )}
                      </div>
                      {fund.fundValue != null && (
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-muted-foreground">Vrednost fonda</div>
                          <div className="font-mono text-sm font-semibold">
                            {formatAmount(fund.fundValue)} RSD
                          </div>
                        </div>
                      )}
                    </div>
                    {(fund.fundValue != null || fund.liquidAmount != null || fund.holdings != null || fund.accountNumber) && (
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <div className="text-muted-foreground">Likvidnost</div>
                          <div className="font-mono">
                            {fund.liquidAmount != null ? `${formatAmount(fund.liquidAmount)} RSD` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Hartije</div>
                          <div className="font-mono">{fund.holdings?.length ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Racun</div>
                          <div className="font-mono truncate" title={fund.accountNumber ?? ''}>
                            {fund.accountNumber ? `...${accountSuffix}` : '—'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 p-6">
              <Button type="button" variant="outline" onClick={handleCancelReassign}>
                Otkazi
              </Button>
              <Button
                type="button"
                onClick={handleConfirmReassign}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold"
              >
                Potvrdi
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
