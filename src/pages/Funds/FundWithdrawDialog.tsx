import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { accountService } from '@/services/accountService';
import investmentFundService from '@/services/investmentFundService';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { ClientFundPosition, ClientFundTransaction } from '@/types/celina4';
import { formatAmount, getErrorMessage } from '@/utils/formatters';

interface FundWithdrawDialogProps {
  fundId: number;
  fundName: string;
  myPosition: ClientFundPosition;
  open: boolean;
  onClose: () => void;
  onSuccess: (transaction: ClientFundTransaction) => void;
}

export default function FundWithdrawDialog({
  fundId,
  fundName,
  myPosition,
  open,
  onClose,
  onSuccess,
}: FundWithdrawDialogProps) {
  const { isSupervisor } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [amount, setAmount] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');

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
        setDestinationAccountId(activeAccounts[0] ? String(activeAccounts[0].id) : '');
      } catch (error) {
        if (!cancelled) {
          setAccounts([]);
          setDestinationAccountId('');
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
      setWithdrawAll(false);
      setAmount('');
      setDestinationAccountId('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!destinationAccountId && accounts[0]) {
      setDestinationAccountId(String(accounts[0].id));
    }
  }, [accounts, destinationAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === Number(destinationAccountId)) ?? null,
    [accounts, destinationAccountId]
  );

  const parsedAmount = Number(amount);
  const amountIsValidNumber = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const canSubmit =
    !!selectedAccount &&
    !submitting &&
    !loadingAccounts &&
    (withdrawAll || amountIsValidNumber);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount) {
      toast.error('Izaberite racun za isplatu.');
      return;
    }

    if (!withdrawAll) {
      if (!amountIsValidNumber) {
        toast.error('Iznos mora biti veci od 0.');
        return;
      }
      if (parsedAmount > Number(myPosition.currentValue ?? 0)) {
        toast.error('Iznos ne moze biti veci od vrednosti vase pozicije.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const transaction = await investmentFundService.withdraw(fundId, {
        amount: withdrawAll ? undefined : parsedAmount,
        destinationAccountId: selectedAccount.id,
      });
      if (transaction.status === 'PENDING') {
        toast.success('Povlacenje ce biti obradjeno kad fond proda hartije.');
      } else {
        toast.success(`Povuceno ${formatAmount(transaction.amountRsd)} RSD.`);
      }
      onSuccess(transaction);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Povlacenje nije uspelo.'));
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
              <Dialog.Title className="text-xl font-semibold">Povlacenje iz fonda</Dialog.Title>
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
              Trenutna vrednost pozicije: <span className="font-semibold">{formatAmount(myPosition.currentValue)} RSD</span>
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="fund-withdraw-all"
                checked={withdrawAll}
                onCheckedChange={(checked) => setWithdrawAll(Boolean(checked))}
              />
              <Label htmlFor="fund-withdraw-all">Povuci celu poziciju</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fund-withdraw-amount">Iznos (RSD)</Label>
              <Input
                id="fund-withdraw-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Unesite iznos"
                disabled={withdrawAll}
              />
            </div>

            <div className="space-y-2">
              <Label>Racun za isplatu</Label>
              <Select
                value={destinationAccountId}
                onValueChange={setDestinationAccountId}
                disabled={loadingAccounts}
              >
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Odustani
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Obrada...' : 'Povuci'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
