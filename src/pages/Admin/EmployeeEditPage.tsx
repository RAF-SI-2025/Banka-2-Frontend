import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2, User, Phone, Briefcase, Shield, UserX } from 'lucide-react';
import { editEmployeeSchema, type EditEmployeeFormData } from '../../utils/validationSchemas';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
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

const ALL_PERMISSIONS = Object.values(Permission);

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
      {/* Back button skeleton */}
      <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />

      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-9 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-[28rem] max-w-full animate-pulse rounded-md bg-muted/70" />
      </div>

      {/* Personal info card skeleton */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-4 w-56 max-w-full animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/50" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact card skeleton */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted/70" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/50" />
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <div className="h-4 w-14 animate-pulse rounded bg-muted/70" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted/50" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work card skeleton */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted/70" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/50" />
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-2">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-10 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions card skeleton */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-28 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer buttons skeleton */}
      <div className="flex justify-end gap-3">
        <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
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
      } catch {
        setError('Greška pri učitavanju podataka o zaposlenom.');
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

  const onSubmit = async (data: EditEmployeeFormData) => {
    if (!id) return;

    setSaving(true);
    setError('');

    try {
      // Permisije se šalju zajedno sa ostalim podacima kroz PUT update
      await employeeService.update(Number(id), { ...data, permissions });

      // Ako je deaktiviran, pozovi i deactivate endpoint
      if (!data.isActive && employee?.isActive) {
        await employeeService.deactivate(Number(id));
      }

      toast.success('Zaposleni uspešno ažuriran!');
      navigate('/admin/employees');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Greška pri čuvanju izmena.');
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-xl font-semibold">Zaposleni nije pronađen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Traženi zaposleni ne postoji ili je uklonjen iz sistema.
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

      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Izmeni zaposlenog: {employee.firstName} {employee.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Azurirajte licne podatke, kontakt informacije, radnu poziciju i permisije zaposlenog.
        </p>
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <User className="h-4 w-4 text-indigo-500" />
              <CardTitle>Lični podaci</CardTitle>
            </div>
            <CardDescription>Osnovne informacije o zaposlenom.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ime</Label>
                <Input id="firstName" {...register('firstName')} />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Prezime</Label>
                <Input id="lastName" {...register('lastName')} />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Datum rođenja</Label>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberite pol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Muški</SelectItem>
                        <SelectItem value="F">Ženski</SelectItem>
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
                <Input id="username" value={employee.username || ''} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Phone className="h-4 w-4 text-indigo-500" />
              <CardTitle>Kontakt</CardTitle>
            </div>
            <CardDescription>Kontakt podaci i adresa zaposlenog.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Broj telefona</Label>
                <Input id="phoneNumber" {...register('phoneNumber')} />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Adresa</Label>
                <Input id="address" {...register('address')} />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Briefcase className="h-4 w-4 text-indigo-500" />
              <CardTitle>Posao</CardTitle>
            </div>
            <CardDescription>Pozicija, odeljenje i status zaposlenog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pozicija</Label>
                <Controller
                  name="position"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
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
                      <SelectTrigger>
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

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Shield className="h-4 w-4 text-indigo-500" />
              <CardTitle>Permisije</CardTitle>
            </div>
            <CardDescription>Izaberite dozvole koje zaposleni ima u sistemu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  htmlFor={`perm-${perm}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-primary/5"
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
    </div>
  );
}
