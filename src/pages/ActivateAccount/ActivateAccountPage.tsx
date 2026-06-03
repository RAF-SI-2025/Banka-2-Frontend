import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle, Clock, KeySquare } from 'lucide-react';
import {
  activateAccountSchema,
  type ActivateAccountFormData,
} from '../../utils/validationSchemas';
import { authService } from '../../services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getPasswordStrength, getStrengthInfo } from '../../utils/passwordStrength';
import AuthPageLayout from '@/components/layout/AuthPageLayout';
import { toast } from '@/lib/notify';

// Spec Sc 9 + ad-hoc bag 12.05.2026: pre renderovanja forme, FE poziva
// GET /auth-employee/activation-token/{token}/status da bi proverio da li je
// token jos validan. Bez ovog koraka, korisnik koji je vec aktivirao nalog
// pa osvezi stranicu vidi formu (FE je propusta) iako BE-u poziv ne uspeva
// (token je used). Token state se mapira u jedan od narednih ekrana.
type TokenStatus = 'CHECKING' | 'VALID' | 'USED' | 'EXPIRED' | 'INVALID' | 'ALREADY_ACTIVE';

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('CHECKING');
  const [tokenEmail, setTokenEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ActivateAccountFormData>({
    resolver: zodResolver(activateAccountSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password', '');
  const strength = getPasswordStrength(passwordValue);
  const strengthInfo = getStrengthInfo(strength);

  // Spec Sc 9 + Bug 12.05.2026: token state pre-check. Ako je token vec
  // iskorisen ili istekao, ne renderujemo formu uopste — prikazujemo
  // odgovarajucu poruku sa dugmetom za login (ALREADY_ACTIVE/USED) ili
  // za kontakt admina (EXPIRED/INVALID).
  useEffect(() => {
    if (!token) {
      setTokenStatus('INVALID');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await authService.getActivationTokenStatus(token);
        if (cancelled) return;
        setTokenStatus(result.status);
        setTokenEmail(result.email ?? null);
      } catch {
        if (!cancelled) setTokenStatus('INVALID');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (data: ActivateAccountFormData) => {
    if (!token) {
      setServerError('Nevazeci link za aktivaciju. Kontaktirajte administratora.');
      return;
    }
    setServerError('');
    setIsSubmitting(true);
    try {
      await authService.activateAccount({ token, password: data.password });
      setSuccess(true);
      // Napomena: NE menjamo tokenStatus na USED ovde. Success state je
      // distinkan UX — pokazuje "Nalog uspesno aktiviran" + "Idi na prijavu".
      // Tek na sledeci mount (refresh stranice) pre-check ce detektovati
      // USED status i prikazati "Vec iskoriscen" stranicu.
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const beMsg = error.response?.data?.message;
      // Ako BE javi da je token iskorisen/istekao izmedju pre-checka i submita
      // (race condition: drugi tab ili admin invalidacija), refresh-ujemo status
      // da prikazemo pravu stranicu umesto generickog error toast-a.
      if (beMsg && /vec used|already used|invalidated|expired/i.test(beMsg)) {
        try {
          const refreshed = await authService.getActivationTokenStatus(token);
          setTokenStatus(refreshed.status);
        } catch {
          setTokenStatus('INVALID');
        }
        return;
      }
      setServerError(beMsg || 'Greska pri aktivaciji naloga. Link je mozda istekao.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Spec Celina 1 Sc 9: kad je token istekao, posalji novi aktivacioni link.
  // BE je anti-enumeration (uvek generic 200), pa je i poruka neutralna:
  // "ako nalog postoji". Greske hvatamo gracefully i prikazujemo error toast.
  const handleResend = async () => {
    if (!token) return;
    setIsResending(true);
    try {
      await authService.resendActivation(token);
      setResendSent(true);
      toast.success('Novi aktivacioni link je poslat ako nalog postoji.');
    } catch {
      toast.error('Slanje novog linka trenutno nije uspelo. Pokusajte ponovo kasnije.');
    } finally {
      setIsResending(false);
    }
  };

  // Spec Sc 9 — token istekao
  if (tokenStatus === 'EXPIRED') {
    return (
      <AuthPageLayout>
        <div className="mx-auto max-w-[440px] animate-fade-up">
          <Card className="shadow-2xl shadow-indigo-500/5">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
                <Clock className="h-7 w-7 text-amber-500" />
              </div>
              <CardTitle className="text-xl">Link za aktivaciju je istekao</CardTitle>
              <CardDescription>
                Aktivacioni link traje 24 sata. Vasa veza vise nije validna.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3" data-testid="activation-token-expired">
              {resendSent ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Link je poslat</AlertTitle>
                  <AlertDescription>
                    Novi aktivacioni link je poslat ako nalog postoji. Proverite vas email
                    (i spam folder) i kliknite na novi link.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Mozete sami zatraziti novi aktivacioni link ili kontaktirati vaseg administratora.
                </p>
              )}
              <Button
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold"
                onClick={handleResend}
                disabled={isResending || resendSent}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Slanje...
                  </>
                ) : resendSent ? (
                  'Link je poslat'
                ) : (
                  'Posalji novi link'
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Nazad na prijavu
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  // Spec Sc 9 + ad-hoc bag — token je vec iskorisen (najcesce: refresh stranice
  // posle uspesne aktivacije, ili klik na isti email link drugi put).
  if (tokenStatus === 'USED' || tokenStatus === 'ALREADY_ACTIVE') {
    const isAlreadyActive = tokenStatus === 'ALREADY_ACTIVE';
    return (
      <AuthPageLayout>
        <div className="mx-auto max-w-[440px] animate-fade-up">
          <Card className="shadow-2xl shadow-indigo-500/5">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <CardTitle className="text-xl">
                {isAlreadyActive ? 'Nalog je vec aktivan' : 'Link je vec iskoriscen'}
              </CardTitle>
              <CardDescription>
                {isAlreadyActive
                  ? 'Vas nalog je vec aktiviran. Prijavite se sa email-om i lozinkom.'
                  : 'Aktivacioni link je vec iskoriscen. Mozete se odmah prijaviti.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3" data-testid={isAlreadyActive ? 'activation-already-active' : 'activation-token-used'}>
              {tokenEmail && (
                <Alert>
                  <KeySquare className="h-4 w-4" />
                  <AlertTitle>Email naloga</AlertTitle>
                  <AlertDescription className="font-mono">{tokenEmail}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground text-center">
                Ako ste zaboravili lozinku, koristite opciju "Zaboravili ste lozinku" na prijavi.
              </p>
              <Button
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold"
                onClick={() => navigate('/login')}
              >
                Idi na prijavu
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  if (tokenStatus === 'INVALID' || !token) {
    return (
      <AuthPageLayout>
        <div className="mx-auto max-w-[440px] animate-fade-up">
          <Card className="shadow-2xl shadow-indigo-500/5">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <CardTitle className="text-xl">Nevazeci link za aktivaciju</CardTitle>
              <CardDescription>
                Aktivacioni token ne postoji u sistemu. Kontaktirajte administratora za novi link.
              </CardDescription>
            </CardHeader>
            <CardContent data-testid="activation-token-invalid">
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Nazad na prijavu
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  if (tokenStatus === 'CHECKING') {
    return (
      <AuthPageLayout>
        <div className="mx-auto max-w-[440px] animate-fade-up">
          <Card className="shadow-2xl shadow-indigo-500/5">
            <CardContent className="p-10 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Provera linka za aktivaciju...</p>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  // tokenStatus === 'VALID' — renderujemo formu
  return (
    <AuthPageLayout>
      <div className="mx-auto w-full max-w-[480px] animate-fade-up">
        <Card className="shadow-2xl shadow-indigo-500/5">
          <CardHeader className="text-center space-y-2">
            <img src="/logo.svg" alt="Banka 2025" className="mx-auto h-16 w-16" />
            <CardTitle className="text-xl">Aktivacija naloga</CardTitle>
            <CardDescription>
              Postavite svoju lozinku za pristup sistemu
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold">Nalog uspesno aktiviran!</h3>
                <p className="text-sm text-muted-foreground">
                  Sada se mozete prijaviti sa vasim email-om i lozinkom.
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

                {tokenEmail && (
                  <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2">
                    <KeySquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs">
                      <span className="text-muted-foreground">Aktivira se nalog: </span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{tokenEmail}</span>
                    </p>
                  </div>
                )}

                <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                  <p className="text-xs text-indigo-600 dark:text-indigo-300">
                    Lozinka mora imati: 8-32 karaktera, najmanje 2 broja, 1 veliko i 1 malo slovo.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova lozinka</Label>
                    <div className="relative">
                      <Input
                        {...register('password')}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={cn('pr-10', errors.password && 'border-destructive')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                    {passwordValue && (
                      <div className="space-y-1">
                        <Progress value={strength} className="h-1.5" indicatorClassName={strengthInfo.color} />
                        <p className="text-xs text-muted-foreground">
                          Jacina lozinke: <span className="font-medium">{strengthInfo.label}</span>
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
                        Aktivacija...
                      </>
                    ) : (
                      'Aktiviraj nalog'
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
