/**
 * SAGA - Mock System Tests (Uputstvo_SAGA_Testovi.pdf Primer 10-12, mock varijanta)
 *
 * Pokriva intra-bank OTC exercise SAGA tok na OtcContractsPage (/otc/ugovori):
 *   S1 (happy): exercise → SAGA COMPLETED → success UI + ugovor EXERCISED.
 *   S2 (failure/rollback): exercise → 409 (SAGA COMPENSATED) → failure poruka,
 *      ugovor ostaje ACTIVE ("Aktivan").
 *   S3 (access control): prodavac (non-buyer) NEMA "Iskoristi" akciju.
 *
 * Svi API pozivi mock-ovani sa cy.intercept() — backend NIJE potreban.
 *
 * VAZNE specificnosti FE-a (verifikovano u src/pages/Otc/OtcContractsPage.tsx):
 *   - "Iskoristi" se prikazuje SAMO kad je ugovor ACTIVE i trenutni korisnik je
 *     kupac (isMe(buyerId, buyerName), vidi otcUtils.ts: JWT id ILI normalizovano
 *     ime). setupClientSession = Stefan Jovanovic (id:1).
 *   - handleExercise koristi NATIVE window.confirm (NE Radix dialog) → testovi
 *     stub-uju `cy.on('window:confirm', () => true)`.
 *   - NOVI exercise response je SAGA rezultat
 *     {sagaId, sagaStatus, currentStep, id, status}; FE gleda samo 2xx → success
 *     toast + Promise.all re-fetch. Pravi failure mora biti non-2xx (409) sa
 *     error body-jem da FE prikaze gresku i ostavi ugovor ACTIVE.
 */

import { setupClientSession } from '../support/commands';

const stefanAccounts = [
  {
    id: 7, accountNumber: '265000000000000007', name: 'Stefan USD', ownerName: 'Stefan Jovanovic',
    availableBalance: 50000, balance: 50000, reservedBalance: 0, currency: 'USD',
    accountType: 'CHECKING', accountSubtype: 'STANDARD', status: 'ACTIVE',
  },
];

// Stefan (id:1) je KUPAC → ima pravo na exercise/abandon.
const buyerContract = {
  id: 7, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
  buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 9, sellerName: 'Milica Nikolic',
  quantity: 4, strikePrice: 180, premium: 15, currentPrice: 210,
  settlementDate: '2026-12-31', status: 'ACTIVE', createdAt: '2026-05-03T10:00:00Z',
};

// Stefan (id:1) je PRODAVAC (buyer je neko drugi) → NEMA exercise akciju.
const sellerContract = {
  id: 8, listingId: 2, listingTicker: 'MSFT', listingName: 'Microsoft Corp.', listingCurrency: 'USD',
  buyerId: 99, buyerName: 'Milica Nikolic', sellerId: 1, sellerName: 'Stefan Jovanovic',
  quantity: 3, strikePrice: 400, premium: 20, currentPrice: 430,
  settlementDate: '2026-11-30', status: 'ACTIVE', createdAt: '2026-05-03T11:00:00Z',
};

describe('SAGA Mock: OTC exercise system test (Primer 10-12)', () => {
  // ---------------- S1: happy path ----------------
  it('S1: Uspesan exercise — SAGA COMPLETED → success UI + ugovor "Iskoriscen"', () => {
    cy.on('window:confirm', () => true);

    cy.intercept('POST', '**/contracts/*/exercise*', {
      statusCode: 200,
      body: { sagaId: 's1', sagaStatus: 'COMPLETED', currentStep: 5, id: 7, status: 'EXERCISED' },
    }).as('exercise');

    // Jedan intercept menja odgovor po pozivu: mount=ACTIVE, re-fetch=EXERCISED.
    let call = 0;
    const exercised = { ...buyerContract, status: 'EXERCISED', exercisedAt: '2026-05-06T10:00:00Z' };
    cy.intercept('GET', '**/api/otc/contracts*', (req) => {
      call += 1;
      req.reply({ statusCode: 200, body: call <= 1 ? [buyerContract] : [exercised] });
    }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');

    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
    cy.wait('@accounts'); // handleExercise koristi getPreferredAccount

    cy.contains('Sklopljeni ugovori').should('be.visible');
    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });

    cy.wait('@exercise');
    // Success toast (handleExercise: "Opcioni ugovor je iskoriscen ...").
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /iskoriscen/i);

    // Posle re-fetch-a red prikazuje status "Iskoriscen" (EXERCISED).
    cy.wait('@contracts');
    cy.contains('tr', 'AAPL').contains('Iskoriscen').should('be.visible');
  });

  // ---------------- S2: failure / rollback ----------------
  it('S2: Neuspesan exercise — 409 SAGA COMPENSATED → failure poruka, ugovor ostaje "Aktivan"', () => {
    cy.on('window:confirm', () => true);

    // SAGA kompenzacija: BE vraca non-2xx sa error porukom da FE prikaze gresku.
    // (200 sa sagaStatus:COMPENSATED ne bi triggera-o catch granu — FE bi
    // pogresno prikazao success. Pravi rollback je 409 + error body.)
    cy.intercept('POST', '**/contracts/*/exercise*', {
      statusCode: 409,
      body: { message: 'Iskoriscavanje nije uspelo — sredstva vracena (SAGA COMPENSATED).' },
    }).as('exerciseFail');

    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: [buyerContract] }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');

    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
    cy.wait('@accounts'); // handleExercise koristi getPreferredAccount

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });

    cy.wait('@exerciseFail');
    // Failure poruka (BE message preko getErrorMessage).
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /nije uspelo|sredstva vracena/i);

    // Ugovor ostaje ACTIVE ("Aktivan") sa i dalje dostupnim "Iskoristi" dugmetom.
    cy.contains('tr', 'AAPL').contains('Aktivan').should('be.visible');
    cy.contains('tr', 'AAPL').contains('button', 'Iskoristi').should('be.visible');
  });

  // ---------------- S3: access control ----------------
  it('S3: Prodavac (non-buyer) NE vidi "Iskoristi" akciju', () => {
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: [sellerContract] }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');

    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');

    cy.contains('tr', 'MSFT').should('be.visible');
    // Stefan je prodavac → akcijska celija je "—", bez Iskoristi/Odustani.
    cy.contains('tr', 'MSFT').within(() => {
      cy.contains('button', 'Iskoristi').should('not.exist');
      cy.contains('button', 'Odustani').should('not.exist');
    });
  });
});
