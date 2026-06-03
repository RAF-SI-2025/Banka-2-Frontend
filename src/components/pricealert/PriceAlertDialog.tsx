// ============================================================
// [FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic]
//
// Radix Dialog za kreiranje cenovnog alarma na hartiji od vrednosti.
// Predvidjeno za ugradnju u SecuritiesDetailsPage i PriceAlertsPage.
//
// Spec: Zadaci_Frontend.pdf, FE2 + task instructions 25.05.2026.
// ============================================================

import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BellRing, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { priceAlertService } from '@/services/priceAlertService';
import type {
  PriceAlertCondition,
  PriceAlertDto,
} from '@/types/priceAlert';

export interface PriceAlertDialogInitialListing {
  id: number;
  ticker: string;
  currentPrice?: number | null;
  type: string;
  currency?: string;
}

export interface PriceAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialListing?: PriceAlertDialogInitialListing;
  onCreated?: (alert: PriceAlertDto) => void;
}

const schema = z.object({
  listingId: z
    .number({ message: 'ID hartije je obavezan' })
    .int()
    .positive('ID hartije mora biti pozitivan'),
  condition: z.enum(['ABOVE', 'BELOW']),
  threshold: z
    .number({ message: 'Prag je obavezan' })
    .positive('Prag mora biti pozitivan broj')
    .finite('Prag mora biti konacan broj')
    .max(9_999_999, 'Prag je prevelik'),
});

type FormData = z.infer<typeof schema>;

function formatPriceShort(n: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n) + (currency ? ` ${currency}` : '');
  } catch {
    return `${n.toFixed(2)}${currency ? ` ${currency}` : ''}`;
  }
}

export default function PriceAlertDialog({
  open,
  onOpenChange,
  initialListing,
  onCreated,
}: PriceAlertDialogProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      listingId: initialListing?.id ?? 0,
      condition: 'ABOVE' as PriceAlertCondition,
      threshold: 0,
    },
  });

  // Reset form when dialog opens/closes or initialListing changes.
  useEffect(() => {
    if (open) {
      reset({
        listingId: initialListing?.id ?? 0,
        condition: 'ABOVE',
        threshold: 0,
      });
    }
  }, [open, initialListing, reset]);

  const condition = watch('condition');
  const threshold = watch('threshold');

  const currentPrice = initialListing?.currentPrice ?? null;
  const currency = initialListing?.currency;

  // Compute helper text — % distance from current price.
  // R1 570 / R7 2037: `wrongSide` znaci da je prag na POGRESNOJ strani trenutne
  // cene (ABOVE prag <= cena, ili BELOW prag >= cena) — takav alarm bi se okinuo
  // odmah / nikad i nema smisla. Kad nemamo currentPrice, ne mozemo proveriti
  // smer (fail-open na klijentu; BE i dalje validira).
  let helperText: { text: string; tone: 'positive' | 'negative' | 'neutral' } | null = null;
  let wrongSide = false;
  if (currentPrice != null && currentPrice > 0 && threshold > 0) {
    const diffPct = ((threshold - currentPrice) / currentPrice) * 100;
    if (condition === 'ABOVE') {
      if (threshold > currentPrice) {
        helperText = {
          text: `+${diffPct.toFixed(2)}% iznad trenutne cene`,
          tone: 'positive',
        };
      } else {
        wrongSide = true;
        helperText = {
          text: `Prag mora biti iznad trenutne cene (${formatPriceShort(currentPrice, currency)})`,
          tone: 'negative',
        };
      }
    } else {
      if (threshold < currentPrice) {
        helperText = {
          text: `${diffPct.toFixed(2)}% ispod trenutne cene`,
          tone: 'positive',
        };
      } else {
        wrongSide = true;
        helperText = {
          text: `Prag mora biti ispod trenutne cene (${formatPriceShort(currentPrice, currency)})`,
          tone: 'negative',
        };
      }
    }
  }

  const onSubmit = async (data: FormData) => {
    // R1 570 / R7 2037: blokiraj slanje praga na pogresnoj strani cene.
    if (currentPrice != null && currentPrice > 0) {
      if (data.condition === 'ABOVE' && data.threshold <= currentPrice) {
        toast.error(
          `Prag za "Cena prelazi" mora biti iznad trenutne cene (${formatPriceShort(currentPrice, currency)}).`
        );
        return;
      }
      if (data.condition === 'BELOW' && data.threshold >= currentPrice) {
        toast.error(
          `Prag za "Cena pada ispod" mora biti ispod trenutne cene (${formatPriceShort(currentPrice, currency)}).`
        );
        return;
      }
    }
    try {
      const created = await priceAlertService.createAlert({
        listingId: data.listingId,
        condition: data.condition,
        threshold: data.threshold,
      });
      toast.success('Alarm postavljen');
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Neuspeh kreiranja alarma';
      toast.error(message);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-2xl shadow-2xl p-0 w-full max-w-md overflow-hidden"
          data-testid="price-alert-dialog"
        >
          {/* Gradient header */}
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-bold">
                    {initialListing
                      ? `Cenovni alarm: ${initialListing.ticker}`
                      : 'Postavi cenovni alarm'}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-white/80 mt-0.5">
                    Obavestice vas kad cena dosegne zadati prag
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Listing field */}
            {initialListing ? (
              <div className="bg-muted/40 rounded-lg p-3">
                <Label className="text-xs text-muted-foreground">Hartija</Label>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <div className="font-mono font-semibold text-sm">
                      {initialListing.ticker}
                    </div>
                    <div className="text-xs text-muted-foreground">{initialListing.type}</div>
                  </div>
                  {currentPrice != null && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Trenutna cena</div>
                      <div className="font-mono font-semibold text-sm tabular-nums">
                        {formatPriceShort(currentPrice, currency)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="listingId">ID hartije od vrednosti</Label>
                <Input
                  id="listingId"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Unesite ID hartije"
                  {...register('listingId', { valueAsNumber: true })}
                  data-testid="price-alert-listing-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: koristite dugme &quot;Postavi cenovni alarm&quot; sa stranice
                  hartije da se polje popuni automatski.
                </p>
                {errors.listingId && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {errors.listingId.message}
                  </p>
                )}
              </div>
            )}

            {/* Condition radio */}
            <div>
              <Label>Uslov</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setValue('condition', 'ABOVE', { shouldValidate: true })}
                  data-testid="price-alert-condition-ABOVE"
                  className={`relative border rounded-lg p-3 text-left transition-all ${
                    condition === 'ABOVE'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/30'
                      : 'border-border hover:border-emerald-400/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={`h-4 w-4 ${
                        condition === 'ABOVE'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <span className="text-sm font-semibold">Cena prelazi</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Iznad praga</p>
                </button>
                <button
                  type="button"
                  onClick={() => setValue('condition', 'BELOW', { shouldValidate: true })}
                  data-testid="price-alert-condition-BELOW"
                  className={`relative border rounded-lg p-3 text-left transition-all ${
                    condition === 'BELOW'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500/30'
                      : 'border-border hover:border-red-400/60 hover:bg-red-50/40 dark:hover:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown
                      className={`h-4 w-4 ${
                        condition === 'BELOW'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <span className="text-sm font-semibold">Cena pada ispod</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ispod praga</p>
                </button>
              </div>
              {errors.condition && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {errors.condition.message}
                </p>
              )}
            </div>

            {/* Threshold field */}
            <div>
              <Label htmlFor="threshold">
                Prag {currency ? `(${currency})` : ''}
              </Label>
              <Input
                id="threshold"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="0.00"
                {...register('threshold', { valueAsNumber: true })}
                data-testid="price-alert-threshold"
              />
              {helperText && (
                <p
                  className={`text-xs mt-1 ${
                    helperText.tone === 'positive'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : helperText.tone === 'negative'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }`}
                  data-testid="price-alert-threshold-helper"
                >
                  {helperText.text}
                </p>
              )}
              {errors.threshold && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {errors.threshold.message}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Otkazi
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={isSubmitting || wrongSide}
                data-testid="price-alert-submit"
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
              >
                <BellRing className="h-4 w-4 mr-1.5" />
                {isSubmitting ? 'Postavljam...' : 'Postavi alarm'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
