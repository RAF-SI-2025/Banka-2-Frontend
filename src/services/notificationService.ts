// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
//
// HTTP klijent za rad sa /notifications endpoint-ima na BE-u.
// Spec: Zadaci_Frontend.pdf, FE1.
// ============================================================

import api from './api';
import type {
  NotificationDto,
  NotificationPageDto,
  UnreadCountDto,
} from '../types/notification';

interface ListParams {
  /** true => samo neprocitane. BE param je `onlyUnread` (ne `read`). */
  onlyUnread?: boolean;
  page?: number;
  size?: number;
}

export const notificationService = {
  listNotifications: async (
    params: ListParams = {}
  ): Promise<NotificationPageDto<NotificationDto>> => {
    const query: Record<string, unknown> = {};
    // P1-fe-contracts-1: BE NotificationController cita `onlyUnread` (Boolean),
    // ne `read`. Slanje `read=false` je BE tiho ignorisao → UNREAD filter je
    // vracao SVE notifikacije.
    if (params.onlyUnread === true) query.onlyUnread = true;
    if (typeof params.page === 'number') query.page = params.page;
    if (typeof params.size === 'number') query.size = params.size;
    const { data } = await api.get<NotificationPageDto<NotificationDto>>(
      '/notifications',
      { params: query }
    );
    return data;
  },

  getUnreadCount: async (): Promise<UnreadCountDto> => {
    const { data } = await api.get<UnreadCountDto>('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: number): Promise<void> => {
    await api.patch<void>(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch<void>('/notifications/read-all');
  },
};
