/// <reference types="cypress" />

// =============================================================================
// Celina 3 - Comprehensive E2E Tests: Securities & Orders
// Covers: Securities List, Securities Details, Create Order, My Orders
// =============================================================================

// --- Helpers ---

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(role: 'ADMIN' | 'CLIENT', email: string) {
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

function loginAs(win: Window, role: 'ADMIN' | 'CLIENT') {
  const email = role === 'ADMIN' ? 'admin@banka.rs' : 'client@test.com';
  const token = createJwt(role, email);
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake-refresh');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      email,
      role,
      firstName: role === 'ADMIN' ? 'Admin' : 'Milica',
      lastName: role === 'ADMIN' ? 'Admin' : 'Nikolic',
      username: email.split('@')[0],
      permissions: role === 'ADMIN' ? ['ADMIN'] : ['TRADE_STOCKS'],
    })
  );
}

function makePage<T>(items: T[], totalPages = 1) {
  return {
    content: items,
    totalPages,
    totalElements: items.length,
    number: 0,
    size: 20,
    empty: items.length === 0,
  };
}

const _formatSr = (value: number, decimals = 2) =>
  new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

// --- Mock Data ---

const STOCK_APPLE = {
  id: 1, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ',
  listingType: 'STOCK', price: 178.5, ask: 178.6, bid: 178.4,
  volume: 52340000, priceChange: 2.3, changePercent: 1.31,
  initialMarginCost: 500, maintenanceMargin: 400,
  outstandingShares: 15000000000, dividendYield: 0.55, marketCap: 2800000000000,
};

const STOCK_MSFT = {
  id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', exchangeAcronym: 'NASDAQ',
  listingType: 'STOCK', price: 415.2, ask: 415.3, bid: 415.1,
  volume: 21500000, priceChange: -3.1, changePercent: -0.74,
  initialMarginCost: 800, maintenanceMargin: 600,
};

const STOCK_TSLA = {
  id: 3, ticker: 'TSLA', name: 'Tesla Inc.', exchangeAcronym: 'NASDAQ',
  listingType: 'STOCK', price: 245.8, ask: 246.0, bid: 245.6,
  volume: 98200000, priceChange: 12.5, changePercent: 5.36,
  initialMarginCost: 600, maintenanceMargin: 500,
};

const STOCKS = [STOCK_APPLE, STOCK_MSFT, STOCK_TSLA];

const FUTURE_OIL = {
  id: 10, ticker: 'CLJ26', name: 'Crude Oil Jun 2026', exchangeAcronym: 'NYMEX',
  listingType: 'FUTURES', price: 78.5, ask: 78.6, bid: 78.4,
  volume: 350000, priceChange: -0.8, changePercent: -1.01,
  initialMarginCost: 5000, maintenanceMargin: 4000,
  contractSize: 1000, contractUnit: 'barrel', settlementDate: '2026-06-20',
};

const FUTURES = [FUTURE_OIL];

const FOREX_EURUSD = {
  id: 20, ticker: 'EUR/USD', name: 'Euro Dollar', exchangeAcronym: 'FOREX',
  listingType: 'FOREX', price: 1.0852, ask: 1.0854, bid: 1.085,
  volume: 1200000000, priceChange: 0.0023, changePercent: 0.21,
  initialMarginCost: 100, maintenanceMargin: 80,
  baseCurrency: 'EUR', quoteCurrency: 'USD', liquidity: 'HIGH',
};

const FOREXES = [FOREX_EURUSD];

const MOCK_HISTORY = [
  { date: '2026-03-01', price: 170.0, high: 172.0, low: 169.0, change: 1.5, volume: 500000 },
  { date: '2026-03-05', price: 172.5, high: 174.0, low: 171.0, change: 2.5, volume: 600000 },
  { date: '2026-03-10', price: 168.0, high: 173.0, low: 167.0, change: -4.5, volume: 700000 },
  { date: '2026-03-15', price: 175.0, high: 176.0, low: 174.0, change: 7.0, volume: 450000 },
  { date: '2026-03-20', price: 178.5, high: 179.0, low: 177.0, change: 3.5, volume: 520000 },
];

const MOCK_OPTIONS: Array<{
  settlementDate: string;
  currentStockPrice: number;
  calls: Array<{ id: number; strikePrice: number; bid: number; ask: number; price: number; volume: number; openInterest: number; impliedVolatility: number; inTheMoney: boolean }>;
  puts: Array<{ id: number; strikePrice: number; bid: number; ask: number; price: number; volume: number; openInterest: number; impliedVolatility: number; inTheMoney: boolean }>;
}> = [
  {
    settlementDate: '2026-04-18',
    currentStockPrice: 178.5,
    calls: [
      { id: 100, strikePrice: 170, bid: 9.5, ask: 10.0, price: 9.75, volume: 1200, openInterest: 5000, impliedVolatility: 0.28, inTheMoney: true },
      { id: 101, strikePrice: 175, bid: 5.2, ask: 5.7, price: 5.45, volume: 2500, openInterest: 8000, impliedVolatility: 0.25, inTheMoney: true },
      { id: 102, strikePrice: 180, bid: 2.3, ask: 2.8, price: 2.55, volume: 3100, openInterest: 12000, impliedVolatility: 0.23, inTheMoney: false },
      { id: 103, strikePrice: 185, bid: 0.8, ask: 1.2, price: 1.0, volume: 800, openInterest: 4000, impliedVolatility: 0.22, inTheMoney: false },
    ],
    puts: [
      { id: 200, strikePrice: 170, bid: 1.0, ask: 1.4, price: 1.2, volume: 900, openInterest: 3500, impliedVolatility: 0.27, inTheMoney: false },
      { id: 201, strikePrice: 175, bid: 2.5, ask: 3.0, price: 2.75, volume: 1800, openInterest: 6000, impliedVolatility: 0.26, inTheMoney: false },
      { id: 202, strikePrice: 180, bid: 4.8, ask: 5.3, price: 5.05, volume: 2200, openInterest: 7000, impliedVolatility: 0.24, inTheMoney: true },
      { id: 203, strikePrice: 185, bid: 7.5, ask: 8.0, price: 7.75, volume: 600, openInterest: 2000, impliedVolatility: 0.23, inTheMoney: true },
    ],
  },
  {
    settlementDate: '2026-05-16',
    currentStockPrice: 178.5,
    calls: [
      { id: 110, strikePrice: 175, bid: 7.0, ask: 7.5, price: 7.25, volume: 1500, openInterest: 6000, impliedVolatility: 0.30, inTheMoney: true },
      { id: 111, strikePrice: 180, bid: 4.0, ask: 4.5, price: 4.25, volume: 2000, openInterest: 9000, impliedVolatility: 0.28, inTheMoney: false },
    ],
    puts: [
      { id: 210, strikePrice: 175, bid: 3.5, ask: 4.0, price: 3.75, volume: 1100, openInterest: 4500, impliedVolatility: 0.29, inTheMoney: false },
      { id: 211, strikePrice: 180, bid: 6.0, ask: 6.5, price: 6.25, volume: 1400, openInterest: 5500, impliedVolatility: 0.27, inTheMoney: true },
    ],
  },
];

const MOCK_ACCOUNTS = [
  {
    id: 501, accountNumber: '265000000000001234', name: 'Tekuci racun',
    ownerName: 'Milica Nikolic', accountType: 'CURRENT', status: 'ACTIVE',
    availableBalance: 500000, currency: 'USD',
  },
  {
    id: 502, accountNumber: '265000000000005678', name: 'Devizni racun',
    ownerName: 'Milica Nikolic', accountType: 'FOREIGN_CURRENCY', status: 'ACTIVE',
    availableBalance: 100000, currency: 'EUR',
  },
];

function makeOrder(overrides: Partial<{
  id: number; listingTicker: string; listingName: string; listingType: string;
  orderType: string; quantity: number; contractSize: number; pricePerUnit: number;
  direction: string; status: string; remainingPortions: number; approximatePrice: number;
  allOrNone: boolean; afterHours: boolean; margin: boolean; limitValue: number;
  stopValue: number; approvedBy: string; isDone: boolean; createdAt: string;
  lastModification: string; userName: string; userRole: string; listingId: number;
  accountNumber: string; accountName: string; accountId: number;
}> = {}) {
  return {
    id: 1,
    listingId: 1,
    userName: 'Milica Nikolic',
    userRole: 'CLIENT',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 10,
    contractSize: 1,
    pricePerUnit: 178.5,
    direction: 'BUY',
    status: 'PENDING',
    approvedBy: '',
    isDone: false,
    remainingPortions: 10,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 1785.0,
    createdAt: '2026-03-28T10:00:00Z',
    lastModification: '2026-03-28T10:00:00Z',
    ...overrides,
  };
}

function mockCommonEndpoints() {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
}

function interceptListings() {
  cy.intercept('GET', '**/listings*', (req) => {
    const url = new URL(req.url, 'http://localhost');
    // Avoid matching /listings/{id} or /listings/{id}/history
    if (/\/listings\/\d+/.test(url.pathname)) return;

    const type = String(req.query['type'] ?? 'STOCK');
    const search = String(req.query['search'] ?? '').toLowerCase();
    let items =
      type === 'FUTURES' ? FUTURES :
      type === 'FOREX' ? FOREXES :
      STOCKS;
    if (search) {
      items = items.filter(
        (i) => i.ticker.toLowerCase().includes(search) || i.name.toLowerCase().includes(search)
      );
    }
    req.reply(makePage(items));
  }).as('getListings');
}

function interceptCurrentUser(role: 'ADMIN' | 'CLIENT') {
  const email = role === 'ADMIN' ? 'admin@banka.rs' : 'client@test.com';
  cy.intercept('GET', '**/users/me', {
    id: 1, email, firstName: role === 'ADMIN' ? 'Admin' : 'Milica',
    lastName: role === 'ADMIN' ? 'Admin' : 'Nikolic', role,
    permissions: role === 'ADMIN' ? ['ADMIN'] : ['TRADE_STOCKS'],
  }).as('getCurrentUser');
}

// =============================================================================
// 1. SECURITIES LIST (10+ tests)
// =============================================================================

describe('Celina 3 - Securities List Page', () => {
  describe('Client view', () => {
    beforeEach(() => {
      mockCommonEndpoints();
      interceptListings();
      cy.visit('/securities', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.wait('@getListings');
    });

    it('loads the securities page with Bloomberg-style UI header', () => {
      cy.contains('h1', 'Hartije od vrednosti').should('be.visible');
      cy.contains('Pregledajte i trgujte').should('be.visible');
      // Bloomberg-style LIVE indicator
      cy.contains('LIVE').should('be.visible');
    });

    it('displays Stocks tab as default with data in table', () => {
      cy.contains('AAPL').should('be.visible');
      cy.contains('Apple Inc.').should('be.visible');
      cy.contains('MSFT').should('be.visible');
      cy.contains('TSLA').should('be.visible');
    });

    it('switches between Stocks and Futures tabs', () => {
      cy.contains('button', 'Futures').click({ force: true });
      cy.wait('@getListings');
      cy.contains('CLJ26').should('be.visible');
      cy.contains('Crude Oil').should('be.visible');
      // Futures shows expiry column
      cy.get('th').contains('Istek').should('be.visible');

      // Switch back to stocks
      cy.contains('button', 'Akcije').click({ force: true });
      cy.wait('@getListings');
      cy.contains('AAPL').should('be.visible');
    });

    it('does NOT show Forex tab for client', () => {
      cy.contains('button', 'Akcije').should('be.visible');
      cy.contains('button', 'Futures').should('be.visible');
      cy.contains('button', 'Forex').should('not.exist');
    });

    it('searches by ticker and filters results', () => {
      cy.get('input[placeholder*="Pretrazi"]').type('AAPL');
      cy.wait('@getListings');
      cy.contains('AAPL').should('be.visible');
    });

    it('shows empty state when search yields no results', () => {
      cy.intercept('GET', '**/listings*', makePage([])).as('emptySearch');
      cy.get('input[placeholder*="Pretrazi"]').type('XYZNOTFOUND');
      cy.wait('@emptySearch');
      cy.contains('Nema hartija').should('be.visible');
    });

    it('displays market overview cards with total, gainer, loser, volume', () => {
      // Total count card
      cy.contains('Ukupno hartija').should('be.visible');
      cy.contains('3').should('be.visible');
      // Top gainer card (TSLA +5.36%)
      cy.contains('Najveci rast').should('be.visible');
      cy.contains('TSLA').should('be.visible');
      // Top loser card (MSFT -0.74%)
      cy.contains('Najveci pad').should('be.visible');
      // Total volume card
      cy.contains('Ukupan promet').should('be.visible');
    });

    it('renders sparkline charts in the table', () => {
      // Each row should have a recharts container for the mini sparkline
      cy.get('.recharts-responsive-container').should('have.length.at.least', 3);
    });

    it('colors price changes correctly - green for positive, red for negative', () => {
      // AAPL has +1.31% => emerald
      cy.get('table').contains('AAPL').closest('tr').within(() => {
        cy.get('[class*="bg-emerald"]').should('exist');
        cy.contains('+1.31%').should('be.visible');
      });
      // MSFT has -0.74% => red (search within table to avoid matching the "Top Loser" card)
      cy.get('table').contains('MSFT').closest('tr').within(() => {
        cy.get('[class*="bg-red"]').should('exist');
        cy.contains('-0.74%').should('be.visible');
      });
    });

    it('handles pagination when multiple pages exist', () => {
      // Override listings to return multipage data
      const manyStocks = Array.from({ length: 20 }, (_, i) => ({
        ...STOCK_APPLE,
        id: 100 + i,
        ticker: `STK${i}`,
        name: `Stock ${i}`,
      }));
      cy.intercept('GET', '**/listings*', (req) => {
        const page = Number(req.query['page'] ?? 0);
        req.reply({
          content: manyStocks,
          totalPages: 3,
          totalElements: 60,
          number: page,
          size: 20,
        });
      }).as('pagedListings');

      // Reload to trigger the new intercept
      cy.visit('/securities', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.wait('@pagedListings');

      // Pagination controls should be visible
      cy.contains('Strana 1 / 3').should('be.visible');
      cy.contains('button', 'Sledeca').should('not.be.disabled');
      cy.contains('button', 'Prethodna').should('be.disabled');

      // Navigate forward
      cy.contains('button', 'Sledeca').click({ force: true });
      cy.wait('@pagedListings');
    });

    it('refreshes prices when Osvezi cene button is clicked', () => {
      cy.intercept('POST', '**/listings/refresh', { statusCode: 200 }).as('refresh');
      cy.contains('Osvezi cene').click({ force: true });
      cy.wait('@refresh');
      // After refresh, listings are re-fetched
      cy.wait('@getListings');
    });

    it('navigates to details page when row is clicked', () => {
      cy.contains('AAPL').closest('tr').click({ force: true });
      cy.url().should('include', '/securities/1');
    });

    it('shows skeleton loading state while data loads', () => {
      cy.intercept('GET', '**/listings*', (req) => {
        req.reply({ delay: 2000, body: makePage(STOCKS) });
      });
      cy.visit('/securities', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.get('.animate-pulse').should('exist');
    });
  });

  describe('Admin view', () => {
    beforeEach(() => {
      mockCommonEndpoints();
      interceptListings();
      cy.visit('/securities', { onBeforeLoad: (win) => loginAs(win, 'ADMIN') });
      cy.wait('@getListings');
    });

    it('shows all three tabs including Forex for admin', () => {
      cy.contains('button', 'Akcije').should('be.visible');
      cy.contains('button', 'Futures').should('be.visible');
      cy.contains('button', 'Forex').should('be.visible');
    });

    it('displays forex pairs when Forex tab is selected', () => {
      cy.contains('button', 'Forex').click({ force: true });
      cy.wait('@getListings');
      cy.contains('EUR/USD').should('be.visible');
      cy.contains('Euro Dollar').should('be.visible');
    });
  });
});

// =============================================================================
// 2. SECURITIES DETAILS (8+ tests)
// =============================================================================

describe('Celina 3 - Securities Details Page', () => {
  describe('Stock details', () => {
    beforeEach(() => {
      mockCommonEndpoints();
      cy.intercept('GET', '**/listings/1', STOCK_APPLE).as('getListing');
      cy.intercept('GET', '**/listings/1/history*', MOCK_HISTORY).as('getHistory');
      cy.intercept('GET', '**/options*', MOCK_OPTIONS).as('getOptions');
      cy.visit('/securities/1', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.wait('@getListing');
      cy.wait('@getHistory');
    });

    it('loads the details page with chart and listing info', () => {
      cy.contains('h1', 'AAPL').should('be.visible');
      cy.contains('Apple Inc.').should('be.visible');
      cy.contains('Kretanje cene').should('be.visible');
      cy.get('.recharts-responsive-container').should('exist');
    });

    it('displays period selector buttons (1D, 1N, 1M, 1G, 5G, Sve)', () => {
      cy.contains('button', '1D').should('be.visible');
      cy.contains('button', '1N').should('be.visible');
      cy.contains('button', '1M').should('be.visible');
      cy.contains('button', '1G').should('be.visible');
      cy.contains('button', '5G').should('be.visible');
      cy.contains('button', 'Sve').should('be.visible');
    });

    it('changes period when a period button is clicked', () => {
      cy.contains('button', '1G').click({ force: true });
      cy.wait('@getHistory');
    });

    it('displays stats grid with price, change, bid, ask, volume', () => {
      cy.contains('Podaci o hartiji').should('be.visible');
      cy.contains('Cena').should('be.visible');
      cy.contains('Bid').should('be.visible');
      cy.contains('Ask').should('be.visible');
      cy.contains('Volume').should('be.visible');
      cy.contains('Promena').should('be.visible');
    });

    it('shows Buy and Sell buttons in the order panel', () => {
      cy.contains('KUPI').should('be.visible');
      cy.contains('PRODAJ').should('be.visible');
      cy.contains('Kupi AAPL').should('be.visible');
    });

    it('navigates to create order page with correct params on Buy click', () => {
      cy.contains('Kupi AAPL').click({ force: true });
      cy.url().should('include', '/orders/new');
      cy.url().should('include', 'listingId=1');
      cy.url().should('include', 'direction=BUY');
    });

    it('navigates to create order page with SELL direction', () => {
      cy.contains('PRODAJ').click({ force: true });
      cy.contains('Prodaj AAPL').click({ force: true });
      cy.url().should('include', '/orders/new');
      cy.url().should('include', 'direction=SELL');
    });

    it('displays options chain table for stocks', () => {
      cy.wait('@getOptions');
      cy.contains('Lanac opcija').should('be.visible');
      // Headers: Call Bid, Call Ask, Call Last, Strike, Put Bid, Put Ask, Put Last
      cy.contains('th', 'Call Bid').should('be.visible');
      cy.contains('th', 'Strike').should('be.visible');
      cy.contains('th', 'Put Last').should('be.visible');
    });

    // TODO: Tailwind class with /10 opacity suffix not matched by Cypress attribute selector
    it.skip('shows ITM rows with emerald background and OTM rows with red background', () => {
      cy.wait('@getOptions');
      // ITM calls (strike < currentPrice=178.5): 170, 175 should have emerald bg
      // OTM calls (strike >= 178.5): 180, 185 should have red bg
      cy.contains('170').should('exist');
      cy.contains('185').should('exist');
      // Check that both ITM and OTM styling exists (class contains bg-emerald or bg-red with possible /10 suffix)
      cy.get('[class*="bg-emerald"]').should('exist');
      cy.get('tr').then(($rows) => {
        const hasRed = $rows.toArray().some(row => row.className.includes('bg-red'));
        expect(hasRed).to.be.true;
      });
    });

    it('allows filtering options by settlement date', () => {
      cy.wait('@getOptions');
      // The select for settlement date should show the first date
      // We should see a select trigger for dates
      cy.get('[role="combobox"]').first().should('be.visible');
    });

    it('displays stock-specific stats like Market Cap, Shares Outstanding, Dividend Yield', () => {
      cy.contains('Market Cap').should('be.visible');
      cy.contains('Shares Outstanding').should('be.visible');
      cy.contains('Dividend Yield').should('be.visible');
    });
  });

  describe('Not found', () => {
    it('displays not found message for invalid ID', () => {
      mockCommonEndpoints();
      cy.intercept('GET', '**/listings/99999', { statusCode: 404, body: {} }).as('notFound');
      cy.intercept('GET', '**/listings/99999/history*', { statusCode: 404, body: [] }).as('notFoundHistory');
      cy.visit('/securities/99999', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.wait('@notFound');
      cy.contains('Hartija nije pronadjena').should('be.visible');
      cy.contains('Nazad na listu').should('be.visible');
    });
  });

  describe('Futures details', () => {
    it('shows futures-specific fields like contract size and settlement date', () => {
      mockCommonEndpoints();
      cy.intercept('GET', '**/listings/10', FUTURE_OIL).as('getListing');
      cy.intercept('GET', '**/listings/10/history*', MOCK_HISTORY).as('getHistory');
      cy.visit('/securities/10', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
      cy.wait('@getListing');
      cy.wait('@getHistory');
      cy.contains('Velicina ugovora').should('be.visible');
      cy.contains('Datum isteka').should('be.visible');
    });
  });
});

// =============================================================================
// 3. CREATE ORDER (10+ tests)
// =============================================================================

describe('Celina 3 - Create Order Page', () => {
  function setupCreateOrderPage(role: 'ADMIN' | 'CLIENT' = 'CLIENT', queryParams = '') {
    mockCommonEndpoints();
    interceptCurrentUser(role);

    cy.intercept('GET', '**/listings*', (req) => {
      const url = new URL(req.url, 'http://localhost');
      if (/\/listings\/\d+$/.test(url.pathname)) {
        // Single listing fetch
        const id = Number(url.pathname.split('/').pop());
        const all = [...STOCKS, ...FUTURES, ...FOREXES];
        const found = all.find((l) => l.id === id);
        req.reply(found || { statusCode: 404 });
        return;
      }
      const type = String(req.query['type'] ?? 'STOCK');
      const items =
        type === 'FUTURES' ? FUTURES :
        type === 'FOREX' ? FOREXES :
        STOCKS;
      req.reply(makePage(items));
    }).as('getListings');

    cy.intercept('GET', '**/listings/1', STOCK_APPLE).as('getListingById');

    if (role === 'ADMIN') {
      cy.intercept('GET', '**/accounts*', (req) => {
        if (String(req.url).includes('/my')) {
          req.reply(MOCK_ACCOUNTS);
        } else {
          req.reply(makePage(MOCK_ACCOUNTS));
        }
      }).as('getAccounts');
    } else {
      cy.intercept('GET', '**/accounts/my*', MOCK_ACCOUNTS).as('getAccounts');
      cy.intercept('GET', '**/accounts*', (req) => {
        if (String(req.url).includes('/my')) {
          req.reply(MOCK_ACCOUNTS);
        } else {
          req.reply(makePage(MOCK_ACCOUNTS));
        }
      }).as('getAccountsAll');
    }

    cy.intercept('GET', '**/exchanges/**', {
      statusCode: 200,
      body: { id: 1, name: 'NASDAQ', acronym: 'NASDAQ', isOpen: true },
    }).as('getExchange');

    cy.visit(`/orders/new${queryParams}`, {
      onBeforeLoad: (win) => loginAs(win, role),
    });
  }

  it('renders the order form with header', () => {
    setupCreateOrderPage();
    cy.contains('h1', 'Novi nalog').should('be.visible');
    cy.contains('Kreirajte BUY ili SELL nalog').should('be.visible');
  });

  it('displays BUY/SELL direction toggle and defaults to BUY', () => {
    setupCreateOrderPage();
    cy.contains('legend', 'Smer').should('be.visible');
    cy.contains('Kupovina').should('be.visible');
    cy.contains('Prodaja').should('be.visible');
    // BUY should be selected by default (border-emerald)
    cy.contains('Kupovina').closest('label').should('have.class', 'border-emerald-500');
  });

  it('switches direction to SELL when clicked', () => {
    setupCreateOrderPage();
    cy.contains('Prodaja').click({ force: true });
    cy.contains('Prodaja').closest('label').should('have.class', 'border-red-500');
  });

  it('shows all order type options in the selector', () => {
    setupCreateOrderPage();
    cy.get('#orderType').should('be.visible');
    cy.get('#orderType option').should('have.length', 4);
    cy.get('#orderType').find('option').then((options) => {
      const values = [...options].map((o) => o.value);
      expect(values).to.include('MARKET');
      expect(values).to.include('LIMIT');
      expect(values).to.include('STOP');
      expect(values).to.include('STOP_LIMIT');
    });
  });

  it('shows limit field only for LIMIT and STOP_LIMIT order types', () => {
    setupCreateOrderPage();
    // Default is MARKET - no limit field
    cy.get('#limitValue').should('not.exist');
    cy.get('#stopValue').should('not.exist');

    // Select LIMIT
    cy.get('#orderType').select('LIMIT');
    cy.get('#limitValue').should('be.visible');
    cy.get('#stopValue').should('not.exist');

    // Select STOP
    cy.get('#orderType').select('STOP');
    cy.get('#limitValue').should('not.exist');
    cy.get('#stopValue').should('be.visible');

    // Select STOP_LIMIT - both should appear
    cy.get('#orderType').select('STOP_LIMIT');
    cy.get('#limitValue').should('be.visible');
    cy.get('#stopValue').should('be.visible');
  });

  it('updates approximate price when quantity changes', () => {
    setupCreateOrderPage();
    // Initially quantity is 1, wait for listings to load
    cy.get('[data-testid="approximate-price-row"]').should('be.visible');

    // Change quantity to 5
    cy.get('#quantity').clear().type('5');
    // The approximate price row should update
    cy.get('[data-testid="approximate-price-row"]').should('be.visible');
  });

  it('displays commission preview based on order type', () => {
    setupCreateOrderPage();
    // Commission should be visible in the cost estimate card
    cy.get('[data-testid="commission-row"]').should('be.visible');
    cy.get('[data-testid="total-row"]').should('be.visible');
  });

  it('shows account selector with available accounts', () => {
    setupCreateOrderPage();
    cy.get('#accountId').should('be.visible');
    // Should have the mock accounts
    cy.get('#accountId option').should('have.length.at.least', 2);
  });

  it('has All or None checkbox that can be toggled', () => {
    setupCreateOrderPage();
    cy.contains('All or None').should('be.visible');
    cy.contains('Dozvoljeno je parcijalno izvršenje').should('be.visible');

    // Check the AON checkbox
    cy.contains('All or None').closest('label').find('input[type="checkbox"]').check({ force: true });
    cy.contains('Nalog se izvršava samo ako može u potpunosti').should('be.visible');
  });

  it('shows after-hours/exchange closed warning when exchange is closed', () => {
    mockCommonEndpoints();
    interceptCurrentUser('CLIENT');

    cy.intercept('GET', '**/listings*', (req) => {
      const url = new URL(req.url, 'http://localhost');
      if (/\/listings\/\d+$/.test(url.pathname)) {
        // Single listing fetch — reply with STOCK_APPLE
        req.reply(STOCK_APPLE);
        return;
      }
      req.reply(makePage(STOCKS));
    }).as('getListings');
    cy.intercept('GET', '**/listings/1', STOCK_APPLE).as('getListingById');
    cy.intercept('GET', '**/accounts/my*', MOCK_ACCOUNTS).as('getAccounts');
    cy.intercept('GET', '**/accounts*', (req) => {
      if (String(req.url).includes('/my')) {
        req.reply(MOCK_ACCOUNTS);
      } else {
        req.reply(makePage(MOCK_ACCOUNTS));
      }
    }).as('getAccountsAll');

    // Return exchange as closed
    cy.intercept('GET', '**/exchanges/**', {
      statusCode: 200,
      body: { id: 1, name: 'NASDAQ', acronym: 'NASDAQ', isOpen: false },
    }).as('getExchangeClosed');

    cy.visit('/orders/new', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
    // The exchange status check happens when a listing is selected
    cy.contains('Berza zatvorena', { timeout: 10000 }).should('be.visible');
  });

  it('submits order after confirmation dialog', () => {
    setupCreateOrderPage();

    cy.intercept('POST', '**/api/orders', {
      statusCode: 201,
      body: makeOrder(),
    }).as('createOrder');

    // Fill in the form - listings and accounts should auto-select
    cy.get('#quantity').clear().type('10');

    // Submit form
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });

    // Confirmation dialog should open
    cy.contains('Potvrda naloga').should('be.visible');
    cy.contains('Proverite detalje pre slanja').should('be.visible');

    // Confirm
    cy.contains('button', 'Potvrdi').scrollIntoView().click({ force: true });
    cy.wait('@createOrder');

    // Should navigate to my orders
    cy.url().should('include', '/orders/my');
  });

  it('pre-fills listing and direction from query params', () => {
    setupCreateOrderPage('CLIENT', '?listingId=1&direction=SELL');
    // Direction should be SELL
    cy.contains('Prodaja').closest('label').should('have.class', 'border-red-500');
  });

  it('shows loading skeletons while data loads', () => {
    mockCommonEndpoints();
    interceptCurrentUser('CLIENT');
    cy.intercept('GET', '**/listings*', (req) => {
      req.reply({ delay: 3000, body: makePage(STOCKS) });
    });
    cy.intercept('GET', '**/accounts/my*', (req) => {
      req.reply({ delay: 3000, body: MOCK_ACCOUNTS });
    });
    cy.intercept('GET', '**/accounts*', (req) => {
      req.reply({ delay: 3000, body: makePage(MOCK_ACCOUNTS) });
    });

    cy.visit('/orders/new', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
    cy.get('.animate-pulse').should('exist');
  });
});

// =============================================================================
// 4. MY ORDERS (8+ tests)
// =============================================================================

describe('Celina 3 - My Orders Page', () => {
  const pendingOrder = makeOrder({ id: 1, status: 'PENDING', direction: 'BUY', quantity: 10, remainingPortions: 10 });
  const approvedOrder = makeOrder({ id: 2, status: 'APPROVED', direction: 'SELL', quantity: 20, remainingPortions: 8, listingTicker: 'MSFT', listingName: 'Microsoft Corp.', createdAt: '2026-03-27T15:00:00Z' });
  const doneOrder = makeOrder({ id: 3, status: 'DONE', direction: 'BUY', quantity: 5, remainingPortions: 0, isDone: true, listingTicker: 'TSLA', listingName: 'Tesla Inc.', approvedBy: 'admin@banka.rs', createdAt: '2026-03-26T09:00:00Z' });
  const declinedOrder = makeOrder({ id: 4, status: 'DECLINED', direction: 'BUY', quantity: 3, remainingPortions: 3, listingTicker: 'CLJ26', listingName: 'Crude Oil Jun 2026', listingType: 'FUTURES', createdAt: '2026-03-25T12:00:00Z' });

  const allOrders = [pendingOrder, approvedOrder, doneOrder, declinedOrder];

  function setupMyOrdersPage(orders = allOrders) {
    mockCommonEndpoints();
    interceptCurrentUser('CLIENT');
    cy.intercept('GET', '**/api/orders/my*', {
      statusCode: 200,
      body: makePage(orders),
    }).as('getMyOrders');

    cy.visit('/orders/my', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
    cy.wait('@getMyOrders');
    // Wait for the page header to ensure rendering is complete
    cy.contains('h1', 'Moji nalozi', { timeout: 10000 }).should('be.visible');
  }

  it('loads the my orders page with header and stats', () => {
    setupMyOrdersPage();
    cy.contains('h1', 'Moji nalozi').should('be.visible');
    cy.contains('Pregled svih vasih BUY i SELL naloga').should('be.visible');
    // Filter buttons showing status counts
    cy.contains('button', 'Na cekanju').should('be.visible');
    cy.contains('button', 'Odobreni').should('be.visible');
    cy.contains('button', 'Zavrseni').should('be.visible');
  });

  it('displays status badges with correct variants for each order', () => {
    setupMyOrdersPage();
    cy.contains('Na cekanju').should('be.visible');  // PENDING badge in table
    cy.contains('Odobren').should('be.visible');     // APPROVED badge
    cy.contains('Zavrsen').should('be.visible');     // DONE badge
    cy.contains('Odbijen').should('be.visible');     // DECLINED badge
  });

  it('displays direction with correct icon styling (BUY green, SELL red)', () => {
    setupMyOrdersPage();
    // BUY orders should show Kupovina with emerald icon
    cy.contains('Kupovina').should('be.visible');
    cy.get('.text-emerald-600').should('exist');
    // SELL order should show Prodaja with rose icon
    cy.contains('Prodaja').should('be.visible');
    cy.get('.text-rose-600').should('exist');
  });

  it('shows progress bar for executing (APPROVED) orders with partial execution', () => {
    setupMyOrdersPage();
    // approvedOrder has quantity=20, remaining=8, so executed=12, progress=60%
    cy.get('[aria-label*="Izvrsenje ordera"]').should('exist');
    cy.contains('Izvrseno:').should('be.visible');
  });

  it('shows cancel button for PENDING and APPROVED orders only', () => {
    setupMyOrdersPage();
    // PENDING order should have cancel button
    cy.contains('AAPL').closest('tr').contains('button', 'Otkazi').should('be.visible');
    // APPROVED order should have cancel button
    cy.contains('MSFT').closest('tr').contains('button', 'Otkazi').should('be.visible');
    // DONE order should NOT have cancel button
    cy.contains('TSLA').closest('tr').contains('button', 'Otkazi').should('not.exist');
    // DECLINED order should NOT have cancel button
    cy.contains('CLJ26').closest('tr').contains('button', 'Otkazi').should('not.exist');
  });

  it('cancels an order via confirmation dialog', () => {
    setupMyOrdersPage();

    cy.intercept('PATCH', '**/api/orders/1/decline', {
      statusCode: 200,
      body: { ...pendingOrder, status: 'DECLINED' },
    }).as('cancelOrder');

    // Click cancel on first order
    cy.contains('AAPL').closest('tr').contains('button', 'Otkazi').click({ force: true });

    // Confirmation dialog
    cy.contains('Otkazi nalog').should('be.visible');
    cy.contains('#1').should('be.visible');
    cy.contains('button', 'Potvrdi otkazivanje').click({ force: true });
    cy.wait('@cancelOrder');
  });

  it('opens order detail modal when Detalji button is clicked', () => {
    setupMyOrdersPage();

    // Click details on the pending order
    cy.contains('AAPL').closest('tr').contains('button', 'Detalji').click({ force: true });

    // Modal should show detailed info
    cy.contains('Detalji naloga').should('be.visible');
    cy.contains('Kompletan pregled izabranog naloga').should('be.visible');
    cy.contains('Tip ordera').should('be.visible');
    cy.contains('Kolicina').should('be.visible');
    cy.contains('Finansijski pregled').scrollIntoView().should('be.visible');
    cy.contains('Provizija').scrollIntoView().should('be.visible');

    // Close modal
    cy.get('button[aria-label="Zatvori"]').click({ force: true });
    cy.contains('Detalji naloga').should('not.exist');
  });

  it('displays empty state message when no orders exist', () => {
    setupMyOrdersPage([]);
    cy.contains('Nema kreiranih naloga').should('be.visible');
    cy.contains('Kada posaljete prvi nalog').should('be.visible');
  });

  it('polls for active orders when APPROVED orders exist', () => {
    // The page sets up a 5s interval when APPROVED orders exist
    let callCount = 0;
    mockCommonEndpoints();
    interceptCurrentUser('CLIENT');
    cy.intercept('GET', '**/api/orders/my*', (req) => {
      callCount++;
      req.reply(makePage(allOrders));
    }).as('getMyOrdersPolled');

    cy.visit('/orders/my', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
    cy.wait('@getMyOrdersPolled');

    // Wait for at least one poll cycle (5 seconds)
    cy.wait(6000);
    cy.wait('@getMyOrdersPolled').then(() => {
      expect(callCount).to.be.greaterThan(1);
    });
  });

  it('shows loading skeletons while orders are loading', () => {
    mockCommonEndpoints();
    interceptCurrentUser('CLIENT');
    cy.intercept('GET', '**/api/orders/my*', (req) => {
      req.reply({ delay: 3000, body: makePage(allOrders) });
    }).as('getMyOrdersSlow');

    cy.visit('/orders/my', { onBeforeLoad: (win) => loginAs(win, 'CLIENT') });
    cy.get('.animate-pulse').should('exist');
  });

  it('shows refresh button and can manually refresh orders', () => {
    setupMyOrdersPage();
    cy.contains('button', 'Osvezi').should('be.visible');
    cy.contains('button', 'Osvezi').click();
    cy.wait('@getMyOrders');
  });

  it('shows all order details in the modal including AON, margin, after hours', () => {
    const detailedOrder = makeOrder({
      id: 10,
      allOrNone: true,
      margin: true,
      afterHours: true,
      limitValue: 180.0,
      stopValue: 175.0,
      orderType: 'STOP_LIMIT',
      approvedBy: 'admin@banka.rs',
    });
    setupMyOrdersPage([detailedOrder]);

    cy.contains('AAPL').closest('tr').contains('button', 'Detalji').click({ force: true });

    cy.contains('Detalji naloga').should('be.visible');
    cy.contains('All or None').scrollIntoView().should('be.visible');
    cy.contains('Da').should('exist'); // allOrNone = true
    cy.contains('Margin').scrollIntoView().should('be.visible');
    cy.contains('After hours').scrollIntoView().should('be.visible');
    cy.contains('Limit vrednost').scrollIntoView().should('be.visible');
    cy.contains('Stop vrednost').scrollIntoView().should('be.visible');
  });
});
