/// <reference types="cypress" />
export {};

function base64UrlEncode(input: string) {
  return btoa(input)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(role: string, email = 'client@test.com') {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.signature`;
}

describe('Portfolio page', () => {
  const portfolioItems = [
    {
      id: 1,
      listingTicker: 'AAPL',
      listingName: 'Apple Inc.',
      listingType: 'STOCK',
      quantity: 10,
      averageBuyPrice: 150,
      currentPrice: 180,
      profit: 300,
      profitPercent: 20,
      publicQuantity: 5,
      lastModified: '2026-03-22T10:30:00Z',
    },
    {
      id: 2,
      listingTicker: 'EUR/USD',
      listingName: 'Euro Dollar',
      listingType: 'FOREX',
      quantity: 1000,
      averageBuyPrice: 1.08,
      currentPrice: 1.05,
      profit: -30,
      profitPercent: -2.78,
      publicQuantity: 0,
      lastModified: '2026-03-21T09:15:00Z',
    },
  ];

  const summary = {
    totalValue: 5000,
    totalProfit: 270,
    paidTaxThisYear: 50,
    unpaidTaxThisMonth: 10,
  };

  function loginAsTradeClient(win: Window) {
    const accessToken = createJwt('CLIENT', 'portfolio@test.com');

    win.sessionStorage.setItem('accessToken', accessToken);
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        email: 'portfolio@test.com',
        username: 'portfolioClient',
        firstName: 'Lazar',
        lastName: 'Ilic',
        permissions: ['TRADE'],
      })
    );
  }

  function mockPortfolioEndpoints() {
    cy.intercept('GET', '**/portfolio/summary', {
      statusCode: 200,
      body: summary,
    }).as('getPortfolioSummary');

    cy.intercept('GET', '**/portfolio/my', {
      statusCode: 200,
      body: portfolioItems,
    }).as('getMyPortfolio');
  }

  beforeEach(() => {
    mockPortfolioEndpoints();

    cy.visit('/portfolio', {
      onBeforeLoad(win) {
        loginAsTradeClient(win);
      },
    });

    cy.wait('@getPortfolioSummary');
    cy.wait('@getMyPortfolio');
  });

 it('renders summary cards', () => {
  cy.contains('h1', 'Moj portfolio').should('be.visible');

  cy.contains('Ukupna vrednost portfolija').should('be.visible');
  cy.contains('Ukupan profit').should('be.visible');
  cy.contains('Plaćen porez ove godine').should('be.visible');
  cy.contains('Neplaćen porez za tekući mesec').should('be.visible');

  cy.contains('5.000,00').should('be.visible');
  cy.contains('270,00').should('be.visible');
  cy.contains('50,00').should('be.visible');
  cy.contains('10,00').should('be.visible');
});

  it('renders portfolio table with expected columns and rows', () => {
    cy.contains('Hartije u vlasništvu').should('be.visible');

    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Ticker').should('be.visible');
    cy.contains('th', 'Količina').should('be.visible');
    cy.contains('th', 'Prosečna cena').should('be.visible');
    cy.contains('th', 'Trenutna cena').should('be.visible');
    cy.contains('th', 'Profit').should('be.visible');
    cy.contains('th', 'Profit%').should('be.visible');
    cy.contains('th', 'Poslednja izmena').should('be.visible');

    cy.contains('AAPL').should('be.visible');
    cy.contains('Apple Inc.').should('be.visible');
    cy.contains('EUR/USD').should('be.visible');
    cy.contains('Euro Dollar').should('be.visible');

    cy.contains('Akcija').should('be.visible');
    cy.contains('Forex').should('be.visible');

    cy.contains('300,00').should('be.visible');
    cy.contains('-30,00').should('be.visible');
    cy.contains('20,00%').should('be.visible');
    cy.contains('-2,78%').should('be.visible');
  });

  it('navigates to sell order page when Sell button is clicked', () => {
    cy.contains('AAPL')
      .parents('tr')
      .within(() => {
        cy.contains('button', 'Prodaj').click();
      });

    cy.location('pathname').should('eq', '/orders/new');
    cy.location('search').should('include', 'listingId=1');
    cy.location('search').should('include', 'direction=SELL');
  });

  it('allows setting public quantity only for stock items', () => {
    cy.intercept('PATCH', '**/portfolio/1/public', (req) => {
      expect(req.body).to.deep.equal({ quantity: 7 });

      req.reply({
        statusCode: 200,
        body: {
          ...portfolioItems[0],
          publicQuantity: 7,
        },
      });
    }).as('setPublicQuantity');

    cy.contains('AAPL')
      .parents('tr')
      .within(() => {
        cy.get('input[type="number"]').clear().type('7');
        cy.contains('button', 'Učini javnim').click();
      });

    cy.wait('@setPublicQuantity');

    cy.contains('EUR/USD')
      .parents('tr')
      .within(() => {
        cy.get('input[type="number"]').should('not.exist');
        cy.contains('button', 'Učini javnim').should('not.exist');
      });
  });

  it('shows empty state when user has no portfolio items', () => {
    cy.intercept('GET', '**/portfolio/summary', {
      statusCode: 200,
      body: {
        totalValue: 0,
        totalProfit: 0,
        paidTaxThisYear: 0,
        unpaidTaxThisMonth: 0,
      },
    }).as('getEmptySummary');

    cy.intercept('GET', '**/portfolio/my', {
      statusCode: 200,
      body: [],
    }).as('getEmptyPortfolio');

    cy.visit('/portfolio', {
      onBeforeLoad(win) {
        loginAsTradeClient(win);
      },
    });

    cy.wait('@getEmptySummary');
    cy.wait('@getEmptyPortfolio');

    cy.contains('Nemate hartije u portfoliju').should('be.visible');
    cy.contains('Kupljene hartije će se prikazati ovde.').should('be.visible');
  });
});