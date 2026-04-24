import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/lib/notify';
import { transactionService } from '@/services/transactionService';
import { verificationSchema, type VerificationFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (otpCode: string) => Promise<void>;
}

/**
 * OTP Verification Modal
 *
 * Flow:
 * 1. Modal opens -> request OTP (code appears on mobile app)
 * 2. User enters 6-digit code
 * 3. User clicks "Potvrdi" -> calls onVerified(code) which is an async function
 * 4. Parent component (NewPaymentPage) sends POST /payments with the code
 * 5. If backend rejects -> error shown in modal, user can retry
 * 6. If backend accepts -> parent navigates away, modal closes
 * 7. "Otkaži" -> closes modal, NOTHING happens with money
 */
export default function VerificationModal({ isOpen, onClose, onVerified }: VerificationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: '' },
  });

  // Request OTP when modal opens + fetch generated code for dev display
  const sendOtp = useCallback(async () => {
    try {
      await transactionService.requestOtp();
      setOtpSent(true);
      // Fetch the just-generated code so we can show it in the modal
      try {
        const active = await transactionService.getActiveOtp();
        if (active.active && active.code) {
          setDevOtp(active.code);
        }
      } catch {
        // non-fatal — modal still works, user reads from mobile app
      }
    } catch {
      toast.error('Greška pri slanju verifikacionog koda.');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(300);
    setAttemptsLeft(3);
    setServerError('');
    setOtpSent(false);
    setDevOtp(null);
    reset({ code: '' });
    sendOtp();
  }, [isOpen, reset, sendOtp]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft(p => Math.max(0, p - 1)), 1000);
    return () => window.clearInterval(id);
  }, [isOpen, secondsLeft]);

  const formattedTime = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const s = (secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [secondsLeft]);

  // Submit: pass code to parent, parent does the actual payment
  const onSubmit = async (data: VerificationFormData) => {
    if (secondsLeft === 0) {
      setServerError('Kod je istekao. Zatražite novi.');
      return;
    }
    if (attemptsLeft <= 0) {
      setServerError('Nema preostalih pokušaja.');
      return;
    }

    setIsSubmitting(true);
    setServerError('');

    try {
      // Propagiramo korisnicki unos u parent (NewPaymentPage/CreateOrderPage/TransferPage),
      // koji radi stvarni POST /payments /orders /transfers sa otpCode-om.
      // Backend (OtpService.verify) pravi stvarnu proveru — pogresan kod vrati 403 i
      // uvecava attempts; exception handler niz stack propagira poruku.
      await onVerified(data.code);
      // If we get here, payment succeeded - parent will navigate away
    } catch (err: unknown) {
      // Payment failed — pogresan OTP, blokiran, istekao, nedovoljno sredstava...
      // Backend poruke dolaze kroz `error`, `message` ili body stringa (zavisno od
      // endpoint-a). Pokrivamo sve.
      const error = err as {
        response?: {
          status?: number;
          data?: { error?: string; message?: string; verified?: boolean; blocked?: boolean };
        };
      };
      const data403 = error.response?.data;
      const msg =
        data403?.error ??
        data403?.message ??
        (error.response?.status === 403
          ? 'Verifikacioni kod nije tacan.'
          : 'Verifikacija nije uspela. Pokusajte ponovo.');
      setServerError(msg);

      // Backend je vec markirao OTP kao iskoriscen kada si premasila maxAttempts —
      // pogledaj polje `blocked` iz direktnog /payments/verify poziva ako postoji,
      // inace pratimo attempts lokalno (po default-u max 3 kao sto OtpService vraca).
      const blocked = data403?.blocked === true;
      setAttemptsLeft((prev) => {
        const next = blocked ? 0 : prev - 1;
        if (next <= 0) {
          toast.error('Maksimalan broj pokusaja. Transakcija otkazana.');
          setTimeout(() => onClose(), 1500);
        }
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(300);
    setAttemptsLeft(3);
    setServerError('');
    reset({ code: '' });
    await sendOtp();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between border-b p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  Verifikacija transakcije
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {otpSent
                    ? 'Otvorite mobilnu aplikaciju za verifikacioni kod.'
                    : 'Slanje verifikacionog koda...'}
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isSubmitting}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Zatvori"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Error message */}
            {serverError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Dev convenience: prikaz generisanog OTP koda iz bekenda.
                  U produkciji bi ovo trebalo sakriti, ali za SI rok je praktičnije. */}
              {devOtp && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        Vaš verifikacioni kod
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-indigo-900 dark:text-indigo-100">
                        {devOtp}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setValue('code', devOtp, { shouldValidate: true });
                      }}
                    >
                      Popuni
                    </Button>
                  </div>
                </div>
              )}

              {/* OTP Input */}
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium">
                  Verifikacioni kod
                </Label>
                <Input
                  {...register('code')}
                  id="otp"
                  inputMode="numeric"
                  placeholder="- - - - - -"
                  className={`h-12 text-center text-xl font-semibold tracking-[0.5em] ${
                    errors.code ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                  autoFocus
                />
                {errors.code && (
                  <p className="text-sm font-medium text-destructive">{errors.code.message}</p>
                )}
              </div>

              {/* Timer & attempts info */}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kod važi još</span>
                  <span className={`font-mono font-semibold ${secondsLeft <= 60 ? 'text-destructive' : ''}`}>
                    {formattedTime}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Preostalo pokušaja</span>
                  <span className={`font-semibold ${attemptsLeft <= 1 ? 'text-destructive' : ''}`}>
                    {attemptsLeft}
                  </span>
                </div>
              </div>

              {/* Resend & email fallback */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={secondsLeft > 0}
                  className="text-sm text-primary transition-colors hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed"
                >
                  {secondsLeft > 0 ? `Pošalji ponovo za ${secondsLeft}s` : 'Pošalji ponovo'}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  onClick={async () => {
                    try {
                      await transactionService.requestOtpViaEmail();
                      toast.info('Kod poslat na email.');
                    } catch { toast.error('Greška.'); }
                  }}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Pošaljite na email
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Otkaži
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || attemptsLeft <= 0 || secondsLeft === 0}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Provera...
                    </>
                  ) : (
                    'Potvrdi'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
