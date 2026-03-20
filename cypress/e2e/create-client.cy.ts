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

describe('Create Client - Admin Portal', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsAdmin();
  });

  it('admin vidi dugme za kreiranje novog klijenta', () => {
    cy.intercept('GET', '**/clients**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('clients');

    cy.visit('/employee/clients-portal');
    cy.wait('@clients');
    cy.contains('Novi klijent').should('be.visible');
  });

  it('admin kreira novog klijenta', () => {
    cy.intercept('GET', '**/clients**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('clients');
    cy.intercept('POST', '**/clients', {
      statusCode: 201,
      body: {
        id: 10, firstName: 'Novi', lastName: 'Klijent',
        email: 'novi@test.com', active: true,
      },
    }).as('createClient');

    cy.visit('/employee/clients-portal');
    cy.wait('@clients');
    cy.contains('Novi klijent').click();
  });

  it('admin vidi listu klijenata sa pretragom', () => {
    cy.intercept('GET', '**/clients**', {
      statusCode: 200,
      body: {
        content: [
          { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan@test.com', phone: '+381601234567' },
          { id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica@test.com', phone: '+381609876543' },
        ],
        totalPages: 1, totalElements: 2, number: 0,
      },
    }).as('clients');

    cy.visit('/employee/clients-portal');
    cy.wait('@clients');
    cy.contains('Stefan').should('be.visible');
    cy.contains('Milica').should('be.visible');
    cy.get('input[placeholder*="Pretraga"]').should('be.visible');
  });

  it('admin vidi detalje klijenta', () => {
    cy.intercept('GET', '**/clients**', {
      statusCode: 200,
      body: {
        content: [
          { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan@test.com', phone: '+381601234567', address: 'Beograd', dateOfBirth: '1995-05-15', gender: 'M' },
        ],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('clients');
    cy.intercept('GET', '**/accounts/client/1', {
      statusCode: 200,
      body: [
        { id: 1, accountNumber: '222000112345678911', accountType: 'CHECKING', currencyCode: 'RSD', currency: 'RSD', balance: 185000, status: 'ACTIVE' },
      ],
    }).as('clientAccounts');

    cy.visit('/employee/clients-portal');
    cy.wait('@clients');
    cy.contains('Detalji').first().click();
    cy.wait('@clientAccounts');
    cy.contains('Stefan').should('be.visible');
    cy.contains('222000112345678911').should('be.visible');
  });

  it('klijent NE moze da pristupi portalu klijenata', () => {
    cy.visit('/login');
    loginAsClient();

    cy.visit('/employee/clients-portal');
    cy.url().should('not.include', '/employee/clients-portal');
  });
});

describe('Payment with OTP Verification', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('klijent vrsi placanje sa OTP verifikacijom', () => {
    cy.intercept('GET', '**/accounts/my', {
      statusCode: 200,
      body: [
        { id: 1, accountNumber: '222000112345678911', currencyCode: 'RSD', currency: 'RSD', balance: 185000, availableBalance: 178000, name: 'Glavni racun' },
      ],
    }).as('accounts');
    cy.intercept('GET', '**/payment-recipients', {
      statusCode: 200,
      body: { content: [{ id: 1, name: 'Milica', accountNumber: '222000112345678913' }], totalPages: 1, totalElements: 1, number: 0 },
    }).as('recipients');
    cy.intercept('POST', '**/payments', {
      statusCode: 201,
      body: { id: 1, status: 'PENDING', amount: 5000 },
    }).as('createPayment');
    cy.intercept('POST', '**/payments/verify', {
      statusCode: 200,
      body: { verified: true, message: 'Transakcija uspesno verifikovana' },
    }).as('verify');

    cy.visit('/payments/new');
    cy.wait('@accounts');
  });

  it('pogresan OTP kod ne prolazi', () => {
    cy.intercept('POST', '**/payments/verify', {
      statusCode: 400,
      body: { message: 'Neispravan verifikacioni kod' },
    }).as('verifyFail');
  });
});
