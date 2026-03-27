import { useEffect, useState } from 'react';
import { toast } from '@/lib/notify';
import { CreditCard, Check, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';

interface CardReq {
  id: number;
  accountId: number;
  accountNumber: string;
  cardLimit: number;
  clientEmail: string;
  clientName: string;
  status: string;
  createdAt: string;
}

export default function CardRequestsPage() {
  const [requests, setRequests] = useState<CardReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cards/requests?page=0&limit=50');
      const data = res.data;
      setRequests(Array.isArray(data?.content) ? data.content : []);
    } catch {
      toast.error('Neuspešno učitavanje zahteva.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(id);
    try {
      if (action === 'approve') {
        await api.patch(`/cards/requests/${id}/approve`);
        toast.success('Zahtev odobren, kartica kreirana.');
      } else {
        const reason = window.prompt('Razlog odbijanja (opciono):');
        await api.patch(`/cards/requests/${id}/reject`, { reason });
        toast.success('Zahtev odbijen.');
      }
      await load();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Akcija nije uspela.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zahtevi za kartice</h1>
          <p className="text-sm text-muted-foreground">Pregledajte i odobrite zahteve klijenata za izdavanje kartica.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Lista zahteva</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nema zahteva za prikaz</h3>
              <p className="mt-1 text-sm text-muted-foreground">Trenutno nema zahteva za izdavanje kartica.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Klijent</th>
                    <th className="py-2 text-left">Račun</th>
                    <th className="py-2 text-left">Limit</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Datum</th>
                    <th className="py-2 text-left">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2">
                        <div>{req.clientName}</div>
                        <div className="text-xs text-muted-foreground">{req.clientEmail}</div>
                      </td>
                      <td className="py-2 font-mono text-xs">{req.accountNumber}</td>
                      <td className="py-2">{Number(req.cardLimit || 0).toLocaleString('sr-RS')} RSD</td>
                      <td className="py-2">
                        <Badge variant={req.status === 'APPROVED' ? 'success' : req.status === 'REJECTED' ? 'destructive' : 'warning'}>
                          {req.status === 'PENDING' ? 'Na čekanju' : req.status === 'APPROVED' ? 'Odobreno' : 'Odbijeno'}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">{new Date(req.createdAt).toLocaleString('sr-RS')}</td>
                      <td className="py-2">
                        {req.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={processing === req.id}
                              onClick={() => handleAction(req.id, 'approve')}
                              className="text-green-600 border-green-300 hover:bg-green-50">
                              <Check className="h-3 w-3 mr-1" /> Odobri
                            </Button>
                            <Button size="sm" variant="outline" disabled={processing === req.id}
                              onClick={() => handleAction(req.id, 'reject')}
                              className="text-red-600 border-red-300 hover:bg-red-50">
                              <XIcon className="h-3 w-3 mr-1" /> Odbij
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
