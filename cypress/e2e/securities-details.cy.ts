/// <reference types="cypress" />

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(role: string, email = 'client@test.com') {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: email, role, active: true, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })
  );
  return `${header}.${payload}.signature`;
}

const MOCK_STOCK: Record<string, unknown> = {
  id: 1, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK',
  price: 178.5, ask: 178.6, bid: 178.4, volume: 52340000,
  priceChange: 2.3, changePercent: 1.31,
  initialMarginCost: 500, maintenanceMargin: 400,
  outstandingShares: 15000000000, dividendYield: 0.55, marketCap: 2800000000000,
};

const MOCK_FUTURES: Record<string, unknown> = {
  id: 10, ticker: 'CLJ26', name: 'Crude Oil Jun 2026', exchangeAcronym: 'NYMEX', listingType: 'FUTURES',
  price: 78.5, ask: 78.6, bid: 78.4, volume: 350000,
  priceChange: -0.8, changePercent: -1.01,
  initialMarginCost: 5000, maintenanceMargin: 4000,
  contractSize: 1000, contractUnit: 'barrel', settlementDate: '2026-06-20',
};

const MOCK_HISTORY = [
  { date: '2026-03-01', price: 170.0 },
  { date: '2026-03-05', price: 172.5 },
  { date: '2026-03-10', price: 168.0 },
  { date: '2026-03-15', price: 175.0 },
  { date: '2026-03-20', price: 178.5 },
];

function login(win: Window) {
  const token = createJwt('CLIENT');
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake');
  win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'client@test.com', role: 'CLIENT' }));
}

describe('Securities Details Page - Stock', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/listings/1', MOCK_STOCK).as('getListing');
    cy.intercept('GET', '**/listings/1/history*', MOCK_HISTORY).as('getHistory');
    cy.visit('/securities/1', { onBeforeLoad: login });
    cy.wait('@getListing');
    cy.wait('@getHistory');
  });

  it('prikazuje breadcrumb navigaciju', () => {
    cy.contains('Hartije').should('be.visible');
    cy.contains('AAPL').should('be.visible');
  });

  it('prikazuje ticker i naziv', () => {
    cy.contains('h1', 'AAPL').should('be.visible');
    cy.contains('Apple Inc.').should('be.visible');
  });

  it('prikazuje badge za tip i berzu', () => {
    cy.contains('STOCK').should('be.visible');
    cy.contains('NASDAQ').should('be.visible');
  });

  it('prikazuje cenu', () => {
    cy.contains('178').should('be.visible');
  });

  it('prikazuje pozitivnu promenu zelenom', () => {
    cy.get('.text-emerald-600').should('exist');
    cy.contains('+1.31%').should('be.visible');
  });

  it('prikazuje dugme Kupi', () => {
    cy.contains('Kupi AAPL').should('be.visible');
  });

  it('Kupi dugme navigira na orders/new', () => {
    cy.contains('Kupi AAPL').click();
    cy.url().should('include', '/orders/new');
    cy.url().should('include', 'listingId=1');
    cy.url().should('include', 'direction=BUY');
  });

  it('prikazuje grafik', () => {
    cy.contains('Kretanje cene').should('be.visible');
    cy.get('.recharts-responsive-container').should('exist');
  });

  it('prikazuje period dugmice', () => {
    cy.contains('1D').should('be.visible');
    cy.contains('1M').should('be.visible');
    cy.contains('1G').should('be.visible');
    cy.contains('Sve').should('be.visible');
  });

  it('menja period grafika', () => {
    cy.contains('button', '1G').click();
    cy.wait('@getHistory');
  });

  it('prikazuje podatke o hartiji', () => {
    cy.contains('Podaci o hartiji').should('be.visible');
    cy.contains('Cena').should('be.visible');
    cy.contains('Ask').should('be.visible');
    cy.contains('Bid').should('be.visible');
    cy.contains('Volume').should('be.visible');
  });

  it('prikazuje stock-specificne podatke', () => {
    cy.contains('Market Cap').should('be.visible');
    cy.contains('Shares Outstanding').should('be.visible');
    cy.contains('Dividend Yield').should('be.visible');
  });

  it('navigira nazad na listu', () => {
    cy.contains('Hartije').first().click();
    cy.url().should('include', '/securities');
    cy.url().should('not.include', '/securities/1');
  });
});

describe('Securities Details Page - Futures', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/listings/10', MOCK_FUTURES).as('getListing');
    cy.intercept('GET', '**/listings/10/history*', MOCK_HISTORY).as('getHistory');
    cy.visit('/securities/10', { onBeforeLoad: login });
    cy.wait('@getListing');
    cy.wait('@getHistory');
  });

  it('prikazuje futures-specificne podatke', () => {
    cy.contains('Contract Size').should('be.visible');
    cy.contains('Contract Unit').should('be.visible');
    cy.contains('Settlement').should('be.visible');
  });

  it('prikazuje negativnu promenu crvenom', () => {
    cy.get('.text-red-500').should('exist');
  });
});

describe('Securities Details - Not Found', () => {
  it('prikazuje poruku kada hartija ne postoji', () => {
    cy.intercept('GET', '**/listings/999', { statusCode: 404, body: {} }).as('notFound');
    cy.intercept('GET', '**/listings/999/history*', { statusCode: 404, body: [] }).as('notFoundHistory');
    cy.visit('/securities/999', { onBeforeLoad: login });
    cy.wait('@notFound');
    cy.contains('Hartija nije pronadjena').should('be.visible');
    cy.contains('Nazad na listu').should('be.visible');
  });
});

describe('Securities Details - Loading', () => {
  it('prikazuje skeleton dok se ucitava', () => {
    cy.intercept('GET', '**/listings/1', (req) => { req.reply({ delay: 2000, body: MOCK_STOCK }); });
    cy.intercept('GET', '**/listings/1/history*', (req) => { req.reply({ delay: 2000, body: MOCK_HISTORY }); });
    cy.visit('/securities/1', { onBeforeLoad: login });
    cy.get('.animate-pulse').should('exist');
  });
});
