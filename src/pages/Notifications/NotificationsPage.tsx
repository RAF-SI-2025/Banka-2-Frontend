// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
//
// In-app notifikacioni inboks. Dostupno svim ulogovanim korisnicima.
// Spec: Zadaci_Frontend.pdf, FE1.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Banknote,
  ShoppingCart,
  Handshake,
  CreditCard,
  FileText,
  PiggyBank,
  Lock,
  AlertCircle,
  CheckCheck,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import { toast } from '@/lib/notify';
import { notificationService } from '@/services/notificationService';
import {
  type NotificationDto,
  type NotificationType,
  NOTIFICATION_TYPE_LABEL_SR,
} from '@/types/notification';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

type FilterMode = 'ALL' | 'UNREAD';

// P1-fe-contracts-1: kljucevi su sad STVARNA BE NotificationType imena.
const ICON_BY_TYPE: Partial<Record<NotificationType, React.ComponentType<{ className?: string }>>> = {
  PAYMENT: Banknote,
  TRANSFER: Banknote,
  LIMIT_CHANGE: FileText,
  ORDER_PENDING: ShoppingCart,
  ORDER_APPROVED: ShoppingCart,
  ORDER_DECLINED: ShoppingCart,
  ORDER_EXECUTED: ShoppingCart,
  ORDER_PARTIAL_FILL: ShoppingCart,
  ORDER_CANCELLED: ShoppingCart,
  OTC_COUNTER_OFFER: Handshake,
  OTC_ACCEPTED: Handshake,
  OTC_DECLINED: Handshake,
  OTC_CONTRACT_EXPIRING: Handshake,
  PRICE_ALERT_TRIGGERED: PiggyBank,
  RECURRING_ORDER_SKIPPED: PiggyBank,
  LOAN_CREATED: FileText,
  LOAN_APPROVED: FileText,
  LOAN_REJECTED: FileText,
  CARD_BLOCKED: CreditCard,
  CARD_UNBLOCKED: CreditCard,
  ACCOUNT_LOCKED: Lock,
  GENERAL: Bell,
};

function resolveDeepLink(n: NotificationDto): string | null {
  // P1-fe-contracts-1: BE polja su `referenceType`/`referenceId` (ne `relatedEntity*`).
  const t = n.referenceType?.toUpperCase();
  if (!t) return null;
  if (t === 'PAYMENT' || t === 'TRANSFER') return '/payments/history';
  if (t === 'ORDER') return '/orders/my';
  if (t === 'OTC_OFFER' || t === 'OTC_CONTRACT' || t === 'OTC') return '/otc';
  if (t === 'FUND') return n.referenceId ? `/funds/${n.referenceId}` : '/funds';
  if (t === 'CARD') return '/cards';
  if (t === 'LOAN' || t === 'LOAN_REQUEST') return '/loans';
  if (t === 'ACCOUNT') return '/accounts';
  // R1 689: BE emituje i RECURRING_ORDER / PRICE_ALERT reference (RecurringOrderScheduler,
  // PriceAlertService) — bez ovih grana te notifikacije nisu bile klikabilne.
  if (t === 'RECURRING_ORDER') return '/recurring-orders';
  if (t === 'PRICE_ALERT') return '/price-alerts';
  // TAX notifikacija (poreski obracun) nema klijentski-vidljivu rutu (TaxPortal je
  // employee-only) → namerno bez deep-link-a; klijent prati naplatu kroz /accounts.
  return null;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('sr-RS', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(
    async (targetPage: number, mode: FilterMode) => {
      setLoading(true);
      setError(null);
      try {
        const params: { onlyUnread?: boolean; page: number; size: number } = {
          page: targetPage,
          size: PAGE_SIZE,
        };
        if (mode === 'UNREAD') params.onlyUnread = true;
        const data = await notificationService.listNotifications(params);
        setItems(data.content ?? []);
        setTotalPages(data.totalPages ?? 0);
        setPage(data.number ?? targetPage);
      } catch {
        setError('Neuspeh ucitavanja notifikacija.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { count } = await notificationService.getUnreadCount();
      setUnreadCount(count ?? 0);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void load(0, filter);
    void refreshUnreadCount();
  }, [filter, load, refreshUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      toast.success('Sve notifikacije oznacene kao procitane.');
      await load(page, filter);
      await refreshUnreadCount();
    } catch {
      toast.error('Neuspeh oznacavanja kao procitano.');
    }
  }, [filter, load, page, refreshUnreadCount]);

  const handleRowClick = useCallback(
    async (n: NotificationDto) => {
      // Optimisticki update — odmah obelezi kao procitano u UI-u.
      if (!n.read) {
        // FE-FND-06 fix: capture filter mode at click time; ako se filter
        // promenio izmedju click-a i odgovora servera, NE radimo rollback —
        // items array vise nije isti pa bi rollback narusio UI.
        const filterAtClick = filter;
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        try {
          await notificationService.markAsRead(n.id);
          await refreshUnreadCount();
        } catch {
          if (filter === filterAtClick) {
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
          }
          toast.error('Neuspeh oznacavanja notifikacije.');
        }
      }
      const link = resolveDeepLink(n);
      if (link) navigate(link);
    },
    [filter, navigate, refreshUnreadCount]
  );

  const hasItems = items.length > 0;
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const allMarkDisabled = unreadCount === 0;

  return (
    <div
      className="container mx-auto p-6 max-w-4xl"
      data-testid="notifications-page"
    >
      <div className="mb-6">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifikacije"
          description="Sva obavestenja o tvom nalogu i aktivnostima"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={allMarkDisabled}
              data-testid="mark-all-read-btn"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Oznaci sve kao procitano
            </Button>
          }
        />
      </div>

      {/* Filter tabs */}
      <Card className="p-2 mb-4">
        <div className="flex items-center gap-1">
          <FilterTab
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
            label="Sve"
            testid="filter-all"
          />
          <FilterTab
            active={filter === 'UNREAD'}
            onClick={() => setFilter('UNREAD')}
            label={`Neprocitane${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            testid="filter-unread"
          />
        </div>
      </Card>

      {/* Body */}
      {loading ? (
        <NotificationsSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Greska</AlertTitle>
          <AlertDescription>
            {error}{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => load(page, filter)}
              data-testid="reload-btn"
            >
              Pokusaj ponovo
            </Button>
          </AlertDescription>
        </Alert>
      ) : !hasItems ? (
        <Card className="p-12 text-center" data-testid="empty-state">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nemate notifikacija</h3>
          <p className="text-muted-foreground">
            {filter === 'UNREAD'
              ? 'Sve notifikacije su procitane.'
              : 'Cim se nesto desi na tvom nalogu, javicemo ti ovde.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationRow key={n.id} item={n} onClick={() => handleRowClick(n)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => load(page - 1, filter)}
            data-testid="prev-page"
          >
            Prethodna
          </Button>
          <div className="text-sm text-muted-foreground" data-testid="page-indicator">
            Strana {page + 1} od {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => load(page + 1, filter)}
            data-testid="next-page"
          >
            Sledeca
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  testid,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={cn(
        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-400 shadow-sm'
          : 'text-muted-foreground hover:bg-accent'
      )}
      aria-pressed={active ? 'true' : 'false'}
    >
      {label}
    </button>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationDto;
  onClick: () => void;
}) {
  const Icon = ICON_BY_TYPE[item.type as NotificationType] ?? Bell;
  return (
    <Card
      onClick={onClick}
      onKeyDown={(e) => {
        // R7 2036: klikabilan Card mora biti dostupan i tastaturom (Enter/Space).
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Obavestenje: ${item.title}`}
      data-testid={`notification-row-${item.id}`}
      className={cn(
        'p-4 flex gap-3 cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
        !item.read && 'border-indigo-500/40'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          !item.read
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm',
              !item.read ? 'font-semibold' : 'text-muted-foreground'
            )}
          >
            {item.title}
          </span>
          <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
            {NOTIFICATION_TYPE_LABEL_SR[item.type as NotificationType] ?? 'Obavestenje'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {item.body}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatDateTime(item.createdAt)}
        </p>
      </div>
      {!item.read && (
        <span
          aria-label="Neprocitano"
          data-testid={`unread-dot-${item.id}`}
          className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0"
        />
      )}
    </Card>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-2" data-testid="notifications-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4 flex gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}
