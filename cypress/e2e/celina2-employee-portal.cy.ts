/// <reference types="cypress" />
// Celina 8: Portali za zaposlene (S39-S40) - Upravljanje klijentima
import { setupAdminSession } from '../support/commands';

const mockClients = {
  content: [
    { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan.jovanovic@gmail.com', phoneNumber: '+381601234567', address: 'Beograd, Knez Mihailova 1', dateOfBirth: '1990-01-15', gender: 'MALE' },
    { id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica.nikolic@gmail.com', phoneNumber: '+381609876543', address: 'Novi Sad, Trg slobode 5', dateOfBirth: '1992-05-20', gender: 'FEMALE' },
    { id: 3, firstName: 'Jovan', lastName: 'Markovic', email: 'jovan.markovic@gmail.com', phoneNumber: '+381605555555', address: 'Nis, Obrenoviceva 3', dateOfBirth: '1988-11-10', gender: 'MALE' },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockClientAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
];

function setupPortalIntercepts() {
  cy.intercept('GET', '**/api/clients?*', { statusCode: 200, body: mockClients }).as('getClients');
  cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClient1');
  cy.intercept('GET', '**/api/clients/2', { statusCode: 200, body: mockClients.content[1] }).as('getClient2');
  cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');
  cy.intercept('GET', '**/api/accounts/client/2', { statusCode: 200, body: [] }).as('getClientAccounts2');
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S39: Pretraga klijenta na portalu ──────────────────────────────
describe('S39: Pretraga klijenta na portalu za upravljanje klijentima', () => {
  beforeEach(() => {
    setupPortalIntercepts();
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
  });

  it('prikazuje portal za upravljanje klijentima', () => {
    cy.contains('Portal klijenata').should('be.visible');
    cy.contains('Pretrazujte').should('be.visible');
  });

  it('prikazuje listu klijenata u tabeli', () => {
    cy.contains('Stefan').should('be.visible');
    cy.contains('Milica').should('be.visible');
    cy.contains('Jovan').should('be.visible');
  });

  it('prikazuje kolone tabele: Ime, Prezime, Email, Telefon, Akcije', () => {
    cy.contains('th', 'Ime').should('be.visible');
    cy.contains('th', 'Prezime').should('be.visible');
    cy.contains('th', 'Email').should('be.visible');
    cy.contains('th', 'Telefon').should('be.visible');
    cy.contains('th', 'Akcije').should('be.visible');
  });

  it('pretrazuje klijente po imenu/prezimenu/email-u', () => {
    cy.get('input[placeholder*="Pretraga"]').type('Stefan');
    // Debounced search - the search fires after a timeout
    cy.wait('@getClients');
  });

  it('prikazuje prazan state kad nema rezultata', () => {
    cy.intercept('GET', '**/api/clients?*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 1 } }).as('emptyClients');
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@emptyClients');
    cy.contains('Nema klijenata').should('be.visible');
  });

  it('otvara profil klijenta klikom na Detalji', () => {
    cy.contains('tr', 'Stefan').within(() => {
      cy.contains('button', 'Detalji').click();
    });
    // Navigates to /employee/clients/1
    cy.wait('@getClient1');
    cy.contains('Detalji klijenta').should('be.visible');
    cy.get('#client-first-name').should('have.value', 'Stefan');
    cy.get('#client-email').should('have.value', 'stefan.jovanovic@gmail.com');
  });

  it('prikazuje paginaciju', () => {
    cy.contains('Strana 1').should('be.visible');
    cy.contains('button', 'Prethodna').should('be.visible');
    cy.contains('button', 'Sledeca').should('be.visible');
  });
});

// ─── S40: Izmena podataka klijenta ──────────────────────────────────
describe('S40: Izmena podataka klijenta', () => {
  beforeEach(() => {
    setupPortalIntercepts();
    cy.intercept('PUT', '**/api/clients/1', {
      statusCode: 200,
      body: { ...mockClients.content[0], phoneNumber: '+381609999999', address: 'Beograd, Nova adresa 10' },
    }).as('updateClient');
    cy.visit('/employee/clients/1', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.wait('@getClient1');
  });

  it('prikazuje detalje klijenta sa popunjenim inputima', () => {
    cy.contains('Detalji klijenta').should('be.visible');
    cy.get('#client-first-name').should('have.value', 'Stefan');
    cy.get('#client-last-name').should('have.value', 'Jovanovic');
    cy.get('#client-email').should('have.value', 'stefan.jovanovic@gmail.com');
    cy.get('#client-phone').should('have.value', '+381601234567');
  });

  it('inputi su disabled pre klika na Izmeni', () => {
    cy.get('#client-first-name').should('be.disabled');
    cy.get('#client-phone').should('be.disabled');
    cy.get('#client-address').should('be.disabled');
  });

  it('aktivira edit mode klikom na Izmeni', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-first-name').should('not.be.disabled');
    cy.get('#client-phone').should('not.be.disabled');
    cy.get('#client-address').should('not.be.disabled');
  });

  it('uspesno menja telefon klijenta', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381609999999');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@updateClient');
    cy.contains('uspesno izmenjen').should('be.visible');
  });

  it('uspesno menja adresu klijenta', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-address').clear().type('Beograd, Nova adresa 10');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@updateClient');
    cy.contains('uspesno izmenjen').should('be.visible');
  });

  it('moze otkazati izmenu', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381600000000');
    cy.contains('button', 'Otkazi').click();
    // Should restore original value and disable inputs
    cy.get('#client-phone').should('be.disabled');
    cy.get('#client-phone').should('have.value', '+381601234567');
  });

  it('prikazuje racune klijenta', () => {
    cy.contains('Racuni klijenta').should('be.visible');
    cy.contains('265000000000000001').should('be.visible');
  });

  it('prikazuje gresku kad izmena nije uspela', () => {
    cy.intercept('PUT', '**/api/clients/1', { statusCode: 500, body: { message: 'Server error' } }).as('failedUpdate');
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381609999999');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@failedUpdate');
    cy.contains('nije uspela').should('be.visible');
  });
});
