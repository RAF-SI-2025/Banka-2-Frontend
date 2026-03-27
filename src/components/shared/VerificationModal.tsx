import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { transactionService } from '@/services/transactionService';
import { verificationSchema, type VerificationFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VerificationModalProps {
  transactionId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VerificationModal({
  transactionId,
  isOpen,
  onClose,
  onSuccess,
}: VerificationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: '' },
  });

  const sendOtp = useCallback(async () => {
    try {
      await transactionService.requestOtp();
      setOtpSent(true);
      toast.info('Verifikacioni kod je poslat na vaš email.');
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
    reset({ code: '' });

    sendOtp();
  }, [isOpen, transactionId, reset, sendOtp]);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isOpen, secondsLeft]);

  const formattedTime = useMemo(() => {
    const min = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, '0');
    const sec = (secondsLeft % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }, [secondsLeft]);

  const closeWithReset = () => {
    setServerError('');
    reset({ code: '' });
    onClose();
  };

  const onSubmit = async (data: VerificationFormData) => {
    if (!transactionId) return;
    if (secondsLeft === 0) {
      setServerError('Kod je istekao. Pokrenite verifikaciju ponovo.');
      return;
    }

    setIsSubmitting(true);
    setServerError('');
    try {
      const result = await transactionService.verifyPayment({
        transactionId,
        code: data.code,
      });

      if (result.verified) {
        toast.success('Transakcija je uspešno verifikovana.');
        reset({ code: '' });
        onSuccess();
        onClose();
      } else if (result.blocked) {
        toast.error('Maksimalan broj pokušaja je dostignut. Transakcija je otkazana.');
        closeWithReset();
      } else {
        setServerError(result.message || 'Kod nije validan. Pokušajte ponovo.');
        setAttemptsLeft((prev) => Math.max(0, prev - 1));
      }
    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || error.message || 'Kod nije validan. Pokušajte ponovo.';
      setServerError(msg);
      setAttemptsLeft((prev) => Math.max(0, prev - 1));
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

  if (!isOpen || !transactionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-1">Verifikacija transakcije</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {otpSent
            ? 'Otvorite mobilnu aplikaciju za verifikacioni kod.'
            : 'Slanje verifikacionog koda...'}
        </p>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verifikacioni kod</Label>
            <Input
              {...register('code')}
              id="otp"
              inputMode="numeric"
              placeholder="Unesite 6-cifreni kod"
              className={errors.code ? 'border-destructive text-center' : 'text-center'}
            />
            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <p>
              Kod važi još: <span className="font-semibold">{formattedTime}</span>
            </p>
            <p>
              Preostalo pokušaja: <span className="font-semibold">{attemptsLeft}</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={secondsLeft > 0}
              className="text-primary disabled:text-muted-foreground"
            >
              {secondsLeft > 0 ? `Pošalji ponovo za ${secondsLeft}s` : 'Pošalji ponovo'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await transactionService.requestOtpViaEmail();
                  toast.info('Verifikacioni kod je poslat na vaš email.');
                } catch {
                  toast.error('Greška pri slanju email-a.');
                }
              }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Nemate telefon? Pošaljite na email
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={closeWithReset}>
              Otkaži
            </Button>
            <Button type="submit" disabled={isSubmitting || attemptsLeft === 0 || secondsLeft === 0}>
              {isSubmitting ? 'Provera...' : 'Potvrdi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


