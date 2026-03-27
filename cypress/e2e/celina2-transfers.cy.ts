/// <reference types="cypress" />
// Celina 3: Transferi (S17-S20) - Prenos sredstava izmedju sopstvenih racuna
import { setupClientSession } from '../support/commands';

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
  { id: 2, accountNumber: '265000000000000002', name: 'Stedni RSD', accountType: 'CHECKING', currency: 'RSD', balance: 50000, availableBalance: 50000, status: 'ACTIVE' },
  { id: 3, accountNumber: '265000000000000003', name: 'Devizni EUR', accountType: 'FOREIGN', currency: 'EUR', balance: 1500, availableBalance: 1500, status: 'ACTIVE' },
];

const mockTransferResult = {
  id: 200,
  fromAccountNumber: '265000000000000001',
  toAccountNumber: '265000000000000002',
  amount: 10000,
  status: 'COMPLETED',
  createdAt: '2025-03-27T12:00:00',
};

const mockTransferHistory = [
  { id: 1, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000002', amount: 10000, fromCurrency: 'RSD', toCurrency: 'RSD', status: 'COMPLETED', createdAt: '2025-03-26T10:00:00' },
  { id: 2, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000003', amount: 50000, fromCurrency: 'RSD', toCurrency: 'EUR', convertedAmount: 425, exchangeRate: 0.0085, commission: 500, status: 'COMPLETED', createdAt: '2025-03-25T14:00:00' },
  { id: 3, fromAccountNumber: '265000000000000003', toAccountNumber: '265000000000000001', amount: 200, fromCurrency: 'EUR', toCurrency: 'RSD', convertedAmount: 23500, exchangeRate: 117.5, commission: 2, status: 'COMPLETED', createdAt: '2025-03-24T09:00:00' },
];

function setupTransferIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: mockTransferHistory }).as('getTransfers');
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S17: Transfer izmedju sopstvenih racuna u istoj valuti ─────────
describe('S17: Transfer izmedju sopstvenih racuna u istoj valuti', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.intercept('POST', '**/api/transfers/internal', { statusCode: 201, body: mockTransferResult }).as('createTransfer');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje stranicu za prenos', () => {
    cy.contains('Prenos izmedju racuna').should('be.visible');
    cy.get('#fromAccount').should('exist');
    cy.get('#toAccount').should('exist');
    cy.get('#amount').should('exist');
  });

  it('uspesno izvrsava transfer u istoj valuti bez provizije', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('10000');
    // Should show "bez konverzije" message
    cy.contains('Prenos bez konverzije').should('be.visible');
    cy.contains('button', 'Nastavi na potvrdu').click();
    // Confirm step
    cy.contains('Potvrda prenosa').should('be.visible');
    cy.contains(mockAccounts[0].accountNumber).should('be.visible');
    cy.contains(mockAccounts[1].accountNumber).should('be.visible');
    cy.contains('button', 'Potvrdi transfer').click();
    cy.wait('@createTransfer');
  });

  it('prikazuje raspolozivo stanje izabranog racuna', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.contains('Raspolozivo stanje').should('be.visible');
    cy.contains('145000.00').should('be.visible');
  });

  it('ne dozvoljava isti racun za posiljaoca i primaoca', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    // toAccount dropdown should not contain the fromAccount
    cy.get('#toAccount option').each(($option) => {
      expect($option.val()).not.to.equal(mockAccounts[0].accountNumber);
    });
  });
});

// ─── S18: Transfer izmedju sopstvenih racuna u razlicitim valutama ──
describe('S18: Transfer izmedju sopstvenih racuna u razlicitim valutama', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200,
      body: { convertedAmount: 425.50, exchangeRate: 0.0085, fromCurrency: 'RSD', toCurrency: 'EUR' },
    }).as('exchangeCalc');
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 201,
      body: { ...mockTransferResult, toAccountNumber: '265000000000000003' },
    }).as('createFxTransfer');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje kurs konverzije i proviziju za razlicite valute', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    cy.contains('Kurs').should('be.visible');
    cy.contains('Konvertovani iznos').should('be.visible');
    cy.contains('Provizija').should('be.visible');
    cy.contains('Ukupno za terecenje').should('be.visible');
  });

  it('izvrsava FX transfer sa potvrdom', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.contains('Potvrda prenosa').should('be.visible');
    cy.contains('button', 'Potvrdi transfer').click();
    cy.wait('@createFxTransfer');
  });
});

// ─── S19: Pregled istorije transfera ────────────────────────────────
describe('S19: Pregled istorije transfera', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');
  });

  it('prikazuje listu svih transfera klijenta', () => {
    cy.contains('265000000000000001').should('be.visible');
    cy.contains('265000000000000002').should('be.visible');
  });

  it('prikazuje prazno stanje kad nema transfera', () => {
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] }).as('emptyTransfers');
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyTransfers');
    cy.contains('Nema').should('be.visible');
  });
});

// ─── S20: Neuspesan transfer zbog nedovoljnih sredstava ─────────────
describe('S20: Neuspesan transfer zbog nedovoljnih sredstava', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje upozorenje o nedovoljnim sredstvima', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('999999');
    cy.contains('Nemate dovoljno').should('be.visible');
  });

  it('ne dozvoljava submit kad nema dovoljno sredstava', () => {
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 400,
      body: { message: 'Nedovoljno sredstava na racunu' },
    }).as('failedTransfer');

    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('999999');
    cy.contains('button', 'Nastavi na potvrdu').click();
    // The client-side check should show error toast
    cy.contains('Nemate dovoljno').should('be.visible');
  });
});

// ─── Validacija forme ───────────────────────────────────────────────
describe('Validacija forme za prenos', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje greske validacije kada polja nisu popunjena', () => {
    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.get('.text-destructive').should('exist');
  });

  it('prikazuje prazan state kad nema racuna', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] }).as('emptyAccounts');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyAccounts');
    cy.contains('Nema dostupnih racuna').should('be.visible');
  });
});
