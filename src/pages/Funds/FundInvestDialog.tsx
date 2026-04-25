import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { accountService } from '@/services/accountService';
import investmentFundService from '@/services/investmentFundService';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Account } from '@/types/celina2';
import type { ClientFundPosition } from '@/types/celina4';
import { formatAmount, getErrorMessage } from '@/utils/formatters';

interface FundInvestDialogProps {
  fundId: number;
  fundName: string;
  minimumContribution: number;
  open: boolean;
  onClose: () => void;
  onSuccess: (position: ClientFundPosition) => void;
}

export default function FundInvestDialog({
  fundId,
  fundName,
  minimumContribution,
  open,
  onClose,
  onSuccess,
}: FundInvestDialogProps) {
  const { isSupervisor } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = isSupervisor
          ? await accountService.getBankAccounts()
          : await accountService.getMyAccounts();
        if (cancelled) return;
        const activeAccounts = (response ?? []).filter((account) => account.status === 'ACTIVE');
        setAccounts(activeAccounts);
        setSourceAccountId(activeAccounts[0] ? String(activeAccounts[0].id) : '');
      } catch (error) {
        if (!cancelled) {
          setAccounts([]);
          setSourceAccountId('');
          toast.error(getErrorMessage(error, 'Neuspesno ucitavanje racuna.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingAccounts(false);
        }
      }
    };

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [open, isSupervisor]);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setSourceAccountId('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!sourceAccountId && accounts[0]) {
      setSourceAccountId(String(accounts[0].id));
    }
  }, [accounts, sourceAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === Number(sourceAccountId)) ?? null,
    [accounts, sourceAccountId]
  );

  const parsedAmount = Number(amount);
  const amountIsValidNumber = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const canSubmit = amountIsValidNumber && !!selectedAccount && !submitting && !loadingAccounts;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount) {
      toast.error('Izaberite racun.');
      return;
    }

    if (!amountIsValidNumber) {
      toast.error('Iznos mora biti veci od 0.');
      return;
    }

    if (parsedAmount < minimumContribution) {
      toast.error(`Minimalni ulog je ${formatAmount(minimumContribution)} RSD.`);
      return;
    }

    if (Number(selectedAccount.availableBalance ?? 0) < parsedAmount) {
      toast.error('Nedovoljno sredstava na izabranom racunu.');
      return;
    }

    setSubmitting(true);
    try {
      const position = await investmentFundService.invest(fundId, {
        amount: parsedAmount,
        currency: selectedAccount.currency,
        sourceAccountId: selectedAccount.id,
      });
      toast.success(`Uplata u fond "${fundName}" je uspesna.`);
      onSuccess(position);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Uplata u fond nije uspela.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
          <div className="flex items-start justify-between border-b p-6">
            <div>
              <Dialog.Title className="text-xl font-semibold">Uplata u fond</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {fundName}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Zatvori"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form className="space-y-4 p-6" onSubmit={handleSubmit}>
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              Minimalni ulog: <span className="font-semibold">{formatAmount(minimumContribution)} RSD</span>
            </p>

            <div className="space-y-2">
              <Label htmlFor="fund-invest-amount">Iznos (RSD)</Label>
              <Input
                id="fund-invest-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Unesite iznos"
              />
            </div>

            <div className="space-y-2">
              <Label>Racun za uplatu</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId} disabled={loadingAccounts}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingAccounts ? 'Ucitavanje racuna...' : 'Izaberite racun'} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.accountNumber} | {formatAmount(account.availableBalance)} {account.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fund-invest-currency">Valuta</Label>
              <Input
                id="fund-invest-currency"
                value={selectedAccount?.currency ?? ''}
                readOnly
                placeholder="Automatski iz racuna"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Odustani
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Uplata...' : 'Uplati'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
