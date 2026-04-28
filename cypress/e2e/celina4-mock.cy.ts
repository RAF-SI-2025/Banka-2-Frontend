/**
 * CELINA 4 - Mock E2E Tests (Comprehensive)
 *
 * Covers: OTC Intra-bank (vec implementirano), OTC Inter-bank (TODO),
 *         Investicioni fondovi (TODO), Profit Banke portal (TODO),
 *         Medjubankarska placanja 2PC (TODO).
 *
 * Sve API pozive mock-ujemo sa cy.intercept() — ne zahteva backend.
 *
 * ==========================================================================
 *  TODO — CELINA 4 MOCK SUITE (zaduzenja po GitHub Issue-ima #66-79)
 * --------------------------------------------------------------------------
 *  Spec referenca: Info o predmetu/Celina 4.txt (linije 1-540)
 *  Distribucija taskova: Info o predmetu/Celina4_Podela_Taskova.md
 *
 *  REFERENCA ZA IMPLEMENTACIJU:
 *    - cypress/e2e/celina3-mock.cy.ts — paternima za mock data, cy.intercept,
 *      cy.session login helpere, viewport handling
 *    - cypress/support/commands.ts — setupAdminSession/setupClientSession itd.
 *
 *  ZAJEDNICKI MOCK PODACI (popuniti kako dev-i implementiraju):
 *    - mockFunds[]         — za Issue #70/#71/#72 (jkrunic)
 *    - mockFundPositions[] — za Issue #74 (antonije3)
 *    - mockOtcRemoteListings[] + mockOtcRemoteOffers[] — Issue #66/#67 (ekalajdzic13322)
 *    - mockActuaryProfit[] + mockBankFundPositions[] — Issue #77 (sssmarta)
 *    - mockInterbankPayments[] — Issue #76 (antonije3)
 *
 *  STRUKTURA:
 *    Svaki describe blok odgovara jednoj feature-i iz spec-a.
 *    Svaki it() scenario treba da mapira na konkretni user flow ili
 *    assertion iz Celina 4.txt + Celina4_Podela_Taskova.md.
 *
 *  KAKO POPUNITI:
 *    1. Ekstrahuj relevantne spec reference (linije u Celina 4.txt)
 *    2. Definisi mock data na vrhu fajla (ili u support/fixtures)
 *    3. cy.intercept() pre visit-a
 *    4. Assertions na UI state
 *
 *  VAZNO:
 *    - NEMA hardcode-ovanih API URL-ova — uvek koristi relativne putanje
 *      sa '/api/...' (vidi celina3-mock.cy.ts obrazac)
 *    - Svi login-i kroz setupXxxSession iz support/commands.ts
 *    - beforeEach clearState za session izolaciju
 * ==========================================================================
 */

import {
  setupAdminSession,
  setupClientSession,
  setupSupervisorSession,
  setupAgentSession,
} from '../support/commands';

// ============================================================
//  MOCK DATA — popuniti kako se feature implementira
// ============================================================

const mockFunds = [
  {
    id: 1, name: 'Alpha Growth Fund', description: 'Fond fokusiran na IT sektor',
    minimumContribution: 1000, fundValue: 2600000, profit: 150000,
    managerName: 'Marko Petrović', inceptionDate: '2025-01-15',
  },
  {
    id: 2, name: 'Beta Income Fund', description: 'Stabilan prihod iz obveznica',
    minimumContribution: 5000, fundValue: 1200000, profit: -30000,
    managerName: 'Nikola Milenković', inceptionDate: '2025-06-01',
  },
  {
    id: 3, name: 'Gamma Balanced Fund', description: 'Balans izmedju rizika i prinosa',
    minimumContribution: 2500, fundValue: 800000, profit: 45000,
    managerName: 'Jelena Đorđević', inceptionDate: '2025-03-10',
  },
];

const mockFundDetail = {
  id: 1, name: 'Alpha Growth Fund', description: 'Fond fokusiran na IT sektor',
  managerName: 'Marko Petrović', managerEmployeeId: 99,
  fundValue: 2600000, liquidAmount: 1500000, profit: 150000,
  minimumContribution: 1000, accountNumber: '222-0000000012345-89',
  inceptionDate: '2025-01-15',
  holdings: [
    { listingId: 1, ticker: 'AAPL', name: 'Apple Inc.', quantity: 50,
      currentPrice: 220, change: 1.5, volume: 1200000, initialMarginCost: 11000,
      acquisitionDate: '2025-02-10' },
    { listingId: 2, ticker: 'MSFT', name: 'Microsoft Corp.', quantity: 30,
      currentPrice: 410, change: -0.8, volume: 800000, initialMarginCost: 12300,
      acquisitionDate: '2025-03-05' },
  ],
  performance: [],
};

const mockPerformance = [
  { date: '2025-10-01', fundValue: 2400000, profit: 100000 },
  { date: '2025-11-01', fundValue: 2500000, profit: 120000 },
  { date: '2025-12-01', fundValue: 2550000, profit: 130000 },
  { date: '2026-01-01', fundValue: 2600000, profit: 150000 },
];

// Mock podaci za OTC inter-bank discovery/offers/contracts (Issue #67/#68/#69)
// Referenca: src/types/celina4.ts → OtcInterbankListing, OtcInterbankOffer
const mockOtcRemoteListings = [
  {
    bankCode: 'BANKA2',
    sellerPublicId: 'remote-user-1',
    sellerName: 'Remote Seller',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    currentPrice: 198.25,
    availableQuantity: 40,
  },
  {
    bankCode: 'BANKA3',
    sellerPublicId: 'remote-user-2',
    sellerName: 'Partner Seller',
    listingTicker: 'MSFT',
    listingName: 'Microsoft Corporation',
    listingCurrency: 'USD',
    currentPrice: 421.15,
    availableQuantity: 25,
  },
];

const mockOtcRemoteOffer = {
  offerId: 'cb4f6c3d-d4b9-4cb4-a09d-c6950df0a101',
  listingTicker: 'AAPL',
  listingName: 'Apple Inc.',
  listingCurrency: 'USD',
  currentPrice: 198.25,
  buyerBankCode: 'BANKA1',
  buyerUserId: 'client-1',
  buyerName: 'Stefan Jovanovic',
  sellerBankCode: 'BANKA2',
  sellerUserId: 'remote-user-1',
  sellerName: 'Remote Seller',
  quantity: 3,
  pricePerStock: 198.25,
  premium: 11.5,
  settlementDate: '2026-05-01',
  waitingOnBankCode: 'BANKA2',
  waitingOnUserId: 'remote-user-1',
  myTurn: false,
  status: 'ACTIVE',
  lastModifiedAt: '2026-04-24T12:00:00Z',
  lastModifiedByName: 'Stefan Jovanovic',
};

const mockOtcRemoteOffers = [
  {
    offerId: 'remote-offer-green',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    currentPrice: 100,
    buyerBankCode: 'BANKA1',
    buyerUserId: 'buyer-1',
    buyerName: 'Stefan Jovanovic',
    sellerBankCode: 'BANKA2',
    sellerUserId: 'seller-1',
    sellerName: 'Remote Seller',
    quantity: 5,
    pricePerStock: 102,
    premium: 10,
    settlementDate: '2026-05-10',
    waitingOnBankCode: 'BANKA1',
    waitingOnUserId: 'buyer-1',
    myTurn: true,
    status: 'ACTIVE',
    lastModifiedAt: '2026-04-25T10:00:00Z',
    lastModifiedByName: 'Stefan Jovanovic',
  },
  {
    offerId: 'remote-offer-yellow',
    listingTicker: 'MSFT',
    listingName: 'Microsoft Corporation',
    listingCurrency: 'USD',
    currentPrice: 100,
    buyerBankCode: 'BANKA3',
    buyerUserId: 'buyer-2',
    buyerName: 'Partner Buyer',
    sellerBankCode: 'BANKA1',
    sellerUserId: 'seller-2',
    sellerName: 'Ana Agent',
    quantity: 3,
    pricePerStock: 114,
    premium: 8,
    settlementDate: '2026-05-12',
    waitingOnBankCode: 'BANKA3',
    waitingOnUserId: 'buyer-2',
    myTurn: false,
    status: 'ACTIVE',
    lastModifiedAt: '2026-04-25T11:00:00Z',
    lastModifiedByName: 'Partner Buyer',
  },
  {
    offerId: 'remote-offer-red',
    listingTicker: 'NVDA',
    listingName: 'NVIDIA Corporation',
    listingCurrency: 'USD',
    currentPrice: 100,
    buyerBankCode: 'BANKA1',
    buyerUserId: 'buyer-3',
    buyerName: 'Stefan Jovanovic',
    sellerBankCode: 'BANKA4',
    sellerUserId: 'seller-3',
    sellerName: 'Remote Supervisor',
    quantity: 9,
    pricePerStock: 130,
    premium: 15,
    settlementDate: '2026-05-15',
    waitingOnBankCode: 'BANKA1',
    waitingOnUserId: 'buyer-3',
    myTurn: true,
    status: 'ACTIVE',
    lastModifiedAt: '2026-04-25T12:00:00Z',
    lastModifiedByName: 'Stefan Jovanovic',
  },
];

const mockOtcRemoteContracts = [
  {
    id: 'remote-contract-active',
    listingId: 101,
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    buyerUserId: 'stefan.jovanovic',
    buyerBankCode: 'BANKA1',
    buyerName: 'Stefan Jovanovic',
    sellerUserId: 'remote-seller-1',
    sellerBankCode: 'BANKA2',
    sellerName: 'Remote Seller',
    quantity: 8,
    strikePrice: 100,
    premium: 25,
    currentPrice: 126,
    settlementDate: '2026-05-10',
    status: 'ACTIVE',
    createdAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 'remote-contract-exercised',
    listingId: 102,
    listingTicker: 'TSLA',
    listingName: 'Tesla Inc.',
    listingCurrency: 'USD',
    buyerUserId: 'stefan.jovanovic',
    buyerBankCode: 'BANKA1',
    buyerName: 'Stefan Jovanovic',
    sellerUserId: 'remote-seller-2',
    sellerBankCode: 'BANKA3',
    sellerName: 'Partner Seller',
    quantity: 4,
    strikePrice: 180,
    premium: 18,
    currentPrice: 195,
    settlementDate: '2026-05-03',
    status: 'EXERCISED',
    createdAt: '2026-04-18T10:00:00Z',
    exercisedAt: '2026-04-24T12:00:00Z',
  },
  {
    id: 'remote-contract-expired',
    listingId: 103,
    listingTicker: 'NVDA',
    listingName: 'NVIDIA Corp.',
    listingCurrency: 'USD',
    buyerUserId: 'stefan.jovanovic',
    buyerBankCode: 'BANKA1',
    buyerName: 'Stefan Jovanovic',
    sellerUserId: 'remote-seller-3',
    sellerBankCode: 'BANKA4',
    sellerName: 'Remote Supervisor',
    quantity: 2,
    strikePrice: 90,
    premium: 9,
    currentPrice: 88,
    settlementDate: '2026-04-10',
    status: 'EXPIRED',
    createdAt: '2026-04-01T10:00:00Z',
  },
];

const mockAccounts = [
  {
    id: 1,
    accountNumber: '222000000000000001',
    ownerName: 'Stefan Jovanovic',
    accountType: 'CHECKING',
    currency: 'USD',
    balance: 10000,
    availableBalance: 10000,
    reservedBalance: 0,
    dailyLimit: 100000,
    monthlyLimit: 500000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    accountNumber: '222000000000000002',
    ownerName: 'Stefan Jovanovic',
    accountType: 'CHECKING',
    currency: 'USD',
    balance: 9000,
    availableBalance: 9000,
    reservedBalance: 0,
    dailyLimit: 100000,
    monthlyLimit: 500000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// TODO(antonije3) — mockFundPositions + mockInterbankPayments za Issue #74/#76
// Referenca: ClientFundPosition, InterbankPayment
const mockFundPositions = [
  {
    id: 501,
    fundId: 1,
    fundName: 'Alpha Growth Fund',
    userId: 101,
    userRole: 'CLIENT',
    userName: 'Stefan Jovanovic',
    totalInvested: 10000,
    currentValue: 12000,
    percentOfFund: 1.2,
    profit: 2000,
    lastModifiedAt: '2026-01-10T10:00:00Z',
  },
];

// TODO(sssmarta) — mockActuaryProfit + mockBankFundPositions za Issue #77
// Referenca: ActuaryProfit, BankFundPosition


// ============================================================
//  FEATURE 1: Investicioni fondovi — Discovery (Issue #71 / jkrunic)
// ============================================================
describe('Mock C4: Investicioni fondovi - Discovery', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
  });

  it('S1: Klijent otvara /funds i vidi listu aktivnih fondova', () => {
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.get('table tbody tr').should('have.length', mockFunds.length);
    cy.contains('Alpha Growth Fund').should('be.visible');
    cy.contains('Beta Income Fund').should('be.visible');
    cy.contains('Gamma Balanced Fund').should('be.visible');
  });

  it('S2: Search filter po nazivu filtrira listu', () => {
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.get('input[placeholder*="Pretraži"]').type('Alpha');
    cy.wait('@funds');
  });

  it('S3: Sort po vrednosti fonda', () => {
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('th', 'Vrednost').click();
    cy.wait('@funds');
  });

  it('S4: Klik na red navigira na /funds/{id}', () => {
    cy.intercept('GET', '/api/funds/1', { body: mockFundDetail }).as('fundDetail');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('tr', 'Alpha Growth Fund').click();
    cy.wait('@fundDetail');
    cy.url().should('include', '/funds/1');
  });

  it('S5: Supervizor vidi dugme "Kreiraj fond"', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('fundsSup');
    cy.visit('/funds', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@fundsSup');
    cy.contains('button', 'Kreiraj fond').should('be.visible');
  });

  it('S6: Klijent NE vidi dugme "Kreiraj fond"', () => {
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('button', 'Kreiraj fond').should('not.exist');
  });

  it('S7: Empty state kad nema fondova', () => {
    cy.intercept('GET', '/api/funds*', { body: [] }).as('emptyFunds');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@emptyFunds');
    cy.contains('Nema dostupnih fondova').should('be.visible');
  });

  it('S8: Skeleton loader dok se ucitava', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds, delay: 1000 }).as('slowFunds');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@slowFunds');
    cy.get('.animate-pulse').should('not.exist');
  });
});


// ============================================================
//  FEATURE 2: Investicioni fondovi — Detalji (Issue #72 / jkrunic)
// ============================================================
describe('Mock C4: Investicioni fondovi - Detalji', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/funds/1', { body: mockFundDetail }).as('fundDetail');
    cy.intercept('GET', '/api/funds/1/performance*', { body: mockPerformance }).as('fundPerf');
  });

  it('S9: Prikaz 4 KPI karte (Vrednost, Likvidnost, Profit, Min ulog)', () => {
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('Vrednost fonda').should('be.visible');
    cy.contains('Likvidnost').should('be.visible');
    cy.contains('Profit').should('be.visible');
    cy.contains('Minimalni ulog').should('be.visible');
  });

  it('S10: Lista hartija u fondu', () => {
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('Hartije u fondu').should('be.visible');
    cy.contains('AAPL').should('be.visible');
    cy.contains('MSFT').should('be.visible');
  });

  it('S11: Performance grafik sa period toggle-om', () => {
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('Performanse fonda').should('be.visible');
    cy.contains('button', '1M').should('be.visible');
    cy.contains('button', '3M').should('be.visible');
    cy.contains('button', '1G').should('be.visible');
    cy.contains('button', '1M').click();
    cy.wait('@fundPerf');
  });

  it('S12: Supervizor (owner) vidi "Prodaj" dugme pored hartija', () => {
    const ownerDetail = { ...mockFundDetail, managerEmployeeId: 1 };
    cy.intercept('GET', '/api/funds/1', { body: ownerDetail }).as('fundOwner');
    cy.visit('/funds/1', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@fundOwner');
    cy.contains('button', 'Prodaj').should('be.visible');
  });

  it('S13: Klijent vidi "Uplati u fond" dugme', () => {
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('button', 'Uplati u fond').should('be.visible');
  });

  it('S14: Klijent vidi "Povuci iz fonda" dugme', () => {
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('button', 'Povuci iz fonda').should('be.visible');
  });

  it('S15: 404 kad fond ne postoji - navigira na /funds', () => {
    cy.intercept('GET', '/api/funds/999', { statusCode: 404, body: { error: 'Not found' } }).as('fund404');
    cy.intercept('GET', '/api/funds/999/performance*', { statusCode: 404, body: { error: 'Not found' } });
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('fundsList');
    cy.visit('/funds/999', { onBeforeLoad: setupClientSession });
    cy.wait('@fund404');
    cy.url().should('include', '/funds');
  });
});


// ============================================================
//  FEATURE 3: Investicioni fondovi — Create (Issue #73 / antonije3)
// ============================================================
describe('Mock C4: Create Fund', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token', refreshToken: 'fake-refresh-token', tokenType: 'Bearer' },
    });
  });

  it('TODO S16: Supervizor popunjava formu i kreira fond', () => {
    cy.intercept('POST', '/api/funds', {
      statusCode: 201,
      body: { id: 10, name: 'E2E Mock Fund', description: 'Mock test create fund', minimumContribution: 1500 },
    }).as('createFund');
    cy.intercept('GET', '/api/funds/10', {
      statusCode: 200,
      body: { ...mockFundDetail, id: 10, name: 'E2E Mock Fund' },
    }).as('fundDetail');

    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('E2E Mock Fund');
    cy.get('#description').type('Mock test create fund');
    cy.get('#minimumContribution').clear().type('1500');
    cy.contains('button', 'Kreiraj fond').click();
    cy.wait('@createFund');
    cy.wait('@fundDetail');
    cy.url().should('include', '/funds/10');
  });

  it('TODO S17: Validation - prazan naziv', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('ab');
    cy.get('#minimumContribution').clear().type('1000');
    cy.contains('button', 'Kreiraj fond').click();
    cy.contains('Naziv mora imati najmanje 3 karaktera').should('be.visible');
  });

  it('TODO S18: Validation - minimumContribution <= 0', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('Mock Valid Name');
    cy.get('#minimumContribution').clear().type('0');
    cy.contains('button', 'Kreiraj fond').click();
    cy.contains('Minimalna uplata mora biti veća od 0').should('be.visible');
  });

  it('TODO S19: Duplikat naziva - server vraca 400, toast error', () => {
    cy.intercept('POST', '/api/funds', {
      statusCode: 400,
      body: { error: 'Fond sa tim nazivom vec postoji' },
    }).as('createFundError');

    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('Postojeci Fond');
    cy.get('#description').type('Opis');
    cy.get('#minimumContribution').clear().type('1200');
    cy.contains('button', 'Kreiraj fond').click();
    cy.wait('@createFundError');

    cy.contains(/vec postoji|nije uspelo|gresk/i).should('be.visible');
    cy.url().should('include', '/funds/create');
  });

  it('TODO S20: Klijent nema pristup /funds/create', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupClientSession });
    cy.url().should('include', '/funds');
  });
});


// ============================================================
//  FEATURE 4: Investicioni fondovi — Invest/Withdraw (Issue #74 / antonije3)
// ============================================================
describe('Mock C4: Fund Invest/Withdraw', () => {
  const setupPortfolioBase = () => {
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token' },
    });
    cy.intercept('GET', '/api/portfolio/summary', {
      statusCode: 200,
      body: { totalValue: 100000, totalProfit: 1500, paidTaxThisYear: 0, unpaidTaxThisMonth: 0 },
    });
    cy.intercept('GET', '/api/portfolio/my', { statusCode: 200, body: [] });
  };

  it('S21: Klijent uplacuje iznos u fond (FundInvestDialog)', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions }).as('myPositions');
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail }).as('fundDetail');
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 11, accountNumber: '265000000000000011', availableBalance: 100000, currency: 'RSD', status: 'ACTIVE' }],
    }).as('myAccounts');
    cy.intercept('POST', '/api/funds/1/invest', (req) => {
      expect(req.body.amount).to.equal(1500);
      expect(req.body.sourceAccountId).to.equal(11);
      expect(req.body.currency).to.equal('RSD');
      req.reply({ statusCode: 200, body: { ...mockFundPositions[0], currentValue: 13500, totalInvested: 11500 } });
    }).as('invest');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@myPositions');
    cy.contains('button', 'Uplati').first().click({ force: true });
    cy.contains('Uplata u fond').should('be.visible');
    cy.get('[role="dialog"]').within(() => {
      cy.get('#fund-invest-amount').type('1500', { force: true });
      cy.contains('button', 'Uplati').click({ force: true });
    });
    cy.wait('@invest');
    cy.contains('Uplata u fond').should('not.exist');
  });

  it('S22: Validation - iznos manji od minimumContribution', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions });
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail });
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 11, accountNumber: '265000000000000011', availableBalance: 100000, currency: 'RSD', status: 'ACTIVE' }],
    });
    cy.intercept('POST', '/api/funds/1/invest', { statusCode: 200, body: {} }).as('invest');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.contains('button', 'Uplati').first().click({ force: true });
    cy.get('[role="dialog"]').within(() => {
      cy.get('#fund-invest-amount').type('500', { force: true });
      cy.contains('button', 'Uplati').click({ force: true });
    });
    cy.contains(/Minimalni ulog/i).should('be.visible');
    cy.get('@invest.all').should('have.length', 0);
  });

  it('S23: Klijent povlaci deo pozicije (FundWithdrawDialog)', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions });
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail });
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 12, accountNumber: '265000000000000012', availableBalance: 5000, currency: 'RSD', status: 'ACTIVE' }],
    });
    cy.intercept('POST', '/api/funds/1/withdraw', (req) => {
      expect(req.body.amount).to.equal(1000);
      expect(req.body.destinationAccountId).to.equal(12);
      req.reply({ statusCode: 200, body: { id: 1, amountRsd: 1000, status: 'COMPLETED' } });
    }).as('withdraw');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.contains('button', 'Povuci').first().click({ force: true });
    cy.get('[role="dialog"]').within(() => {
      cy.get('#fund-withdraw-amount').type('1000', { force: true });
      cy.contains('button', 'Povuci').click({ force: true });
    });
    cy.wait('@withdraw');
    cy.contains('Povlacenje iz fonda').should('not.exist');
  });

  it('S24: Klijent povlaci celu poziciju (checkbox)', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions });
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail });
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 12, accountNumber: '265000000000000012', availableBalance: 5000, currency: 'RSD', status: 'ACTIVE' }],
    });
    cy.intercept('POST', '/api/funds/1/withdraw', (req) => {
      expect(req.body.destinationAccountId).to.equal(12);
      expect(req.body).to.not.have.property('amount');
      req.reply({ statusCode: 200, body: { id: 2, amountRsd: 12000, status: 'COMPLETED' } });
    }).as('withdrawAll');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.contains('button', 'Povuci').first().click({ force: true });
    cy.get('[role="dialog"]').within(() => {
      cy.get('#fund-withdraw-all').click({ force: true });
      cy.get('#fund-withdraw-amount').should('be.disabled');
      cy.contains('button', 'Povuci').click({ force: true });
    });
    cy.wait('@withdrawAll');
  });

  it('S25: Server vraca status=PENDING - toast "Obrada u toku"', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions });
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail });
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 12, accountNumber: '265000000000000012', availableBalance: 5000, currency: 'RSD', status: 'ACTIVE' }],
    });
    cy.intercept('POST', '/api/funds/1/withdraw', {
      statusCode: 200,
      body: { id: 3, amountRsd: 1500, status: 'PENDING' },
    }).as('withdrawPending');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.contains('button', 'Povuci').first().click({ force: true });
    cy.get('[role="dialog"]').within(() => {
      cy.get('#fund-withdraw-amount').type('1500', { force: true });
      cy.contains('button', 'Povuci').click({ force: true });
    });
    cy.wait('@withdrawPending');
    cy.contains(/Povlacenje ce biti obradjeno kad fond proda hartije/i).should('be.visible');
  });

  it('S26: Supervizor nema klijentske akcije Uplati/Povuci u MyFundsTab', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds', { statusCode: 200, body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: { ...mockFundDetail, managerEmployeeId: 1 } }).as('fund1');
    cy.intercept('GET', '/api/funds/2', { statusCode: 200, body: { ...mockFundDetail, id: 2, name: 'Beta Income Fund', managerEmployeeId: 3 } }).as('fund2');
    cy.intercept('GET', '/api/funds/3', { statusCode: 200, body: { ...mockFundDetail, id: 3, name: 'Gamma Balanced Fund', managerEmployeeId: 5 } }).as('fund3');

    cy.visit('/portfolio', { onBeforeLoad: setupSupervisorSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@funds');
    cy.contains('Uplati').should('not.exist');
    cy.contains('Povuci').should('not.exist');
    cy.contains('Likvidnost').should('be.visible');
  });
});


// ============================================================
//  FEATURE 5: "Moji fondovi" tab na Portfoliu (Issue #74 / antonije3)
// ============================================================
describe('Mock C4: MyFundsTab', () => {
  const setupPortfolioBase = () => {
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token' },
    });
    cy.intercept('GET', '/api/portfolio/summary', {
      statusCode: 200,
      body: { totalValue: 100000, totalProfit: 1500, paidTaxThisYear: 0, unpaidTaxThisMonth: 0 },
    });
    cy.intercept('GET', '/api/portfolio/my', { statusCode: 200, body: [] });
  };

  it('S27: Tab "Moji fondovi" prikazuje moje pozicije', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions }).as('myPositions');
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail }).as('fund1');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@myPositions');
    cy.contains('Alpha Growth Fund').should('be.visible');
    cy.contains('button', 'Uplati').should('be.visible');
    cy.contains('button', 'Povuci').should('be.visible');
  });

  it('S28: Empty state kad klijent nema poziciju', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: [] }).as('emptyPositions');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@emptyPositions');
    cy.contains('Nemate aktivne pozicije u fondovima.').should('be.visible');
  });

  it('S29: Prikaz udela % i RSD vrednosti', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions });
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail });

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.contains('Moj udeo:').should('be.visible');
    cy.contains('Moj iznos:').should('be.visible');
    cy.contains('Profit:').should('be.visible');
  });

  it('S30: Klik na fond navigira na /funds/{id}', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds/my-positions', { statusCode: 200, body: mockFundPositions }).as('myPositions');
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: mockFundDetail }).as('fundDetail');

    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@myPositions');
    cy.contains('button', 'Detalji fonda').click({ force: true });
    cy.wait('@fundDetail');
    cy.url().should('include', '/funds/1');
  });

  it('S31: Supervizor vidi fondove kojima upravlja', () => {
    setupPortfolioBase();
    cy.intercept('GET', '/api/funds', { statusCode: 200, body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/1', { statusCode: 200, body: { ...mockFundDetail, managerEmployeeId: 1 } });
    cy.intercept('GET', '/api/funds/2', { statusCode: 200, body: { ...mockFundDetail, id: 2, name: 'Beta Income Fund', managerEmployeeId: 3 } });
    cy.intercept('GET', '/api/funds/3', { statusCode: 200, body: { ...mockFundDetail, id: 3, name: 'Gamma Balanced Fund', managerEmployeeId: 5 } });

    cy.visit('/portfolio', { onBeforeLoad: setupSupervisorSession });
    cy.contains('button', 'Moji fondovi').click();
    cy.wait('@funds');
    cy.contains('Likvidnost').should('be.visible');
    cy.contains('Alpha Growth Fund').should('be.visible');
    cy.contains('Beta Income Fund').should('not.exist');
  });
});


// ============================================================
//  FEATURE 6: CreateOrder "u ime fonda" selektor (Issue #75 / antonije3)
// ============================================================
describe('Mock C4: CreateOrder Fund Selector', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token', refreshToken: 'fake-refresh-token', tokenType: 'Bearer' },
    });
    cy.intercept('GET', '/api/listings*', {
      statusCode: 200,
      body: { content: [{ id: 1, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', ask: 190, bid: 189.5, price: 189.8, contractSize: 1 }], totalPages: 1, totalElements: 1, number: 0, size: 100 },
    });
    cy.intercept('GET', '/api/accounts/bank', {
      statusCode: 200,
      body: [
        { id: 16, accountNumber: '222000100000000140', name: 'Banka USD', ownerName: 'Banka 2025', availableBalance: 5000000, currency: 'USD', accountType: 'BUSINESS', accountSubtype: 'STANDARD', status: 'ACTIVE' },
        { id: 13, accountNumber: '222000100000000110', name: 'Banka RSD', ownerName: 'Banka 2025', availableBalance: 500000000, currency: 'RSD', accountType: 'BUSINESS', accountSubtype: 'STANDARD', status: 'ACTIVE' },
      ],
    }).as('bankAccounts');
    cy.intercept('GET', '/api/funds', {
      statusCode: 200,
      body: [
        { id: 10, name: 'Supervisor Fund', description: 'My fund', minimumContribution: 1000, fundValue: 1000000, profit: 10000, managerName: 'Nikola', inceptionDate: '2025-01-01' },
      ],
    }).as('funds');
    cy.intercept('GET', '/api/funds/10', {
      statusCode: 200,
      body: {
        id: 10,
        name: 'Supervisor Fund',
        description: 'My fund',
        managerName: 'Nikola',
        managerEmployeeId: 1,
        fundValue: 1000000,
        liquidAmount: 250000,
        profit: 10000,
        minimumContribution: 1000,
        accountNumber: '222000100000000140',
        accountId: 16,
        holdings: [],
        performance: [],
        inceptionDate: '2025-01-01',
      },
    }).as('fund10');
    cy.intercept('GET', '/api/exchanges*', { statusCode: 200, body: { isOpen: true, name: 'NASDAQ' } });
    cy.intercept('POST', '/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OK' } });
    cy.intercept('GET', '/api/payments/my-otp', { statusCode: 200, body: { active: true, code: '123456', attempts: 0, maxAttempts: 3 } });
    cy.intercept('POST', '/api/orders', (req) => {
      req.reply({ statusCode: 200, body: { id: 101 } });
    }).as('createOrder');
  });

  it('S32: Supervizor vidi "Kupujem u ime" selektor', () => {
    cy.visit('/orders/new', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@bankAccounts');
    cy.wait('@funds');
    cy.wait('@fund10');
    cy.get('#buyingFor').should('be.visible');
    cy.get('#buyingFor').find('option').should('have.length.at.least', 2);
    cy.contains('Fond: Supervisor Fund').should('be.visible');
  });

  it('S33: Izbor fonda menja accountId na fund.accountId', () => {
    cy.visit('/orders/new', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@bankAccounts');
    cy.wait('@funds');
    cy.wait('@fund10');

    cy.get('#buyingFor option[value="FUND:10"]').should('exist');
    cy.get('#buyingFor').invoke('val', 'FUND:10').trigger('change');
    cy.get('#buyingFor').should('have.value', 'FUND:10');
  });

  it('S34: Submit salje fundId u CreateOrderDto', () => {
    cy.intercept('POST', '/api/orders', (req) => {
      expect(req.body.fundId).to.equal(10);
      expect(req.body.accountId).to.equal(16);
      req.reply({ statusCode: 200, body: { id: 102 } });
    }).as('createOrderWithFund');

    cy.visit('/orders/new', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@bankAccounts');
    cy.wait('@funds');
    cy.wait('@fund10');

    cy.get('body').then(($body) => {
      if ($body.find('#buyingFor').length === 0) {
        cy.url().should('match', /\/orders\/new|\/login/);
        return;
      }

      cy.get('#buyingFor option[value="FUND:10"]').should('exist');
      cy.get('#buyingFor').invoke('val', 'FUND:10').trigger('change');
      cy.get('#buyingFor').should('have.value', 'FUND:10');
      cy.get('#listingId').should('not.be.disabled').then(($listing) => {
        if (!$listing.val()) {
          cy.wrap($listing).select('1', { force: true });
        }
      });
      cy.get('form').within(() => {
        cy.get('button[type="submit"]').click({ force: true });
      });
      cy.get('body').then(($afterSubmit) => {
        if ($afterSubmit.text().includes('Potvrda naloga')) {
          cy.get('[data-cy="confirm-order"]').click({ force: true });
          cy.get('#otp').type('123456');
          cy.contains('button', 'Potvrdi').last().click();
          cy.wait('@createOrderWithFund');
        }
      });
    });
  });

  it('S35: Klijent NE vidi "Kupujem u ime" selektor', () => {
    cy.intercept('GET', '/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 1, accountNumber: '265000000000000001', name: 'Klijent USD', ownerName: 'Stefan', availableBalance: 10000, currency: 'USD', accountType: 'CHECKING', accountSubtype: 'STANDARD', status: 'ACTIVE' }],
    });
    cy.visit('/orders/new', { onBeforeLoad: setupClientSession });
    cy.get('#buyingFor').should('not.exist');
  });
});


// ============================================================
//  FEATURE 7: OTC Inter-bank Discovery (Issue #67 / ekalajdzic13322)
// ============================================================
describe('Mock C4: OTC Inter-bank Discovery', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/otc/listings', { statusCode: 200, body: [] }).as('localOtcListings');
    cy.intercept('GET', '/api/interbank/otc/listings', {
      statusCode: 200,
      body: mockOtcRemoteListings,
    }).as('remoteOtcListings');
    cy.intercept('POST', '/api/interbank/otc/offers', {
      statusCode: 200,
      body: mockOtcRemoteOffer,
    }).as('createInterbankOffer');
  });

  const openRemoteTab = () => {
    cy.visit('/otc', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcListings');
    cy.contains('[role="tab"]', 'Iz drugih banaka').click();
    cy.wait('@remoteOtcListings');
  };

  it('TODO S36: Tab "Iz drugih banaka" na OtcTrgovinaPage', () => {
    openRemoteTab();

    cy.contains('[role="tab"]', 'Iz drugih banaka').should('have.attr', 'aria-selected', 'true');
    cy.contains('Javno dostupne akcije iz drugih banaka (2)').should('be.visible');
    cy.get('table tbody tr').should('have.length', mockOtcRemoteListings.length);
  });

  it('TODO S37: Lista prikazuje bankCode i sellerName kolone', () => {
    openRemoteTab();

    cy.contains('th', 'Banka prodavca').should('be.visible');
    cy.contains('th', 'Prodavac').should('be.visible');
    cy.contains('BANKA2').should('be.visible');
    cy.contains('Remote Seller').should('be.visible');
    cy.contains('BANKA3').should('be.visible');
    cy.contains('Partner Seller').should('be.visible');
  });

  it('TODO S38: "Napravi ponudu" otvara formu i salje POST', () => {
    openRemoteTab();

    cy.contains('button', 'Napravi ponudu').first().click();
    cy.get('input[id^="remote-qty-"]').clear().type('3');
    cy.get('input[id^="remote-premium-"]').clear().type('11.5');
    cy.contains('button', 'Posalji ponudu prodavcu').click();

    cy.wait('@createInterbankOffer').then((interception) => {
      expect(interception.request.body).to.deep.equal({
        sellerBankCode: 'BANKA2',
        sellerUserId: 'remote-user-1',
        listingTicker: 'AAPL',
        quantity: 3,
        pricePerStock: 198.25,
        premium: 11.5,
        settlementDate: interception.request.body.settlementDate,
      });
    });

    cy.wait('@remoteOtcListings');
    cy.contains('Inter-bank ponuda je uspesno poslata.').should('be.visible');
    cy.contains('button', 'Posalji ponudu prodavcu').should('not.exist');
  });

  it('TODO S39: Osvezi dugme poziva listRemoteListings', () => {
    openRemoteTab();

    cy.contains('button', 'Osvezi').click();
    cy.wait('@remoteOtcListings');
  });
});


// ============================================================
//  FEATURE 8: OTC Inter-bank Offers tab (Issue #68 / ekalajdzic13322)
// ============================================================
describe('Mock C4: OTC Inter-bank Offers', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/otc/offers/active', { statusCode: 200, body: [] }).as('localOtcOffers');
    cy.intercept('GET', '/api/otc/contracts*', { statusCode: 200, body: [] }).as('localOtcContracts');
    cy.intercept('GET', '/api/interbank/otc/offers/my', {
      statusCode: 200,
      body: mockOtcRemoteOffers,
    }).as('remoteOtcOffers');
    cy.intercept('GET', '/api/interbank/otc/contracts/my*', {
      statusCode: 200,
      body: mockOtcRemoteContracts,
    }).as('remoteOtcContracts');
    cy.intercept('GET', '/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('myAccounts');
    cy.intercept('PATCH', '/api/interbank/otc/offers/*/accept*', {
      statusCode: 200,
      body: { ...mockOtcRemoteOffers[0], status: 'ACCEPTED', myTurn: false },
    }).as('acceptRemoteOffer');
    cy.intercept('PATCH', '/api/interbank/otc/offers/*/counter', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          ...mockOtcRemoteOffers[0],
          quantity: req.body.quantity,
          pricePerStock: req.body.pricePerStock,
          premium: req.body.premium,
          settlementDate: req.body.settlementDate,
          myTurn: false,
          lastModifiedByName: 'Stefan Jovanovic',
        },
      });
    }).as('counterRemoteOffer');
    cy.intercept('PATCH', '/api/interbank/otc/offers/*/decline', {
      statusCode: 200,
      body: { ...mockOtcRemoteOffers[0], status: 'DECLINED', myTurn: false },
    }).as('declineRemoteOffer');
  });

  const openRemoteOffersTab = () => {
    cy.visit('/otc/offers', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcOffers');
    cy.wait('@localOtcContracts');
    cy.wait('@myAccounts');
    cy.contains('[role="tab"]', 'Aktivne ponude (inter-bank)').click();
    cy.wait('@remoteOtcOffers');
  };

  it('S40: Tab prikazuje moje aktivne inter-bank ponude', () => {
    openRemoteOffersTab();

    cy.contains('[role="tab"]', 'Aktivne ponude (inter-bank)').should('have.attr', 'aria-selected', 'true');
    cy.contains('AAPL').should('be.visible');
    cy.contains('MSFT').should('be.visible');
    cy.contains('NVDA').should('be.visible');
    cy.contains('Kupac: BANKA1').should('be.visible');
    cy.contains('Prodavac: BANKA2').should('be.visible');
  });

  it('S41: Bojenje odstupanja - zeleno/zuto/crveno (±5/±20)', () => {
    openRemoteOffersTab();

    cy.contains('+2.0%')
      .invoke('attr', 'class')
      .should('include', 'bg-emerald-500/15');
    cy.contains('+14.0%')
      .invoke('attr', 'class')
      .should('include', 'bg-amber-500/15');
    cy.contains('+30.0%')
      .invoke('attr', 'class')
      .should('include', 'bg-red-500/15');
  });

  it('S42: "Moj red" vs "Ceka drugu stranu" badge', () => {
    openRemoteOffersTab();

    cy.contains('Moj red').should('have.length.at.least', 1);
    cy.contains('Ceka drugu stranu').should('be.visible');
    cy.contains('BANKA3 / buyer-2').should('be.visible');
  });

  it('S43: Prihvati - PATCH /accept + account selector', () => {
    openRemoteOffersTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Prihvati').click();
    });
    cy.get('select[id^="remote-accept-account-"]').select('2');
    cy.contains('button', 'Potvrdi prihvatanje').click();

    cy.wait('@acceptRemoteOffer').then((interception) => {
      expect(interception.request.query.accountId).to.equal('2');
    });
    cy.wait('@remoteOtcOffers');
    cy.wait('@remoteOtcContracts');
    cy.contains('[role="tab"]', 'Sklopljeni ugovori (inter-bank)').should('have.attr', 'aria-selected', 'true');
  });

  it('S44: Kontraponuda - PATCH /counter sa novim iznosima', () => {
    openRemoteOffersTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Kontraponuda').click();
    });
    cy.get('input[id^="remote-counter-qty-"]').clear().type('7');
    cy.get('input[id^="remote-counter-premium-"]').clear().type('12.5');
    cy.contains('button', 'Posalji kontraponudu').click();

    cy.wait('@counterRemoteOffer').then((interception) => {
      expect(interception.request.body.quantity).to.equal(7);
      expect(interception.request.body.premium).to.equal(12.5);
      expect(interception.request.body.offerId).to.equal('remote-offer-green');
    });
    cy.wait('@remoteOtcOffers');
    cy.contains('Inter-bank kontraponuda je poslata.').should('be.visible');
  });

  it('S45: Odbij - PATCH /decline', () => {
    cy.on('window:confirm', () => true);
    openRemoteOffersTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Odbij').click();
    });

    cy.wait('@declineRemoteOffer');
    cy.wait('@remoteOtcOffers');
    cy.contains('Inter-bank ponuda je odbijena.').should('be.visible');
  });
});


// ============================================================
//  FEATURE 9: OTC Inter-bank Contracts + SAGA (Issue #69 / ekalajdzic13322)
// ============================================================
describe('Mock C4: OTC Inter-bank Contracts', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/otc/offers/active', { statusCode: 200, body: [] }).as('localOtcOffers');
    cy.intercept('GET', '/api/otc/contracts*', { statusCode: 200, body: [] }).as('localOtcContracts');
    cy.intercept('GET', '/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('myAccounts');
    cy.intercept('GET', '/api/interbank/otc/contracts/my*', (req) => {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const body = !status || status === 'ALL'
        ? mockOtcRemoteContracts
        : mockOtcRemoteContracts.filter((contract) => contract.status === status);
      req.reply({ statusCode: 200, body });
    }).as('remoteContracts');
  });

  const openRemoteContractsTab = () => {
    cy.clock(new Date('2026-04-25T09:00:00Z').getTime());
    cy.visit('/otc/offers', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcOffers');
    cy.wait('@localOtcContracts');
    cy.wait('@myAccounts');
    cy.contains('button', 'Sklopljeni ugovori (inter-bank)').click();
    cy.wait('@remoteContracts');
    cy.wait('@myAccounts');
  };

  it('S46: Tab prikazuje inter-bank ugovore sa filtr po statusu', () => {
    openRemoteContractsTab();

    cy.contains('AAPL').should('be.visible');
    cy.contains('TSLA').should('be.visible');
    cy.contains('NVDA').should('be.visible');

    cy.contains('[role="tab"]', 'Iskoriscen').click();
    cy.wait('@remoteContracts').its('request.query.status').should('eq', 'EXERCISED');
    cy.contains('TSLA').should('be.visible');
    cy.contains('AAPL').should('not.exist');

    cy.contains('[role="tab"]', 'Svi').click();
    cy.wait('@remoteContracts');
    cy.contains('AAPL').should('be.visible');
  });

  it('S47: "Iskoristi" dugme otvara dialog sa potvrdom + progres', () => {
    cy.intercept('POST', '/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: {
        id: 501,
        transactionId: 'otc-saga-fallback',
        type: 'OTC',
        status: 'INITIATED',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T10:00:00Z',
        retryCount: 0,
      },
    }).as('exerciseContract');

    openRemoteContractsTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });

    cy.contains('Iskoristi inter-bank opciju').should('be.visible');
    cy.contains('Strike × kolicina').should('be.visible');
    cy.get('#interbank-exercise-account').select('2');
    cy.contains('button', 'Potvrdi exercise').click();

    cy.wait('@exerciseContract').then((interception) => {
      expect(interception.request.query.buyerAccountId).to.equal('2');
    });
    cy.contains('SAGA exercise u toku').should('be.visible');
    cy.contains('Izvrsavanje u toku').should('be.visible');
  });

  it('S48: SAGA progres modal prikazuje 5 faza', () => {
    cy.intercept('POST', '/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: {
        id: 502,
        transactionId: 'otc-saga-phases',
        type: 'OTC',
        status: 'INITIATED',
        currentPhase: 'RESERVE_FUNDS',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T10:00:00Z',
        retryCount: 0,
      },
    }).as('exerciseWithPhases');

    openRemoteContractsTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.contains('button', 'Potvrdi exercise').click();

    cy.wait('@exerciseWithPhases');
    cy.contains('Rezervacija sredstava').should('be.visible');
    cy.contains('Rezervacija hartija').should('be.visible');
    cy.contains('Transfer').should('be.visible');
    cy.contains('Prenos vlasnistva').should('be.visible');
    cy.contains('Finalizacija').should('be.visible');
  });

  it('S49: Polling status dok ne COMMITTED ili ABORTED', () => {
    let callCount = 0;

    cy.intercept('POST', '/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: {
        id: 503,
        transactionId: 'otc-saga-commit',
        type: 'OTC',
        status: 'INITIATED',
        currentPhase: 'RESERVE_FUNDS',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T10:00:00Z',
        retryCount: 0,
      },
    }).as('exerciseWithPolling');
    cy.intercept('GET', '/api/interbank/payments/otc-saga-commit', (req) => {
      callCount += 1;

      if (callCount === 1) {
        req.reply({
          statusCode: 200,
          body: {
            id: 503,
            transactionId: 'otc-saga-commit',
            type: 'OTC',
            status: 'PREPARING',
            currentPhase: 'RESERVE_SECURITIES',
            senderBankCode: 'BANKA1',
            receiverBankCode: 'BANKA2',
            amount: 800,
            currency: 'USD',
            createdAt: '2026-04-25T10:00:00Z',
            retryCount: 0,
          },
        });
        return;
      }

      if (callCount === 2) {
        req.reply({
          statusCode: 200,
          body: {
            id: 503,
            transactionId: 'otc-saga-commit',
            type: 'OTC',
            status: 'COMMITTING',
            currentPhase: 'OWNERSHIP_TRANSFER',
            senderBankCode: 'BANKA1',
            receiverBankCode: 'BANKA2',
            amount: 800,
            currency: 'USD',
            createdAt: '2026-04-25T10:00:00Z',
            retryCount: 0,
          },
        });
        return;
      }

      req.reply({
        statusCode: 200,
        body: {
          id: 503,
          transactionId: 'otc-saga-commit',
          type: 'OTC',
          status: 'COMMITTED',
          currentPhase: 'FINALIZING',
          senderBankCode: 'BANKA1',
          receiverBankCode: 'BANKA2',
          amount: 800,
          currency: 'USD',
          createdAt: '2026-04-25T10:00:00Z',
          committedAt: '2026-04-25T10:00:09Z',
          retryCount: 0,
        },
      });
    }).as('sagaStatus');

    openRemoteContractsTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.get('#interbank-exercise-account').select('1');
    cy.contains('button', 'Potvrdi exercise').click();

    cy.wait('@exerciseWithPolling');
    cy.tick(3000);
    cy.wait('@sagaStatus');
    cy.tick(3000);
    cy.wait('@sagaStatus');
    cy.tick(3000);
    cy.wait('@sagaStatus');

    cy.contains('COMMITTED').should('be.visible');
    cy.contains('Inter-bank exercise je uspesno finalizovan.').should('be.visible');
  });

  it('S50: ABORTED status prikazuje failureReason', () => {
    cy.intercept('POST', '/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: {
        id: 504,
        transactionId: 'otc-saga-aborted',
        type: 'OTC',
        status: 'INITIATED',
        currentPhase: 'TRANSFER',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T10:00:00Z',
        retryCount: 0,
      },
    }).as('exerciseAborted');
    cy.intercept('GET', '/api/interbank/payments/otc-saga-aborted', {
      statusCode: 200,
      body: {
        id: 504,
        transactionId: 'otc-saga-aborted',
        type: 'OTC',
        status: 'ABORTED',
        currentPhase: 'TRANSFER',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T10:00:00Z',
        abortedAt: '2026-04-25T10:00:03Z',
        retryCount: 0,
        failureReason: 'Partner banka odbila prenos hartija.',
      },
    }).as('abortedStatus');

    openRemoteContractsTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.contains('button', 'Potvrdi exercise').click();

    cy.wait('@exerciseAborted');
    cy.tick(3000);
    cy.wait('@abortedStatus');

    cy.contains('Partner banka odbila prenos hartija.').should('be.visible');
  });
});


// ============================================================
//  FEATURE 10: Profit Banke portal (Issue #77 / sssmarta)
// ============================================================
describe('Mock C4: Profit Banke Portal', () => {
  beforeEach(() => {
    setupSupervisorSession();
  });

  it.skip('TODO S51: Supervizor pristupa /employee/profit-bank', () => {});
  it.skip('TODO S52: Tab "Profit aktuara" - tabela sa profitom RSD', () => {});
  it.skip('TODO S53: Sortiranje po profitu desc (default)', () => {});
  it.skip('TODO S54: Tab "Pozicije u fondovima" - bankine pozicije', () => {});
  it.skip('TODO S55: "Uplati (banka)" dugme otvara FundInvestDialog supervisor mode', () => {});
  it.skip('TODO S56: "Povuci (banka)" dugme otvara FundWithdrawDialog supervisor mode', () => {});
  it.skip('TODO S57: Agent/Klijent NEMAJU pristup portalu (403)', () => {});
});


// ============================================================
//  FEATURE 11: EmployeeEdit fund reassign dialog (Issue #78 / sssmarta)
// ============================================================
describe('Mock C4: Admin Fund Reassignment', () => {
  beforeEach(() => {
    setupAdminSession();
  });

  it.skip('TODO S58: Admin uklanja isSupervisor - dialog se otvara ako user upravlja fondovima', () => {});
  it.skip('TODO S59: Dialog prikazuje broj i nazive fondova', () => {});
  it.skip('TODO S60: "Potvrdi" salje PATCH i refreshuje listu', () => {});
  it.skip('TODO S61: "Otkazi" vraca checkbox u checked stanje', () => {});
  it.skip('TODO S62: User bez fondova - nema dialog-a (direktno PATCH)', () => {});
});


// ============================================================
//  FEATURE 12: Inter-bank payments routing (Issue #76 / antonije3)
// ============================================================
describe('Mock C4: Inter-bank Payment Routing', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: [
        {
          id: 1,
          accountNumber: '222000100000000110',
          name: 'Klijent RSD',
          ownerName: 'Stefan Jovanovic',
          availableBalance: 150000,
          currency: 'RSD',
          accountType: 'CHECKING',
          accountSubtype: 'STANDARD',
          status: 'ACTIVE',
        },
      ],
    }).as('myAccounts');
    cy.intercept('GET', '**/api/payment-recipients*', { statusCode: 200, body: [] }).as('recipients');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } });
    cy.intercept('GET', '**/api/payments/my-otp', {
      statusCode: 200,
      body: { active: true, code: '123456', attempts: 0, maxAttempts: 3 },
    });
  });

  function fillMandatoryPaymentFields(receiverAccount: string) {
    cy.get('select#fromAccount').select(1);
    cy.get('input#toAccount').clear().type(receiverAccount);
    cy.get('input#recipientName').clear().type('Test Primaoc');
    cy.get('input#amount').clear().type('5000');
    cy.get('textarea#purpose').clear().type('Interbank test placanje');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.contains('Verifikacija transakcije').should('be.visible');
    cy.contains('button', 'Popuni').click({ force: true });
    cy.contains('button', 'Potvrdi').last().click({ force: true });
  }

  it('S63: Detekcija inter-bank po prve 3 cifre (ne 222)', () => {
    cy.intercept('POST', '**/api/interbank/payments/initiate', {
      statusCode: 200,
      body: {
        id: 1,
        transactionId: 'tx-s63',
        status: 'INITIATED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000001',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    }).as('initInterbank');
    cy.intercept('GET', '**/api/interbank/payments/tx-s63', {
      statusCode: 200,
      body: {
        id: 1,
        transactionId: 'tx-s63',
        status: 'COMMITTED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000001',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('POST', '**/api/payments', { statusCode: 200, body: {} }).as('intraPayment');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('111000000000000001');
    cy.wait('@initInterbank');
    cy.get('@intraPayment.all').should('have.length', 0);
  });

  it('S64: Salje POST /payments', () => {
    cy.intercept('POST', '**/api/payments', (req) => {
      expect(req.body.toAccount).to.equal('111000000000000002');
      req.reply({
        statusCode: 200,
        body: {
          id: 2,
          transactionId: 'tx-s64',
          status: 'INITIATED',
          senderAccountNumber: req.body.fromAccount,
          receiverAccountNumber: req.body.toAccount,
          amount: req.body.amount,
          currency: 'RSD',
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('initInterbank');
    cy.intercept('GET', '**/api/interbank-tx/tx-s64', {
      statusCode: 200,
      body: {
        id: 2,
        transactionId: 'tx-s64',
        status: 'COMMITTED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000002',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    });

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('111000000000000002');
    cy.wait('@initInterbank');
  });

  it('S65: Modal prikazuje fazu (INITIATED → PREPARING → ... → COMMITTED)', () => {
    let statusCall = 0;
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 3,
        transactionId: 'tx-s65',
        status: 'INITIATED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000003',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/interbank-tx/tx-s65', (req) => {
      statusCall += 1;
      const statuses = ['PREPARING', 'PREPARED', 'COMMITTING', 'COMMITTED'] as const;
      const status = statuses[Math.min(statusCall - 1, statuses.length - 1)];
      req.reply({
        statusCode: 200,
        body: {
          id: 3,
          transactionId: 'tx-s65',
          status,
          senderAccountNumber: '222000100000000110',
          receiverAccountNumber: '111000000000000003',
          amount: 5000,
          currency: 'RSD',
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('111000000000000003');
    cy.wait('@statusPoll');
    cy.wait('@statusPoll');
    cy.get('@statusPoll.all').its('length').should('be.greaterThan', 1);
  });

  it('S66: Polling na svakih 3s', () => {
    let statusCall = 0;
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 4,
        transactionId: 'tx-s66',
        status: 'INITIATED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000004',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/interbank-tx/tx-s66', (req) => {
      statusCall += 1;
      req.reply({
        statusCode: 200,
        body: {
          id: 4,
          transactionId: 'tx-s66',
          status: statusCall < 2 ? 'PREPARING' : 'COMMITTED',
          senderAccountNumber: '222000100000000110',
          receiverAccountNumber: '111000000000000004',
          amount: 5000,
          currency: 'RSD',
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('111000000000000004');
    cy.wait('@statusPoll');
    cy.wait('@statusPoll');
    cy.wrap(null).then(() => {
      expect(statusCall).to.be.greaterThan(1);
    });
  });

  it('S67: ABORTED - prikazuje failureReason', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 5,
        transactionId: 'tx-s67',
        status: 'INITIATED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000005',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/interbank-tx/tx-s67', {
      statusCode: 200,
      body: {
        id: 5,
        transactionId: 'tx-s67',
        status: 'ABORTED',
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000000000000005',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-04-25T10:00:00',
        failureReason: 'Nedovoljno sredstava u drugoj banci',
      },
    });

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('111000000000000005');
    cy.contains('ABORTED').should('be.visible');
    cy.contains('Nedovoljno sredstava u drugoj banci').should('be.visible');
  });

  it('S68: Intra-bank (222...) ide standard flow, ne interbank', () => {
    cy.intercept('GET', '**/api/interbank-tx/*').as('interbankStatus');
    cy.intercept('POST', '**/api/payments', { statusCode: 200, body: {} }).as('intraPayment');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    fillMandatoryPaymentFields('222000000000000001');
    cy.wait('@intraPayment');
    cy.get('@interbankStatus.all').should('have.length', 0);
  });
});


// ============================================================
//  FEATURE 13: HomePage C4 tile-ovi (Issue #79 / sssmarta)
// ============================================================
describe('Mock C4: HomePage Dashboard Tiles', () => {
  const mockHomeData = () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] }).as('myAccounts');
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] }).as('recipients');
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] }).as('rates');
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    }).as('payments');
    cy.intercept('GET', '**/api/portfolio/summary', {
      statusCode: 200,
      body: { totalValue: 0, totalProfit: 0, paidTaxThisYear: 0, unpaidTaxThisMonth: 0 },
    }).as('portfolioSummary');
    cy.intercept('GET', '**/api/orders/my*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    }).as('myOrders');
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    }).as('employees');
    cy.intercept('GET', '**/api/loans*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    }).as('loans');
  };

  it('S69: Supervisor vidi "Profit Banke" i "Investicioni fondovi" tile-ove', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupSupervisorSession });
    cy.get('main').contains('Profit Banke').should('be.visible');
    cy.get('main').contains('Investicioni fondovi').should('be.visible');
  });

  it('S70: Klijent vidi samo "Investicioni fondovi"', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.get('main').contains('Investicioni fondovi').should('be.visible');
    cy.get('main').should('not.contain', 'Profit Banke');
  });

  it('S71: Agent vidi "Investicioni fondovi"', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupAgentSession });
    cy.get('main').contains('Investicioni fondovi').should('be.visible');
    cy.get('main').should('not.contain', 'Profit Banke');
  });

  it('S72: Klik na tile navigira na pravu rutu', () => {
    mockHomeData();
    cy.intercept('GET', '/api/funds*', { statusCode: 200, body: [] }).as('funds');
    cy.visit('/home', { onBeforeLoad: setupSupervisorSession });
    cy.get('main').contains('Investicioni fondovi').click();
    cy.url().should('include', '/funds');
    cy.wait('@funds');

    cy.intercept('GET', '/api/profit-bank/actuary-performance', { statusCode: 200, body: [] }).as('actuaries');
    cy.intercept('GET', '/api/profit-bank/fund-positions', { statusCode: 200, body: [] }).as('bankFunds');
    cy.visit('/home', { onBeforeLoad: setupSupervisorSession });
    cy.get('main').contains('Profit Banke').click();
    cy.url().should('include', '/employee/profit-bank');
    cy.wait('@actuaries');
    cy.wait('@bankFunds');
  });
});


// ============================================================
//  FEATURE 14: Sidebar linkovi (Issue #79 / sssmarta)
// ============================================================
describe('Mock C4: Sidebar C4 Links', () => {
  const mockHomeData = () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    });
    cy.intercept('GET', '**/api/portfolio/summary', {
      statusCode: 200,
      body: { totalValue: 0, totalProfit: 0, paidTaxThisYear: 0, unpaidTaxThisMonth: 0 },
    });
    cy.intercept('GET', '**/api/orders/my*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    });
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    });
    cy.intercept('GET', '**/api/loans*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 },
    });
  };

  it('S73: "Investicioni fondovi" link pod Berza sekcijom', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.get('nav').contains('Investicioni fondovi').should('be.visible');
  });

  it('S74: "Profit Banke" link samo za supervizora', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupSupervisorSession });
    cy.get('nav').contains('Profit Banke').should('be.visible');
  });

  it('S75: Klijent NE vidi "Profit Banke"', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.get('nav').should('not.contain', 'Profit Banke');
  });

  it('S76: Agent NE vidi "Profit Banke"', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupAgentSession });
    cy.get('nav').should('not.contain', 'Profit Banke');
  });
});

/*
================================================================================
  UKUPNO: 76 TODO scenarija (mock)
  Nakon sto feature bude implementiran, zameni `it.skip` sa `it` i popuni body.
  Cilj: do KT3, ceo mock suite da bude zelen.
================================================================================
*/
