// ============================================================
// ConfirmDialog — reusable potvrda akcije (Radix Dialog).
//
// Zamena za native `window.confirm` (R1 561): konzistentan izgled sa ostatkom
// app-a (gradijent header kao PriceAlertDialog), a11y (focus trap, Esc, fokus
// restore) preko @radix-ui/react-dialog. Kontrolisan komponentom: roditelj drzi
// `open` i `onConfirm`/`onCancel`.
// ============================================================

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Tekst potvrdnog dugmeta (default "Potvrdi"). */
  confirmLabel?: string;
  /** Tekst dugmeta za otkazivanje (default "Otkazi"). */
  cancelLabel?: string;
  /** Destruktivna akcija → crveno dugme. */
  destructive?: boolean;
  /** Onemoguci dugmad dok traje async akcija. */
  busy?: boolean;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Potvrdi',
  cancelLabel = 'Otkazi',
  destructive = false,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-2xl shadow-2xl p-0 w-full max-w-md overflow-hidden"
          data-testid="confirm-dialog"
        >
          <div
            className={`p-5 text-white bg-gradient-to-br ${
              destructive ? 'from-red-500 to-rose-600' : 'from-indigo-500 to-violet-600'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="text-xs text-white/80 mt-0.5">
                      {description}
                    </Dialog.Description>
                  )}
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

          <div className="p-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={busy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              data-testid="confirm-dialog-confirm"
              disabled={busy}
              variant={destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
