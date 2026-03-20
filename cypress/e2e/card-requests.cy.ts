/// <reference types="cypress" />

function createJwt(role: string, email = 'admin@banka.rs') {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({
    sub: email, role, active: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.signature`;
}

function loginAsAdmin() {
  const token = createJwt('ADMIN', 'marko.petrovic@banka.rs');
  window.sessionStorage.setItem('token', token);
  window.sessionStorage.setItem('refreshToken', token);
}

function loginAsClient() {
  const token = createJwt('CLIENT', 'stefan.jovanovic@gmail.com');
  window.sessionStorage.setItem('token', token);
  window.sessionStorage.setItem('refreshToken', token);
}

describe('Card Requests - Client', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('klijent vidi dugme za zahtev za novu karticu', () => {
    cy.intercept('GET', '**/cards', { statusCode: 200, body: [] }).as('cards');
    cy.visit('/cards');
    cy.wait('@cards');
    cy.contains('Nova kartica').should('be.visible');
  });

  it('klijent podnosi zahtev za karticu', () => {
    cy.intercept('GET', '**/cards', { statusCode: 200, body: [] }).as('cards');
    cy.intercept('GET', '**/accounts/my', {
      statusCode: 200,
      body: [{ id: 1, accountNumber: '222000112345678911', currencyCode: 'RSD', name: 'Glavni racun' }],
    }).as('accounts');
    cy.intercept('POST', '**/cards/requests', {
      statusCode: 201,
      body: { id: 1, status: 'PENDING', accountId: 1, clientName: 'Stefan Jovanovic' },
    }).as('submitRequest');

    cy.visit('/cards');
    cy.wait('@cards');
    cy.contains('Nova kartica').click();
  });

  it('klijent moze da blokira svoju karticu', () => {
    cy.intercept('GET', '**/cards', {
      statusCode: 200,
      body: [{
        id: 1, cardNumber: '4111111111111111', cardName: 'Visa Debit',
        accountNumber: '222000112345678911', status: 'ACTIVE', cardLimit: 100000,
        expirationDate: '2028-01-01', createdAt: '2026-01-01',
      }],
    }).as('cards');
    cy.intercept('PATCH', '**/cards/1/block', {
      statusCode: 200, body: { id: 1, status: 'BLOCKED' },
    }).as('block');

    cy.visit('/cards');
    cy.wait('@cards');
    cy.contains('Blokiraj').should('be.visible');
  });

  it('klijent NE moze da deaktivira karticu', () => {
    cy.intercept('GET', '**/cards', {
      statusCode: 200,
      body: [{
        id: 1, cardNumber: '4111111111111111', cardName: 'Visa Debit',
        accountNumber: '222000112345678911', status: 'ACTIVE', cardLimit: 100000,
        expirationDate: '2028-01-01', createdAt: '2026-01-01',
      }],
    }).as('cards');

    cy.visit('/cards');
    cy.wait('@cards');
    cy.contains('Deaktiviraj').should('not.exist');
  });

  it('klijent NE moze da odblokira karticu', () => {
    cy.intercept('GET', '**/cards', {
      statusCode: 200,
      body: [{
        id: 1, cardNumber: '4111111111111111', cardName: 'Visa Debit',
        accountNumber: '222000112345678911', status: 'BLOCKED', cardLimit: 100000,
        expirationDate: '2028-01-01', createdAt: '2026-01-01',
      }],
    }).as('cards');

    cy.visit('/cards');
    cy.wait('@cards');
    cy.contains('Odblokiraj').should('not.exist');
  });
});

describe('Card Requests - Admin Portal', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsAdmin();
  });

  it('admin vidi stranicu za zahteve za kartice', () => {
    cy.intercept('GET', '**/cards/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountId: 1, accountNumber: '222000112345678911', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00', cardLimit: 50000 },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');

    cy.visit('/employee/card-requests');
    cy.wait('@requests');
    cy.contains('Zahtevi za kartice').should('be.visible');
    cy.contains('Stefan Jovanovic').should('be.visible');
  });

  it('admin odobrava zahtev za karticu', () => {
    cy.intercept('GET', '**/cards/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountId: 1, accountNumber: '222000112345678911', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00', cardLimit: 50000 },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');
    cy.intercept('PATCH', '**/cards/requests/1/approve', {
      statusCode: 200, body: { id: 1, status: 'APPROVED' },
    }).as('approve');

    cy.visit('/employee/card-requests');
    cy.wait('@requests');
    cy.contains('Odobri').click();
    cy.wait('@approve');
  });

  it('admin odbija zahtev za karticu', () => {
    cy.intercept('GET', '**/cards/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountId: 1, accountNumber: '222000112345678911', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00', cardLimit: 50000 },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');
    cy.intercept('PATCH', '**/cards/requests/1/reject', {
      statusCode: 200, body: { id: 1, status: 'REJECTED' },
    }).as('reject');

    cy.visit('/employee/card-requests');
    cy.wait('@requests');
    cy.contains('Odbij').click();
    cy.wait('@reject');
  });

  it('admin moze da odblokira karticu klijenta', () => {
    cy.intercept('GET', '**/cards/account/1', {
      statusCode: 200,
      body: [{
        id: 1, cardNumber: '4111111111111111', cardName: 'Visa Debit',
        accountNumber: '222000112345678911', status: 'BLOCKED', cardLimit: 100000,
        expirationDate: '2028-01-01', createdAt: '2026-01-01',
      }],
    }).as('cards');
    cy.intercept('PATCH', '**/cards/1/unblock', {
      statusCode: 200, body: { id: 1, status: 'ACTIVE' },
    }).as('unblock');

    cy.visit('/employee/account-cards/1');
    cy.wait('@cards');
    cy.contains('Odblokiraj').should('be.visible');
  });

  it('admin moze da deaktivira karticu klijenta', () => {
    cy.intercept('GET', '**/cards/account/1', {
      statusCode: 200,
      body: [{
        id: 1, cardNumber: '4111111111111111', cardName: 'Visa Debit',
        accountNumber: '222000112345678911', status: 'ACTIVE', cardLimit: 100000,
        expirationDate: '2028-01-01', createdAt: '2026-01-01',
      }],
    }).as('cards');
    cy.intercept('PATCH', '**/cards/1/deactivate', {
      statusCode: 200, body: { id: 1, status: 'DEACTIVATED' },
    }).as('deactivate');

    cy.visit('/employee/account-cards/1');
    cy.wait('@cards');
    cy.contains('Deaktiviraj').should('be.visible');
  });
});
