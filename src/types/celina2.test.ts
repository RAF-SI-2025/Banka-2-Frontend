import { describe, it, expect } from 'vitest';
import {
  AccountType,
  AccountSubtype,
  AccountStatus,
  Currency,
  TransactionStatus,
  CardType,
  CardStatus,
  LoanType,
  LoanStatus,
  InterestRateType,
} from './celina2';

describe('celina2 enums', () => {
  describe('AccountType', () => {
    it('contains backend values', () => {
      expect(AccountType.CHECKING).toBe('CHECKING');
      expect(AccountType.FOREIGN).toBe('FOREIGN');
      expect(AccountType.BUSINESS).toBe('BUSINESS');
      expect(AccountType.MARGIN).toBe('MARGIN');
    });

    it('contains FE legacy values', () => {
      expect(AccountType.TEKUCI).toBe('TEKUCI');
      expect(AccountType.DEVIZNI).toBe('DEVIZNI');
      expect(AccountType.POSLOVNI).toBe('POSLOVNI');
    });

    it('has exactly 7 values', () => {
      expect(Object.keys(AccountType)).toHaveLength(7);
    });
  });

  describe('AccountSubtype', () => {
    it('contains licni racun podvrste', () => {
      expect(AccountSubtype.STANDARDNI).toBe('STANDARDNI');
      expect(AccountSubtype.STEDNI).toBe('STEDNI');
      expect(AccountSubtype.PENZIONERSKI).toBe('PENZIONERSKI');
      expect(AccountSubtype.ZA_MLADE).toBe('ZA_MLADE');
      expect(AccountSubtype.STUDENTSKI).toBe('STUDENTSKI');
      expect(AccountSubtype.ZA_NEZAPOSLENE).toBe('ZA_NEZAPOSLENE');
    });

    it('contains poslovni racun podvrste', () => {
      expect(AccountSubtype.DOO).toBe('DOO');
      expect(AccountSubtype.AD).toBe('AD');
      expect(AccountSubtype.FONDACIJA).toBe('FONDACIJA');
    });

    it('has exactly 9 values', () => {
      expect(Object.keys(AccountSubtype)).toHaveLength(9);
    });
  });

  describe('AccountStatus', () => {
    it('contains all statuses', () => {
      expect(AccountStatus.ACTIVE).toBe('ACTIVE');
      expect(AccountStatus.INACTIVE).toBe('INACTIVE');
      expect(AccountStatus.BLOCKED).toBe('BLOCKED');
    });

    it('has exactly 3 values', () => {
      expect(Object.keys(AccountStatus)).toHaveLength(3);
    });
  });

  describe('Currency', () => {
    it('contains all currencies', () => {
      expect(Currency.RSD).toBe('RSD');
      expect(Currency.EUR).toBe('EUR');
      expect(Currency.CHF).toBe('CHF');
      expect(Currency.USD).toBe('USD');
      expect(Currency.GBP).toBe('GBP');
      expect(Currency.JPY).toBe('JPY');
      expect(Currency.CAD).toBe('CAD');
      expect(Currency.AUD).toBe('AUD');
    });

    it('has exactly 8 values', () => {
      expect(Object.keys(Currency)).toHaveLength(8);
    });
  });

  describe('TransactionStatus', () => {
    it('contains all statuses', () => {
      expect(TransactionStatus.PENDING).toBe('PENDING');
      // R1-333: poravnato sa BE PaymentStatus enum-om.
      expect(TransactionStatus.PROCESSING).toBe('PROCESSING');
      expect(TransactionStatus.COMPLETED).toBe('COMPLETED');
      expect(TransactionStatus.REJECTED).toBe('REJECTED');
      expect(TransactionStatus.CANCELLED).toBe('CANCELLED');
      expect(TransactionStatus.ABORTED).toBe('ABORTED');
    });

    it('has exactly 6 values (R1-333: + PROCESSING + ABORTED)', () => {
      expect(Object.keys(TransactionStatus)).toHaveLength(6);
    });
  });

  describe('CardType', () => {
    it('contains all card types', () => {
      expect(CardType.VISA).toBe('VISA');
      expect(CardType.MASTERCARD).toBe('MASTERCARD');
      expect(CardType.DINACARD).toBe('DINACARD');
      expect(CardType.AMERICAN_EXPRESS).toBe('AMERICAN_EXPRESS');
    });

    it('has exactly 4 values', () => {
      expect(Object.keys(CardType)).toHaveLength(4);
    });
  });

  describe('CardStatus', () => {
    it('contains all card statuses', () => {
      expect(CardStatus.ACTIVE).toBe('ACTIVE');
      expect(CardStatus.BLOCKED).toBe('BLOCKED');
      expect(CardStatus.DEACTIVATED).toBe('DEACTIVATED');
    });

    it('has exactly 3 values', () => {
      expect(Object.keys(CardStatus)).toHaveLength(3);
    });
  });

  describe('LoanType', () => {
    it('contains all loan types', () => {
      expect(LoanType.GOTOVINSKI).toBe('GOTOVINSKI');
      expect(LoanType.STAMBENI).toBe('STAMBENI');
      expect(LoanType.AUTO).toBe('AUTO');
      expect(LoanType.STUDENTSKI).toBe('STUDENTSKI');
      expect(LoanType.REFINANSIRAJUCI).toBe('REFINANSIRAJUCI');
    });

    it('has exactly 5 values', () => {
      expect(Object.keys(LoanType)).toHaveLength(5);
    });
  });

  describe('LoanStatus', () => {
    it('contains all loan statuses', () => {
      expect(LoanStatus.PENDING).toBe('PENDING');
      expect(LoanStatus.APPROVED).toBe('APPROVED');
      expect(LoanStatus.REJECTED).toBe('REJECTED');
      expect(LoanStatus.ACTIVE).toBe('ACTIVE');
      expect(LoanStatus.CLOSED).toBe('CLOSED');
      expect(LoanStatus.LATE).toBe('LATE');
      expect(LoanStatus.PAID).toBe('PAID');
      expect(LoanStatus.PAID_OFF).toBe('PAID_OFF');
    });

    it('has exactly 8 values', () => {
      expect(Object.keys(LoanStatus)).toHaveLength(8);
    });
  });

  describe('InterestRateType', () => {
    it('contains all interest rate types', () => {
      expect(InterestRateType.FIKSNI).toBe('FIKSNI');
      expect(InterestRateType.VARIJABILNI).toBe('VARIJABILNI');
    });

    it('has exactly 2 values', () => {
      expect(Object.keys(InterestRateType)).toHaveLength(2);
    });
  });
});
