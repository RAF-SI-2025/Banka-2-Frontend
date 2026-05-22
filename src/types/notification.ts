// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Tipovi za sistem in-app notifikacija
// ============================================================

export type NotificationType =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_SENT'
  | 'ORDER_FILLED'
  | 'ORDER_DECLINED'
  | 'OTC_OFFER_RECEIVED'
  | 'OTC_OFFER_ACCEPTED'
  | 'OTC_OFFER_DECLINED'
  | 'OTC_CONTRACT_EXERCISED'
  | 'OTC_CONTRACT_EXPIRED'
  | 'FUND_INTEREST_PAID'
  | 'FUND_DEPOSIT_MATURED'
  | 'LOAN_APPROVED'
  | 'LOAN_DECLINED'
  | 'LOAN_PAYMENT_DUE'
  | 'CARD_BLOCKED'
  | 'CARD_UNBLOCKED'
  | 'ACCOUNT_LOCKED'
  | 'GENERIC';

export interface NotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

export interface NotificationPageDto<T = NotificationDto> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface UnreadCountDto {
  count: number;
}

export const NOTIFICATION_TYPE_LABEL_SR: Record<NotificationType, string> = {
  PAYMENT_RECEIVED: 'Primljeno plaćanje',
  PAYMENT_SENT: 'Plaćanje poslano',
  ORDER_FILLED: 'Narudžbina izvršena',
  ORDER_DECLINED: 'Narudžbina odbijena',
  OTC_OFFER_RECEIVED: 'Primljena OTC ponuda',
  OTC_OFFER_ACCEPTED: 'OTC ponuda prihvaćena',
  OTC_OFFER_DECLINED: 'OTC ponuda odbijena',
  OTC_CONTRACT_EXERCISED: 'Ugovor izvršen',
  OTC_CONTRACT_EXPIRED: 'Ugovor istekao',
  FUND_INTEREST_PAID: 'Kamata na fond isplaćena',
  FUND_DEPOSIT_MATURED: 'Depozit dospeo',
  LOAN_APPROVED: 'Kredit odobren',
  LOAN_DECLINED: 'Kredit odbijen',
  LOAN_PAYMENT_DUE: 'Rok za plaćanje kredita',
  CARD_BLOCKED: 'Kartica blokirana',
  CARD_UNBLOCKED: 'Kartica odblokirana',
  ACCOUNT_LOCKED: 'Račun zaključan',
  GENERIC: 'Obaveštenje',
};
