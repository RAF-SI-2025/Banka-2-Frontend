/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


describe('FE2-08b - Transfer history page', () => {
  const mockAccounts = [
    {
      id: 1,
      accountNumber: '111111111111111111',
      ownerName: 'Test User',
      accountType: 'TEKUCI',
      currency: 'RSD',
      balance: 50000,
      availableBalance: 50000,
      reservedBalance: 0,
      dailyLimit: 100000,
      monthlyLimit: 500000,
      dailySpending: 0,
      monthlySpending: 0,
      maintenanceFee: 0,
      status: 'ACTIVE',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 2,
      accountNumber: '222222222222222222',
      ownerName: 'Test User',
      accountType: 'DEVIZNI',
      currency: 'EUR',
      balance: 1000,
      availableBalance: 1000,
      reservedBalance: 0,
      dailyLimit: 100000,
      monthlyLimit: 500000,
      dailySpending: 0,
      monthlySpending: 0,
      maintenanceFee: 0,
      status: 'ACTIVE',
      createdAt: '2026-03-01T10:00:00Z',
    },
  ];

  const page0Transfers = {
    content: [
      {
        id: 1,
        fromAccountNumber: '111111111111111111',
        toAccountNumber: '222222222222222222',
        amount: 1000,
        fromCurrency: 'RSD',
        toCurrency: 'EUR',
        exchangeRate: 117,
        convertedAmount: 117000,
        commission: 10,
        status: 'COMPLETED',
        createdAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 2,
        fromAccountNumber: '222222222222222222',
        toAccountNumber: '111111111111111111',
        amount: 500,
        fromCurrency: 'EUR',
        toCurrency: 'RSD',
        exchangeRate: 117.5,
        convertedAmount: 58750,
        commission: 5,
        status: 'PENDING',
        createdAt: '2026-03-14T12:00:00Z',
      },
    ],
    totalElements: 12,
    totalPages: 2,
    size: 10,
    number: 0,
  };

  const page1Transfers = {
    content: [
      {
        id: 3,
        fromAccountNumber: '111111111111111111',
        toAccountNumber: '222222222222222222',
        amount: 250,
        fromCurrency: 'RSD',
        toCurrency: 'EUR',
        exchangeRate: 117,
        convertedAmount: 29250,
        commission: 2.5,
        status: 'COMPLETED',
        createdAt: '2026-03-01T08:00:00Z',
      },
      {
        id: 4,
        fromAccountNumber: '222222222222222222',
        toAccountNumber: '111111111111111111',
        amount: 300,
        fromCurrency: 'EUR',
        toCurrency: 'RSD',
        exchangeRate: 117.25,
        convertedAmount: 35175,
        commission: 3,
        status: 'PENDING',
        createdAt: '2026-02-28T09:00:00Z',
      },
    ],
    totalElements: 12,
    totalPages: 2,
    size: 10,
    number: 1,
  };

  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');

    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: page0Transfers,
    }).as('getTransfersPage0');

    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: page1Transfers,
    }).as('getTransfersPage1');

    cy.visit('/transfers/history', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            email: 'client@test.com',
            username: 'client',
            firstName: 'Test',
            lastName: 'User',
            permissions: ['CLIENT'],
          })
        );
      },
    });
  });

  it('prikazuje loading state pre ucitavanja transfera', () => {
    cy.intercept('GET', '**/api/transfers*', {
      delay: 800,
      statusCode: 200,
      body: page0Transfers,
    }).as('getTransfersDelayed');

    cy.visit('/transfers/history', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            email: 'client@test.com',
            username: 'client',
            firstName: 'Test',
            lastName: 'User',
            permissions: ['CLIENT'],
          })
        );
      },
    });

    cy.contains('Učitavanje transfera...').should('be.visible');
    cy.wait('@getTransfersDelayed');
  });

  it('prikazuje istoriju transfera sa trazenim kolonama', () => {
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfersPage0');

    cy.contains('Istorija transfera').should('be.visible');
    cy.contains('Filteri').should('be.visible');

    cy.contains('Order no').should('be.visible');
    cy.contains('From / To').should('be.visible');
    cy.contains('Amount').should('be.visible');
    cy.contains('Rate').should('be.visible');
    cy.contains('Fee').should('be.visible');
    cy.contains('Date').should('be.visible');

    cy.contains('1').should('be.visible');
    cy.contains('111111111111111111').should('be.visible');
    cy.contains('222222222222222222').should('be.visible');
    cy.contains('1000.00 RSD').should('be.visible');
    cy.contains('117.0000').should('be.visible');
    cy.contains('10.00').should('be.visible');
  });

  it('sortira transfere newest first', () => {
    cy.wait('@getTransfersPage0');

    cy.get('tbody tr').first().should('contain.text', '2026');
    cy.get('tbody tr').first().should('contain.text', '222222222222222222');
    cy.get('tbody tr').first().should('contain.text', '111111111111111111');

    cy.get('tbody tr').eq(0).should('contain.text', '500.00 EUR');
    cy.get('tbody tr').eq(1).should('contain.text', '1000.00 RSD');
  });

  it('filtrira po racunu i resetuje stranu', () => {
    cy.wait('@getTransfersPage0');

    cy.get('#account-filter').select('111111111111111111');
    cy.wait('@getTransfersPage0');

    cy.contains('Strana 1 / 2').should('be.visible');
  });

  it('filtrira po datumu', () => {
    cy.wait('@getTransfersPage0');

    cy.get('#date-from').type('2026-03-01');
    cy.get('#date-to').type('2026-03-31');

    cy.wait('@getTransfersPage0');

    cy.contains('Strana 1 / 2').should('be.visible');
  });

  it('prikazuje status vrednosti u tabeli', () => {
    cy.wait('@getTransfersPage0');

    cy.contains('COMPLETED').should('be.visible');
    cy.contains('PENDING').should('be.visible');
  });

  it('prelazi na sledecu stranu i nastavlja order no', () => {
    cy.wait('@getTransfersPage0');

    cy.contains('Sledeca').click();
    cy.wait('@getTransfersPage1');

    cy.contains('Strana 2 / 2').should('be.visible');
    cy.get('tbody tr').eq(0).should('contain.text', '11');
    cy.get('tbody tr').eq(1).should('contain.text', '12');
  });

  it('prikazuje poruku kada nema transfera', () => {
    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0,
      },
    }).as('getEmptyTransfers');

    cy.visit('/transfers/history', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            email: 'client@test.com',
            username: 'client',
            firstName: 'Test',
            lastName: 'User',
            permissions: ['CLIENT'],
          })
        );
      },
    });

    cy.wait('@getMyAccounts');
    cy.wait('@getEmptyTransfers');

    cy.contains('Nema transfera za izabrane filtere.').should('be.visible');
  });
});