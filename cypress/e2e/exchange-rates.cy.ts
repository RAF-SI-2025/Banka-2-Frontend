/// <reference types="cypress" />

describe('FE2-09a - Exchange rate table', () => {
  const mockRates = [
    {
      currency: 'EUR',
      buyRate: 117,
      sellRate: 118,
      middleRate: 117.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'CHF',
      buyRate: 123,
      sellRate: 124,
      middleRate: 123.5,
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
      currency: 'GBP',
      buyRate: 138,
      sellRate: 139,
      middleRate: 138.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'JPY',
      buyRate: 0.71,
      sellRate: 0.79,
      middleRate: 0.75,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'CAD',
      buyRate: 80,
      sellRate: 81,
      middleRate: 80.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'AUD',
      buyRate: 74,
      sellRate: 75,
      middleRate: 74.5,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'RSD',
      buyRate: 1,
      sellRate: 1,
      middleRate: 1,
      date: '2026-03-14T10:00:00Z',
    },
    {
      currency: 'SEK',
      buyRate: 10,
      sellRate: 11,
      middleRate: 10.5,
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

  it('prikazuje kursnu listu sa trazenim kolonama, podrzanim valutama i formatiranjem', () => {
    cy.contains('Kursna lista').should('be.visible');

    cy.contains('Valuta').should('be.visible');
    cy.contains('Kupovni kurs').should('be.visible');
    cy.contains('Prodajni kurs').should('be.visible');
    cy.contains('Srednji kurs').should('be.visible');
    cy.contains('Datum').should('be.visible');

    ['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'].forEach((currency) => {
      cy.contains('td', currency).should('exist');
    });

    // Should only show supported currencies (8 rows)
    cy.get('tbody tr').should('have.length', 8);

    cy.contains('td', 'SEK').should('not.exist');

    cy.contains('EUR').parent('tr').within(() => {
      cy.contains('117.0000').should('be.visible');
      cy.contains('118.0000').should('be.visible');
      cy.contains('117.5000').should('be.visible');
      cy.contains('14. 3. 2026.').should('be.visible');
    });

    cy.contains('RSD').parent('tr').within(() => {
      cy.contains('1.0000').should('be.visible');
    });
  });
});