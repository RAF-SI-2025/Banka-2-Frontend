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

const MOCK_STOCKS = [
  { id: 1, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 178.5, ask: 178.6, bid: 178.4, volume: 52340000, priceChange: 2.3, changePercent: 1.31, initialMarginCost: 500, maintenanceMargin: 400, outstandingShares: 15000000000, dividendYield: 0.55, marketCap: 2800000000000 },
  { id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 415.2, ask: 415.3, bid: 415.1, volume: 21500000, priceChange: -3.1, changePercent: -0.74, initialMarginCost: 800, maintenanceMargin: 600 },
  { id: 3, ticker: 'TSLA', name: 'Tesla Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 245.8, ask: 246.0, bid: 245.6, volume: 98200000, priceChange: 12.5, changePercent: 5.36, initialMarginCost: 600, maintenanceMargin: 500 },
];

const MOCK_FUTURES = [
  { id: 10, ticker: 'CLJ26', name: 'Crude Oil Jun 2026', exchangeAcronym: 'NYMEX', listingType: 'FUTURES', price: 78.5, ask: 78.6, bid: 78.4, volume: 350000, priceChange: -0.8, changePercent: -1.01, initialMarginCost: 5000, maintenanceMargin: 4000, contractSize: 1000, contractUnit: 'barrel', settlementDate: '2026-06-20' },
];

const MOCK_FOREX = [
  { id: 20, ticker: 'EUR/USD', name: 'Euro Dollar', exchangeAcronym: 'FOREX', listingType: 'FOREX', price: 1.0852, ask: 1.0854, bid: 1.085, volume: 1200000000, priceChange: 0.0023, changePercent: 0.21, initialMarginCost: 100, maintenanceMargin: 80, baseCurrency: 'EUR', quoteCurrency: 'USD', liquidity: 'HIGH' },
];

function makePage(items: unknown[]) {
  return { content: items, totalPages: 1, totalElements: items.length, number: 0, size: 20, empty: items.length === 0 };
}

function login(win: Window, role: string) {
  const token = createJwt(role, role === 'CLIENT' ? 'client@test.com' : 'admin@banka.rs');
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake');
  win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email: role === 'CLIENT' ? 'client@test.com' : 'admin@banka.rs', role }));
}

function mockListings() {
  cy.intercept('GET', '**/listings*', (req) => {
    const type = String(req.query['type'] ?? 'STOCK');
    const search = String(req.query['search'] ?? '').toLowerCase();
    let items = type === 'FUTURES' ? MOCK_FUTURES : type === 'FOREX' ? MOCK_FOREX : MOCK_STOCKS;
    if (search) items = items.filter(i => i.ticker.toLowerCase().includes(search) || i.name.toLowerCase().includes(search));
    req.reply(makePage(items));
  }).as('getListings');
}

describe('Securities List Page', () => {
  describe('Klijent', () => {
    beforeEach(() => {
      mockListings();
      cy.visit('/securities', { onBeforeLoad: (win) => login(win, 'CLIENT') });
      cy.wait('@getListings');
    });

    it('prikazuje header sa ikonom i naslovom', () => {
      cy.contains('Hartije od vrednosti').should('be.visible');
      cy.contains('Pregledajte i trgujte').should('be.visible');
    });

    it('prikazuje samo Akcije i Futures tabove za klijenta (bez Forex)', () => {
      cy.contains('button', 'Akcije').should('be.visible');
      cy.contains('button', 'Futures').should('be.visible');
      cy.contains('button', 'Forex').should('not.exist');
    });

    it('prikazuje akcije u tabeli', () => {
      cy.contains('AAPL').should('be.visible');
      cy.contains('Apple Inc.').should('be.visible');
      cy.contains('MSFT').should('be.visible');
      cy.contains('TSLA').should('be.visible');
    });

    it('prikazuje badge sa brojem hartija', () => {
      cy.contains('3').should('be.visible');
    });

    it('prikazuje pozitivnu promenu zelenom bojom', () => {
      cy.contains('AAPL').closest('tr').find('.text-emerald-600').should('exist');
    });

    it('prikazuje negativnu promenu crvenom bojom', () => {
      cy.contains('MSFT').closest('tr').find('.text-red-500').should('exist');
    });

    it('prebacuje se na Futures tab', () => {
      cy.contains('button', 'Futures').click();
      cy.wait('@getListings');
      cy.contains('CLJ26').should('be.visible');
      cy.contains('Crude Oil').should('be.visible');
    });

    it('prikazuje datum isteka za futures', () => {
      cy.contains('button', 'Futures').click();
      cy.wait('@getListings');
      cy.contains('Datum isteka').should('be.visible');
    });

    it('pretrazuje po ticker-u', () => {
      cy.get('input[placeholder*="Pretrazi"]').type('AAPL');
      cy.wait('@getListings');
      cy.contains('AAPL').should('be.visible');
    });

    it('prikazuje empty state kada nema rezultata', () => {
      cy.intercept('GET', '**/listings*', makePage([])).as('empty');
      cy.get('input[placeholder*="Pretrazi"]').type('NEPOSTOJECI');
      cy.wait('@empty');
      cy.contains('Nema hartija').should('be.visible');
    });

    it('navigira na detalje klikom na red', () => {
      cy.contains('AAPL').closest('tr').click();
      cy.url().should('include', '/securities/1');
    });

    it('osvezava cene klikom na dugme', () => {
      cy.intercept('POST', '**/listings/refresh', { statusCode: 200 }).as('refresh');
      cy.contains('Osvezi cene').click();
      cy.wait('@refresh');
    });
  });

  describe('Admin/Aktuar', () => {
    beforeEach(() => {
      mockListings();
      cy.visit('/securities', { onBeforeLoad: (win) => login(win, 'ADMIN') });
      cy.wait('@getListings');
    });

    it('prikazuje sva tri taba ukljucujuci Forex', () => {
      cy.contains('button', 'Akcije').should('be.visible');
      cy.contains('button', 'Futures').should('be.visible');
      cy.contains('button', 'Forex').should('be.visible');
    });

    it('prikazuje forex parove', () => {
      cy.contains('button', 'Forex').click();
      cy.wait('@getListings');
      cy.contains('EUR/USD').should('be.visible');
    });
  });

  describe('Skeleton loading', () => {
    it('prikazuje skeleton dok se podaci ucitavaju', () => {
      cy.intercept('GET', '**/listings*', (req) => {
        req.reply({ delay: 2000, body: makePage(MOCK_STOCKS) });
      });
      cy.visit('/securities', { onBeforeLoad: (win) => login(win, 'CLIENT') });
      cy.get('.animate-pulse').should('exist');
    });
  });
});
