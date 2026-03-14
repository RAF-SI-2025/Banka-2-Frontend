/// <reference types="cypress" />

describe('FE2-09b - Exchange office conversion calculator', () => {
  const mockRates = [
    {
      currency: 'EUR',
      buyRate: 117,
      sellRate: 118,
      middleRate: 117.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'USD',
      buyRate: 105,
      sellRate: 106,
      middleRate: 105.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'RSD',
      buyRate: 1,
      sellRate: 1,
      middleRate: 1,
      date: '2026-03-14T10:00:00Z',
    },
  ];

  const mockAccounts = [
    {
      id: 1,
      accountNumber: '111111111111111111',
      ownerName: 'Test User',
      accountType: 'TEKUCI',
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
      id: 2,
      accountNumber: '222222222222222222',
      ownerName: 'Test User',
      accountType: 'DEVIZNI',
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
  ];

  beforeEach(() => {
    cy.intercept('GET', '**/exchange-rates', {
      statusCode: 200,
      body: mockRates,
    }).as('getExchangeRates');

    cy.intercept('GET', '**/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');

    cy.intercept('POST', '**/convert', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          convertedAmount: 11750,
          rate: 117.5,
        },
      });
    }).as('convertCurrency');

    cy.visit('/exchange', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', 'fake-access-token');
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

    cy.wait('@getExchangeRates');
    cy.wait('@getMyAccounts');
  });

  it('prikazuje kalkulator konverzije sa svim potrebnim poljima', () => {
    cy.contains('Konverzija').should('be.visible');
    cy.contains('Iz valute').should('be.visible');
    cy.contains('U valutu').should('be.visible');
    cy.contains('Iznos').should('be.visible');
    cy.contains('Račun').should('be.visible');
    cy.contains('button', 'Konvertuj').should('be.visible');
  });

  it('uspesno radi konverziju i prikazuje preview rezultata', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#toCurrency').select('RSD');
    cy.get('#amount').clear().type('100');
    cy.get('#accountNumber').select('111111111111111111');

    cy.contains('button', 'Konvertuj').click();

    cy.wait('@convertCurrency')
      .its('request.body')
      .should((body) => {
        expect(body.fromCurrency).to.equal('EUR');
        expect(body.toCurrency).to.equal('RSD');
        expect(body.amount).to.equal(100);
        expect(body.accountNumber).to.equal('111111111111111111');
      });

    cy.contains('100 EUR = 11750.00 RSD po kursu 117.5000').should('be.visible');
  });

  it('ne dozvoljava konverziju kada su izvorna i ciljna valuta iste', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#toCurrency').select('EUR');
    cy.get('#amount').clear().type('100');
    cy.get('#accountNumber').select('111111111111111111');

    cy.contains('button', 'Konvertuj').click();

    cy.contains('Valute moraju biti razlicite').should('be.visible');

    cy.wait(300);
    cy.get('@convertCurrency.all').should('have.length', 0);
  });

  it('menja dostupne racune u skladu sa izabranom from valutom', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#accountNumber').find('option').should('contain', '111111111111111111');
    cy.get('#accountNumber').find('option').should('not.contain', '222222222222222222');

    cy.get('#fromCurrency').select('RSD');
    cy.get('#accountNumber').find('option').should('contain', '222222222222222222');
    cy.get('#accountNumber').find('option').should('not.contain', '111111111111111111');
  });

  it('resetuje preview rezultata kada korisnik promeni vrednosti u formi', () => {
    cy.get('#fromCurrency').select('EUR');
    cy.get('#toCurrency').select('RSD');
    cy.get('#amount').clear().type('100');
    cy.get('#accountNumber').select('111111111111111111');

    cy.contains('button', 'Konvertuj').click();
    cy.wait('@convertCurrency');

    cy.contains('100 EUR = 11750.00 RSD po kursu 117.5000').should('be.visible');

    cy.get('#amount').clear().type('200');

    cy.contains('100 EUR = 11750.00 RSD po kursu 117.5000').should('not.exist');
  });
});
