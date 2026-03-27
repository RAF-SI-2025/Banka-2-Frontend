/// <reference types="cypress" />
// Celina 6: Kartice (S27-S32) - Upravljanje bankarskim karticama
import { setupClientSession, setupAdminSession } from '../support/commands';

const mockCards = [
  { id: 1, cardNumber: '4111111111111234', cardName: 'VISA', cardType: 'DEBIT', status: 'ACTIVE', accountNumber: '265000000000000001', ownerName: 'Stefan Jovanovic', holderName: 'Stefan Jovanovic', expirationDate: '2027-12-31', cardLimit: 100000, limit: 100000 },
  { id: 2, cardNumber: '5500000000005678', cardName: 'MASTERCARD', cardType: 'DEBIT', status: 'BLOCKED', accountNumber: '265000000000000001', ownerName: 'Stefan Jovanovic', holderName: 'Stefan Jovanovic', expirationDate: '2026-06-30', cardLimit: 50000, limit: 50000 },
  { id: 3, cardNumber: '3600000000009012', cardName: 'DINACARD', cardType: 'DEBIT', status: 'DEACTIVATED', accountNumber: '265000000000000002', ownerName: 'Stefan Jovanovic', holderName: 'Stefan Jovanovic', expirationDate: '2025-03-31', cardLimit: 30000, limit: 30000 },
];

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
  { id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR', accountType: 'FOREIGN', currency: 'EUR', balance: 1500, availableBalance: 1500, status: 'ACTIVE' },
];

function setupCardIntercepts() {
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S27: Automatsko kreiranje kartice prilikom otvaranja racuna ────
describe('S27: Automatsko kreiranje kartice prilikom otvaranja racuna', () => {
  it('salje createCard: true kada je checkbox cekiran', () => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 1 } });
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: { id: 10, accountNumber: '265000000000000010', accountType: 'CHECKING', currency: 'RSD', balance: 0, availableBalance: 0, status: 'ACTIVE' },
    }).as('createAccount');
    setupCardIntercepts();

    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.get('#accountType').select('TEKUCI');
    cy.get('input[type="checkbox"]').check();
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount').its('request.body').should('have.property', 'createCard', true);
  });
});

// ─── S28: Kreiranje kartice na zahtev klijenta ──────────────────────
describe('S28: Kreiranje kartice na zahtev klijenta', () => {
  beforeEach(() => {
    setupCardIntercepts();
    cy.intercept('POST', '**/api/cards/requests', {
      statusCode: 201,
      body: { id: 4, message: 'Zahtev uspesno podnet' },
    }).as('submitCardRequest');
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
  });

  it('prikazuje dugme za novu karticu', () => {
    cy.contains('button', 'Nova kartica').should('be.visible');
  });

  it('otvara formu za novu karticu i podnosi zahtev', () => {
    cy.contains('button', 'Nova kartica').click();
    cy.contains('Zahtev za novu karticu').should('be.visible');
    // Selectuje racun (treba da bude aktivan)
    cy.get('[role="combobox"]').first().click();
    cy.get('[role="option"]').first().click();
    cy.contains('button', 'Kreiraj karticu').click();
    cy.wait('@submitCardRequest');
    cy.contains('uspešno podnet').should('be.visible');
  });

  it('moze otkazati kreiranje kartice', () => {
    cy.contains('button', 'Nova kartica').click();
    cy.contains('Zahtev za novu karticu').should('be.visible');
    cy.contains('button', 'Otkaži').click();
    cy.contains('Zahtev za novu karticu').should('not.exist');
  });
});

// ─── S29: Pregled liste kartica ─────────────────────────────────────
describe('S29: Pregled liste kartica', () => {
  beforeEach(() => {
    setupCardIntercepts();
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
  });

  it('prikazuje stranicu Moje kartice', () => {
    cy.contains('Moje kartice').should('be.visible');
  });

  it('prikazuje kartice sa maskiranim brojevima', () => {
    cy.contains('**** **** **** 1234').should('be.visible');
    cy.contains('**** **** **** 5678').should('be.visible');
    cy.contains('**** **** **** 9012').should('be.visible');
  });

  it('prikazuje tip kartice', () => {
    cy.contains('VISA').should('be.visible');
    cy.contains('MASTERCARD').should('be.visible');
    cy.contains('DINACARD').should('be.visible');
  });

  it('prikazuje status kartice', () => {
    cy.contains('Aktivna').should('be.visible');
    cy.contains('Blokirana').should('be.visible');
    cy.contains('Deaktivirana').should('be.visible');
  });

  it('prikazuje limit kartice', () => {
    cy.contains('Limit').should('exist');
    cy.contains('100000.00').should('exist');
  });

  it('prikazuje prazan state kad nema kartica', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('emptyCards');
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyCards');
    cy.contains('Nemate kartica').should('be.visible');
  });

  it('prikazuje loading skeleton dok se podaci ucitavaju', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards, delay: 500 }).as('delayedCards');
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@delayedCards');
    cy.get('.animate-pulse').should('not.exist');
  });
});

// ─── S30: Blokiranje kartice od strane klijenta ────────────────────
describe('S30: Blokiranje kartice od strane klijenta', () => {
  beforeEach(() => {
    setupCardIntercepts();
    cy.intercept('PATCH', '**/api/cards/1/block', { statusCode: 200 }).as('blockCard');
    // After blocking, return updated cards
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards }).as('getCards');
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
  });

  it('prikazuje dugme Blokiraj za aktivnu karticu', () => {
    // First card (VISA) is ACTIVE
    cy.contains('VISA').parents('.rounded-xl').within(() => {
      cy.contains('Blokiraj').should('be.visible');
    });
  });

  it('blokira aktivnu karticu', () => {
    cy.contains('VISA').parents('.rounded-xl').within(() => {
      cy.contains('button', 'Blokiraj').click();
    });
    cy.wait('@blockCard');
    cy.contains('uspešno izvršena').should('be.visible');
  });
});

// ─── S31: Odblokiranje kartice od strane zaposlenog ─────────────────
describe('S31: Odblokiranje kartice od strane zaposlenog', () => {
  beforeEach(() => {
    setupCardIntercepts();
    cy.intercept('PATCH', '**/api/cards/2/unblock', { statusCode: 200 }).as('unblockCard');
    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');
  });

  it('prikazuje dugme Deblokiraj za blokiranu karticu (admin)', () => {
    cy.contains('MASTERCARD').parents('.rounded-xl').within(() => {
      cy.contains('Deblokiraj').should('be.visible');
    });
  });

  it('deblokira karticu kao zaposleni', () => {
    cy.contains('MASTERCARD').parents('.rounded-xl').within(() => {
      cy.contains('button', 'Deblokiraj').click();
    });
    cy.wait('@unblockCard');
    cy.contains('uspešno izvršena').should('be.visible');
  });
});

// ─── S32: Pokusaj aktivacije deaktivirane kartice ───────────────────
describe('S32: Pokusaj aktivacije deaktivirane kartice', () => {
  beforeEach(() => {
    setupCardIntercepts();
    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');
  });

  it('ne prikazuje dugme za aktivaciju deaktivirane kartice', () => {
    cy.contains('DINACARD').parents('.rounded-xl').within(() => {
      cy.contains('Deaktivirana').should('be.visible');
      cy.contains('Blokiraj').should('not.exist');
      cy.contains('Deblokiraj').should('not.exist');
      cy.contains('Promeni limit').should('not.exist');
    });
  });

  it('klijent ne moze deblokireti karticu (samo poruka)', () => {
    cy.contains('MASTERCARD').parents('.rounded-xl').within(() => {
      cy.contains('Kontaktirajte banku').should('be.visible');
    });
  });
});
