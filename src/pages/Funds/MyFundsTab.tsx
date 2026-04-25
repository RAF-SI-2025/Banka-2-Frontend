import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import investmentFundService from '@/services/investmentFundService';
import type { ClientFundPosition, InvestmentFundDetail } from '@/types/celina4';
import { formatAmount, getErrorMessage } from '@/utils/formatters';
import { toast } from '@/lib/notify';
import FundInvestDialog from './FundInvestDialog';
import FundWithdrawDialog from './FundWithdrawDialog';

type FundDetailsMap = Record<number, InvestmentFundDetail>;

export default function MyFundsTab() {
  const navigate = useNavigate();
  const { isSupervisor, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [positions, setPositions] = useState<ClientFundPosition[]>([]);
  const [detailsMap, setDetailsMap] = useState<FundDetailsMap>({});
  const [investDialogFundId, setInvestDialogFundId] = useState<number | null>(null);
  const [withdrawDialogPosition, setWithdrawDialogPosition] = useState<ClientFundPosition | null>(null);

  const loadClientData = async () => {
    const myPositions = await investmentFundService.myPositions();
    const uniqueFundIds = Array.from(new Set((myPositions ?? []).map((position) => position.fundId)));
    const detailEntries = await Promise.all(
      uniqueFundIds.map(async (fundId) => {
        const detail = await investmentFundService.get(fundId);
        return [fundId, detail] as const;
      })
    );
    setPositions(myPositions ?? []);
    setDetailsMap(Object.fromEntries(detailEntries));
  };

  const loadSupervisorData = async () => {
    const allFunds = await investmentFundService.list();
    const detailedFunds = await Promise.all(
      (allFunds ?? []).map(async (fund) => investmentFundService.get(fund.id))
    );
    const managedFunds = detailedFunds.filter((fund) => fund.managerEmployeeId === user?.id);
    setPositions([]);
    setDetailsMap(
      Object.fromEntries(managedFunds.map((fund) => [fund.id, fund]))
    );
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (isSupervisor) {
        await loadSupervisorData();
      } else {
        await loadClientData();
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Neuspesno ucitavanje fondova.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isSupervisor, user?.id]);

  const investFund = useMemo(
    () => (investDialogFundId != null ? detailsMap[investDialogFundId] : undefined),
    [detailsMap, investDialogFundId]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Moji fondovi</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Ucitavanje...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isSupervisor) {
    const managedFunds = Object.values(detailsMap);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Moji fondovi</CardTitle>
        </CardHeader>
        <CardContent>
          {managedFunds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nemate fondove kojima upravljate.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Vrednost fonda</TableHead>
                  <TableHead>Likvidnost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managedFunds.map((fund) => (
                  <TableRow
                    key={fund.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                  >
                    <TableCell className="font-medium">{fund.name}</TableCell>
                    <TableCell>{fund.description}</TableCell>
                    <TableCell>{formatAmount(fund.fundValue)} RSD</TableCell>
                    <TableCell>{formatAmount(fund.liquidAmount)} RSD</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {positions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Moji fondovi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nemate aktivne pozicije u fondovima.</p>
          </CardContent>
        </Card>
      ) : (
        positions.map((position) => {
          const detail = detailsMap[position.fundId];
          return (
            <Card key={position.id}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">{position.fundName}</CardTitle>
                <p className="text-sm text-muted-foreground">{detail?.description ?? '-'}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <p>Vrednost fonda: <span className="font-semibold">{formatAmount(detail?.fundValue)} RSD</span></p>
                  <p>Moj udeo: <span className="font-semibold">{formatAmount(position.percentOfFund)}%</span></p>
                  <p>Moj iznos: <span className="font-semibold">{formatAmount(position.currentValue)} RSD</span></p>
                  <p>Ulozeno: <span className="font-semibold">{formatAmount(position.totalInvested)} RSD</span></p>
                  <p>Profit: <span className="font-semibold">{formatAmount(position.profit)} RSD</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setInvestDialogFundId(position.fundId)}>
                    Uplati
                  </Button>
                  <Button variant="outline" onClick={() => setWithdrawDialogPosition(position)}>
                    Povuci
                  </Button>
                  <Button variant="ghost" onClick={() => navigate(`/funds/${position.fundId}`)}>
                    Detalji fonda
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {investFund && (
        <FundInvestDialog
          fundId={investFund.id}
          fundName={investFund.name}
          minimumContribution={investFund.minimumContribution}
          open={investDialogFundId != null}
          onClose={() => setInvestDialogFundId(null)}
          onSuccess={() => {
            setInvestDialogFundId(null);
            void loadData();
          }}
        />
      )}

      {withdrawDialogPosition && (
        <FundWithdrawDialog
          fundId={withdrawDialogPosition.fundId}
          fundName={withdrawDialogPosition.fundName}
          myPosition={withdrawDialogPosition}
          open={withdrawDialogPosition != null}
          onClose={() => setWithdrawDialogPosition(null)}
          onSuccess={() => {
            setWithdrawDialogPosition(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
