import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTION_TYPES,
  TRADING_AUDIT_ACTION_TYPES,
  AUDIT_ACTION_LABEL_SR,
  type AuditActionType,
} from './audit';

describe('audit types', () => {
  // R1 390: dropdown je ranije imao samo 6 tipova; sada pokriva UNIJU oba BE enuma.
  it('AUDIT_ACTION_TYPES pokriva sve BE tipove (oba servisa), ne samo prvih 6', () => {
    // Zajednicki + banka-core + trading-service tipovi.
    const beTypes: AuditActionType[] = [
      'LIMIT_CHANGED', 'USED_LIMIT_RESET', 'ORDER_APPROVED', 'ORDER_DECLINED',
      'PERMISSIONS_CHANGED', 'TAX_RUN_TRIGGERED',
      'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_EARLY_REPAYMENT',
      'LOAN_INSTALLMENT_PAID', 'LOAN_INSTALLMENT_FAILED',
      'PAYMENT_CREATED', 'PAYMENT_ABORTED', 'PAYMENT_QUICK_APPROVED',
      'TRANSFER_INTERNAL', 'TRANSFER_FX',
      'SAVINGS_OPENED', 'SAVINGS_WITHDRAWN_EARLY', 'SAVINGS_AUTO_RENEWED',
      'CARD_BLOCKED', 'CARD_UNBLOCKED', 'CARD_LIMIT_CHANGED', 'CARD_DEACTIVATED',
      'ACCOUNT_STATUS_CHANGED', 'ACCOUNT_LIMITS_CHANGED', 'EMPLOYEE_DEACTIVATED',
      'FUND_CREATED', 'FUND_INVEST', 'FUND_WITHDRAW', 'USED_LIMIT_RESET_ALL',
    ];
    expect(AUDIT_ACTION_TYPES.length).toBeGreaterThan(6);
    beTypes.forEach((t) => expect(AUDIT_ACTION_TYPES).toContain(t));
    // Bez duplikata.
    expect(new Set(AUDIT_ACTION_TYPES).size).toBe(AUDIT_ACTION_TYPES.length);
  });

  it('AUDIT_ACTION_LABEL_SR mapira svaki AuditActionType na srpsku labelu', () => {
    for (const type of AUDIT_ACTION_TYPES) {
      expect(AUDIT_ACTION_LABEL_SR[type]).toBeDefined();
      expect(AUDIT_ACTION_LABEL_SR[type].length).toBeGreaterThan(0);
    }
  });

  it('AUDIT_ACTION_LABEL_SR koristi konkretne srpske labele', () => {
    expect(AUDIT_ACTION_LABEL_SR.LIMIT_CHANGED).toMatch(/limit/i);
    expect(AUDIT_ACTION_LABEL_SR.USED_LIMIT_RESET).toMatch(/reset/i);
    expect(AUDIT_ACTION_LABEL_SR.ORDER_APPROVED).toMatch(/odobr/i);
    expect(AUDIT_ACTION_LABEL_SR.ORDER_DECLINED).toMatch(/odbij/i);
    expect(AUDIT_ACTION_LABEL_SR.PERMISSIONS_CHANGED).toMatch(/permis/i);
    expect(AUDIT_ACTION_LABEL_SR.TAX_RUN_TRIGGERED).toMatch(/pores|porez|tax/i);
    // Novi tipovi (R1 390)
    expect(AUDIT_ACTION_LABEL_SR.LOAN_INSTALLMENT_PAID).toMatch(/rata/i);
    expect(AUDIT_ACTION_LABEL_SR.FUND_INVEST).toMatch(/fond/i);
    expect(AUDIT_ACTION_LABEL_SR.CARD_DEACTIVATED).toMatch(/kartic/i);
  });

  it('AUDIT_ACTION_TYPES je izveden iz labela (1:1, bez praznina)', () => {
    expect(AUDIT_ACTION_TYPES).toEqual(Object.keys(AUDIT_ACTION_LABEL_SR));
  });

  // /audit rutira na trading-service koji radi valueOf(...) nad SVOJIM enum-om
  // (10 vrednosti). Filter dropdown sme da nudi SAMO te tipove — inace 400.
  it('TRADING_AUDIT_ACTION_TYPES je tacno 10 trading-service dostiznih tipova', () => {
    const trading: AuditActionType[] = [
      'LIMIT_CHANGED', 'USED_LIMIT_RESET', 'USED_LIMIT_RESET_ALL',
      'ORDER_APPROVED', 'ORDER_DECLINED', 'PERMISSIONS_CHANGED',
      'TAX_RUN_TRIGGERED', 'FUND_CREATED', 'FUND_INVEST', 'FUND_WITHDRAW',
    ];
    expect(new Set(TRADING_AUDIT_ACTION_TYPES)).toEqual(new Set(trading));
    expect(TRADING_AUDIT_ACTION_TYPES.length).toBe(10);
  });

  it('TRADING_AUDIT_ACTION_TYPES ne sadrzi nijedan banka-core-only tip', () => {
    const bankCoreOnly: AuditActionType[] = [
      'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_EARLY_REPAYMENT',
      'LOAN_INSTALLMENT_PAID', 'LOAN_INSTALLMENT_FAILED',
      'PAYMENT_CREATED', 'PAYMENT_ABORTED', 'PAYMENT_QUICK_APPROVED',
      'TRANSFER_INTERNAL', 'TRANSFER_FX',
      'SAVINGS_OPENED', 'SAVINGS_WITHDRAWN_EARLY', 'SAVINGS_AUTO_RENEWED',
      'CARD_BLOCKED', 'CARD_UNBLOCKED', 'CARD_LIMIT_CHANGED', 'CARD_DEACTIVATED',
      'ACCOUNT_STATUS_CHANGED', 'ACCOUNT_LIMITS_CHANGED', 'EMPLOYEE_DEACTIVATED',
    ];
    bankCoreOnly.forEach((t) => expect(TRADING_AUDIT_ACTION_TYPES).not.toContain(t));
  });

  it('svaki TRADING_AUDIT_ACTION_TYPES ima srpsku labelu', () => {
    for (const type of TRADING_AUDIT_ACTION_TYPES) {
      expect(AUDIT_ACTION_LABEL_SR[type]).toBeDefined();
    }
  });
});
