// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// HTTP klijent za /notifications endpoint-e
// ============================================================

import api from './api';
import type {
  NotificationDto,
  NotificationPageDto,
  UnreadCountDto,
} from '../types/notification';

interface ListNotificationParams {
  read?: boolean;
  page?: number;
  size?: number;
}

export const notificationService = {
  listNotifications: async (
    params: ListNotificationParams = {}
  ): Promise<NotificationPageDto<NotificationDto>> => {
    const { data } = await api.get<NotificationPageDto<NotificationDto>>(
      '/notifications',
      { params }
    );
    return data;
  },

  getUnreadCount: async (): Promise<UnreadCountDto> => {
    const { data } = await api.get<UnreadCountDto>('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: number): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },
};
