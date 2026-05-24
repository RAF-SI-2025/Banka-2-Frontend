// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Stranica sa listom in-app notifikacija
// ============================================================

import { useEffect, useState } from 'react';
import {
  Bell,
  DollarSign,
  TrendingUp,
  Handshake,
  PiggyBank,
  CreditCard,
  Lock,
  AlertCircle,
  CheckCheck,
  Dot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import { toast } from '@/lib/notify';
import { notificationService } from '@/services/notificationService';
import type { NotificationDto, NotificationType } from '@/types/notification';

// ============================================================
// Helper funkcije
// ============================================================

function getNotificationIcon(type: NotificationType): React.ReactNode {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_SENT':
      return <DollarSign className={iconClass} />;
    case 'ORDER_FILLED':
    case 'ORDER_DECLINED':
      return <TrendingUp className={iconClass} />;
    case 'OTC_OFFER_RECEIVED':
    case 'OTC_OFFER_ACCEPTED':
    case 'OTC_OFFER_DECLINED':
    case 'OTC_CONTRACT_EXERCISED':
    case 'OTC_CONTRACT_EXPIRED':
      return <Handshake className={iconClass} />;
    case 'FUND_INTEREST_PAID':
    case 'FUND_DEPOSIT_MATURED':
      return <PiggyBank className={iconClass} />;
    case 'LOAN_APPROVED':
    case 'LOAN_DECLINED':
    case 'LOAN_PAYMENT_DUE':
      return <AlertCircle className={iconClass} />;
    case 'CARD_BLOCKED':
    case 'CARD_UNBLOCKED':
      return <CreditCard className={iconClass} />;
    case 'ACCOUNT_LOCKED':
      return <Lock className={iconClass} />;
    default:
      return <Bell className={iconClass} />;
  }
}

function formatRelativeTime(dateIso: string): string {
  const date = new Date(dateIso);
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return 'upravo sad';
  if (secondsAgo < 3600) return `pre ${Math.floor(secondsAgo / 60)} min`;
  if (secondsAgo < 86400) return `pre ${Math.floor(secondsAgo / 3600)} h`;
  if (secondsAgo < 604800) return `pre ${Math.floor(secondsAgo / 86400)} d`;

  return date.toLocaleDateString('sr-RS');
}

// ============================================================
// Component
// ============================================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(0);

  // Fetch notifikacija
  useEffect(() => {
    setLoading(true);
    const params = {
      page,
      size: 20,
      read: filter === 'unread' ? false : undefined,
    };

    notificationService
      .listNotifications(params)
      .then(result => setNotifications(result.content))
      .catch(() => toast.error('Greška pri učitavanju notifikacija'))
      .finally(() => setLoading(false));
  }, [page, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasMoreUnread = unreadCount > 0;

  // Označi sve kao pročitane
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Sve notifikacije su označene kao pročitane');
    } catch {
      toast.error('Greška pri označi sve');
    }
  };

  // Označi pojedinačnu kao pročitanu
  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      toast.error('Greška pri označi');
    }
  };

  // Resetuj filter na prvu stranu
  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
    setPage(0);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl" data-testid="notifications-page">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifikacije"
          description="Vašа obaveštenja"
        />
        <div className="mt-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-4xl" data-testid="notifications-page">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifikacije"
          description="Vašа obaveštenja"
        />
        <div className="mt-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Nemate notifikacija</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" data-testid="notifications-page">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifikacije"
          description={`${notifications.length} notifikacija`}
          actions={
            hasMoreUnread && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Označi sve pročitanim
              </Button>
            )
          }
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('all')}
          data-testid="filter-all"
        >
          Sve
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('unread')}
          data-testid="filter-unread"
        >
          Nepročitane ({unreadCount})
        </Button>
      </div>

      {/* Notifikacije lista */}
      <div className="space-y-3">
        {notifications.map(notification => (
          <Card
            key={notification.id}
            data-testid={`notification-item-${notification.id}`}
            className={`p-4 flex gap-3 items-start cursor-pointer transition-colors hover:bg-accent ${
              !notification.read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
            }`}
          >
            {/* Icon */}
            <div className="mt-1 flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`font-semibold text-sm line-clamp-1 ${
                    !notification.read ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {notification.message}
                  </p>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <Dot className="w-6 h-6 text-blue-500 flex-shrink-0" />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </p>

                {/* Mark as read button */}
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkAsRead(notification.id)}
                    data-testid={`mark-read-btn-${notification.id}`}
                    className="h-auto p-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
