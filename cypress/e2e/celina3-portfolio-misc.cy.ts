/// <reference types="cypress" />
export {};

/* ---------- helpers ---------- */

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(role: string, email = 'test@test.com') {
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
  return `${header}.${payload}.fake-signature`;
}

function setClientSession(win: Window) {
  const token = createJwt('CLIENT', 'client@test.com');
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      email: 'client@test.com',
      firstName: 'Stefan',
      lastName: 'Jovanovic',
      permissions: ['TRADE'],
    })
  );
}

function setAdminSession(win: Window) {
  const token = createJwt('ADMIN', 'admin@banka.rs');
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 2,
      email: 'admin@banka.rs',
      firstName: 'Marko',
      lastName: 'Petrovic',
      role: 'ADMIN',
      permissions: ['ADMIN'],
    })
  );
}

function mockCommon() {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake-access-token' },
  });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
}

/* ================================================================
   PORTFOLIO (8 tests)
   ================================================================ */

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
    {
      id: 3,
      listingTicker: 'CORN-JUL',
      listingName: 'Corn July Futures',
      listingType: 'FUTURES',
      quantity: 5,
      averageBuyPrice: 450,
      currentPrice: 470,
      profit: 100,
      profitPercent: 4.44,
      publicQuantity: 0,
      lastModified: '2026-03-20T14:00:00Z',
    },
  ];

  const summary = {
    totalValue: 5000,
    totalProfit: 370,
    paidTaxThisYear: 50,
    unpaidTaxThisMonth: 10,
  };

  function mockPortfolioEndpoints() {
    cy.intercept('GET', '**/api/portfolio/summary', {
      statusCode: 200,
      body: summary,
    }).as('getSummary');

    cy.intercept('GET', '**/api/portfolio/my', {
      statusCode: 200,
      body: portfolioItems,
    }).as('getPortfolio');
  }

  beforeEach(() => {
    mockCommon();
    mockPortfolioEndpoints();

    cy.visit('/portfolio', {
      onBeforeLoad(win) {
        setClientSession(win);
      },
    });

    cy.wait('@getSummary');
    cy.wait('@getPortfolio');
    cy.contains('h1', 'Moj portfolio', { timeout: 10000 }).should('be.visible');
    // Wait for the holdings table to render (ensure loading state is done)
    cy.contains('Hartije u vlasnistvu', { timeout: 10000 }).should('be.visible');
  });

  it('loads portfolio page with holdings table', () => {
    cy.contains('h1', 'Moj portfolio').should('be.visible');
    cy.contains('Hartije u vlasnistvu').should('be.visible');
    cy.contains('AAPL').should('be.visible');
    cy.contains('EUR/USD').should('be.visible');
    cy.contains('CORN-JUL').should('be.visible');
  });

  it('renders summary cards with correct values', () => {
    cy.contains('Ukupna vrednost portfolija').should('be.visible');
    cy.contains('Ukupan profit').should('be.visible');
    cy.contains('5.000,00').should('be.visible');
    cy.contains('370,00').should('be.visible');
    cy.contains('50,00').should('be.visible');
    cy.contains('10,00').should('be.visible');
  });

  it('renders pie chart distribution section', () => {
    cy.contains('Distribucija portfolija').should('be.visible');
    // Recharts renders an SVG with the pie chart
    cy.get('.recharts-pie').should('exist');
  });

  it('displays profit/loss coloring in holdings table', () => {
    // Positive profit row (AAPL) should have green text — scope to table to avoid chart matches
    cy.get('table').contains('td', 'AAPL')
      .parents('tr')
      .within(() => {
        cy.contains('+300,00').should('be.visible');
        cy.contains('+20,00%').should('be.visible');
      });

    // Negative profit row (EUR/USD) should have red text
    cy.get('table').contains('td', 'EUR/USD')
      .parents('tr')
      .within(() => {
        cy.contains('-30,00').should('be.visible');
        cy.contains('-2,78%').should('be.visible');
      });
  });

  it('navigates to sell order when Sell button is clicked', () => {
    cy.get('table').contains('td', 'AAPL')
      .parents('tr')
      .within(() => {
        cy.contains('button', 'Prodaj').click({ force: true });
      });

    cy.location('pathname').should('eq', '/orders/new');
    cy.location('search').should('include', 'listingId=1');
    cy.location('search').should('include', 'direction=SELL');
  });

  it('allows setting public quantity only for STOCK items', () => {
    cy.intercept('PATCH', '**/api/portfolio/1/public', (req) => {
      expect(req.body).to.deep.equal({ quantity: 7 });
      req.reply({
        statusCode: 200,
        body: { ...portfolioItems[0], publicQuantity: 7 },
      });
    }).as('setPublic');

    // STOCK row should have the public quantity input — scope to table to avoid chart matches
    cy.get('table').contains('td', 'AAPL')
      .parents('tr')
      .within(() => {
        cy.get('input[type="number"]').clear({ force: true }).type('7', { force: true });
        cy.contains('button', 'Učini javnim').click({ force: true });
      });

    cy.wait('@setPublic');

    // FOREX row should NOT have public quantity input
    cy.get('table').contains('td', 'EUR/USD')
      .parents('tr')
      .within(() => {
        cy.get('input[type="number"]').should('not.exist');
        cy.contains('button', 'Učini javnim').should('not.exist');
      });

    // FUTURES row should NOT have public quantity input
    cy.get('table').contains('td', 'CORN-JUL')
      .parents('tr')
      .within(() => {
        cy.get('input[type="number"]').should('not.exist');
      });
  });

  it('shows empty portfolio message when no items', () => {
    cy.intercept('GET', '**/api/portfolio/summary', {
      statusCode: 200,
      body: { totalValue: 0, totalProfit: 0, paidTaxThisYear: 0, unpaidTaxThisMonth: 0 },
    }).as('emptySummary');
    cy.intercept('GET', '**/api/portfolio/my', {
      statusCode: 200,
      body: [],
    }).as('emptyPortfolio');

    cy.visit('/portfolio', { onBeforeLoad: setClientSession });
    cy.wait('@emptySummary');
    cy.wait('@emptyPortfolio');

    cy.contains('Nemate hartije u portfoliju').should('be.visible');
  });

  it('displays profit percentage with correct formatting', () => {
    cy.contains('+4,44%').should('be.visible');
    cy.contains('+20,00%').should('be.visible');
    cy.contains('-2,78%').should('be.visible');
  });
});

/* ================================================================
   ACTUARY MANAGEMENT (8 tests)
   ================================================================ */

describe('Actuary management page', () => {
  const agents = [
    {
      id: 10,
      employeeId: 10,
      employeeName: 'Pera Peric',
      employeeEmail: 'pera.peric@banka.rs',
      actuaryType: 'AGENT',
      dailyLimit: 100000,
      usedLimit: 35000,
      needApproval: true,
    },
    {
      id: 11,
      employeeId: 11,
      employeeName: 'Jovan Jovanovic',
      employeeEmail: 'jovan@banka.rs',
      actuaryType: 'SUPERVISOR',
      dailyLimit: 500000,
      usedLimit: 480000,
      needApproval: false,
    },
  ];

  function mockAgents(data = agents) {
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 200,
      body: data,
    }).as('getAgents');
  }

  beforeEach(() => {
    mockCommon();
  });

  it('loads actuary page with agent table', () => {
    mockAgents();
    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.contains('h1', 'Upravljanje aktuarima').should('be.visible');
    cy.contains('td', 'Pera').should('be.visible');
    cy.contains('td', 'Peric').should('be.visible');
    cy.contains('td', 'pera.peric@banka.rs').should('be.visible');
    cy.contains('td', 'Jovan').should('be.visible');
  });

  it('filters agents by email when filter panel is open', () => {
    cy.intercept('GET', '**/api/actuaries/agents*', (req) => {
      const email = String(req.query.email ?? '');
      if (email.includes('pera')) {
        req.reply({ statusCode: 200, body: [agents[0]] });
      } else {
        req.reply({ statusCode: 200, body: agents });
      }
    }).as('getAgents');

    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.get('button[title="Filteri"]').click({ force: true });
    cy.get('input[placeholder="Pretraga po email-u"]').type('pera');

    cy.wait('@getAgents');
    cy.contains('td', 'Pera').should('be.visible');
  });

  it('filters agents by first name', () => {
    cy.intercept('GET', '**/api/actuaries/agents*', (req) => {
      const firstName = String(req.query.firstName ?? '');
      if (firstName === 'Jovan') {
        req.reply({ statusCode: 200, body: [agents[1]] });
      } else {
        req.reply({ statusCode: 200, body: agents });
      }
    }).as('getAgents');

    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.get('button[title="Filteri"]').click({ force: true });
    cy.get('input[placeholder="Pretraga po imenu"]').type('Jovan');

    cy.wait('@getAgents');
    cy.contains('td', 'Jovan').should('be.visible');
  });

  it('opens edit limit dialog when pencil button clicked', () => {
    mockAgents();
    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.contains('td', 'Pera')
      .parents('tr')
      .within(() => {
        cy.get('button[title="Izmeni limit"]').click({ force: true });
      });

    cy.contains('Izmena limita').should('be.visible');
    cy.contains('Pera Peric').should('be.visible');
    cy.get('#dailyLimit').should('be.visible');
  });

  it('saves limit changes via edit dialog', () => {
    mockAgents();
    cy.intercept('PATCH', '**/api/actuaries/10/limit', (req) => {
      expect(req.body.dailyLimit).to.equal(200000);
      req.reply({
        statusCode: 200,
        body: { ...agents[0], dailyLimit: 200000 },
      });
    }).as('updateLimit');

    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.contains('td', 'Pera')
      .parents('tr')
      .within(() => {
        cy.get('button[title="Izmeni limit"]').click({ force: true });
      });

    cy.get('#dailyLimit').clear().type('200000');
    cy.contains('button', 'Sacuvaj').click({ force: true });
    cy.wait('@updateLimit');
  });

  it('resets used limit after confirmation', () => {
    mockAgents();
    cy.intercept('PATCH', '**/api/actuaries/10/reset-limit', {
      statusCode: 200,
      body: { ...agents[0], usedLimit: 0 },
    }).as('resetLimit');

    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.on('window:confirm', () => true);

    cy.contains('td', 'Pera')
      .parents('tr')
      .within(() => {
        cy.contains('button', 'Resetuj limit').click({ force: true });
      });

    cy.wait('@resetLimit');
  });

  it('displays usage progress bar with high-usage coloring', () => {
    mockAgents();
    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    // Jovan has 96% usage (480000/500000) - should be red (>= 90%)
    cy.contains('td', 'Jovan')
      .parents('tr')
      .within(() => {
        cy.contains('96%').should('be.visible');
      });

    // Pera has 35% usage - should be green (< 70%)
    cy.contains('td', 'Pera')
      .parents('tr')
      .within(() => {
        cy.contains('35%').should('be.visible');
      });
  });

  it('shows empty agents message when no agents found', () => {
    mockAgents([]);
    cy.visit('/employee/actuaries', { onBeforeLoad: setAdminSession });
    cy.wait('@getAgents');

    cy.contains('Nema pronadjenih agenata').should('be.visible');
  });
});

/* ================================================================
   TAX PORTAL (6 tests)
   ================================================================ */

describe('Tax portal page', () => {
  const taxRecords = [
    {
      userId: 11,
      userName: 'Marko Markovic',
      userType: 'CLIENT',
      totalProfit: 120000,
      taxOwed: 18000,
      taxPaid: 10000,
      currency: 'RSD',
    },
    {
      userId: 22,
      userName: 'Ana Anic',
      userType: 'EMPLOYEE',
      totalProfit: 50000,
      taxOwed: 7500,
      taxPaid: 2000,
      currency: 'EUR',
    },
  ];

  const exchangeRates = [
    { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
    { currency: 'EUR', buyRate: 117, sellRate: 118, middleRate: 117.5, date: '2026-03-23' },
  ];

  function mockTaxEndpoints(records = taxRecords) {
    cy.intercept('GET', '**/exchange-rates', {
      statusCode: 200,
      body: exchangeRates,
    }).as('getRates');

    cy.intercept('GET', '**/api/tax*', {
      statusCode: 200,
      body: records,
    }).as('getTax');
  }

  beforeEach(() => {
    mockCommon();
  });

  it('loads tax page with records and correct columns', () => {
    mockTaxEndpoints();
    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    cy.contains('h1', 'Pracenje poreza').should('be.visible');
    cy.contains('th', 'Korisnik').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Ukupan profit').should('be.visible');
    cy.contains('th', 'Porez dugovan').should('be.visible');
    cy.contains('th', 'Porez placen').should('be.visible');
    cy.contains('th', 'Dugovanje (RSD)').should('be.visible');
    cy.contains('td', 'Marko Markovic').should('be.visible');
  });

  it('filters records by user type', () => {
    cy.intercept('GET', '**/exchange-rates', {
      statusCode: 200,
      body: exchangeRates,
    }).as('getRates');

    cy.intercept('GET', '**/api/tax*', (req) => {
      const ut = String(req.query.userType ?? '');
      if (ut === 'CLIENT') {
        req.reply({ statusCode: 200, body: [taxRecords[0]] });
      } else if (ut === 'EMPLOYEE') {
        req.reply({ statusCode: 200, body: [taxRecords[1]] });
      } else {
        req.reply({ statusCode: 200, body: taxRecords });
      }
    }).as('getTax');

    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    cy.contains('button', 'Klijenti').click({ force: true });
    cy.wait('@getTax');
    cy.contains('td', 'Marko Markovic').should('be.visible');
  });

  it('filters records by name search', () => {
    cy.intercept('GET', '**/exchange-rates', {
      statusCode: 200,
      body: exchangeRates,
    }).as('getRates');

    cy.intercept('GET', '**/api/tax*', (req) => {
      const name = String(req.query.name ?? '');
      if (name.toLowerCase().includes('ana')) {
        req.reply({ statusCode: 200, body: [taxRecords[1]] });
      } else {
        req.reply({ statusCode: 200, body: taxRecords });
      }
    }).as('getTax');

    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    cy.get('input[placeholder="Pretraga po imenu"]').type('ana');
    cy.wait('@getTax');
    cy.contains('td', 'Ana Anic').should('be.visible');
  });

  it('triggers tax calculation after confirmation', () => {
    mockTaxEndpoints([]);
    cy.intercept('POST', '**/api/tax/calculate', {
      statusCode: 200,
      body: {},
    }).as('calculate');

    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    cy.on('window:confirm', () => true);
    cy.contains('button', 'Izracunaj porez').should('not.be.disabled').click({ force: true });
    cy.wait('@calculate');
    cy.contains('Obracun poreza je uspesno pokrenut.').should('be.visible');
  });

  it('displays tax amounts with correct RSD conversion', () => {
    mockTaxEndpoints();
    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    // Ana: (7500 - 2000) * 117.5 = 646250.00 RSD
    cy.contains('td', '646.250,00 RSD').should('be.visible');
    // Marko: (18000 - 10000) * 1 = 8000.00 RSD
    cy.contains('td', '8.000,00 RSD').should('be.visible');
  });

  it('shows empty records message', () => {
    mockTaxEndpoints([]);
    cy.visit('/employee/tax', { onBeforeLoad: setAdminSession });
    cy.wait('@getRates');
    cy.wait('@getTax');

    cy.contains('Nema podataka za prikaz').should('be.visible');
  });
});

/* ================================================================
   EXCHANGES (5 tests)
   ================================================================ */

describe('Exchanges page', () => {
  const exchangesList = [
    {
      id: 1,
      name: 'New York Stock Exchange',
      acronym: 'NYSE',
      micCode: 'XNYS',
      country: 'SAD',
      currency: 'USD',
      openTime: '09:30',
      closeTime: '16:00',
      isOpen: true,
      testMode: false,
    },
    {
      id: 2,
      name: 'Belgrade Stock Exchange',
      acronym: 'BELEX',
      micCode: 'XBEL',
      country: 'Srbija',
      currency: 'RSD',
      openTime: '10:00',
      closeTime: '14:00',
      isOpen: false,
      testMode: true,
    },
  ];

  beforeEach(() => {
    mockCommon();
  });

  it('loads exchanges page with exchange table', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: exchangesList,
    }).as('getExchanges');

    cy.visit('/employee/exchanges', { onBeforeLoad: setAdminSession });
    cy.wait('@getExchanges');

    cy.contains('h1', 'Berze').should('be.visible');
    cy.contains('Svetske berze (2)').should('be.visible');
    cy.contains('New York Stock Exchange').should('be.visible');
    cy.contains('Belgrade Stock Exchange').should('be.visible');
  });

  it('shows open/closed status badges', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: exchangesList,
    }).as('getExchanges');

    cy.visit('/employee/exchanges', { onBeforeLoad: setAdminSession });
    cy.wait('@getExchanges');

    // NYSE is open
    cy.contains('New York Stock Exchange')
      .parents('tr')
      .within(() => {
        cy.contains('Otvorena').should('be.visible');
      });

    // BELEX is closed
    cy.contains('Belgrade Stock Exchange')
      .parents('tr')
      .within(() => {
        cy.contains('Zatvorena').should('be.visible');
      });
  });

  it('shows test mode toggle for admin and allows toggling', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: exchangesList,
    }).as('getExchanges');

    cy.intercept('PATCH', '**/api/exchanges/NYSE/test-mode', {
      statusCode: 200,
      body: {},
    }).as('toggleTestMode');

    cy.visit('/employee/exchanges', { onBeforeLoad: setAdminSession });
    cy.wait('@getExchanges');

    // Test Mode column header should be visible for admin
    cy.contains('th', 'Test Mode').should('be.visible');

    // NYSE row: test mode off, toggle it
    cy.contains('New York Stock Exchange')
      .parents('tr')
      .within(() => {
        cy.get('button[role="switch"]').click({ force: true });
      });

    cy.wait('@toggleTestMode');
  });

  it('displays exchange details (MIC code, currency, working hours)', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: exchangesList,
    }).as('getExchanges');

    cy.visit('/employee/exchanges', { onBeforeLoad: setAdminSession });
    cy.wait('@getExchanges');

    cy.contains('New York Stock Exchange')
      .parents('tr')
      .within(() => {
        cy.contains('XNYS').should('be.visible');
        cy.contains('USD').should('be.visible');
        cy.contains('09:30 - 16:00').should('be.visible');
        cy.contains('NYSE').should('be.visible');
      });
  });

  it('shows empty exchanges message when no data', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: [],
    }).as('getExchanges');

    cy.visit('/employee/exchanges', { onBeforeLoad: setAdminSession });
    cy.wait('@getExchanges');

    cy.contains('Nema dostupnih berzi').should('be.visible');
  });
});

/* ================================================================
   MARGIN ACCOUNTS (5 tests)
   ================================================================ */

describe('Margin accounts page', () => {
  const marginAccounts = [
    {
      id: 1,
      accountNumber: 'MRG-00001',
      linkedAccountNumber: 'ACC-12345',
      status: 'ACTIVE',
      currency: 'RSD',
      initialMargin: 100000,
      loanValue: 200000,
      maintenanceMargin: 50000,
      bankParticipation: 75,
    },
    {
      id: 2,
      accountNumber: 'MRG-00002',
      linkedAccountNumber: 'ACC-67890',
      status: 'BLOCKED',
      currency: 'EUR',
      initialMargin: 5000,
      loanValue: 10000,
      maintenanceMargin: 2500,
      bankParticipation: 60,
    },
  ];

  beforeEach(() => {
    mockCommon();
  });

  it('loads margin accounts page with account cards', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: marginAccounts,
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: setClientSession });
    cy.wait('@getMarginAccounts');

    cy.contains('h1', 'Marzni racuni').should('be.visible');
    cy.contains('MRG-00001').should('be.visible');
    cy.contains('MRG-00002').should('be.visible');
  });

  it('displays correct status badges (AKTIVAN / BLOKIRAN)', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: marginAccounts,
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: setClientSession });
    cy.wait('@getMarginAccounts');

    cy.contains('AKTIVAN').should('be.visible');
    cy.contains('BLOKIRAN').should('be.visible');
  });

  it('opens deposit dialog and submits deposit', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: marginAccounts,
    }).as('getMarginAccounts');

    cy.intercept('POST', '**/api/margin-accounts/1/deposit', (req) => {
      expect(req.body.amount).to.equal(5000);
      req.reply({ statusCode: 200, body: {} });
    }).as('deposit');

    cy.visit('/margin-accounts', { onBeforeLoad: setClientSession });
    cy.wait('@getMarginAccounts');

    // Click deposit on the first (active) account
    cy.contains('button', 'Uplati').first().click({ force: true });

    cy.contains('Uplata na marzni racun').should('be.visible');
    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('5000', { force: true });
    cy.get('[role="dialog"]').contains('button', 'Uplati').click({ force: true });
    cy.wait('@deposit');
  });

  it('opens withdraw dialog and submits withdrawal', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: [marginAccounts[0]], // only active account
    }).as('getMarginAccounts');

    cy.intercept('POST', '**/api/margin-accounts/1/withdraw', (req) => {
      expect(req.body.amount).to.equal(3000);
      req.reply({ statusCode: 200, body: {} });
    }).as('withdraw');

    cy.visit('/margin-accounts', { onBeforeLoad: setClientSession });
    cy.wait('@getMarginAccounts');

    cy.contains('button', 'Isplati').first().click({ force: true });
    cy.contains('Isplata sa marznog racuna').should('be.visible');
    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('3000', { force: true });
    cy.get('[role="dialog"]').contains('button', 'Isplati').click({ force: true });
    cy.wait('@withdraw');
  });

  it('shows blocked account banner and disables withdraw', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: [marginAccounts[1]], // only blocked account
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: setClientSession });
    cy.wait('@getMarginAccounts');

    cy.contains('Racun je blokiran').should('be.visible');
    cy.contains('button', 'Isplati').should('be.disabled');
  });
});

/* ================================================================
   NAVIGATION & SIDEBAR (5 tests)
   ================================================================ */

describe('Sidebar navigation - Celina 3 sections', () => {
  beforeEach(() => {
    mockCommon();
  });

  it('renders all sidebar links for a client user', () => {
    cy.visit('/home', { onBeforeLoad: setClientSession });

    // Client financial links
    cy.get('aside a[href="/accounts"]').should('exist');
    cy.get('aside a[href="/payments/new"]').should('exist');
    cy.get('aside a[href="/cards"]').should('exist');
    cy.get('aside a[href="/loans"]').should('exist');
    cy.get('aside a[href="/margin-accounts"]').should('exist');
  });

  it('shows Moje finansije section for client', () => {
    cy.visit('/home', { onBeforeLoad: setClientSession });

    cy.contains('Moje finansije').should('exist');
    cy.contains('aside', 'Racuni').should('exist');
    cy.contains('aside', 'Placanja').should('exist');
    cy.contains('aside', 'Marzni racuni').should('exist');
  });

  it('shows Employee portal section for admin', () => {
    cy.visit('/home', { onBeforeLoad: setAdminSession });

    cy.contains('Employee portal').should('exist');
    cy.get('aside a[href="/employee/actuaries"]').should('exist');
    cy.get('aside a[href="/employee/tax"]').should('exist');
    cy.get('aside a[href="/employee/exchanges"]').should('exist');
    cy.get('aside a[href="/employee/orders"]').should('exist');
  });

  it('shows Berza section with trading links', () => {
    cy.visit('/home', { onBeforeLoad: setClientSession });

    cy.contains('Berza').should('exist');
    cy.get('aside a[href="/securities"]').should('exist');
    cy.get('aside a[href="/portfolio"]').should('exist');
    cy.get('aside a[href="/orders/my"]').should('exist');
  });

  it('theme toggle switches between light and dark modes', () => {
    cy.visit('/home', { onBeforeLoad: setClientSession });

    // Find the theme dropdown trigger and click it
    cy.contains('aside button', /Svetlo|Tamno|Sistem/i).click({ force: true });

    // Select dark mode
    cy.contains('Tamno').click({ force: true });

    // Verify the button now says Tamno
    cy.contains('aside button', 'Tamno').should('be.visible');

    // Switch back to light
    cy.contains('aside button', 'Tamno').click({ force: true });
    cy.contains('Svetlo').click({ force: true });
    cy.contains('aside button', 'Svetlo').should('be.visible');
  });
});
