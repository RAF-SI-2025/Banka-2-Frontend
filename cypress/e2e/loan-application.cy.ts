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

describe('Loan Application - Client', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('klijent vidi stranicu za podnosenje zahteva za kredit', () => {
    cy.intercept('GET', '**/accounts/my', {
      statusCode: 200,
      body: [{ id: 1, accountNumber: '222000112345678911', currencyCode: 'RSD', currency: 'RSD', name: 'Glavni racun' }],
    }).as('accounts');
    cy.intercept('GET', '**/loans/my**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('loans');

    cy.visit('/loans');
    cy.wait('@loans');
    cy.contains('Krediti').should('be.visible');
  });

  it('klijent podnosi zahtev za gotovinski kredit', () => {
    cy.intercept('GET', '**/accounts/my', {
      statusCode: 200,
      body: [{ id: 1, accountNumber: '222000112345678911', currencyCode: 'RSD', currency: 'RSD', name: 'Glavni racun' }],
    }).as('accounts');
    cy.intercept('GET', '**/loans/my**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('loans');
    cy.intercept('POST', '**/loans', {
      statusCode: 201,
      body: {
        id: 1, loanType: 'CASH', amount: 50000, currency: 'RSD',
        loanPurpose: 'Renoviranje stana', repaymentPeriod: 12,
        status: 'PENDING', interestType: 'FIXED',
      },
    }).as('applyLoan');

    cy.visit('/loans');
    cy.wait('@loans');
    cy.contains('Zahtev za kredit').click();
  });

  it('klijent vidi listu svojih kredita', () => {
    cy.intercept('GET', '**/loans/my**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanNumber: 'LN-123', loanType: 'CASH', amount: 100000,
          currency: 'RSD', status: 'ACTIVE', repaymentPeriod: 24,
          monthlyPayment: 4523, remainingDebt: 90000, startDate: '2026-01-01',
          endDate: '2028-01-01', nominalRate: 6.25, effectiveRate: 8.0,
          interestType: 'FIXED', loanPurpose: 'Renoviranje',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('loans');

    cy.visit('/loans');
    cy.wait('@loans');
    cy.contains('LN-123').should('be.visible');
    cy.contains('100.000').should('be.visible');
    cy.contains('ACTIVE').should('be.visible');
  });

  it('kredit prikazuje sve detalje', () => {
    cy.intercept('GET', '**/loans/my**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanNumber: 'LN-123', loanType: 'CASH', amount: 100000,
          currency: 'RSD', status: 'ACTIVE', repaymentPeriod: 24,
          monthlyPayment: 4523, remainingDebt: 90000, startDate: '2026-01-01',
          endDate: '2028-01-01', nominalRate: 6.25, effectiveRate: 8.0,
          interestType: 'FIXED', loanPurpose: 'Renoviranje',
          accountNumber: '222000112345678911',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('loans');

    cy.visit('/loans');
    cy.wait('@loans');
    cy.contains('Renoviranje').should('be.visible');
  });
});

describe('Loan Requests - Admin Portal', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsAdmin();
  });

  it('admin vidi zahteve za kredite', () => {
    cy.intercept('GET', '**/loans/requests**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanType: 'CASH', amount: 50000, currency: 'RSD',
          status: 'PENDING', clientName: 'Stefan Jovanovic',
          clientEmail: 'stefan@test.com', repaymentPeriod: 12,
          loanPurpose: 'Renoviranje', createdAt: '2026-03-20T10:00:00',
          interestType: 'FIXED', accountNumber: '222000112345678911',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('requests');

    cy.visit('/employee/loan-requests');
    cy.wait('@requests');
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('50.000').should('be.visible');
    cy.contains('Odobri').should('be.visible');
    cy.contains('Odbij').should('be.visible');
  });

  it('admin odobrava kredit', () => {
    cy.intercept('GET', '**/loans/requests**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanType: 'CASH', amount: 50000, currency: 'RSD',
          status: 'PENDING', clientName: 'Stefan Jovanovic',
          clientEmail: 'stefan@test.com', repaymentPeriod: 12,
          loanPurpose: 'Renoviranje', createdAt: '2026-03-20T10:00:00',
          interestType: 'FIXED', accountNumber: '222000112345678911',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('requests');
    cy.intercept('PATCH', '**/loans/requests/1/approve', {
      statusCode: 200,
      body: { id: 1, status: 'APPROVED', loanNumber: 'LN-ABC123' },
    }).as('approve');

    cy.visit('/employee/loan-requests');
    cy.wait('@requests');
    cy.contains('Odobri').first().click();
    cy.wait('@approve');
  });

  it('admin odbija kredit', () => {
    cy.intercept('GET', '**/loans/requests**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanType: 'CASH', amount: 50000, currency: 'RSD',
          status: 'PENDING', clientName: 'Stefan Jovanovic',
          clientEmail: 'stefan@test.com', repaymentPeriod: 12,
          loanPurpose: 'Renoviranje', createdAt: '2026-03-20T10:00:00',
          interestType: 'FIXED', accountNumber: '222000112345678911',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('requests');
    cy.intercept('PATCH', '**/loans/requests/1/reject', {
      statusCode: 200,
      body: { id: 1, status: 'REJECTED' },
    }).as('reject');

    cy.visit('/employee/loan-requests');
    cy.wait('@requests');
    cy.contains('Odbij').first().click();
    cy.wait('@reject');
  });

  it('admin vidi sve kredite', () => {
    cy.intercept('GET', '**/loans?**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, loanNumber: 'LN-123', loanType: 'CASH', amount: 100000,
          currency: 'RSD', status: 'ACTIVE', repaymentPeriod: 24,
          monthlyPayment: 4523, remainingDebt: 90000,
          clientName: 'Stefan Jovanovic',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('allLoans');

    cy.visit('/employee/all-loans');
    cy.wait('@allLoans');
    cy.contains('LN-123').should('be.visible');
  });
});
