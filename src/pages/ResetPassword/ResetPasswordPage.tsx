import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '../../utils/validationSchemas';
import { authService } from '../../services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getPasswordStrength, getStrengthInfo } from '../../utils/passwordStrength';
import AuthPageLayout from '@/components/layout/AuthPageLayout';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const passwordValue = watch('newPassword', '');
  const strength = getPasswordStrength(passwordValue);
  const strengthInfo = getStrengthInfo(strength);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setServerError('Nevažeći link za resetovanje lozinke.');
      return;
    }
    setServerError('');
    setIsSubmitting(true);
    try {
      await authService.resetPassword({ token, newPassword: data.newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error.response?.data?.message ||
          'Greška pri resetovanju lozinke. Link je možda istekao.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthPageLayout>
        <div className="mx-auto max-w-[440px] animate-fade-up">
          <Card className="shadow-2xl shadow-indigo-500/5">
            <CardContent className="p-6 text-center space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  Nevažeći link za resetovanje lozinke. Zatražite novi link.
                </AlertDescription>
              </Alert>
              <Button
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold"
                onClick={() => navigate('/forgot-password')}
              >
                Zatraži novi link
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="mx-auto w-full max-w-[480px] space-y-4 animate-fade-up">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad na prijavu
        </Button>

        <Card className="shadow-2xl shadow-indigo-500/5">
          <CardHeader className="text-center space-y-2">
            <img src="/logo.svg" alt="Banka 2025" className="mx-auto h-16 w-16" />
            <CardTitle className="text-xl">Resetovanje lozinke</CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold">Lozinka uspešno promenjena!</h3>
                <p className="text-sm text-muted-foreground">
                  Sada se možete prijaviti sa novom lozinkom.
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold"
                  onClick={() => navigate('/login')}
                >
                  Idi na prijavu
                </Button>
              </div>
            ) : (
              <>
                {serverError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                )}

                <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                  <p className="text-xs text-indigo-600 dark:text-indigo-300">
                    Lozinka mora imati: 8-32 karaktera, najmanje 2 broja, 1 veliko i 1 malo slovo.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova lozinka</Label>
                    <div className="relative">
                      <Input
                        {...register('newPassword')}
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        className={cn('pr-10', errors.newPassword && 'border-destructive')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                    )}
                    {passwordValue && (
                      <div className="space-y-1">
                        <Progress value={strength} className="h-1.5" indicatorClassName={strengthInfo.color} />
                        <p className="text-xs text-muted-foreground">
                          Jačina lozinke: <span className="font-medium">{strengthInfo.label}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Potvrdite lozinku</Label>
                    <div className="relative">
                      <Input
                        {...register('confirmPassword')}
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        className={cn('pr-10', errors.confirmPassword && 'border-destructive')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Postavljanje...
                      </>
                    ) : (
                      'Postavi novu lozinku'
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthPageLayout>
  );
}
