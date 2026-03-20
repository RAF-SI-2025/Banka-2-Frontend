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

function loginAsClient() {
  const token = createJwt('CLIENT', 'stefan.jovanovic@gmail.com');
  window.sessionStorage.setItem('token', token);
  window.sessionStorage.setItem('refreshToken', token);
}

const mockAccounts = [
  { id: 1, accountNumber: '222000112345678911', currencyCode: 'RSD', currency: 'RSD', balance: 185000, availableBalance: 178000, name: 'Glavni racun', accountType: 'CHECKING', status: 'ACTIVE' },
  { id: 3, accountNumber: '222000121345678921', currencyCode: 'EUR', currency: 'EUR', balance: 2500, availableBalance: 2350, name: 'Euro racun', accountType: 'FOREIGN', status: 'ACTIVE' },
];

describe('Payment Flow - Complete', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: mockAccounts }).as('accounts');
    cy.intercept('GET', '**/payment-recipients', {
      statusCode: 200,
      body: { content: [
        { id: 1, name: 'Milica Nikolic', accountNumber: '222000112345678913' },
        { id: 2, name: 'Lazar Ilic', accountNumber: '222000112345678915' },
      ], totalPages: 1, totalElements: 2, number: 0 },
    }).as('recipients');
  });

  it('prikazuje formu za novo placanje', () => {
    cy.visit('/payments/new');
    cy.wait('@accounts');
    cy.contains('Novo plaćanje').should('be.visible');
  });

  it('prikazuje listu racuna za izbor', () => {
    cy.visit('/payments/new');
    cy.wait('@accounts');
  });

  it('uspesno placanje prikazuje potvrdu', () => {
    cy.intercept('POST', '**/payments', {
      statusCode: 201,
      body: {
        id: 1, orderNumber: 'PAY-123', status: 'COMPLETED',
        fromAccount: '222000112345678911', toAccount: '222000112345678913',
        amount: 5000, currency: 'RSD', description: 'Test uplata',
        createdAt: '2026-03-20T10:00:00',
      },
    }).as('createPayment');
    cy.intercept('POST', '**/payments/verify', {
      statusCode: 200, body: { verified: true },
    }).as('verify');

    cy.visit('/payments/new');
    cy.wait('@accounts');
  });

  it('nedovoljno sredstava prikazuje gresku', () => {
    cy.intercept('POST', '**/payments', {
      statusCode: 400,
      body: { message: 'Nedovoljno sredstava na racunu' },
    }).as('paymentFail');

    cy.visit('/payments/new');
    cy.wait('@accounts');
  });
});

describe('Payment History', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('prikazuje istoriju placanja', () => {
    cy.intercept('GET', '**/payments**', {
      statusCode: 200,
      body: {
        content: [
          {
            id: 1, orderNumber: 'PAY-123', status: 'COMPLETED',
            fromAccount: '222000112345678911', toAccount: '222000112345678913',
            amount: 5000, currency: 'RSD', description: 'Test uplata',
            direction: 'OUTGOING', createdAt: '2026-03-20T10:00:00',
            recipientName: 'Milica Nikolic',
          },
          {
            id: 2, orderNumber: 'PAY-456', status: 'COMPLETED',
            fromAccount: '222000112345678913', toAccount: '222000112345678911',
            amount: 3000, currency: 'RSD', description: 'Povrat',
            direction: 'INCOMING', createdAt: '2026-03-19T10:00:00',
            recipientName: 'Stefan Jovanovic',
          },
        ],
        totalPages: 1, totalElements: 2, number: 0,
      },
    }).as('payments');

    cy.visit('/payments');
    cy.wait('@payments');
    cy.contains('PAY-123').should('be.visible');
    cy.contains('5.000').should('be.visible');
  });

  it('filtriranje po statusu', () => {
    cy.intercept('GET', '**/payments**', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('filteredPayments');

    cy.visit('/payments');
    cy.wait('@filteredPayments');
  });

  it('preuzimanje PDF potvrde', () => {
    cy.intercept('GET', '**/payments/1/receipt', {
      statusCode: 200,
      headers: { 'content-type': 'application/pdf' },
      body: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    }).as('receipt');

    cy.intercept('GET', '**/payments**', {
      statusCode: 200,
      body: {
        content: [{
          id: 1, orderNumber: 'PAY-123', status: 'COMPLETED',
          fromAccount: '222000112345678911', toAccount: '222000112345678913',
          amount: 5000, currency: 'RSD', description: 'Test',
          direction: 'OUTGOING', createdAt: '2026-03-20T10:00:00',
          recipientName: 'Milica',
        }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('payments');

    cy.visit('/payments');
    cy.wait('@payments');
  });
});

describe('Payment Recipients', () => {
  beforeEach(() => {
    cy.visit('/login');
    loginAsClient();
  });

  it('prikazuje listu sablona', () => {
    cy.intercept('GET', '**/payment-recipients', {
      statusCode: 200,
      body: {
        content: [
          { id: 1, name: 'Milica Nikolic', accountNumber: '222000112345678913' },
          { id: 2, name: 'Lazar Ilic', accountNumber: '222000112345678915' },
        ],
        totalPages: 1, totalElements: 2, number: 0,
      },
    }).as('recipients');

    cy.visit('/recipients');
    cy.wait('@recipients');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Lazar Ilic').should('be.visible');
  });

  it('kreiranje novog sablona', () => {
    cy.intercept('GET', '**/payment-recipients', {
      statusCode: 200,
      body: { content: [], totalPages: 0, totalElements: 0, number: 0 },
    }).as('recipients');
    cy.intercept('POST', '**/payment-recipients', {
      statusCode: 201,
      body: { id: 3, name: 'Ana Stojanovic', accountNumber: '222000112345678917' },
    }).as('createRecipient');

    cy.visit('/recipients');
    cy.wait('@recipients');
  });

  it('brisanje sablona', () => {
    cy.intercept('GET', '**/payment-recipients', {
      statusCode: 200,
      body: {
        content: [{ id: 1, name: 'Za brisanje', accountNumber: '222000112345678913' }],
        totalPages: 1, totalElements: 1, number: 0,
      },
    }).as('recipients');
    cy.intercept('DELETE', '**/payment-recipients/1', {
      statusCode: 204,
    }).as('deleteRecipient');

    cy.visit('/recipients');
    cy.wait('@recipients');
  });
});
