// FIX FE-OTC-03: shared "isMe" pattern za OtcContractsPage + OtcNegotiationsPage.
// Identitet u OTC skupu razresavamo ISKLJUCIVO preko pouzdanog JWT/profile `id`.
//
// P1-fe-mobile-authz-1 (1561/1599): RANIJE je matcher padao na normalizovano
// poredjenje IMENA kad `userId <= 0` (cest slucaj kad `/clients/me` padne pa
// AuthContext vrati `userId:0`). To je footgun: dva korisnika sa istim
// normalizovanim imenom ("Marko Petrović" / "Marko Petrovic") FE bi tretirao
// kao istu osobu → korisniku B se prikazuju "Iskoristi"/"Odustani" dugmad i "VI"
// badge na ugovorima korisnika A (privacy leak + akcija nad tudjim ugovorom).
// Sada: ako nemamo validan `userId > 0`, NE razresavamo identitet (fail-closed) —
// akcije/badge se ne prikazuju dok se ne dobije pravi id.

export interface IsMeUser {
  id?: number | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Vraca matcher koji proverava da li (partyId, partyName) pripada trenutnom
 * korisniku. Koristi SAMO pouzdan numericki `id` — bez fallback-a na ime.
 * Ako `userId <= 0` (identitet nepoznat), matcher uvek vraca `false`
 * (fail-closed), pa se "moje" akcije ne prikazuju dok se identitet ne razresi.
 */
export function createIsMeMatcher(user: IsMeUser | null | undefined) {
  const userId = user?.id ?? 0;

  // partyName se zadrzava u potpisu radi backwards-compat sa pozivaocima, ali se
  // namerno NE koristi (vidi gore — name-fallback je security footgun).
  return (partyId: number, _partyName?: string): boolean => {
    if (userId <= 0) return false;
    return userId === partyId;
  };
}
