import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_TYPE_LABEL_SR,
  type NotificationType,
} from '../types/notification';

// P1-fe-contracts-1 (01.06): imena su sada STVARNA BE NotificationType
// (NotificationType.java enum) — ranije su bila izmisljena (`PAYMENT_RECEIVED`...)
// pa labela nikad nije bila pronadjena na realnom BE odgovoru.
describe('NOTIFICATION_TYPE_LABEL_SR', () => {
  const allTypes: NotificationType[] = [
    'PAYMENT',
    'TRANSFER',
    'LIMIT_CHANGE',
    'CARD_BLOCKED',
    'CARD_UNBLOCKED',
    'LOAN_CREATED',
    'LOAN_APPROVED',
    'LOAN_REJECTED',
    'ORDER_PENDING',
    'ORDER_APPROVED',
    'ORDER_DECLINED',
    'ORDER_EXECUTED',
    'ORDER_PARTIAL_FILL',
    'ORDER_CANCELLED',
    'OTC_COUNTER_OFFER',
    'OTC_ACCEPTED',
    'OTC_DECLINED',
    'OTC_CONTRACT_EXPIRING',
    'ACCOUNT_LOCKED',
    'PRICE_ALERT_TRIGGERED',
    'RECURRING_ORDER_SKIPPED',
    'GENERAL',
  ];

  it('contains a Serbian label for every BE NotificationType (21 vrednost)', () => {
    expect(Object.keys(NOTIFICATION_TYPE_LABEL_SR)).toHaveLength(allTypes.length);
    for (const t of allTypes) {
      expect(NOTIFICATION_TYPE_LABEL_SR[t]).toBeTruthy();
      expect(typeof NOTIFICATION_TYPE_LABEL_SR[t]).toBe('string');
    }
  });

  it('PAYMENT label is human-readable Serbian', () => {
    expect(NOTIFICATION_TYPE_LABEL_SR.PAYMENT).toMatch(/placanje/i);
  });

  it('ORDER_EXECUTED label mentions order', () => {
    expect(NOTIFICATION_TYPE_LABEL_SR.ORDER_EXECUTED.toLowerCase()).toContain('order');
  });

  it('ACCOUNT_LOCKED label mentions locking', () => {
    expect(NOTIFICATION_TYPE_LABEL_SR.ACCOUNT_LOCKED.toLowerCase()).toMatch(/zaklju/);
  });

  it('GENERAL label is a fallback string', () => {
    expect(NOTIFICATION_TYPE_LABEL_SR.GENERAL).toBeTruthy();
  });
});
