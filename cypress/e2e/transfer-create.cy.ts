/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


describe('FE2-08a - Transfer create flow', () => {
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
    {
      id: 3,
      accountNumber: '333333333333333333',
      ownerName: 'Test User',
      accountType: 'TEKUCI',
      currency: 'RSD',
      balance: 20000,
      availableBalance: 20000,
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

  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');

    cy.intercept('GET', '**/api/exchange-rates/RSD/EUR', {
      statusCode: 200,
      body: {
        currency: 'EUR',
        buyRate: 116.5,
        sellRate: 118.2,
        middleRate: 117,
        date: '2026-03-14',
      },
    }).as('getRateRsdEur');

    cy.intercept('POST', '**/api/payments/transfer', {
      statusCode: 200,
      body: {
        id: 99,
        fromAccountNumber: '111111111111111111',
        toAccountNumber: '222222222222222222',
        amount: 1000,
        fromCurrency: 'RSD',
        toCurrency: 'EUR',
        exchangeRate: 117,
        convertedAmount: 117000,
        commission: 10,
        status: 'PENDING',
        createdAt: '2026-03-14T12:00:00Z',
      },
    }).as('createTransfer');

    cy.visit('/transfers', {
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

  it('prikazuje confirm step i preview za različite valute', () => {
    cy.wait('@getMyAccounts');

    cy.contains('Prenos između računa').should('be.visible');

    cy.get('#fromAccount').select('111111111111111111');
    cy.get('#toAccount').select('222222222222222222');
    cy.get('#amount').clear().type('1000');

    cy.wait('@getRateRsdEur');

    cy.contains('Kurs: 1 RSD = 117.0000 EUR').should('be.visible');
    cy.contains('Konvertovani iznos: 117000.00 EUR').should('be.visible');
    cy.contains('Provizija: 10.00 RSD').should('be.visible');
    cy.contains('Ukupno za terećenje: 1010.00 RSD').should('be.visible');

    cy.contains('Nastavi na potvrdu').click();

    cy.contains('Potvrda prenosa').should('be.visible');
    cy.contains('Račun pošiljaoca:').should('be.visible');
    cy.contains('Račun primaoca:').should('be.visible');
    cy.contains('Iznos: 1000.00 RSD').should('be.visible');
    cy.contains('Provizija: 10.00 RSD').should('be.visible');
    cy.contains('Ukupno za terećenje: 1010.00 RSD').should('be.visible');

    cy.contains('Potvrdi transfer').click();

    cy.wait('@createTransfer')
      .its('request.body')
      .should('deep.equal', {
        fromAccountNumber: '111111111111111111',
        toAccountNumber: '222222222222222222',
        amount: 1000,
      });
  });

  it('za iste valute ne prikazuje kurs i konverziju, ali prikazuje confirm step', () => {
    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select('111111111111111111');
    cy.get('#toAccount').select('333333333333333333');
    cy.get('#amount').clear().type('500');

    cy.contains('Kurs:').should('not.exist');
    cy.contains('Konvertovani iznos:').should('not.exist');

    cy.contains('Nastavi na potvrdu').click();

    cy.contains('Potvrda prenosa').should('be.visible');
    cy.contains('Iznos: 500.00 RSD').should('be.visible');
    cy.contains('Valute: isti kurs nije potreban').should('be.visible');
  });

  it('dugme Nazad vraća korisnika na formu', () => {
    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select('111111111111111111');
    cy.get('#toAccount').select('222222222222222222');
    cy.get('#amount').clear().type('250');

    cy.wait('@getRateRsdEur');

    cy.contains('Nastavi na potvrdu').click();
    cy.contains('Potvrda prenosa').should('be.visible');

    cy.contains('Nazad').click();

    cy.contains('Novi prenos').should('be.visible');
    cy.contains('Nastavi na potvrdu').should('be.visible');
  });
});