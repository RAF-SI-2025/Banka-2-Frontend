// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
//
// Tipovi za sistem in-app notifikacija. Koristi se u
// notificationService, NotificationBell i NotificationsPage.
// Spec: Zadaci_Frontend.pdf, FE1.
//
// P1-fe-contracts-1 (01.06): tipovi i polja uskladjeni sa STVARNIM BE
// kontraktom (NotificationType.java enum + NotificationDto.java) — ranije je
// FE imao izmisljena imena (`PAYMENT_RECEIVED`, `ORDER_FILLED`...) kojih
// nema u BE enum-u, a citao je `message`/`relatedEntity*` umesto BE
// `body`/`reference*` → lista bez labela + deep-link mrtav.
// ============================================================

/**
 * Mora se 1:1 poklapati sa BE {@code NotificationType.name()}
 * (rs.raf.banka2_bek.notification.model.NotificationType). BE salje enum ime
 * kao plain string u {@code NotificationDto.type}.
 */
export type NotificationType =
  | 'PAYMENT'
  | 'TRANSFER'
  | 'LIMIT_CHANGE'
  | 'CARD_BLOCKED'
  | 'CARD_UNBLOCKED'
  | 'LOAN_CREATED'
  | 'LOAN_APPROVED'
  | 'LOAN_REJECTED'
  | 'ORDER_PENDING'
  | 'ORDER_APPROVED'
  | 'ORDER_DECLINED'
  | 'ORDER_EXECUTED'
  | 'ORDER_PARTIAL_FILL'
  | 'ORDER_CANCELLED'
  | 'OTC_COUNTER_OFFER'
  | 'OTC_ACCEPTED'
  | 'OTC_DECLINED'
  | 'OTC_CONTRACT_EXPIRING'
  | 'ACCOUNT_LOCKED'
  | 'PRICE_ALERT_TRIGGERED'
  | 'RECURRING_ORDER_SKIPPED'
  | 'GENERAL';

export interface NotificationDto {
  id: number;
  /** BE enum ime (vidi {@link NotificationType}); moze biti i nepoznat string. */
  type: NotificationType | string;
  title: string;
  /** BE polje je `body` (ne `message`). */
  body: string;
  read: boolean;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** BE deep-link metapodaci. Ranije FE: `relatedEntityType`/`relatedEntityId`. */
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface NotificationPageDto<T> {
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
  PAYMENT: 'Placanje',
  TRANSFER: 'Prenos sredstava',
  LIMIT_CHANGE: 'Promena limita',
  CARD_BLOCKED: 'Kartica blokirana',
  CARD_UNBLOCKED: 'Kartica odblokirana',
  LOAN_CREATED: 'Zahtev za kredit kreiran',
  LOAN_APPROVED: 'Kredit odobren',
  LOAN_REJECTED: 'Kredit odbijen',
  ORDER_PENDING: 'Order na cekanju',
  ORDER_APPROVED: 'Order odobren',
  ORDER_DECLINED: 'Order odbijen',
  ORDER_EXECUTED: 'Order izvrsen',
  ORDER_PARTIAL_FILL: 'Order delimicno izvrsen',
  ORDER_CANCELLED: 'Order otkazan',
  OTC_COUNTER_OFFER: 'OTC kontraponuda',
  OTC_ACCEPTED: 'OTC ponuda prihvacena',
  OTC_DECLINED: 'OTC ponuda odbijena',
  OTC_CONTRACT_EXPIRING: 'OTC ugovor uskoro istice',
  ACCOUNT_LOCKED: 'Nalog zakljucan',
  PRICE_ALERT_TRIGGERED: 'Cenovni alarm aktiviran',
  RECURRING_ORDER_SKIPPED: 'Trajni nalog preskocen',
  GENERAL: 'Obavestenje',
};
