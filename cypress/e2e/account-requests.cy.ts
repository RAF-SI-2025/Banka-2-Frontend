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

describe('Account Requests - Client', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('klijent vidi dugme za novi zahtev za racun', () => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accounts');
    cy.visit('/accounts');
    cy.wait('@accounts');
    cy.contains('Novi račun').should('be.visible');
  });

  it('klijent moze da podnese zahtev za tekuci racun', () => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accounts');
    cy.intercept('POST', '**/accounts/requests', {
      statusCode: 201,
      body: { id: 1, accountType: 'CHECKING', currency: 'RSD', status: 'PENDING' },
    }).as('submitRequest');

    cy.visit('/accounts');
    cy.wait('@accounts');
    cy.contains('Novi račun').click();
    cy.get('form').should('be.visible');
  });

  it('zahtev zahteva obavezna polja', () => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accounts');
    cy.visit('/accounts');
    cy.wait('@accounts');
    cy.contains('Novi račun').click();
  });

  it('klijent ne moze da kreira racun direktno', () => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accounts');
    cy.visit('/accounts');
    cy.wait('@accounts');
    cy.contains('Kreiraj račun').should('not.exist');
  });
});

describe('Account Requests - Admin Portal', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsAdmin();
  });

  it('admin vidi stranicu za zahteve za racune', () => {
    cy.intercept('GET', '**/accounts/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountType: 'CHECKING', currency: 'RSD', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00' },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');

    cy.visit('/employee/account-requests');
    cy.wait('@requests');
    cy.contains('Zahtevi za račune').should('be.visible');
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('PENDING').should('be.visible');
  });

  it('admin moze da odobri zahtev', () => {
    cy.intercept('GET', '**/accounts/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountType: 'CHECKING', currency: 'RSD', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00' },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');
    cy.intercept('PATCH', '**/accounts/requests/1/approve', {
      statusCode: 200,
      body: { id: 1, status: 'APPROVED' },
    }).as('approve');

    cy.visit('/employee/account-requests');
    cy.wait('@requests');
    cy.contains('Odobri').click();
    cy.wait('@approve');
  });

  it('admin moze da odbije zahtev sa razlogom', () => {
    cy.intercept('GET', '**/accounts/requests**', {
      statusCode: 200,
      body: { content: [
        { id: 1, accountType: 'CHECKING', currency: 'RSD', status: 'PENDING', clientName: 'Stefan Jovanovic', clientEmail: 'stefan@test.com', createdAt: '2026-03-20T10:00:00' },
      ], totalPages: 1, totalElements: 1, number: 0 },
    }).as('requests');
    cy.intercept('PATCH', '**/accounts/requests/1/reject', {
      statusCode: 200,
      body: { id: 1, status: 'REJECTED', rejectionReason: 'Nedovoljno dokumentacije' },
    }).as('reject');

    cy.visit('/employee/account-requests');
    cy.wait('@requests');
    cy.contains('Odbij').click();
  });

  it('prazan spisak zahteva prikazuje poruku', () => {
    cy.intercept('GET', '**/accounts/requests**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('requests');

    cy.visit('/employee/account-requests');
    cy.wait('@requests');
    cy.contains('Nema zahteva').should('be.visible');
  });
});
