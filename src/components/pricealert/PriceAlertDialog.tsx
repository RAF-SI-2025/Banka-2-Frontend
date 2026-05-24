import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/lib/notify';
import priceAlertService from '@/services/priceAlertService';
import type { PriceAlertDto, PriceAlertCondition } from '@/types/priceAlert';
import { PRICE_ALERT_CONDITION_LABELS } from '@/types/priceAlert';
import { formatPrice, getErrorMessage } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const priceAlertFormSchema = z.object({
  condition: z.enum(['ABOVE', 'BELOW']),
  threshold: z
    .number({ message: 'Unesite validan prag' })
    .positive('Prag mora biti pozitivan broj')
    .max(9_999_999, 'Prag je previsok'),
  note: z.string().max(200, 'Napomena moze imati najvise 200 znakova').optional(),
});

type PriceAlertFormData = z.infer<typeof priceAlertFormSchema>;

export interface PriceAlertDialogProps {
  listingId: number;
  ticker: string;
  currentPrice: number | null;
  currency: string;
  existingAlert?: PriceAlertDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (alert: PriceAlertDto) => void;
}

function thresholdHint(
  condition: PriceAlertCondition,
  threshold: number,
  currentPrice: number | null
): { text: string; className: string } | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { text: 'Trenutna cena nije dostupna', className: 'text-muted-foreground' };
  }
  const pct = ((threshold - currentPrice) / currentPrice) * 100;
  if (condition === 'ABOVE') {
    const sign = pct >= 0 ? '+' : '';
    return {
      text: `${sign}${pct.toFixed(2)}% u odnosu na trenutnu cenu`,
      className: pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    };
  }
  const belowPct = ((currentPrice - threshold) / currentPrice) * 100;
  return {
    text: `-${belowPct.toFixed(2)}% ispod trenutne cene`,
    className: threshold < currentPrice ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
  };
}

export default function PriceAlertDialog({
  listingId,
  ticker,
  currentPrice,
  currency,
  existingAlert,
  open,
  onOpenChange,
  onSuccess,
}: PriceAlertDialogProps) {
  const isEdit = existingAlert != null;

  const defaultValues = useMemo<PriceAlertFormData>(
    () => ({
      condition: existingAlert?.condition ?? 'ABOVE',
      threshold: existingAlert?.threshold ?? (currentPrice != null && currentPrice > 0 ? currentPrice : 1),
      note: existingAlert?.note ?? '',
    }),
    [existingAlert, currentPrice]
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PriceAlertFormData>({
    resolver: zodResolver(priceAlertFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const condition = watch('condition');
  const thresholdRaw = watch('threshold');
  const threshold = typeof thresholdRaw === 'number' && Number.isFinite(thresholdRaw) ? thresholdRaw : 0;
  const hint = thresholdHint(condition, threshold, currentPrice);

  const onSubmit = async (data: PriceAlertFormData) => {
    const note = data.note?.trim() || undefined;
    try {
      const alert = isEdit
        ? await priceAlertService.update(existingAlert.id, {
            condition: data.condition,
            threshold: data.threshold,
            note,
          })
        : await priceAlertService.create({
            listingId,
            condition: data.condition,
            threshold: data.threshold,
            note,
          });
      toast.success(isEdit ? 'Alarm azuriran' : 'Alarm kreiran');
      onSuccess?.(alert);
      onOpenChange(false);
    } catch (err) {
      const msg = getErrorMessage(err, isEdit ? 'Azuriranje alarma nije uspelo' : 'Kreiranje alarma nije uspelo');
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 400) {
          setError('threshold', { message: msg });
          return;
        }
      }
      toast.error(msg);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl p-6 w-full max-w-md border border-border/50"
          data-testid="price-alert-dialog"
        >
          <div className="flex items-start justify-between gap-2 mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {isEdit ? 'Uredi alarm' : 'Alarm za'} {ticker}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Zatvori">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {currentPrice != null && Number.isFinite(currentPrice) && (
            <p className="text-sm text-muted-foreground mb-4">
              Trenutna cena: <span className="font-mono font-semibold text-foreground">{formatPrice(currentPrice)}</span>{' '}
              <span className="text-xs">{currency}</span>
            </p>
          )}

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Uslov</legend>
              <div className="flex gap-2">
                {(['ABOVE', 'BELOW'] as const).map((key) => (
                  <label
                    key={key}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                      condition === key
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-foreground'
                        : 'border-border/60 hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="radio"
                      value={key}
                      className="sr-only"
                      data-testid={key === 'ABOVE' ? 'alert-condition-above' : 'alert-condition-below'}
                      {...register('condition')}
                    />
                    {PRICE_ALERT_CONDITION_LABELS[key]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Ciljna cena ({currency})</Label>
              <Input
                id="alert-threshold"
                type="number"
                step="any"
                min={0}
                data-testid="alert-threshold-input"
                {...register('threshold', { valueAsNumber: true })}
              />
              {errors.threshold && (
                <p className="text-xs text-destructive">{errors.threshold.message}</p>
              )}
              {hint && !errors.threshold && (
                <p className={cn('text-xs', hint.className)}>{hint.text}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-note">Napomena (opciono)</Label>
              <textarea
                id="alert-note"
                rows={3}
                maxLength={200}
                data-testid="alert-note-input"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="npr. Pratiti pre objave izvestaja"
                {...register('note')}
              />
              {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Otkazi
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="alert-submit-btn">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Sacuvaj' : 'Kreiraj alarm'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
