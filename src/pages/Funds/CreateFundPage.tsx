import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import investmentFundService from '@/services/investmentFundService';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Validation schema
const createFundSchema = z.object({
  name: z
    .string()
    .min(3, 'Naziv mora imati najmanje 3 karaktera')
    .max(128, 'Naziv može imati maksimalno 128 karaktera'),
  description: z
    .string()
    .max(1024, 'Opis može imati maksimalno 1024 karaktera'),
  minimumContribution: z
    .number({ message: 'Minimalna uplata mora biti broj' })
    .positive('Minimalna uplata mora biti veća od 0'),
});

type CreateFundFormData = z.infer<typeof createFundSchema>;

export default function CreateFundPage() {
  const navigate = useNavigate();
  const { isSupervisor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFundFormData>({
    resolver: zodResolver(createFundSchema),
    defaultValues: {
      name: '',
      description: '',
      minimumContribution: 0,
    },
  });

  // In-component guard: redirect if not supervisor
  useEffect(() => {
    if (!isSupervisor) {
      toast.error('Nemate dozvolu za pristup ovoj stranici');
      navigate('/funds');
    }
  }, [isSupervisor, navigate]);

  const onSubmit = async (data: CreateFundFormData) => {
    setIsSubmitting(true);
    try {
      const newFund = await investmentFundService.create(data);
      toast.success('Fond kreiran');
      navigate(`/funds/${newFund.id}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Kreiranje fonda nije uspelo'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/home')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Nazad na početnu
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <Plus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Novi investicioni fond</h1>
          <p className="text-sm text-muted-foreground">Kreiraj novi fond za investitore</p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Osnovna informacija</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">Naziv fonda *</Label>
              <Input
                id="name"
                placeholder="Unesite naziv fonda"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <Label htmlFor="description">Opis fonda</Label>
              <textarea
                id="description"
                placeholder="Unesite opis fonda"
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Minimum contribution field */}
            <div className="space-y-2">
              <Label htmlFor="minimumContribution">Minimalna uplata (RSD) *</Label>
              <div className="relative">
                <Input
                  id="minimumContribution"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="pr-12"
                  {...register('minimumContribution', { valueAsNumber: true })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  RSD
                </span>
              </div>
              {errors.minimumContribution && (
                <p className="text-sm text-destructive">{errors.minimumContribution.message}</p>
              )}
            </div>

            {/* Submit button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Kreiranje...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Kreiraj fond
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/home')}
              >
                Otkaži
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
