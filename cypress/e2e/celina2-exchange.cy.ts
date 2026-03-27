/// <reference types="cypress" />
// Celina 5: Menjacnica (S24-S26) - Provera kursa i konverzija valuta
import { setupClientSession } from '../support/commands';

const mockExchangeRates = [
  { currency: 'EUR', buyRate: 116.50, sellRate: 118.00, middleRate: 117.25, date: '2025-03-27T08:00:00' },
  { currency: 'CHF', buyRate: 124.00, sellRate: 126.00, middleRate: 125.00, date: '2025-03-27T08:00:00' },
  { currency: 'USD', buyRate: 106.00, sellRate: 108.00, middleRate: 107.00, date: '2025-03-27T08:00:00' },
  { currency: 'GBP', buyRate: 135.00, sellRate: 137.50, middleRate: 136.25, date: '2025-03-27T08:00:00' },
  { currency: 'JPY', buyRate: 0.70, sellRate: 0.73, middleRate: 0.715, date: '2025-03-27T08:00:00' },
  { currency: 'CAD', buyRate: 77.00, sellRate: 79.00, middleRate: 78.00, date: '2025-03-27T08:00:00' },
  { currency: 'AUD', buyRate: 68.00, sellRate: 70.00, middleRate: 69.00, date: '2025-03-27T08:00:00' },
];

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
  { id: 2, accountNumber: '265000000000000003', name: 'Devizni EUR', accountType: 'FOREIGN', currency: 'EUR', balance: 1500, availableBalance: 1500, status: 'ACTIVE' },
];

function setupExchangeIntercepts() {
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates }).as('getExchangeRates');
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S24: Pregled kursne liste ──────────────────────────────────────
describe('S24: Pregled kursne liste', () => {
  beforeEach(() => {
    setupExchangeIntercepts();
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getExchangeRates');
  });

  it('prikazuje stranicu menjacnice', () => {
    cy.contains('Menjacnica').should('be.visible');
    cy.contains('Kursna lista').should('be.visible');
  });

  it('prikazuje kurseve za podrzane valute', () => {
    cy.contains('EUR').should('be.visible');
    cy.contains('CHF').should('be.visible');
    cy.contains('USD').should('be.visible');
    cy.contains('GBP').should('be.visible');
    cy.contains('JPY').should('be.visible');
    cy.contains('CAD').should('be.visible');
    cy.contains('AUD').should('be.visible');
  });

  it('prikazuje kupovni, prodajni i srednji kurs', () => {
    cy.contains('Kupovni kurs').should('be.visible');
    cy.contains('Prodajni kurs').should('be.visible');
    cy.contains('Srednji kurs').should('be.visible');
  });

  it('prikazuje datum kursne liste', () => {
    cy.contains('Datum').should('be.visible');
  });

  it('prikazuje loading skeleton dok se podaci ucitavaju', () => {
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates, delay: 500 }).as('delayedRates');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@delayedRates');
    cy.get('.animate-pulse').should('not.exist');
  });

  it('prikazuje prazan state kad nema kurseva', () => {
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] }).as('emptyRates');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyRates');
    cy.contains('Nema dostupnih kurseva').should('be.visible');
  });
});

// ─── S25: Provera ekvivalentnosti valute ────────────────────────────
describe('S25: Provera ekvivalentnosti valute', () => {
  beforeEach(() => {
    setupExchangeIntercepts();
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200,
      body: { convertedAmount: 11725.00, exchangeRate: 117.25, fromCurrency: 'EUR', toCurrency: 'RSD' },
    }).as('calculateExchange');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getExchangeRates');
  });

  it('prikazuje formu za konverziju', () => {
    cy.contains('Konverzija').should('be.visible');
    cy.get('#fromCurrency').should('exist');
    cy.get('#toCurrency').should('exist');
    cy.get('#amount').should('exist');
  });

  it('izracunava ekvivalentnu vrednost bez izvrsavanja transakcije', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#toCurrency').select('RSD');
    cy.get('#amount').clear().type('100');
    cy.contains('button', 'Konvertuj').click();
    cy.wait('@calculateExchange');
    // Rezultat konverzije
    cy.contains('11725.00').should('be.visible');
    cy.contains('117.25').should('be.visible');
  });

  it('prikazuje upozorenje za iste valute', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#toCurrency').select('EUR');
    cy.contains('Izvorna i ciljna valuta ne mogu biti iste').should('be.visible');
  });

  it('prikazuje gresku kad konverzija nije uspela', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', { statusCode: 500, body: { message: 'Server error' } }).as('failedCalc');
    cy.get('#fromCurrency').select('USD');
    cy.get('#toCurrency').select('RSD');
    cy.get('#amount').clear().type('50');
    cy.contains('button', 'Konvertuj').click();
    cy.wait('@failedCalc');
    cy.contains('nije uspela').should('be.visible');
  });
});

// ─── S26: Konverzija valute tokom transfera ─────────────────────────
describe('S26: Konverzija valute tokom transfera', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200,
      body: { convertedAmount: 425.50, exchangeRate: 0.0085, fromCurrency: 'RSD', toCurrency: 'EUR' },
    }).as('exchangeCalc');
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 201,
      body: { id: 300, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000003', amount: 50000, status: 'COMPLETED' },
    }).as('createTransfer');
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates });
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje konverziju pri transferu izmedju razlicitih valuta', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    cy.contains('Kurs').should('be.visible');
    cy.contains('Provizija').should('be.visible');
    cy.contains('Konvertovani iznos').should('be.visible');
    cy.contains('Ukupno za terecenje').should('be.visible');
  });
});
