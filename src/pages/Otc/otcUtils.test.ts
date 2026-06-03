import { describe, it, expect } from 'vitest';
import { createIsMeMatcher } from './otcUtils';

// P1-fe-mobile-authz-1 (1561/1599): isMe matcher mora da bude FAIL-CLOSED kad
// JWT/profile id nije pouzdan (userId <= 0). Ranije je padao na poredjenje po
// normalizovanom imenu → dva korisnika sa istim imenom (npr. "Marko Petrović" /
// "Marko Petrovic") tretirani kao ista osoba → privacy leak + akcija nad tudjim
// ugovorom. Sada matcher koristi ISKLJUCIVO numericki id.

describe('createIsMeMatcher (OTC isMe — fail-closed)', () => {
  it('matches by id when userId > 0 and ids equal', () => {
    const isMe = createIsMeMatcher({ id: 5, firstName: 'Marko', lastName: 'Petrovic' });
    expect(isMe(5, 'Marko Petrovic')).toBe(true);
  });

  it('does NOT match when ids differ even if names match (no name fallback)', () => {
    const isMe = createIsMeMatcher({ id: 5, firstName: 'Marko', lastName: 'Petrovic' });
    // Ugovor druge osobe sa istim imenom — NE sme da bude "moj".
    expect(isMe(9, 'Marko Petrovic')).toBe(false);
  });

  it('returns false for ALL parties when userId is 0 (identity unknown → fail-closed)', () => {
    // Cest slucaj: /clients/me padne → userId 0. Ranije bi name-fallback
    // pogresno matchovao istoimene korisnike.
    const isMe = createIsMeMatcher({ id: 0, firstName: 'Marko', lastName: 'Petrovic' });
    expect(isMe(0, 'Marko Petrovic')).toBe(false);
    expect(isMe(5, 'Marko Petrovic')).toBe(false);
  });

  it('returns false when userId is negative', () => {
    const isMe = createIsMeMatcher({ id: -1, firstName: 'Marko', lastName: 'Petrovic' });
    expect(isMe(-1, 'Marko Petrovic')).toBe(false);
  });

  it('returns false when user is null/undefined', () => {
    expect(createIsMeMatcher(null)(5, 'Marko Petrovic')).toBe(false);
    expect(createIsMeMatcher(undefined)(5, 'Marko Petrovic')).toBe(false);
  });

  it('does not match by name when other party has no id collision but same name and userId 0', () => {
    // Dva razlicita korisnika istog imena, posmatrac bez pouzdanog id-a.
    const isMe = createIsMeMatcher({ id: 0, firstName: 'Ana', lastName: 'Anić' });
    expect(isMe(0, 'Ana Anic')).toBe(false);
    expect(isMe(123, 'Ana Anić')).toBe(false);
  });
});
