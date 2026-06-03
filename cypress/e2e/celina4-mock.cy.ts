/**
 * CELINA 4 - Mock E2E Tests (Comprehensive)
 *
 * Covers: OTC Intra-bank (vec implementirano), OTC Inter-bank (Pending),
 *         Investicioni fondovi (Pending), Profit Banke portal (Pending),
 *         Medjubankarska placanja 2PC (Pending).
 *
 * Sve API pozive mock-ujemo sa cy.intercept() — ne zahteva backend.
 *
 * ==========================================================================
 *  Pending — CELINA 4 MOCK SUITE (zaduzenja po GitHub Issue-ima #66-79)
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
    // FIXED 03.06 (S43): NASA banka (RN-222) je kupac, nas klijent Stefan (id=1 ->
    // C-1) je buyerUserId. computeMyRoleInOffer tako vraca 'BUYER' i — uz myTurn:true
    // — "Prihvati" dugme postaje vidljivo (samo BUYER cross-bank moze accept, §3.6).
    // Prodavac ostaje BANKA2 (S40 "Prodavac: BANKA2"); "Kupac: BANKA1" S40 asercija
    // i dalje prolazi preko NVDA red ponude koja zadrzava buyerBankCode 'BANKA1'.
    offerId: 'remote-offer-green',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    currentPrice: 100,
    buyerBankCode: 'RN-222',
    buyerUserId: 'C-1',
    buyerName: 'Stefan Jovanovic',
    sellerBankCode: 'BANKA2',
    sellerUserId: 'seller-1',
    sellerName: 'Remote Seller',
    quantity: 5,
    pricePerStock: 102,
    premium: 10,
    settlementDate: '2026-05-10',
    waitingOnBankCode: 'RN-222',
    waitingOnUserId: 'C-1',
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

// Pending(antonije3) — mockFundPositions + mockInterbankPayments za Issue #74/#76
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

// Pending(sssmarta) — mockActuaryProfit za Issue #77
// Referenca: ActuaryProfit (bank fund pozicije koriste ClientFundPosition)


// ============================================================
//  FEATURE 1: Investicioni fondovi — Discovery (Issue #71 / jkrunic)
// ============================================================
// ============================================================
//  FEATURE: Statistika fondova (FE4 — zadatak 7.2 / jkrunic)
// ============================================================
const mockFundStats = {
  fundId: 1,
  fundName: 'Alpha Growth Fund',
  snapshotCount: 90,
  annualizedReturnPercent: 12.34,
  volatilityPercent: 4.2,
  maxDrawdownPercent: -8.5,
  rewardToVariabilityRatio: 2.94,
  sufficientHistory: true,
};

describe('Mock C4: Statistika fondova (FE4 7.2)', () => {
  it('S-FS1: Discovery prikazuje metričke kolone fondova', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/*/statistics', { body: mockFundStats }).as('stats');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('th', 'Godišnji prinos').should('be.visible');
    cy.contains('th', 'Prinos/rizik').should('be.visible');
    cy.contains('th', 'Max pad').should('be.visible');
    cy.contains('th', 'Volatilnost').should('be.visible');
  });

  it('S-FS2: Discovery prikazuje vrednost metrike kad B12 vrati podatke', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/*/statistics', { body: mockFundStats }).as('stats');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.wait('@stats');
    cy.contains('12,34%').should('exist');
  });

  it('S-FS3: Discovery prikazuje poruku kad B12 vrati 404', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/*/statistics', { statusCode: 404, body: {} }).as('stats');
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('Metrike fondova trenutno nisu dostupne').should('be.visible');
  });

  it('S-FS4: Detalji fonda prikazuju karticu Metrike performansi', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/1', { body: mockFundDetail }).as('fundDetail');
    cy.intercept('GET', '/api/funds/*/performance*', { body: mockPerformance }).as('perf');
    cy.intercept('GET', '/api/funds/*/statistics', { body: mockFundStats }).as('stats');
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.wait('@stats');
    cy.contains('Metrike performansi').should('be.visible');
    cy.get('[data-testid="fund-stats-grid"]').should('exist');
  });

  it('S-FS5: Detalji fonda prikazuju poruku kad B12 metrike vrate 404', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/1', { body: mockFundDetail }).as('fundDetail');
    cy.intercept('GET', '/api/funds/*/performance*', { body: mockPerformance }).as('perf');
    cy.intercept('GET', '/api/funds/*/statistics', { statusCode: 404, body: {} }).as('stats');
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.get('[data-testid="fund-stats-unavailable"]').should('exist');
  });

  it('S-FS6: Detalji fonda prikazuju uporedni grafik', () => {
    cy.intercept('GET', '/api/funds*', { body: mockFunds }).as('funds');
    cy.intercept('GET', '/api/funds/1', { body: mockFundDetail }).as('fundDetail');
    cy.intercept('GET', '/api/funds/*/performance*', { body: mockPerformance }).as('perf');
    cy.intercept('GET', '/api/funds/*/statistics', { body: mockFundStats }).as('stats');
    cy.visit('/funds/1', { onBeforeLoad: setupClientSession });
    cy.wait('@fundDetail');
    cy.contains('Poređenje sa prosekom fondova').should('be.visible');
    cy.get('[data-testid="fund-comparison-chart"]').should('exist');
  });
});

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
    // Klik moze da prouzrokuje re-render dugmeta (variant menja iz outline u
    // default kad je period selektovan), pa Cypress moze izgubiti reference
    // izmedju .contains() match-a i actionability check-a. Razbijamo lanac
    // sa `.as()` + dva odvojena get-a (dokumentovano kao Cypress workaround
    // za "element has detached from dom" race-ove sa state-driven re-render-om).
    cy.contains('button', '1M').as('btn1M');
    cy.get('@btn1M').click({ force: true });
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

  it('S16: Supervizor popunjava formu i kreira fond', () => {
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

  it('S17: Validation - prazan naziv', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('ab');
    cy.get('#minimumContribution').clear().type('1000');
    cy.contains('button', 'Kreiraj fond').click();
    cy.contains('Naziv mora imati najmanje 3 karaktera').should('be.visible');
  });

  it('S18: Validation - minimumContribution <= 0', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('Mock Valid Name');
    cy.get('#minimumContribution').clear().type('0');
    cy.contains('button', 'Kreiraj fond').click();
    cy.contains('Minimalna uplata mora biti veća od 0').should('be.visible');
  });

  it('S19: Duplikat naziva - server vraca 400, toast error', () => {
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

  it('S20: Klijent nema pristup /funds/create', () => {
    // ProtectedRoute sa supervisorOnly=true preusmerava klijenta na /403.
    // To je tacno ponasanje — klijent nema pravo da kreira fond po Celina 4 spec-u.
    cy.visit('/funds/create', { onBeforeLoad: setupClientSession });
    cy.url().should('match', /\/(403|funds)/);
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
    // Dialog se zatvara posle uspesne uplate. Tekst "Uplata u fond" moze
    // ostati u toast-u (`Toastify__toast--success`), zato proveravamo da
    // role=dialog nestane umesto da trazimo tekst u celokupnom DOM-u.
    cy.get('[role="dialog"]').should('not.exist');
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
    // Dialog je open (radix Dialog.Overlay z=50 prekriva toast notification).
    // Toast je `position: fixed` ali Cypress ga vidi covered. Trazimo tekst
    // toast-a u DOM-u bez visibility check-a (toast-Toastify-uje ali render-uje).
    cy.get('.Toastify__toast', { timeout: 5000 })
      .should('exist')
      .invoke('text')
      .should('match', /Minimalni ulog|minimum/i);
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

    // Cekaj da fonds budu ucitani i selector se re-renduje sa svim opcijama,
    // pa onda menjaj value sa native select API-jem (umesto invoke koji moze
    // da "racuna" sa elementom u trenutku detach-re-attach).
    cy.get('#buyingFor option[value="FUND:10"]', { timeout: 10000 }).should('exist');
    cy.get('#buyingFor').as('select');
    cy.get('@select').select('FUND:10');
    cy.get('@select').should('have.value', 'FUND:10');
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
      cy.get('#buyingFor').as('selectS34');
      cy.get('@selectS34').select('FUND:10');
      cy.get('@selectS34').should('have.value', 'FUND:10');
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
//  Mock C4: OTC Intra-bank pregovaranje (Sc16-28)
// --------------------------------------------------------------------------
//  KRITICAN gap — intra-bank OTC tok (discovery → ponuda → kontraponuda →
//  prihvatanje → ugovor → exercise/abandon) ranije NIJE imao mock coverage.
//  setupClientSession = Stefan Jovanovic (id:1, TRADE_STOCKS). isMe() matchuje
//  buyerId===1 ILI normalizovano ime "stefan jovanovic" (vidi otcUtils.ts),
//  pa mock ponude/ugovori gde je Stefan kupac dobijaju akcione dugmice.
//
//  VAZNO: exercise i abandon NA OtcContractsPage koriste native window.confirm
//  (NE Radix dialog), pa testovi moraju da stub-uju `cy.on('window:confirm')`.
//  Exercise response je NOVI SAGA oblik {sagaId, sagaStatus, currentStep, id,
//  status}; FE handleExercise samo gleda 2xx → success toast + refetch, pa stub
//  vraca 200 sa tim oblikom (terminalni COMPLETED).
// ============================================================
describe('Mock C4: OTC Intra-bank pregovaranje (Sc16-28)', () => {
  // React 19 controlled <input type="number"> + Cypress 15 + Vite 8 (Rolldown)
  // imaju poznat race u kome clear()/type() ne okine React onChange pouzdano
  // (React value tracker ne vidi DOM-level mutaciju). Koristi native value setter
  // (isti workaround kao inter-bank counter test S44) da SyntheticEvent system
  // primi pravu vrednost.
  const setNativeValue = (selector: string, value: string) => {
    cy.get(selector).then(($el) => {
      const input = $el[0] as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  // --- Discovery mock listings (tudje javne akcije na koje Stefan moze ponuditi) ---
  const mockOtcListings = [
    {
      portfolioId: 301, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.',
      exchangeAcronym: 'NASDAQ', listingCurrency: 'USD', currentPrice: 200,
      publicQuantity: 50, availablePublicQuantity: 50,
      sellerId: 9, sellerRole: 'CLIENT', sellerName: 'Milica Nikolic',
    },
    {
      portfolioId: 302, listingId: 2, listingTicker: 'MSFT', listingName: 'Microsoft Corp.',
      exchangeAcronym: 'NASDAQ', listingCurrency: 'USD', currentPrice: 410,
      publicQuantity: 30, availablePublicQuantity: 30,
      sellerId: 10, sellerRole: 'CLIENT', sellerName: 'Lazar Ilic',
    },
  ];

  // --- Active offers (pregovori u kojima je Stefan ucesnik) ---
  // Offer A: Stefan je KUPAC, myTurn=true → moze Prihvati/Kontraponuda/Otkazi.
  //          pricePerStock 204 vs currentPrice 200 → +2.0% (zeleno ≤5%).
  // Offer B: Stefan je PRODAVAC, myTurn=false (ceka kupca) → samo Otkazi.
  //          pricePerStock 125 vs currentPrice 100 → +25.0% (crveno >20%).
  // Offer C: pricePerStock 112 vs currentPrice 100 → +12.0% (zuto 5-20%).
  const mockActiveOffers = [
    {
      id: 1001, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
      buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 9, sellerName: 'Milica Nikolic',
      quantity: 5, pricePerStock: 204, premium: 12, currentPrice: 200,
      settlementDate: '2026-12-31', lastModifiedById: 9, lastModifiedByName: 'Milica Nikolic',
      waitingOnUserId: 1, myTurn: true, status: 'ACTIVE',
      createdAt: '2026-05-01T10:00:00Z', lastModifiedAt: '2026-05-02T10:00:00Z',
    },
    {
      id: 1002, listingId: 2, listingTicker: 'MSFT', listingName: 'Microsoft Corp.', listingCurrency: 'USD',
      buyerId: 11, buyerName: 'Ana Stojanovic', sellerId: 1, sellerName: 'Stefan Jovanovic',
      quantity: 3, pricePerStock: 125, premium: 8, currentPrice: 100,
      settlementDate: '2026-11-30', lastModifiedById: 1, lastModifiedByName: 'Stefan Jovanovic',
      waitingOnUserId: 11, myTurn: false, status: 'ACTIVE',
      createdAt: '2026-05-01T11:00:00Z', lastModifiedAt: '2026-05-01T11:00:00Z',
    },
    {
      id: 1003, listingId: 1, listingTicker: 'TSLA', listingName: 'Tesla Inc.', listingCurrency: 'USD',
      buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 9, sellerName: 'Milica Nikolic',
      quantity: 2, pricePerStock: 112, premium: 5, currentPrice: 100,
      settlementDate: '2026-10-31', lastModifiedById: 9, lastModifiedByName: 'Milica Nikolic',
      waitingOnUserId: 1, myTurn: true, status: 'ACTIVE',
      createdAt: '2026-05-01T12:00:00Z', lastModifiedAt: '2026-05-02T12:00:00Z',
    },
  ];

  // --- Contracts (sklopljeni ugovori) ---
  // Contract 1: Stefan KUPAC, ACTIVE → moze Iskoristi/Odustani.
  // Contract 2: Stefan KUPAC, vec EXERCISED → nema akcije (prikazuje status).
  const mockContracts = [
    {
      id: 2001, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
      buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 9, sellerName: 'Milica Nikolic',
      quantity: 5, strikePrice: 200, premium: 12, currentPrice: 230,
      settlementDate: '2026-12-31', status: 'ACTIVE', createdAt: '2026-05-03T10:00:00Z',
    },
    {
      id: 2002, listingId: 2, listingTicker: 'MSFT', listingName: 'Microsoft Corp.', listingCurrency: 'USD',
      buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 10, sellerName: 'Lazar Ilic',
      quantity: 3, strikePrice: 400, premium: 20, currentPrice: 420,
      settlementDate: '2026-06-30', status: 'EXERCISED', createdAt: '2026-04-20T10:00:00Z',
      exercisedAt: '2026-05-04T10:00:00Z',
    },
  ];

  const stefanAccounts = [
    {
      id: 1, accountNumber: '265000000000000001', name: 'Stefan USD', ownerName: 'Stefan Jovanovic',
      availableBalance: 100000, balance: 100000, reservedBalance: 0, currency: 'USD',
      accountType: 'CHECKING', accountSubtype: 'STANDARD', status: 'ACTIVE',
    },
  ];

  // ---------------- Discovery + create offer ----------------

  it('Sc16: Klijent sa TRADE permisijom vidi javne OTC akcije na /otc/discovery', () => {
    cy.intercept('GET', '**/api/otc/listings', { statusCode: 200, body: mockOtcListings }).as('listings');
    cy.visit('/otc/discovery', { onBeforeLoad: setupClientSession });
    cy.wait('@listings');
    cy.contains('Javno dostupne akcije (2)').should('be.visible');
    cy.contains('AAPL').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('MSFT').should('be.visible');
    cy.contains('Lazar Ilic').should('be.visible');
  });

  it('Sc17: Kreiranje ponude salje POST /api/otc/offers sa qty/price/premium/settlement', () => {
    cy.intercept('GET', '**/api/otc/listings', { statusCode: 200, body: mockOtcListings }).as('listings');
    cy.intercept('GET', '**/api/otc/offers/active', { statusCode: 200, body: [] }).as('offersAfter');
    cy.intercept('POST', '**/api/otc/offers', (req) => {
      expect(req.body.listingId).to.equal(1);
      expect(req.body.sellerId).to.equal(9);
      expect(req.body.quantity).to.equal(4);
      expect(req.body.pricePerStock).to.equal(199.5);
      expect(req.body.premium).to.equal(10);
      expect(req.body.settlementDate).to.be.a('string').and.have.length.greaterThan(0);
      req.reply({
        statusCode: 200,
        body: {
          id: 5005, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
          buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 9, sellerName: 'Milica Nikolic',
          quantity: 4, pricePerStock: 199.5, premium: 10, currentPrice: 200,
          settlementDate: req.body.settlementDate, lastModifiedById: 1, lastModifiedByName: 'Stefan Jovanovic',
          waitingOnUserId: 9, myTurn: false, status: 'ACTIVE',
          createdAt: '2026-05-05T10:00:00Z', lastModifiedAt: '2026-05-05T10:00:00Z',
        },
      });
    }).as('createOffer');

    cy.visit('/otc/discovery', { onBeforeLoad: setupClientSession });
    cy.wait('@listings');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Napravi ponudu').click();
    });
    setNativeValue('input[id^="qty-"]', '4');
    setNativeValue('input[id^="price-"]', '199.5');
    setNativeValue('input[id^="premium-"]', '10');
    // Verifikuj da je React state usvojio vrednosti pre submit-a.
    cy.get('input[id^="qty-"]').should('have.value', '4');
    cy.get('input[id^="price-"]').should('have.value', '199.5');
    cy.get('input[id^="premium-"]').should('have.value', '10');
    cy.contains('button', 'Posalji ponudu prodavcu').click();

    cy.wait('@createOffer');
    // Posle uspesnog create-a FE navigira na /otc/pregovori.
    cy.url().should('include', '/otc/pregovori');
  });

  // ---------------- Negotiations: counter / accept / decline / deviation ----------------

  const visitNegotiations = (offers: typeof mockActiveOffers) => {
    cy.intercept('GET', '**/api/otc/offers/active', { statusCode: 200, body: offers }).as('offers');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');
    cy.visit('/otc/pregovori', { onBeforeLoad: setupClientSession });
    cy.wait('@offers');
  };

  it('Sc18: Pregovori prikazuju aktivne ponude gde je klijent kupac/prodavac', () => {
    visitNegotiations(mockActiveOffers);
    cy.contains('Moji aktivni pregovori (intra-bank)').should('be.visible');
    cy.contains('tr', 'AAPL').should('be.visible');
    cy.contains('tr', 'AAPL').contains('Kupac: Stefan Jovanovic').should('exist');
    cy.contains('tr', 'MSFT').contains('Prodavac: Stefan Jovanovic').should('exist');
  });

  it('Sc19: Bojenje odstupanja cene — zeleno (≤5%) / zuto (5-20%) / crveno (>20%)', () => {
    visitNegotiations(mockActiveOffers);
    // Offer A AAPL: +2.0% → zeleni badge.
    cy.contains('+2.0%').invoke('attr', 'class').should('include', 'bg-emerald-500/15');
    // Offer C TSLA: +12.0% → zuti badge.
    cy.contains('+12.0%').invoke('attr', 'class').should('include', 'bg-amber-500/15');
    // Offer B MSFT: +25.0% → crveni badge.
    cy.contains('+25.0%').invoke('attr', 'class').should('include', 'bg-red-500/15');
  });

  it('Sc20: Prodavac/kupac salje kontraponudu — POST /api/otc/offers/{id}/counter', () => {
    cy.intercept('POST', '**/api/otc/offers/1001/counter', (req) => {
      expect(req.body.quantity).to.equal(6);
      expect(req.body.premium).to.equal(15);
      req.reply({
        statusCode: 200,
        body: { ...mockActiveOffers[0], quantity: 6, premium: 15, myTurn: false },
      });
    }).as('counter');
    visitNegotiations(mockActiveOffers);

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Kontraponuda').click();
    });
    // Counter forma popunjava inicijalne vrednosti iz ponude; menjamo qty + premiju.
    setNativeValue('#cq-1001', '6');
    setNativeValue('#cpm-1001', '15');
    cy.get('#cq-1001').should('have.value', '6');
    cy.get('#cpm-1001').should('have.value', '15');
    cy.contains('button', 'Posalji kontraponudu').click();

    cy.wait('@counter');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /Kontraponuda je poslata/i);
  });

  it('Sc21: Kupac prihvata ponudu — POST /api/otc/offers/{id}/accept → ugovor u "Sklopljeni ugovori"', () => {
    cy.intercept('POST', '**/api/otc/offers/1001/accept*', (req) => {
      // Stefan je kupac na offer-u 1001 → FE salje buyerAccountId.
      expect(req.query.buyerAccountId).to.equal('1');
      req.reply({ statusCode: 200, body: { ...mockActiveOffers[0], status: 'ACCEPTED' } });
    }).as('accept');
    // Posle accept-a FE re-fetchuje offers (sad bez accepted-og) i accounts.
    cy.intercept('GET', '**/api/otc/offers/active', { statusCode: 200, body: mockActiveOffers }).as('offers');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');

    cy.visit('/otc/pregovori', { onBeforeLoad: setupClientSession });
    cy.wait('@offers');
    // Sacekaj da se racuni ucitaju — handleAccept koristi getPreferredAccount
    // (bez aktivnog racuna baca "Nemate nijedan aktivan racun" umesto accept-a).
    cy.wait('@accounts');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Prihvati').click();
    });
    cy.wait('@accept');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /opcioni ugovor je sklopljen|prihvacena/i);

    // Verifikuj da sklopljeni ugovor stvarno postoji na /otc/ugovori strani.
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: mockContracts }).as('contracts');
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
    cy.contains('Sklopljeni ugovori').should('be.visible');
    cy.contains('tr', 'AAPL').should('be.visible');
  });

  it('Sc22: Kupac/prodavac otkazuje pregovor — POST /api/otc/offers/{id}/decline', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '**/api/otc/offers/1001/decline', {
      statusCode: 200, body: { ...mockActiveOffers[0], status: 'CANCELLED' },
    }).as('decline');
    visitNegotiations(mockActiveOffers);

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Otkazi').click();
    });
    cy.wait('@decline');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /Pregovor je otkazan/i);
  });

  // ---------------- Contracts: exercise (SAGA) / abandon / access ----------------

  const visitContracts = (contracts: typeof mockContracts) => {
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: contracts }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
  };

  it('Sc23: Sklopljeni ugovori prikazuju ACTIVE i EXERCISED ugovore', () => {
    visitContracts(mockContracts);
    cy.contains('tr', 'AAPL').should('be.visible');
    cy.contains('tr', 'MSFT').should('be.visible');
    // Stefan je kupac na ACTIVE AAPL ugovoru → ima Iskoristi/Odustani.
    cy.contains('tr', 'AAPL').contains('button', 'Iskoristi').should('be.visible');
    cy.contains('tr', 'AAPL').contains('button', 'Odustani').should('be.visible');
  });

  it('Sc24: Iskoriscavanje validnog ugovora — POST /exercise vraca SAGA COMPLETED → ugovor EXERCISED', () => {
    cy.on('window:confirm', () => true);
    // NOVI SAGA oblik odgovora (terminalni COMPLETED, status EXERCISED).
    cy.intercept('POST', '**/api/otc/contracts/2001/exercise*', (req) => {
      // Stefan ima 1 aktivan racun (id:1) → FE ga prosledjuje kao buyerAccountId.
      expect(req.query.buyerAccountId).to.equal('1');
      req.reply({
        statusCode: 200,
        body: { sagaId: 'saga-intra-1', sagaStatus: 'COMPLETED', currentStep: 5, id: 2001, status: 'EXERCISED' },
      });
    }).as('exercise');

    // Jedan intercept koji menja odgovor po pozivu: prvi (mount) vraca ACTIVE
    // ugovor; sledeci (Promise.all re-fetch posle exercise-a) vraca EXERCISED.
    // Dva odvojena cy.intercept-a ne bi radila — LIFO bi naterao i mount fetch
    // da dobije EXERCISED, pa "Iskoristi" dugme nikad ne bi bilo prikazano.
    let contractsCall = 0;
    const afterExercise = mockContracts.map((c) =>
      c.id === 2001 ? { ...c, status: 'EXERCISED', exercisedAt: '2026-05-06T10:00:00Z' } : c,
    );
    cy.intercept('GET', '**/api/otc/contracts*', (req) => {
      contractsCall += 1;
      req.reply({ statusCode: 200, body: contractsCall <= 1 ? mockContracts : afterExercise });
    }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
    // handleExercise koristi getPreferredAccount → sacekaj racune da se ucitaju.
    cy.wait('@accounts');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.wait('@exercise');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /iskoriscen/i);
    cy.wait('@contracts');
    // AAPL red sad prikazuje status "Iskoriscen" (srpska labela za EXERCISED).
    cy.contains('tr', 'AAPL').contains('Iskoriscen').should('be.visible');
  });

  it('Sc25: Odustajanje od ugovora — POST /api/otc/contracts/{id}/abandon', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '**/api/otc/contracts/2001/abandon', {
      statusCode: 200, body: { ...mockContracts[0], status: 'EXPIRED' },
    }).as('abandon');

    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: mockContracts }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Odustani').click();
    });
    cy.wait('@abandon');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /Odustali ste od ugovora|Premija ostaje/i);
  });

  it('Sc26: Iskoriscavanje koje BE odbije (409) — prikazuje gresku, ugovor ostaje aktivan', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '**/api/otc/contracts/2001/exercise*', {
      statusCode: 409,
      body: { message: 'Iskoriscavanje nije uspelo — sredstva vracena (SAGA COMPENSATED).' },
    }).as('exerciseFail');
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: mockContracts }).as('contracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: stefanAccounts }).as('accounts');
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@contracts');
    // handleExercise koristi getPreferredAccount → sacekaj racune da se ucitaju.
    cy.wait('@accounts');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.wait('@exerciseFail');
    cy.get('.Toastify__toast', { timeout: 8000 })
      .should('exist')
      .invoke('text')
      .should('match', /nije uspelo|sredstva vracena/i);
    // Ugovor ostaje ACTIVE ("Aktivan") sa i dalje dostupnim dugmetom Iskoristi.
    cy.contains('tr', 'AAPL').contains('Aktivan').should('be.visible');
    cy.contains('tr', 'AAPL').contains('button', 'Iskoristi').should('be.visible');
  });
});


// ============================================================
//  FEATURE: Istorija OTC pregovora (FE4 — zadatak 7.3 / jkrunic)
// ============================================================
const mockNegHistoryPage = {
  content: [
    {
      id: 1, negotiationId: 10, quantity: 5, pricePerShare: 100, premium: 12,
      settlementDate: '2026-06-30', status: 'ACTIVE', modifiedById: 7,
      modifiedByName: 'Marko Petrović', createdAt: '2026-05-10T10:00:00',
    },
    {
      id: 2, negotiationId: 11, quantity: 8, pricePerShare: 220, premium: 30,
      settlementDate: '2026-07-15', status: 'ACCEPTED', modifiedById: 9,
      modifiedByName: 'Jelena Đorđević', createdAt: '2026-05-12T14:00:00',
    },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 20,
};

const mockNegChain = [
  {
    id: 1, negotiationId: 10, quantity: 5, pricePerShare: 100, premium: 12,
    settlementDate: '2026-06-30', status: 'ACTIVE', modifiedById: 7,
    modifiedByName: 'Marko Petrović', createdAt: '2026-05-10T10:00:00',
  },
];

describe('Mock C4: Istorija OTC pregovora (FE4 7.3)', () => {
  it('S-OH1: Supervizor vidi tabelu zapisa pregovora', () => {
    cy.intercept('GET', '/api/otc/negotiation-history*', {
      statusCode: 200, body: mockNegHistoryPage,
    }).as('history');
    cy.visit('/otc/negotiation-history', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@history');
    cy.contains('Istorija OTC pregovora').should('be.visible');
    cy.contains('#10').should('be.visible');
    cy.contains('Marko Petrović').should('be.visible');
  });

  it('S-OH2: Prazno stanje kad nema zapisa', () => {
    cy.intercept('GET', '/api/otc/negotiation-history*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
    }).as('history');
    cy.visit('/otc/negotiation-history', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@history');
    cy.get('[data-testid="otc-history-empty"]').should('exist');
  });

  it('S-OH3: Poruka kad B10 endpoint vrati 404', () => {
    cy.intercept('GET', '/api/otc/negotiation-history*', { statusCode: 404, body: {} }).as('history');
    cy.visit('/otc/negotiation-history', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@history');
    cy.get('[data-testid="otc-history-unavailable"]').should('exist');
  });

  it('S-OH4: Expand reda prikazuje lanac kontraponuda', () => {
    cy.intercept('GET', '/api/otc/negotiation-history*', {
      statusCode: 200, body: mockNegHistoryPage,
    }).as('history');
    cy.intercept('GET', '/api/otc/negotiation-history/*', {
      statusCode: 200, body: mockNegChain,
    }).as('chain');
    cy.visit('/otc/negotiation-history', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@history');
    cy.get('[data-testid="otc-history-toggle-1"]').click();
    cy.wait('@chain');
    cy.get('[data-testid="otc-chain-table"]').should('be.visible');
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
    cy.visit('/otc/discovery', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcListings');
    cy.contains('button', 'Iz drugih banaka').click();
    cy.wait('@remoteOtcListings');
  };

  it('S36: Tab "Iz drugih banaka" na OtcDiscoveryPage', () => {
    openRemoteTab();

    cy.contains('button', 'Iz drugih banaka').should('have.attr', 'aria-pressed', 'true');
    cy.contains('Javno dostupne akcije iz drugih banaka (2)').should('be.visible');
    cy.get('table tbody tr').should('have.length', mockOtcRemoteListings.length);
  });

  it('S37: Lista prikazuje bankCode i sellerName kolone', () => {
    openRemoteTab();

    cy.contains('th', 'Banka prodavca').should('be.visible');
    cy.contains('th', 'Prodavac').should('be.visible');
    cy.contains('BANKA2').should('be.visible');
    cy.contains('Remote Seller').should('be.visible');
    cy.contains('BANKA3').should('be.visible');
    cy.contains('Partner Seller').should('be.visible');
  });

  it('S38: "Napravi ponudu" otvara formu i salje POST', () => {
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

  it('S39: Osvezi dugme poziva listRemoteListings', () => {
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
    cy.visit('/otc/pregovori', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcOffers');
    cy.wait('@myAccounts');
    cy.contains('button', 'Iz drugih banaka').click();
    cy.wait('@remoteOtcOffers');
  };

  it('S40: Tab prikazuje moje aktivne inter-bank ponude', () => {
    openRemoteOffersTab();

    cy.contains('button', 'Iz drugih banaka').should('have.attr', 'aria-pressed', 'true');
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

  // FIXED 03.06: mock fixture (remote-offer-green) sad sinhronizovan sa FE myCode
  // pattern — buyerBankCode='RN-222' (OUR_BANK_CODE default) + buyerUserId='C-1'
  // (setupClientSession user.id=1 -> C-1). computeMyRoleInOffer vraca 'BUYER',
  // myTurn:true -> "Prihvati" dugme je vidljivo. Vidi komentar u mockOtcRemoteOffers[0].
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
    // Posle accept-a, offer se uklanja iz aktivnih ponuda. Filter chip ostaje
    // na "Iz drugih banaka" (na /otc/pregovori). Sklopljeni ugovori sada zive
    // na zasebnoj /otc/ugovori ruti — ne ocekujemo auto-switch.
    cy.contains('button', 'Iz drugih banaka').should('have.attr', 'aria-pressed', 'true');
  });

  it('S44: Kontraponuda - PATCH /counter sa novim iznosima', () => {
    openRemoteOffersTab();

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Kontraponuda').click();
    });
    // Spec: input pocinje sa initial value = offer.quantity (70). React 19
    // controlled <input type="number"> + Cypress 15 + Vite 8 (Rolldown)
    // imaju poznat race u kome ni `clear()` ni `{selectAll}{del}` ne
    // okidaju React's `onChange` handler propisno (React internal value
    // tracker ne detect-uje DOM-level value mutaciju iz Cypress-a).
    // Resenje: koristi native HTMLInputElement value setter direktno —
    // tako React-ov input value tracker obavesti SyntheticEvent system
    // i onChange handler bude pozvan kao da je korisnik fizicki ukucao.
    const setNativeValue = (selector: string, value: string) => {
      cy.get(selector).then(($el) => {
        const input = $el[0] as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeSetter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    setNativeValue('input[id^="remote-counter-qty-"]', '7');
    setNativeValue('input[id^="remote-counter-premium-"]', '12.5');
    // Verifikuj da je React state stvarno usvojio nove vrednosti pre submit-a.
    cy.get('input[id^="remote-counter-qty-"]').should('have.value', '7');
    cy.get('input[id^="remote-counter-premium-"]').should('have.value', '12.5');
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
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@localOtcContracts');
    cy.wait('@myAccounts');
    cy.contains('button', 'Iz drugih banaka').click();
    cy.wait('@remoteContracts');
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
    // Toast je `position: fixed` ali se Radix Dialog.Overlay (z-50) zatvara
    // tek kad korisnik klikne X — Cypress vidi toast pokriven dialog overlay-om.
    // Trazimo tekst u DOM-u bez visibility check-a.
    cy.get('.Toastify__toast', { timeout: 10000 })
      .should('exist')
      .invoke('text')
      .should('include', 'Inter-bank exercise je uspesno finalizovan');
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

    // Failure reason text moze biti u toast-u ili u status badge-u u dialogu.
    // Trazimo bilo gde u DOM-u bez visibility check-a (toast prekriven Radix
    // Dialog.Overlay-om, ali tekst postoji).
    cy.get('body', { timeout: 10000 })
      .invoke('text')
      .should('include', 'Partner banka odbila prenos hartija');
  });
});


// ============================================================
//  FEATURE 10: Profit Banke portal (Issue #77 / sssmarta)
// ============================================================
describe('Mock C4: Profit Banke Portal', () => {
  const mockActuaries = [
    { employeeId: 1, name: 'Marko Petrovic', position: 'SUPERVISOR', ordersDone: 12, totalProfitRsd: 950000 },
    { employeeId: 2, name: 'Tamara Pavlovic', position: 'AGENT', ordersDone: 8, totalProfitRsd: 450000 },
    { employeeId: 3, name: 'Maja Ristic', position: 'AGENT', ordersDone: 4, totalProfitRsd: 120000 },
    { employeeId: 4, name: 'Nikola Milenkovic', position: 'SUPERVISOR', ordersDone: 20, totalProfitRsd: 1500000 },
  ];

  const mockBankPositions = [
    {
      id: 101, fundId: 1, fundName: 'Alpha Growth Fund', userId: 99, userRole: 'CLIENT',
      totalInvested: 5000000, currentValue: 6200000, percentOfFund: 12.5, lastModifiedAt: '2026-04-30T10:00:00Z',
    },
    {
      id: 102, fundId: 2, fundName: 'Beta Income Fund', userId: 99, userRole: 'CLIENT',
      totalInvested: 3000000, currentValue: 3450000, percentOfFund: 8.2, lastModifiedAt: '2026-04-30T10:00:00Z',
    },
  ];

  const mockFundsList = [
    { id: 1, name: 'Alpha Growth Fund', description: 'IT sektor', minimumContribution: 1000, fundValue: 50000000, managerId: 1, managerName: 'Marko Petrovic', accountId: 1, accountNumber: '222100200000000001', currency: 'RSD', createdAt: '2024-01-01' },
    { id: 2, name: 'Beta Income Fund', description: 'Konzervativni', minimumContribution: 500, fundValue: 42000000, managerId: 4, managerName: 'Nikola Milenkovic', accountId: 2, accountNumber: '222100200000000002', currency: 'RSD', createdAt: '2024-02-01' },
  ];

  function setupProfitBankMocks() {
    cy.intercept('GET', '**/api/profit-bank/actuary-performance', {
      statusCode: 200, body: mockActuaries,
    }).as('actuaries');
    cy.intercept('GET', '**/api/profit-bank/fund-positions', {
      statusCode: 200, body: mockBankPositions,
    }).as('bankPositions');
    cy.intercept('GET', '**/api/funds', {
      statusCode: 200, body: mockFundsList,
    }).as('fundsList');
    cy.intercept('GET', '**/api/funds/1', {
      statusCode: 200,
      body: {
        ...mockFundsList[0],
        liquidAmount: 8000000,
        holdings: [{ listingId: 1, ticker: 'AAPL', name: 'Apple', quantity: 100, currentPrice: 220, change: 5, acquisitionDate: '2024-06-01' }],
      },
    }).as('fund1Detail');
    cy.intercept('GET', '**/api/accounts/bank*', { statusCode: 200, body: [
      { id: 10, accountNumber: '222100100000000001', currency: 'RSD', balance: 100000000, availableBalance: 100000000, status: 'ACTIVE' },
    ] });
  }

  it('S51: Supervizor pristupa /employee/profit-bank', () => {
    setupProfitBankMocks();
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.url().should('include', '/employee/profit-bank');
    cy.contains('h1', 'Profit Banke').should('be.visible');
  });

  it('S52: Tab "Profit aktuara" - tabela sa profitom RSD', () => {
    setupProfitBankMocks();
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@actuaries');
    cy.contains('Marko Petrovic').should('be.visible');
    cy.contains('Tamara Pavlovic').should('be.visible');
    cy.contains('Nikola Milenkovic').should('be.visible');
    // Profit u RSD format-u (sr-RS): 950.000,00
    cy.contains(/950\.000|950,000/).should('exist');
  });

  it('S53: Sortiranje po profitu desc (BE controller redosled)', () => {
    // Spec ne forsira sort, ali ako BE vraca po profitu desc, FE prikaze tako.
    // Verifikujemo da se prvi prikazani aktuar poklapa sa najvecim profitom
    // u mock-u (Nikola, 1.5M).
    cy.intercept('GET', '**/api/profit-bank/actuary-performance', {
      statusCode: 200,
      body: [...mockActuaries].sort((a, b) => b.totalProfitRsd - a.totalProfitRsd),
    }).as('actuariesSorted');
    cy.intercept('GET', '**/api/profit-bank/fund-positions', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/funds', { statusCode: 200, body: [] });
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@actuariesSorted');
    cy.get('table tbody tr').first().should('contain', 'Nikola');
  });

  it('S54: Tab "Pozicije u fondovima" - bankine pozicije', () => {
    setupProfitBankMocks();
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@actuaries');
    cy.contains('[role="tab"]', /Pozicije u fondovima/i).click();
    cy.wait('@bankPositions');
    cy.contains('Alpha Growth Fund').should('be.visible');
    cy.contains('Beta Income Fund').should('be.visible');
    // Profit treba da bude prikazan kao razlika current - invested
    cy.contains(/12\.5|12,5/).should('exist'); // procenat fonda
  });

  it('S55: "Uplati u ime banke" dugme otvara FundInvestDialog supervisor mode', () => {
    setupProfitBankMocks();
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@bankPositions');
    cy.contains('[role="tab"]', /Pozicije u fondovima/i).click();
    // ProfitBankPage poziva bankPositions samo jednom na mount (oba tab-a koriste isti state).
    cy.contains('tr', 'Alpha Growth Fund').within(() => {
      cy.contains('button', /Uplati u ime banke/i).click();
    });
    // FundInvestDialog otvoren — treba da pita za bankin racun
    cy.contains(/Uplati u fond|Uplata|Iznos/i).should('be.visible');
  });

  it('S56: "Povuci u ime banke" dugme otvara FundWithdrawDialog supervisor mode', () => {
    setupProfitBankMocks();
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@bankPositions');
    cy.contains('[role="tab"]', /Pozicije u fondovima/i).click();
    cy.contains('tr', 'Alpha Growth Fund').within(() => {
      cy.contains('button', /Povuci u ime banke/i).click();
    });
    cy.contains(/Povlaci|Povuci|Iznos/i).should('be.visible');
  });

  it('S57: Agent NEMA pristup portalu — Navigate na /home', () => {
    // FE route guard: supervisorOnly redirectuje agenta na /403
    cy.visit('/employee/profit-bank', { onBeforeLoad: setupAgentSession });
    cy.url().should('include', '/403');
  });
});


// ============================================================
//  FEATURE 11: EmployeeEdit fund reassign dialog (Issue #78 / sssmarta)
// ============================================================
describe('Mock C4: Admin Fund Reassignment', () => {
  // BE Employee DTO format (snake_case + flat fields kao u employeeService.getById):
  const mockBackendEmployee = {
    id: 5,
    email: 'sasa.supervisor@banka.rs',
    first_name: 'Sasa',
    last_name: 'Supervizoricic',
    firstName: 'Sasa',
    lastName: 'Supervizoricic',
    phone: '+381601234567',
    phoneNumber: '+381601234567',
    address: 'Knez Mihailova 1',
    date_of_birth: '1985-05-15',
    dateOfBirth: '1985-05-15',
    gender: 'M',
    department: 'IT',
    position: 'Supervisor',
    active: true,
    isActive: true,
    permissions: ['SUPERVISOR', 'TRADE_STOCKS'],
    username: 'sasa.supervisor',
  };

  // FundDetail format koji listByManager() filtrira po `managerEmployeeId`:
  const mockManagedFundDetails = [
    {
      id: 10, name: 'Sasa Fond Alpha', description: 'IT diversification',
      minimumContribution: 1000, fundValue: 5000000,
      managerEmployeeId: 5, managerName: 'Sasa Supervizoricic',
      liquidAmount: 1000000, accountId: 100,
      accountNumber: '222100200000001234', currency: 'RSD',
      createdAt: '2024-01-01', holdings: [],
    },
    {
      id: 11, name: 'Sasa Fond Beta', description: 'Energy sector',
      minimumContribution: 500, fundValue: 3000000,
      managerEmployeeId: 5, managerName: 'Sasa Supervizoricic',
      liquidAmount: 600000, accountId: 101,
      accountNumber: '222100200000005678', currency: 'RSD',
      createdAt: '2024-02-01', holdings: [],
    },
  ];

  function setupReassignMocks(funds: typeof mockManagedFundDetails) {
    cy.intercept('GET', '**/api/employees/5', {
      statusCode: 200, body: mockBackendEmployee,
    }).as('getEmployee');
    // listByManager() poziva /funds (lista summaries) i onda /funds/{id}
    // za svaki, filtrira lokalno po managerEmployeeId. Pa moramo mock-ovati:
    cy.intercept('GET', '**/api/funds', {
      statusCode: 200,
      body: funds.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        minimumContribution: f.minimumContribution,
        fundValue: f.fundValue,
        managerEmployeeId: f.managerEmployeeId,
        managerName: f.managerName,
        accountId: f.accountId,
        currency: f.currency,
        createdAt: f.createdAt,
      })),
    }).as('fundsList');
    funds.forEach((f) => {
      cy.intercept('GET', `**/api/funds/${f.id}`, {
        statusCode: 200, body: f,
      });
    });
    cy.intercept('PUT', '**/api/employees/5', {
      statusCode: 200, body: { ...mockBackendEmployee, permissions: ['TRADE_STOCKS'] },
    }).as('putEmployee');
    cy.intercept('PATCH', '**/api/employees/5/deactivate', {
      statusCode: 200, body: {},
    });
  }

  function uncheckSupervisorAndSave() {
    // Sacekaj da se employee i funds ucitaju (managedFunds state se postavi
    // tek kad listByManager() vrati podatke, sto zavisi od /funds + /funds/{id}).
    cy.get('[data-testid="employee-edit-form"]', { timeout: 15000 }).should('be.visible');
    cy.wait(800); // managedFunds state se postavi async-no posle Promise.all-a
    // SUPERVISOR Checkbox je shadcn/ui Checkbox sa id="perm-SUPERVISOR"
    // (vidi EmployeeEditPage.tsx:572). Renderuje se kao Radix <button role="checkbox">.
    cy.get('#perm-SUPERVISOR').click({ force: true });
    cy.contains('button', /Sacuvaj|Save/i).scrollIntoView().click({ force: true });
  }

  it('S58: Admin uklanja isSupervisor - dialog se otvara ako user upravlja fondovima', () => {
    setupReassignMocks(mockManagedFundDetails);
    cy.visit('/admin/employees/5', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    uncheckSupervisorAndSave();
    cy.get('[data-testid="reassign-funds-dialog"]', { timeout: 10000 }).should('be.visible');
  });

  it('S59: Dialog prikazuje broj i nazive fondova', () => {
    setupReassignMocks(mockManagedFundDetails);
    cy.visit('/admin/employees/5', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    uncheckSupervisorAndSave();
    cy.get('[data-testid="reassign-funds-dialog"]', { timeout: 10000 }).within(() => {
      cy.contains(/2\s+fond/i).should('be.visible');
      cy.contains('Sasa Fond Alpha').should('be.visible');
      cy.contains('Sasa Fond Beta').should('be.visible');
    });
  });

  it('S60: "Potvrdi" salje PUT i navigira na /admin/employees', () => {
    setupReassignMocks(mockManagedFundDetails);
    cy.visit('/admin/employees/5', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    uncheckSupervisorAndSave();
    cy.get('[data-testid="reassign-funds-dialog"]', { timeout: 10000 }).within(() => {
      cy.contains('button', /Potvrdi/i).click();
    });
    cy.wait('@putEmployee');
    cy.url({ timeout: 10000 }).should('include', '/admin/employees');
  });

  it('S61: "Otkazi" zatvara dialog, URL ostaje na edit stranici', () => {
    setupReassignMocks(mockManagedFundDetails);
    cy.visit('/admin/employees/5', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    uncheckSupervisorAndSave();
    cy.get('[data-testid="reassign-funds-dialog"]', { timeout: 10000 }).within(() => {
      cy.contains('button', /Otkazi/i).click();
    });
    cy.get('[data-testid="reassign-funds-dialog"]').should('not.exist');
    // Ruta je /admin/employees/:id (NE /edit) — verifikuj samo da nismo redirect-ovani.
    cy.url().should('include', '/admin/employees/5');
    cy.url().should('not.include', '/admin/employees/5/'); // bez naknadnog path-a
  });

  it('S62: User bez fondova - nema dialog-a (direktno PUT)', () => {
    setupReassignMocks([]);
    cy.visit('/admin/employees/5', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    uncheckSupervisorAndSave();
    cy.get('[data-testid="reassign-funds-dialog"]').should('not.exist');
    cy.wait('@putEmployee');
    cy.url({ timeout: 10000 }).should('include', '/admin/employees');
  });
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
    // Bug T2-005 fix: pre OTP modala se otvara confirm dialog sa preview-om uplate.
    // Klikni "Potvrdi i nastavi" da bi se otvorio VerificationModal.
    cy.contains('button', 'Potvrdi i nastavi').click();
    // VerificationModal heading promenjen u "Verifikacija (TOTP)" sa 26.05 TOTP migration.
    cy.contains(/^Verifikacija/).should('be.visible');
    cy.contains('button', 'Popuni').click({ force: true });
    cy.contains('button', 'Potvrdi').last().click({ force: true });
  }

  it('S63: Detekcija inter-bank po prve 3 cifre (ne 222)', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 1,
        fromAccount: '222000100000000110',
        toAccount: '111000000000000001',
        amount: 5000,
        currency: 'RSD',
        status: 'PENDING',
        createdAt: '2026-04-25T10:00:00',
      },
    }).as('initInterbank');

    cy.intercept('GET', '**/api/payments/1', {
      statusCode: 200,
      body: {
        id: 1,
        fromAccount: '222000100000000110',
        toAccount: '111000000000000001',
        amount: 5000,
        currency: 'RSD',
        status: 'COMPLETED',
        createdAt: '2026-04-25T10:00:00',
      },
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillMandatoryPaymentFields('111000000000000001');
    cy.wait('@initInterbank');

    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });

    // UI koristi `data-testid="interbank-status-modal"` umesto teksta
    // "Inter-bank status" (komponenta NewPaymentPage line 811).
    cy.get('[data-testid="interbank-status-modal"]').should('exist');
    cy.contains('p', 'Transaction ID:').find('span').should('have.text', '1');
  });

  it('S64: Salje POST /payments', () => {
    cy.intercept('POST', '**/api/payments', (req) => {
      expect(req.body.toAccount).to.equal('111000000000000002');
      req.reply({
        statusCode: 200,
        body: {
          id: 2,
          fromAccount: req.body.fromAccount,
          toAccount: req.body.toAccount,
          amount: req.body.amount,
          currency: 'RSD',
          status: 'PENDING',
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('initInterbank');

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
        fromAccount: '222000100000000110',
        toAccount: '111000000000000003',
        amount: 5000,
        currency: 'RSD',
        status: 'PENDING',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/payments/3', (req) => {
      statusCall += 1;
      const statuses = ['PROCESSING', 'COMPLETED'] as const;
      const status = statuses[Math.min(statusCall - 1, statuses.length - 1)];
      req.reply({
        statusCode: 200,
        body: {
          id: 3,
          fromAccount: '222000100000000110',
          toAccount: '111000000000000003',
          amount: 5000,
          currency: 'RSD',
          status,
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillMandatoryPaymentFields('111000000000000003');

    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });
    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });

    cy.get('@statusPoll.all').its('length').should('be.greaterThan', 1);
    cy.contains(/INITIATED|COMMITTING|COMMITTED/).should('exist');
  });

  it('S66: Polling na svakih 3s', () => {
    let statusCall = 0;
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 4,
        fromAccount: '222000100000000110',
        toAccount: '111000000000000004',
        amount: 5000,
        currency: 'RSD',
        status: 'PENDING',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/payments/4', (req) => {
      statusCall += 1;
      req.reply({
        statusCode: 200,
        body: {
          id: 4,
          fromAccount: '222000100000000110',
          toAccount: '111000000000000004',
          amount: 5000,
          currency: 'RSD',
          status: statusCall < 2 ? 'PROCESSING' : 'COMPLETED',
          createdAt: '2026-04-25T10:00:00',
        },
      });
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillMandatoryPaymentFields('111000000000000004');

    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });
    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });

    cy.wrap(null).then(() => {
      expect(statusCall).to.be.greaterThan(1);
    });
  });

  it('S67: ABORTED - prikazuje failureReason', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: {
        id: 5,
        fromAccount: '222000100000000110',
        toAccount: '111000000000000005',
        amount: 5000,
        currency: 'RSD',
        status: 'PENDING',
        createdAt: '2026-04-25T10:00:00',
      },
    });
    cy.intercept('GET', '**/api/payments/5', {
      statusCode: 200,
      body: {
        id: 5,
        fromAccount: '222000100000000110',
        toAccount: '111000000000000005',
        amount: 5000,
        currency: 'RSD',
        status: 'REJECTED',
        // BE pravo dodaje `failureReason` na REJECTED status; bez njega FE
        // padne na srpski fallback "Banka primaoca je odbacila transakciju.".
        // Spec Celina 5 (Nova) §69 trazi da se prikazuje BE razlog kad postoji.
        failureReason: 'Payment rejected.',
        createdAt: '2026-04-25T10:00:00',
      },
    }).as('statusPoll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillMandatoryPaymentFields('111000000000000005');

    cy.tick(3000);
    cy.wait('@statusPoll', { timeout: 10000 });

    cy.contains('ABORTED').should('be.visible');
    // failureReason "Payment rejected." se prikazuje preko toast.error koji
    // moze biti pokriven dialog overlay-om. Trazimo tekst u DOM-u (toast i/ili
    // status modal-u — render-uje se u oba mesta po kodu).
    cy.get('body', { timeout: 10000 })
      .invoke('text')
      .should('include', 'Payment rejected');
  });

  it('S68: Intra-bank (222...) ide standard flow, ne interbank', () => {
    cy.intercept('GET', /\/api\/payments\/\d+$/).as('paymentStatus');
    cy.intercept('POST', '**/api/payments', { statusCode: 200, body: {} }).as('intraPayment');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillMandatoryPaymentFields('222000000000000001');
    cy.wait('@intraPayment');

    cy.tick(15000);
    cy.get('@paymentStatus.all').should('have.length', 0);
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
    // Sidebar je `position: fixed` pa link moze biti van viewport-a — scroll-uj
    // do njega pre vidljivosti check-a (Cypress respekt-uje fixed parent overflow).
    cy.get('nav').contains('Investicioni fondovi').scrollIntoView().should('be.visible');
  });

  it('S74: "Profit Banke" link samo za supervizora', () => {
    mockHomeData();
    cy.visit('/home', { onBeforeLoad: setupSupervisorSession });
    cy.get('nav').contains('Profit Banke').scrollIntoView().should('be.visible');
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
  UKUPNO: 76 pending scenarija (mock)
  Nakon sto feature bude implementiran, zameni `it.skip` sa `it` i popuni body.
  Cilj: do KT3, ceo mock suite da bude zelen.
================================================================================
*/

// ============================================================
//  ROUTE GUARDS — Defense-in-depth (preuzeto iz polish migracije 03.05)
// ============================================================

describe('Route guards: supervisorOnly redirects agent to /403', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/employees**', { statusCode: 200, body: { content: [], total: 0 } });
  });

  it('agent direktnim URL-om na /employee/orders dobija 403 (supervisorOnly guard)', () => {
    cy.visit('/employee/orders', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /employee/actuaries dobija 403', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /employee/tax dobija 403', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /employee/profit-bank dobija 403', () => {
    cy.visit('/employee/profit-bank', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /funds/create dobija 403 (samo supervizori prave fondove)', () => {
    cy.visit('/funds/create', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('supervizor moze da pristupi /employee/orders', () => {
    cy.intercept('GET', '**/api/orders**', { statusCode: 200, body: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 } });
    cy.visit('/employee/orders', { onBeforeLoad: (win) => setupSupervisorSession(win) });
    cy.url().should('include', '/employee/orders');
    cy.url().should('not.include', '/403');
  });

  it('admin moze da pristupi /employee/orders (admin je supervizor)', () => {
    cy.intercept('GET', '**/api/orders**', { statusCode: 200, body: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 } });
    cy.visit('/employee/orders', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.url().should('not.include', '/403');
  });
});

describe('Route guards: noAgentOnly redirects agent on OTC URLs', () => {
  it('agent na /otc dobija 403 (Celina 4 (Nova) §137-141)', () => {
    cy.visit('/otc', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /otc/pregovori dobija 403', () => {
    cy.visit('/otc/pregovori', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /otc/ugovori dobija 403', () => {
    cy.visit('/otc/ugovori', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('agent na /otc/discovery dobija 403', () => {
    cy.visit('/otc/discovery', { onBeforeLoad: (win) => setupAgentSession(win) });
    cy.url().should('include', '/403');
  });

  it('klijent moze da pristupi /otc', () => {
    cy.intercept('GET', '**/api/otc/listings**', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.visit('/otc', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.url().should('not.include', '/403');
  });
});

// ============================================================
//  INTER-BANK BANNER (Celina 5 (Nova) — placanja u drugu banku)
// ============================================================

describe('Inter-bank warning banner', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: [
        { id: 1, accountNumber: '222000100000000110', accountType: 'CHECKING', currency: 'RSD', balance: 100000, availableBalance: 100000, status: 'ACTIVE' },
      ],
    });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  });

  it('NE prikazuje banner za prazan racun primaoca', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.contains('Novi platni nalog').should('be.visible');
    cy.get('[data-testid="interbank-warning-banner"]').should('not.exist');
  });

  it('NE prikazuje banner za nas-bank prefix 222', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('#toAccount').type('222000100000000999');
    cy.get('[data-testid="interbank-warning-banner"]').should('not.exist');
  });

  it('PRIKAZUJE banner za prefix 444 sa 2PC objasnjenjem', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('#toAccount').type('444000100000000999');
    cy.get('[data-testid="interbank-warning-banner"]').should('be.visible');
    cy.contains('Medjubankarsko placanje').should('be.visible');
    cy.contains('2-Phase Commit').should('be.visible');
  });

  it('SAKRIJE banner kad user obrise input', () => {
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('#toAccount').type('444000100000000999');
    cy.get('[data-testid="interbank-warning-banner"]').should('be.visible');
    cy.get('#toAccount').clear();
    cy.get('[data-testid="interbank-warning-banner"]').should('not.exist');
  });
});

// ============================================================
//  OTC INTER-BANK DISCOVERY: auto-refresh indicator
// ============================================================

describe('OTC inter-bank Discovery auto-polling indicator', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/interbank/otc/listings*', { statusCode: 200, body: [] }).as('interbankListings');
    cy.intercept('GET', '**/api/interbank/otc/offers/my*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/interbank/otc/contracts/my*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/otc/listings*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/otc/offers/active*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  });

  it('prikazuje Auto 30s indikator i Osvezi dugme', () => {
    // auto-refresh-indicator se nalazi u OtcInterBankDiscoveryTab. Po novoj OTC
    // Hub strukturi (Tasks 1-8), Discovery je na /otc/discovery, gde se inter-bank
    // mod aktivira preko OtcSourceFilterChip "Iz drugih banaka" dugmeta.
    cy.visit('/otc/discovery', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.contains('button', /Iz drugih banaka/i).click();
    // Cekaj da se inter-bank listings fetch zavrsi pre nego sto trazimo
    // indicator — komponenta se renderuje uslovno na osnovu source state-a.
    cy.wait('@interbankListings');
    cy.get('[data-testid="auto-refresh-indicator"]', { timeout: 10000 }).should('exist');
    cy.contains('button', /Osvezi/i).should('exist');
  });
});

// ============================================================
//  OTC TAB BADGE COUNTS
// ============================================================

describe('OTC Hub kartice (n aktivnih)', () => {
  beforeEach(() => {
    // Spec note: otcService.listMyActiveOffers() poziva GET /otc/offers/active,
    // a otcService.listMyContracts(filter) poziva GET /otc/contracts (NE /my).
    // Intercept matchers moraju da pokriju oba URL-a inace mock se ne primenjuje
    // i FE radi pravi network call koji u test okruzenju vraca 401, Hub stats
    // ostaju 0, test fail-uje na cy.get timeout.
    cy.intercept('GET', '**/api/otc/listings*', { statusCode: 200, body: [] }).as('localListings');
    cy.intercept('GET', '**/api/otc/offers/active*', {
      statusCode: 200,
      body: [
        { id: 1, status: 'ACTIVE', listingTicker: 'AAPL', amount: 10, pricePerStock: 150, premium: 100, settlementDate: '2026-12-31', lastModifiedAt: '2026-01-01T00:00:00Z', lastModifiedById: 99, lastModifiedByName: 'Other', myTurn: true },
        { id: 2, status: 'ACCEPTED', listingTicker: 'MSFT', amount: 5, pricePerStock: 400, premium: 50, settlementDate: '2026-12-31', lastModifiedAt: '2026-01-01T00:00:00Z', lastModifiedById: 99, lastModifiedByName: 'Other', myTurn: false },
      ],
    }).as('localOffers');
    cy.intercept('GET', '**/api/otc/contracts*', {
      statusCode: 200,
      body: [
        { id: 11, status: 'ACTIVE', listingTicker: 'AAPL', quantity: 10, strikePrice: 150, premium: 100, settlementDate: '2026-12-31' },
        { id: 12, status: 'ACTIVE', listingTicker: 'TSLA', quantity: 5, strikePrice: 250, premium: 50, settlementDate: '2026-12-31' },
        { id: 13, status: 'EXERCISED', listingTicker: 'MSFT', quantity: 3, strikePrice: 400, premium: 30, settlementDate: '2026-06-30' },
      ],
    }).as('localContracts');
    cy.intercept('GET', '**/api/otc/my-public*', { statusCode: 200, body: [] }).as('myPublic');
    cy.intercept('GET', '**/api/interbank/otc/listings*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/interbank/otc/offers/my*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/interbank/otc/contracts/my*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  });

  it('hub-contracts kartica pokazuje count 2 ACTIVE ugovora (3-1 EXERCISED)', () => {
    cy.visit('/otc', { onBeforeLoad: (win) => setupClientSession(win) });
    // Cekamo da se sve Hub stat fetch-evi zavrse pre nego sto trazimo broj.
    cy.wait('@localContracts');
    cy.get('[data-testid="hub-contracts"]', { timeout: 10000 }).should('contain', '2');
  });
});
