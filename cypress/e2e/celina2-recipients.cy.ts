/// <reference types="cypress" />
// Celina 4: Primaoci placanja (S21-S23) - Upravljanje primaocima
import { setupClientSession } from '../support/commands';

const mockRecipients = [
  { id: 1, name: 'Petar Petrovic', accountNumber: '265000000000000099', address: 'Beograd, Knez Mihailova 1', phoneNumber: '+381601111111' },
  { id: 2, name: 'Ana Markovic', accountNumber: '265000000000000088', address: 'Novi Sad, Trg slobode 5', phoneNumber: '+381602222222' },
  { id: 3, name: 'Jovan Jovic', accountNumber: '265000000000000077', address: 'Nis, Obrenoviceva 3', phoneNumber: '+381603333333' },
];

function setupRecipientsIntercepts() {
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients }).as('getRecipients');
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S21: Dodavanje novog primaoca placanja ─────────────────────────
describe('S21: Dodavanje novog primaoca placanja', () => {
  beforeEach(() => {
    setupRecipientsIntercepts();
    cy.intercept('POST', '**/api/payment-recipients', {
      statusCode: 201,
      body: { id: 4, name: 'Novi Primalac', accountNumber: '265000000000000066', address: 'Kragujevac', phoneNumber: '+381604444444' },
    }).as('createRecipient');
    cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getRecipients');
  });

  it('prikazuje stranicu sa primaocima', () => {
    cy.contains('Primaoci placanja').should('be.visible');
    cy.contains('Petar Petrovic').should('be.visible');
    cy.contains('Ana Markovic').should('be.visible');
  });

  it('otvara formu za dodavanje novog primaoca', () => {
    cy.contains('button', 'Dodaj primaoca').click();
    cy.contains('Novi primalac').should('be.visible');
    cy.get('#create-name').should('be.visible');
    cy.get('#create-account').should('be.visible');
  });

  it('uspesno dodaje novog primaoca', () => {
    cy.contains('button', 'Dodaj primaoca').click();
    cy.get('#create-name').type('Novi Primalac');
    cy.get('#create-account').type('265000000000000066');
    cy.get('#create-address').type('Kragujevac');
    cy.get('#create-phone').type('+381604444444');
    cy.contains('button', 'Sacuvaj primaoca').click();
    cy.wait('@createRecipient');
    cy.contains('uspesno dodat').should('be.visible');
  });

  it('validira obavezna polja pri kreiranju', () => {
    cy.contains('button', 'Dodaj primaoca').click();
    cy.contains('button', 'Sacuvaj primaoca').click();
    cy.get('.text-destructive').should('exist');
  });

  it('moze zatvoriti formu za kreiranje', () => {
    cy.contains('button', 'Dodaj primaoca').click();
    cy.contains('Novi primalac').should('be.visible');
    cy.contains('button', 'Zatvori formu').click();
    cy.contains('Novi primalac').should('not.exist');
  });
});

// ─── S22: Izmena podataka primaoca placanja ─────────────────────────
describe('S22: Izmena podataka primaoca placanja', () => {
  beforeEach(() => {
    setupRecipientsIntercepts();
    cy.intercept('PUT', '**/api/payment-recipients/1', {
      statusCode: 200,
      body: { ...mockRecipients[0], name: 'Petar Petrovic Izmenjen' },
    }).as('updateRecipient');
    cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getRecipients');
  });

  it('aktivira edit mode za primaoca', () => {
    cy.contains('tr', 'Petar Petrovic').within(() => {
      cy.contains('button', 'Izmeni').click();
    });
    // Edit form fields should appear
    cy.get('input[placeholder="Ime"]').should('be.visible');
    cy.get('input[placeholder="Broj racuna"]').should('be.visible');
  });

  it('uspesno menja podatke primaoca', () => {
    cy.contains('tr', 'Petar Petrovic').within(() => {
      cy.contains('button', 'Izmeni').click();
    });
    cy.get('input[placeholder="Ime"]').clear().type('Petar Petrovic Izmenjen');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@updateRecipient');
    cy.contains('uspesno izmenjen').should('be.visible');
  });

  it('moze otkazati izmenu', () => {
    cy.contains('tr', 'Petar Petrovic').within(() => {
      cy.contains('button', 'Izmeni').click();
    });
    cy.contains('button', 'Otkazi').click();
    // Should return to normal view
    cy.contains('Petar Petrovic').should('be.visible');
  });
});

// ─── S23: Brisanje primaoca placanja ────────────────────────────────
describe('S23: Brisanje primaoca placanja', () => {
  beforeEach(() => {
    setupRecipientsIntercepts();
    cy.intercept('DELETE', '**/api/payment-recipients/1', { statusCode: 204 }).as('deleteRecipient');
    cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getRecipients');
  });

  it('brise primaoca nakon potvrde', () => {
    cy.on('window:confirm', () => true);
    cy.contains('tr', 'Petar Petrovic').within(() => {
      cy.contains('button', 'Obrisi').click();
    });
    cy.wait('@deleteRecipient');
    cy.contains('obrisan').should('be.visible');
  });

  it('ne brise primaoca ako korisnik otkaze dijalog', () => {
    cy.on('window:confirm', () => false);
    cy.contains('tr', 'Petar Petrovic').within(() => {
      cy.contains('button', 'Obrisi').click();
    });
    // Primalac bi trebao ostati u listi
    cy.contains('Petar Petrovic').should('be.visible');
  });
});

// ─── Pretraga primalaca ─────────────────────────────────────────────
describe('Pretraga primalaca placanja', () => {
  beforeEach(() => {
    setupRecipientsIntercepts();
    cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getRecipients');
  });

  it('filtrira primaoce po imenu', () => {
    cy.get('input[placeholder*="Pretraga"]').type('Petar');
    cy.contains('Petar Petrovic').should('be.visible');
    cy.contains('Ana Markovic').should('not.exist');
  });

  it('filtrira primaoce po broju racuna', () => {
    cy.get('input[placeholder*="Pretraga"]').type('088');
    cy.contains('Ana Markovic').should('be.visible');
    cy.contains('Petar Petrovic').should('not.exist');
  });

  it('prikazuje prazan state kada nema rezultata pretrage', () => {
    cy.get('input[placeholder*="Pretraga"]').type('NepostojeciPrimalac');
    cy.contains('Nema rezultata').should('be.visible');
  });

  it('prikazuje prazan state kad nema sacuvanih primalaca', () => {
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] }).as('emptyRecipients');
    cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyRecipients');
    cy.contains('Nema sacuvanih primalaca').should('be.visible');
  });
});
