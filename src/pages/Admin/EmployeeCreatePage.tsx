import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { createEmployeeSchema, type CreateEmployeeFormData } from '../../utils/validationSchemas';
import { employeeService } from '../../services/employeeService';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';

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

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateEmployeeFormData>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      position: '',
      phoneNumber: '',
      isActive: true,
      address: '',
      dateOfBirth: '',
      gender: '',
      department: '',
    },
  });

  const onSubmit = async (data: CreateEmployeeFormData) => {
    setServerError('');
    setIsSubmitting(true);
    try {
      await employeeService.create({
        ...data,
        permissions: [],
      });
      toast.success(
        'Zaposleni uspešno kreiran! Email za aktivaciju naloga je poslat.'
      );
      navigate('/admin/employees');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      if (error.response?.data?.message?.includes('email')) {
        setServerError('Korisnik sa ovim email-om već postoji.');
      } else {
        setServerError(
          error.response?.data?.message || 'Greška pri kreiranju zaposlenog.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      <Button variant="ghost" onClick={() => navigate('/admin/employees')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Nazad na listu
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kreiranje novog zaposlenog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nakon kreiranja, zaposleni će dobiti email sa linkom za aktivaciju naloga
          i postavljanje lozinke.
        </p>
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Lični podaci</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ime *</Label>
                <Input
                  id="firstName"
                  className={errors.firstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Prezime *</Label>
                <Input
                  id="lastName"
                  className={errors.lastName ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.lastName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Datum rođenja *</Label>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <DateInput
                      id="dateOfBirth"
                      value={field.value}
                      onChange={field.onChange}
                      className={errors.dateOfBirth ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                  )}
                />
                {errors.dateOfBirth && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.dateOfBirth.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Pol *</Label>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={errors.gender ? 'border-destructive focus:ring-destructive' : ''}
                      >
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
                  <p className="text-sm font-medium text-destructive">
                    {errors.gender.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontakt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Broj telefona *</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+381 60 1234567"
                  className={errors.phoneNumber ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('phoneNumber')}
                />
                {errors.phoneNumber && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Adresa *</Label>
                <Input
                  id="address"
                  className={errors.address ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('address')}
                />
                {errors.address && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.address.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posao</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="petar90"
                  className={errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...register('username')}
                />
                {errors.username && (
                  <p className="text-sm font-medium text-destructive">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Pozicija *</Label>
                <Controller
                  name="position"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        data-cy="position-select"
                        className={errors.position ? 'border-destructive focus:ring-destructive' : ''}
                      >
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
                  <p className="text-sm font-medium text-destructive">
                    {errors.position.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Odeljenje *</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        data-cy="department-select"
                        className={errors.department ? 'border-destructive focus:ring-destructive' : ''}
                      >
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
                  <p className="text-sm font-medium text-destructive">
                    {errors.department.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-md border p-4 md:col-span-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      <Label
                        className="cursor-pointer"
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? 'Aktivan (default)' : 'Neaktivan'}
                      </Label>
                    </>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/employees')}
            >
              Otkaži
            </Button>

            <Button
              type="submit"
              data-cy="createBtn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Kreiranje...' : 'Kreiraj zaposlenog'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}