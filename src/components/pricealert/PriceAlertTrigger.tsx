import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PriceAlertDialog from './PriceAlertDialog';

interface PriceAlertTriggerProps {
  listingId: number;
  ticker: string;
  currentPrice: number | null;
  currency: string;
  variant?: 'icon' | 'full';
}

export default function PriceAlertTrigger({
  listingId,
  ticker,
  currentPrice,
  currency,
  variant = 'icon',
}: PriceAlertTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'full' ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid={`price-alert-trigger-${ticker}`}
          onClick={() => setOpen(true)}
        >
          <Bell className="h-4 w-4" />
          Cenovni alarm
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Alarm za ${ticker}`}
          data-testid={`price-alert-trigger-${ticker}`}
          onClick={() => setOpen(true)}
        >
          <BellRing className="h-4 w-4 text-muted-foreground hover:text-indigo-600" />
        </Button>
      )}
      <PriceAlertDialog
        listingId={listingId}
        ticker={ticker}
        currentPrice={currentPrice}
        currency={currency}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
