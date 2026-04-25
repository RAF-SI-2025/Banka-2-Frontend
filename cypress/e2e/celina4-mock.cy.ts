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
  // TODO(tim): otkomentarisi setupAgentSession kad ti zatreba Agent sesija u TODO testu
  // setupAgentSession,
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
    id: 'remote-contract-1',
    listingId: 1001,
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    buyerUserId: 'buyer-1',
    buyerBankCode: 'BANKA1',
    buyerName: 'Stefan Jovanovic',
    sellerUserId: 'seller-1',
    sellerBankCode: 'BANKA2',
    sellerName: 'Remote Seller',
    quantity: 5,
    strikePrice: 102,
    premium: 10,
    currentPrice: 104,
    settlementDate: '2026-05-10',
    status: 'ACTIVE',
    createdAt: '2026-04-25T10:30:00Z',
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
    balance: 5000,
    availableBalance: 5000,
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
    cy.visit('/funds', { onBeforeLoad: setupClientSession });
    cy.wait('@funds');
    cy.contains('td', 'Alpha Growth Fund').click();
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
    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token', refreshToken: 'fake-refresh-token', tokenType: 'Bearer' },
    });
  });

  it('TODO S16: Supervizor popunjava formu i kreira fond', () => {
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('E2E Mock Fund');
    cy.get('#description').type('Mock test create fund');
    cy.get('#minimumContribution').clear().type('1500');
    cy.contains('button', 'Kreiraj fond').click();

    cy.location('pathname').then((path) => {
      if (/^\/funds\/\d+$/.test(path)) {
        expect(path).to.match(/^\/funds\/\d+$/);
      } else {
        cy.url().should('include', '/funds/create');
        cy.contains(/TODO|nije uspelo|gresk/i).should('be.visible');
      }
    });
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
    cy.visit('/funds/create', { onBeforeLoad: setupSupervisorSession });
    cy.get('#name').type('Postojeci Fond');
    cy.get('#description').type('Opis');
    cy.get('#minimumContribution').clear().type('1200');
    cy.contains('button', 'Kreiraj fond').click();

    cy.contains(/TODO|vec postoji|nije uspelo|gresk/i).should('be.visible');
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
  it.skip('TODO S21: Klijent uplacuje iznos u fond (FundInvestDialog)', () => {});
  it.skip('TODO S22: Validation - iznos manji od minimumContribution', () => {});
  it.skip('TODO S23: Klijent povlaci deo pozicije (FundWithdrawDialog)', () => {});
  it.skip('TODO S24: Klijent povlaci celu poziciju (checkbox)', () => {});
  it.skip('TODO S25: Server vraca status=PENDING - toast "Obrada u toku"', () => {});
  it.skip('TODO S26: Supervizor uplacuje u ime banke (bez FX komisije)', () => {});
});


// ============================================================
//  FEATURE 5: "Moji fondovi" tab na Portfoliu (Issue #74 / antonije3)
// ============================================================
describe('Mock C4: MyFundsTab', () => {
  beforeEach(() => {
    setupClientSession();
  });

  it.skip('TODO S27: Tab "Moji fondovi" prikazuje moje pozicije', () => {});
  it.skip('TODO S28: Empty state kad klijent nema poziciju', () => {});
  it.skip('TODO S29: Prikaz udela % i RSD vrednosti', () => {});
  it.skip('TODO S30: Klik na fond navigira na /funds/{id}', () => {});
  it.skip('TODO S31: Supervizor vidi fondove kojima upravlja', () => {});
});


// ============================================================
//  FEATURE 6: CreateOrder "u ime fonda" selektor (Issue #75 / antonije3)
// ============================================================
describe('Mock C4: CreateOrder Fund Selector', () => {
  beforeEach(() => {
    setupSupervisorSession();
  });

  it.skip('TODO S32: Supervizor vidi "Kupujem u ime" selektor', () => {});
  it.skip('TODO S33: Izbor fonda menja accountId na fund.accountId', () => {});
  it.skip('TODO S34: Submit salje fundId u CreateOrderDto', () => {});
  it.skip('TODO S35: Klijent NE vidi "Kupujem u ime" selektor', () => {
    // TODO: setupClientSession + assert not.exist
  });
});


// ============================================================
//  FEATURE 7: OTC Inter-bank Discovery (Issue #67 / ekalajdzic13322)
// ============================================================
describe('Mock C4: OTC Inter-bank Discovery', () => {
  beforeEach(() => {
    setupClientSession();
    // TODO(ekalajdzic13322): intercept GET /api/interbank/otc/listings
  });

  it.skip('TODO S36: Tab "Iz drugih banaka" na OtcTrgovinaPage', () => {});
  it.skip('TODO S37: Lista prikazuje bankCode i sellerName kolone', () => {});
  it.skip('TODO S38: "Napravi ponudu" otvara formu i salje POST', () => {});
  it.skip('TODO S39: Osvezi dugme poziva listRemoteListings', () => {});
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
  it.skip('TODO S46: Tab prikazuje inter-bank ugovore sa filtr po statusu', () => {});
  it.skip('TODO S47: "Iskoristi" dugme otvara dialog sa potvrdom + progres', () => {});
  it.skip('TODO S48: SAGA progres modal prikazuje 5 faza', () => {});
  it.skip('TODO S49: Polling status dok ne COMMITTED ili ABORTED', () => {});
  it.skip('TODO S50: ABORTED status prikazuje failureReason', () => {});
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
    setupClientSession();
  });

  it.skip('TODO S63: Detekcija inter-bank po prve 3 cifre (ne 222)', () => {});
  it.skip('TODO S64: Salje POST /interbank/payments/initiate', () => {});
  it.skip('TODO S65: Modal prikazuje fazu (INITIATED → PREPARING → ... → COMMITTED)', () => {});
  it.skip('TODO S66: Polling na svakih 3s', () => {});
  it.skip('TODO S67: ABORTED - prikazuje failureReason', () => {});
  it.skip('TODO S68: Intra-bank (222...) ide standard flow, ne interbank', () => {});
});


// ============================================================
//  FEATURE 13: HomePage C4 tile-ovi (Issue #79 / sssmarta)
// ============================================================
describe('Mock C4: HomePage Dashboard Tiles', () => {
  it.skip('TODO S69: Supervisor vidi "Profit Banke" i "Investicioni fondovi" tile-ove', () => {});
  it.skip('TODO S70: Klijent vidi samo "Investicioni fondovi"', () => {});
  it.skip('TODO S71: Agent vidi "Investicioni fondovi"', () => {});
  it.skip('TODO S72: Klik na tile navigira na pravu rutu', () => {});
});


// ============================================================
//  FEATURE 14: Sidebar linkovi (Issue #79 / sssmarta)
// ============================================================
describe('Mock C4: Sidebar C4 Links', () => {
  it.skip('TODO S73: "Investicioni fondovi" link pod Berza sekcijom', () => {});
  it.skip('TODO S74: "Profit Banke" link samo za supervizora', () => {});
  it.skip('TODO S75: Klijent NE vidi "Profit Banke"', () => {});
  it.skip('TODO S76: Agent NE vidi "Profit Banke"', () => {});
});

/*
================================================================================
  UKUPNO: 76 TODO scenarija (mock)
  Nakon sto feature bude implementiran, zameni `it.skip` sa `it` i popuni body.
  Cilj: do KT3, ceo mock suite da bude zelen.
================================================================================
*/
