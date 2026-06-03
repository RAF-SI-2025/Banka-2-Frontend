import { describe, it, expect } from 'vitest';
import { getInterbankStepState } from './interbankStepper';

// R3-1624: 2PC stepper NE sme da boji INITIATED+PREPARED kao "done" (zeleno)
// kad je transakcija ABORTED/STUCK ako te faze nisu zaista zavrsene. Stvarni
// napredak izvodimo iz BE timestamp-ova (preparedAt/committedAt), ne iz
// terminalnog statusa.

describe('getInterbankStepState (R3-1624 — failure does not green completed-looking steps)', () => {
  const KEYS = ['INITIATED', 'PREPARED', 'COMMITTING', 'COMMITTED'] as const;

  describe('happy path', () => {
    it('marks all steps done on COMMITTED', () => {
      for (const k of KEYS) {
        expect(getInterbankStepState(k, 'COMMITTED')).toBe('done');
      }
    });

    it('marks earlier steps done and current step active mid-flow', () => {
      // status PREPARED → INITIATED done, PREPARED active, rest pending
      expect(getInterbankStepState('INITIATED', 'PREPARED')).toBe('done');
      expect(getInterbankStepState('PREPARED', 'PREPARED')).toBe('active');
      expect(getInterbankStepState('COMMITTING', 'PREPARED')).toBe('pending');
      expect(getInterbankStepState('COMMITTED', 'PREPARED')).toBe('pending');
    });
  });

  describe('ABORTED before prepare succeeded (no preparedAt)', () => {
    it('does NOT mark PREPARED as done; marks it as the failed step', () => {
      // Banka B odbila prepare → preparedAt nije set.
      const progress = { preparedAt: null, committedAt: null };
      expect(getInterbankStepState('INITIATED', 'ABORTED', progress)).toBe('done');
      // KLJUCNO: PREPARED NIJE "done" (pre R3-1624 fix-a bilo je 'done').
      expect(getInterbankStepState('PREPARED', 'ABORTED', progress)).toBe('failed');
      expect(getInterbankStepState('COMMITTING', 'ABORTED', progress)).toBe('pending');
      expect(getInterbankStepState('COMMITTED', 'ABORTED', progress)).toBe('pending');
    });
  });

  describe('ABORTED after prepare succeeded but before commit (preparedAt set)', () => {
    it('marks INITIATED+PREPARED done and COMMITTING as the failed step', () => {
      const progress = { preparedAt: '2026-01-01T00:00:01Z', committedAt: null };
      expect(getInterbankStepState('INITIATED', 'ABORTED', progress)).toBe('done');
      expect(getInterbankStepState('PREPARED', 'ABORTED', progress)).toBe('done');
      expect(getInterbankStepState('COMMITTING', 'ABORTED', progress)).toBe('failed');
      expect(getInterbankStepState('COMMITTED', 'ABORTED', progress)).toBe('pending');
    });
  });

  describe('STUCK with no progress timestamps', () => {
    it('only INITIATED is done; PREPARED is the failed step', () => {
      expect(getInterbankStepState('INITIATED', 'STUCK')).toBe('done');
      expect(getInterbankStepState('PREPARED', 'STUCK')).toBe('failed');
      expect(getInterbankStepState('COMMITTING', 'STUCK')).toBe('pending');
      expect(getInterbankStepState('COMMITTED', 'STUCK')).toBe('pending');
    });
  });
});
