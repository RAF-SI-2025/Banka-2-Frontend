import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ScrollText } from 'lucide-react';
import { toast } from '@/lib/notify';
import interbankOtcService from '@/services/interbankOtcService';
import type { OtcInterbankContract } from '@/types/celina4';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAmount } from '@/utils/formatters';

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktivan',
  EXERCISED: 'Iskoriscen',
  EXPIRED: 'Istekao',
};

const statusBadgeVariant = (status: string): 'success' | 'secondary' | 'warning' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'EXERCISED') return 'secondary';
  return 'warning';
};

export default function OtcInterBankContractsTab() {
  const [contracts, setContracts] = useState<OtcInterbankContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await interbankOtcService.listMyContracts();
        setContracts(data ?? []);
      } catch {
        toast.error('Neuspesno ucitavanje inter-bank ugovora.');
        setContracts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedContracts = useMemo(
    () => [...contracts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [contracts],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inter-bank ugovori</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : sortedContracts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Trenutno nema sklopljenih inter-bank ugovora.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hartija</TableHead>
                  <TableHead>Banka kupca / prodavca</TableHead>
                  <TableHead>Kolicina</TableHead>
                  <TableHead>Strike / Premija</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{contract.listingTicker}</span>
                        <span className="text-xs text-muted-foreground">{contract.listingName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>Kupac: {contract.buyerBankCode}</div>
                      <div className="text-muted-foreground">Prodavac: {contract.sellerBankCode}</div>
                    </TableCell>
                    <TableCell className="font-mono">{contract.quantity}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <div>
                        {formatAmount(contract.strikePrice)} {contract.listingCurrency}
                      </div>
                      <div className="text-muted-foreground">
                        Prem: {formatAmount(contract.premium)} {contract.listingCurrency}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(contract.status)}>
                        {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert>
        <ScrollText className="h-4 w-4" />
        <AlertDescription>
          Prikaz exercise i SAGA flow-a bice prosiren u sledecoj iteraciji kada BE zavrsi status tok za inter-bank OTC ugovore.
        </AlertDescription>
      </Alert>

      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Ovaj tab trenutno pokriva read-only pregled ugovora kako bi inter-bank navigacija i fetch tok bili kompletni.
        </AlertDescription>
      </Alert>
    </div>
  );
}
