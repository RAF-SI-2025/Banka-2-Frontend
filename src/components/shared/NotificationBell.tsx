// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Zvono za notifikacije sa bedž-om broja nepročitanih
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';

const POLLING_INTERVAL = 30_000; // 30 sekundi

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Ne polling ako korisnik nije prijavljen
    if (!isAuthenticated) return;

    // Inicijalni fetch
    const fetchUnreadCount = async () => {
      try {
        const result = await notificationService.getUnreadCount();
        setUnreadCount(result.count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();

    // Polling svakih 30s
    const intervalId = setInterval(fetchUnreadCount, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  const displayCount = unreadCount > 9 ? '9+' : unreadCount;
  const ariaLabel = unreadCount > 0 
    ? `Notifikacije, ${unreadCount} nepročitanih` 
    : 'Notifikacije';

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/notifications')}
        data-testid="notification-bell"
        aria-label={ariaLabel}
        title={ariaLabel}
        className="relative"
      >
        <Bell className="h-4 w-4" />
      </Button>
      
      {unreadCount > 0 && (
        <div
          data-testid="notification-badge"
          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white"
        >
          {displayCount}
        </div>
      )}
    </div>
  );
}
