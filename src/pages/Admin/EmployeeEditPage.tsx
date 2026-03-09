import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { editEmployeeSchema, type EditEmployeeFormData } from '../../utils/validationSchemas';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { Permission } from '../../types';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// =============================================================================
// TODO [FE-22] ELENA KALAJDŽIĆ — Poboljšanje EmployeeEditPage UI
// =============================================================================
// ZADATAK: Poboljšati izgled i UX ove stranice.
//   1. Grupisanje polja u logične sekcije sa Card wrapper-ima:
//      - Lični podaci, Kontakt, Posao, Permisije
//   2. Dodati Card wrapper-e oko svake sekcije sa prikladnim naslovima
//   3. Lepši prikaz permisija (checkbox grid umesto liste)
//   4. Loading skeleton dok se podaci učitavaju (umesto spinnera)
//   5. Bolji responsive dizajn za manje ekrane
// NAPOMENA: Pogledaj EmployeeCreatePage za stil i uskladi.
// Koristi shadcn/ui Card, Separator komponente. Koristi AI Agent Mode!
// + Napiši E2E test koji proverava da edit forma učitava podatke.
// =============================================================================

const ALL_PERMISSIONS = Object.values(Permission);

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
          jmbg: data.jmbg,
          address: data.address,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          department: data.department,
          role: data.role,
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
      await employeeService.update(Number(id), data);
      await employeeService.updatePermissions(Number(id), permissions);
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
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Zaposleni nije pronađen.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/employees')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Nazad na listu
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">
        Izmeni zaposlenog: {employee.firstName} {employee.lastName}
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Lični podaci</CardTitle>
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
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={employee?.username || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Broj telefona</Label>
                <Input id="phoneNumber" {...register('phoneNumber')} />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jmbg">JMBG</Label>
                <Input id="jmbg" {...register('jmbg')} />
                {errors.jmbg && (
                  <p className="text-sm text-destructive">{errors.jmbg.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Datum rođenja</Label>
                <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
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
            <CardTitle>Pozicija i odeljenje</CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-2">
                <Label htmlFor="role">Uloga</Label>
                <Input id="role" {...register('role')} />
                {errors.role && (
                  <p className="text-sm text-destructive">{errors.role.message}</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <div className="flex items-center gap-2">
                        <Label
                          className="cursor-pointer"
                          onClick={() => field.onChange(!field.value)}
                        >
                          Status:
                        </Label>
                        <Badge variant={field.value ? 'success' : 'destructive'}>
                          {field.value ? 'Aktivan' : 'Neaktivan'}
                        </Badge>
                      </div>
                    </>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permisije</CardTitle>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {ALL_PERMISSIONS.map((perm) => (
                <div key={perm} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${perm}`}
                    checked={permissions.includes(perm)}
                    onCheckedChange={() => handlePermissionToggle(perm)}
                  />
                  <Label htmlFor={`perm-${perm}`} className="cursor-pointer font-normal">
                    {perm}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/employees')}
          >
            Otkaži
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Čuvanje...' : 'Sačuvaj izmene'}
          </Button>
        </div>
      </form>
    </div>
  );
}
