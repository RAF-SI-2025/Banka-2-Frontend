/**
 * TODO_final — Mock E2E Tests
 *
 * Pokriva TODO_final nadogradnje (Zadaci_Frontend.pdf FE1-FE4) koje do sada
 * NISU imale Cypress coverage:
 *   1. Watchlist (FE2)            — /watchlist
 *   2. Cenovni alarmi (FE2)       — /price-alerts
 *   3. Trajni nalozi / DCA (FE3)  — /recurring-orders
 *   4. Audit log (FE3)            — /audit-log
 *   5. In-app notifikacije (FE1)  — /notifications + NotificationBell
 *   6. TOTP verifikacija          — VerificationModal kroz /payments/new
 *   7. MyOrders filteri           — /orders/my GET query parametri
 *
 * Svi API pozivi su mock-ovani sa cy.intercept() — ne zahteva backend.
 * Stil i konvencije prate cypress/e2e/celina3-mock.cy.ts i celina4-mock.cy.ts:
 *   - login kroz setupXxxSession iz support/commands.ts (onBeforeLoad)
 *   - mock-spec naziv (`-mock.cy`) aktivira /api/** catch-all fallback u
 *     support/e2e.ts (sprecava 401 -> /login redirect za nemock-ovane pozive)
 *   - asertujemo STVARNO ponasanje (intercept body / UI render), ne trivijalnosti
 *
 * NAPOMENA o scheduler-driven efektima: okidanje cenovnog alarma, cron izvrsenje
 * trajnog naloga i isplata dividende su BE-scheduled (nisu FE-observable). Ovde
 * pokrivamo samo UI create / list / state-toggle delove.
 */

import {
  setupClientSession,
  setupSupervisorSession,
  setupAdminSession,
} from '../support/commands';

// ============================================================
//  MOCK DATA
// ============================================================

const mockWatchlists = [
  { id: 1, ownerId: 1, ownerType: 'CLIENT', name: 'Tehnoloske akcije', createdAt: '2026-05-01T10:00:00Z', itemCount: 2 },
  { id: 2, ownerId: 1, ownerType: 'CLIENT', name: 'Energetika', createdAt: '2026-05-02T10:00:00Z', itemCount: 1 },
];

const mockWatchlistItems = [
  {
    id: 11, watchlistId: 1, listingId: 101, listingTicker: 'AAPL', listingName: 'Apple Inc.',
    listingType: 'STOCK', exchange: 'NASDAQ', currentPrice: 198.25, dailyChange: 2.1,
    dailyChangePercent: 1.07, volume: 1200000, currency: 'USD', addedAt: '2026-05-01T11:00:00Z',
  },
  {
    id: 12, watchlistId: 1, listingId: 102, listingTicker: 'EUR/USD', listingName: 'Euro / US Dollar',
    listingType: 'FOREX', exchange: 'FOREX', currentPrice: 1.085, dailyChange: -0.001,
    dailyChangePercent: -0.09, volume: 9000000, currency: 'USD', addedAt: '2026-05-01T12:00:00Z',
  },
];

const mockPriceAlerts = [
  {
    id: 201, listingId: 101, listingTicker: 'AAPL', listingType: 'STOCK', condition: 'ABOVE',
    threshold: 210, active: true, createdAt: '2026-05-01T10:00:00Z', triggeredAt: null,
    currency: 'USD', currentPrice: 198.25,
  },
  {
    id: 202, listingId: 102, listingTicker: 'MSFT', listingType: 'STOCK', condition: 'BELOW',
    threshold: 380, active: false, createdAt: '2026-04-20T10:00:00Z',
    triggeredAt: '2026-04-25T08:00:00Z', currency: 'USD', currentPrice: 410,
  },
];

const mockRecurringOrders = [
  {
    id: 301, ownerId: 1, ownerType: 'CLIENT', listingId: 101, listingTicker: 'AAPL', listingType: 'STOCK',
    direction: 'BUY', mode: 'BY_AMOUNT', value: 5000, currency: 'USD', accountId: 11,
    accountNumber: '265000000000000011', cadence: 'MONTHLY', nextRun: '2026-06-01T09:00:00Z',
    active: true, createdAt: '2026-05-01T10:00:00Z', lastRunAt: '2026-05-01T09:00:00Z',
  },
  {
    id: 302, ownerId: 1, ownerType: 'CLIENT', listingId: 102, listingTicker: 'MSFT', listingType: 'STOCK',
    direction: 'BUY', mode: 'BY_QUANTITY', value: 3, currency: 'USD', accountId: 11,
    accountNumber: '265000000000000011', cadence: 'WEEKLY', nextRun: '2026-05-08T09:00:00Z',
    active: false, createdAt: '2026-04-15T10:00:00Z', lastRunAt: null,
  },
];

const mockMyAccounts = [
  {
    id: 11, accountNumber: '265000000000000011', name: 'Glavni RSD', accountType: 'CHECKING',
    currency: 'RSD', balance: 100000, availableBalance: 100000, status: 'ACTIVE',
  },
];

const mockListingsStockPage = {
  content: [
    { id: 101, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 198.25, ask: 198.5, bid: 198.0, contractSize: 1 },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 8,
};

const mockAuditPage = {
  content: [
    {
      id: 401, actionType: 'LIMIT_CHANGED', actorId: 5, actorEmail: 'nikola.supervisor@banka.rs',
      actorName: 'Nikola Jokic', targetType: 'ACTUARY', targetId: 10, oldValue: '100000',
      newValue: '150000', metadata: null, createdAt: '2026-05-10T12:00:00Z',
    },
    {
      id: 402, actionType: 'ORDER_APPROVED', actorId: 5, actorEmail: 'nikola.supervisor@banka.rs',
      actorName: 'Nikola Jokic', targetType: 'ORDER', targetId: 99, oldValue: 'PENDING',
      newValue: 'APPROVED', metadata: null, createdAt: '2026-05-10T13:00:00Z',
    },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 20,
};

const mockNotificationsPage = {
  content: [
    {
      id: 501, type: 'PAYMENT_RECEIVED', title: 'Primljena uplata 5.000 RSD',
      message: 'Stiglo je 5.000 RSD od Marko Petrovic', read: false,
      createdAt: '2026-05-12T09:00:00Z', relatedEntityType: 'PAYMENT',
    },
    {
      id: 502, type: 'ORDER_FILLED', title: 'Order izvrsen: AAPL', message: 'Vas BUY order za 10x AAPL je izvrsen',
      read: true, createdAt: '2026-05-11T15:00:00Z', relatedEntityType: 'ORDER', relatedEntityId: 99,
    },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 20,
};

const mockOrdersPage = {
  content: [
    {
      id: 601, listingId: 101, userName: 'Stefan Jovanovic', userRole: 'CLIENT',
      listingTicker: 'AAPL', listingName: 'Apple Inc.', listingType: 'STOCK',
      orderType: 'MARKET', quantity: 10, contractSize: 1, pricePerUnit: 198.25,
      direction: 'BUY', status: 'PENDING', approvedBy: '', isDone: false,
      remainingPortions: 10, afterHours: false, allOrNone: false, margin: false,
      approximatePrice: 1982.5, createdAt: '2026-05-12T10:00:00Z', lastModification: '2026-05-12T10:00:00Z',
    },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 10,
};

// ============================================================
//  FEATURE 1: Watchlist (FE2) — /watchlist
// ============================================================

describe('TODO_final: Watchlist', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/watchlists', { statusCode: 200, body: mockWatchlists }).as('lists');
    cy.intercept('GET', '**/api/watchlists/1/items', { statusCode: 200, body: mockWatchlistItems }).as('items1');
    cy.intercept('GET', '**/api/watchlists/2/items', { statusCode: 200, body: [mockWatchlistItems[0]] }).as('items2');
  });

  it('WL1: Klijent vidi svoje liste i stavke prve liste', () => {
    cy.visit('/watchlist', { onBeforeLoad: setupClientSession });
    cy.wait('@lists');
    cy.wait('@items1');
    cy.contains('Tehnoloske akcije').should('be.visible');
    cy.contains('Energetika').should('be.visible');
    cy.get('[data-testid="watchlist-item-row-11"]').should('exist');
    cy.contains('AAPL').should('be.visible');
  });

  it('WL2: Kreiranje nove liste salje POST /watchlists sa {name}', () => {
    cy.intercept('POST', '**/api/watchlists', (req) => {
      expect(req.body).to.deep.equal({ name: 'Dividendni fokus' });
      req.reply({
        statusCode: 201,
        body: { id: 3, ownerId: 1, ownerType: 'CLIENT', name: 'Dividendni fokus', createdAt: '2026-05-13T10:00:00Z', itemCount: 0 },
      });
    }).as('createList');

    cy.visit('/watchlist', { onBeforeLoad: setupClientSession });
    cy.wait('@lists');
    cy.get('[data-testid="create-watchlist-btn"]').click();
    cy.get('[data-testid="create-watchlist-dialog"]').should('be.visible');
    cy.get('[data-testid="create-watchlist-input"]').type('Dividendni fokus');
    cy.get('[data-testid="create-watchlist-submit"]').click();
    cy.wait('@createList');
    cy.contains('Dividendni fokus').should('be.visible');
  });

  it('WL3: Uklanjanje stavke salje DELETE /watchlists/{id}/items/{itemId}', () => {
    cy.intercept('DELETE', '**/api/watchlists/1/items/11', { statusCode: 204 }).as('removeItem');

    cy.visit('/watchlist', { onBeforeLoad: setupClientSession });
    cy.wait('@items1');
    cy.get('[data-testid="remove-item-11"]').click();
    cy.wait('@removeItem');
    cy.get('[data-testid="watchlist-item-row-11"]').should('not.exist');
  });

  it('WL4: Multi-list — klik na drugu listu ucitava njene stavke', () => {
    cy.visit('/watchlist', { onBeforeLoad: setupClientSession });
    cy.wait('@items1');
    cy.get('[data-testid="watchlist-card-2"]').click();
    cy.wait('@items2');
    cy.contains('Energetika').should('be.visible');
    cy.get('[data-testid="watchlist-item-row-11"]').should('exist');
    cy.get('[data-testid="watchlist-item-row-12"]').should('not.exist'); // FOREX nije u listi 2
  });

  it('WL5: Filter po tipu (FOREX) skriva STOCK stavke (client-side filter)', () => {
    cy.visit('/watchlist', { onBeforeLoad: setupClientSession });
    cy.wait('@items1');
    cy.get('[data-testid="watchlist-filter-forex"]').click();
    cy.get('[data-testid="watchlist-item-row-12"]').should('exist'); // EUR/USD ostaje
    cy.get('[data-testid="watchlist-item-row-11"]').should('not.exist'); // AAPL skriven
  });

  it('WL6: AddToWatchlistButton dodaje hartiju (POST /watchlists/{id}/items {listingId})', () => {
    // Header/securities quick-access widget — dropdown dugme za dodavanje hartije.
    // Mount-ujemo ga na securities listi (gde se koristi variant="icon").
    cy.intercept('POST', '**/api/watchlists/1/items', (req) => {
      expect(req.body).to.deep.equal({ listingId: 101 });
      req.reply({
        statusCode: 201,
        body: { id: 13, watchlistId: 1, listingId: 101, listingTicker: 'AAPL', listingType: 'STOCK', addedAt: '2026-05-13T10:00:00Z' },
      });
    }).as('addItem');
    cy.intercept('GET', '**/api/listings*', {
      statusCode: 200,
      body: {
        content: [{ id: 101, ticker: 'AAPL', name: 'Apple Inc.', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 198.25, ask: 198.5, bid: 198.0, changePercent: 1.07, contractSize: 1 }],
        totalElements: 1, totalPages: 1, number: 0, size: 20,
      },
    });

    cy.visit('/securities', { onBeforeLoad: setupClientSession });
    // Dropdown trigger za AAPL (listingId=101) — data-testid="add-to-watchlist-101"
    cy.get('[data-testid="add-to-watchlist-101"]', { timeout: 10000 }).click({ force: true });
    cy.wait('@lists');
    cy.get('[data-testid="watchlist-option-1"]').click({ force: true });
    cy.wait('@addItem');
  });
});

// ============================================================
//  FEATURE 2: Cenovni alarmi (FE2) — /price-alerts
// ============================================================

describe('TODO_final: Cenovni alarmi', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/price-alerts/my*', { statusCode: 200, body: mockPriceAlerts }).as('myAlerts');
  });

  it('PA1: Lista prikazuje aktivne alarme (default tab "Aktivni")', () => {
    cy.visit('/price-alerts', { onBeforeLoad: setupClientSession });
    cy.wait('@myAlerts');
    cy.get('[data-testid="price-alert-row-201"]').should('exist'); // active=true
    cy.contains('AAPL').should('be.visible');
    cy.contains('Iznad praga').should('be.visible');
  });

  it('PA2: Kreiranje ABOVE alarma salje POST /price-alerts {listingId, condition, threshold}', () => {
    cy.intercept('POST', '**/api/price-alerts', (req) => {
      expect(req.body).to.deep.equal({ listingId: 101, condition: 'ABOVE', threshold: 250 });
      req.reply({
        statusCode: 201,
        body: { id: 203, listingId: 101, listingTicker: 'AAPL', listingType: 'STOCK', condition: 'ABOVE', threshold: 250, active: true, createdAt: '2026-05-13T10:00:00Z', triggeredAt: null },
      });
    }).as('createAbove');

    cy.visit('/price-alerts', { onBeforeLoad: setupClientSession });
    cy.wait('@myAlerts');
    cy.get('[data-testid="price-alerts-new-button"]').click();
    cy.get('[data-testid="price-alert-dialog"]').should('be.visible');
    // Bez initialListing-a, listingId polje je vidljivo (manuelni unos)
    cy.get('[data-testid="price-alert-listing-id"]').type('101');
    cy.get('[data-testid="price-alert-condition-ABOVE"]').click();
    cy.get('[data-testid="price-alert-threshold"]').type('250');
    cy.get('[data-testid="price-alert-submit"]').click();
    cy.wait('@createAbove');
  });

  it('PA3: Kreiranje BELOW alarma salje condition=BELOW u body-ju', () => {
    cy.intercept('POST', '**/api/price-alerts', (req) => {
      expect(req.body).to.deep.equal({ listingId: 102, condition: 'BELOW', threshold: 150 });
      req.reply({
        statusCode: 201,
        body: { id: 204, listingId: 102, listingTicker: 'MSFT', listingType: 'STOCK', condition: 'BELOW', threshold: 150, active: true, createdAt: '2026-05-13T10:00:00Z', triggeredAt: null },
      });
    }).as('createBelow');

    cy.visit('/price-alerts', { onBeforeLoad: setupClientSession });
    cy.wait('@myAlerts');
    cy.get('[data-testid="price-alerts-new-button"]').click();
    cy.get('[data-testid="price-alert-listing-id"]').type('102');
    cy.get('[data-testid="price-alert-condition-BELOW"]').click();
    cy.get('[data-testid="price-alert-threshold"]').type('150');
    cy.get('[data-testid="price-alert-submit"]').click();
    cy.wait('@createBelow');
  });

  it('PA4: Tab "Istorija" prikazuje okidnute (active=false) alarme', () => {
    cy.visit('/price-alerts', { onBeforeLoad: setupClientSession });
    cy.wait('@myAlerts');
    cy.get('[data-testid="price-alerts-filter-history"]').click();
    cy.get('[data-testid="price-alert-row-202"]').should('exist'); // okidnut
    cy.get('[data-testid="price-alert-row-201"]').should('not.exist'); // aktivan filtriran
    cy.contains('Okidnut').should('be.visible');
  });

  it('PA5: Brisanje alarma (window.confirm OK) salje DELETE /price-alerts/{id}', () => {
    cy.intercept('DELETE', '**/api/price-alerts/201', { statusCode: 204 }).as('deleteAlert');

    cy.visit('/price-alerts', { onBeforeLoad: setupClientSession });
    cy.wait('@myAlerts');
    cy.on('window:confirm', () => true); // potvrdi native confirm
    cy.get('[data-testid="price-alert-delete-201"]').click();
    cy.wait('@deleteAlert');
    cy.get('[data-testid="price-alert-row-201"]').should('not.exist');
  });

  // NAPOMENA: okidanje alarma kad cena dosegne prag je BE-scheduled (cron),
  // nije FE-observable — pokriveno BE testovima (PriceAlertService).
});

// ============================================================
//  FEATURE 3: Trajni nalozi / DCA (FE3) — /recurring-orders
// ============================================================

describe('TODO_final: Trajni nalozi (DCA)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/recurring-orders*', { statusCode: 200, body: mockRecurringOrders }).as('recurring');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockMyAccounts }).as('myAccounts');
    // listing live-search (listingService.getAll('STOCK', q, 0, 8))
    cy.intercept('GET', '**/api/listings*', { statusCode: 200, body: mockListingsStockPage }).as('listingSearch');
  });

  it('DCA1: Tab "Aktivni" prikazuje aktivni nalog (#301)', () => {
    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.get('[data-testid="recurring-row-301"]').should('exist');
    cy.contains('AAPL').should('be.visible');
    cy.contains('Aktivan').should('be.visible');
  });

  it('DCA2: Kreiranje BY_AMOUNT naloga salje POST /recurring-orders sa mode=BY_AMOUNT', () => {
    cy.intercept('POST', '**/api/recurring-orders', (req) => {
      expect(req.body.mode).to.equal('BY_AMOUNT');
      expect(req.body.direction).to.equal('BUY');
      expect(req.body.cadence).to.equal('MONTHLY');
      expect(req.body.listingId).to.equal(101);
      expect(req.body.accountId).to.equal(11);
      expect(req.body.value).to.equal(5000);
      req.reply({ statusCode: 201, body: { ...mockRecurringOrders[0], id: 303 } });
    }).as('createByAmount');

    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.wait('@myAccounts');

    // 1) Izbor hartije kroz autocomplete (>=2 karaktera triggeruje search)
    cy.get('[data-testid="recurring-listing-search"]').type('AAPL');
    cy.wait('@listingSearch');
    cy.get('[data-testid="recurring-listing-results"]').contains('AAPL').click();
    cy.get('[data-testid="recurring-listing-selected"]').should('be.visible');

    // 2) Mode = BY_AMOUNT (default), 3) vrednost, 4) racun
    cy.get('[data-testid="recurring-mode-BY_AMOUNT"]').click();
    cy.get('[data-testid="recurring-value-input"]').type('5000');
    cy.get('[data-testid="recurring-account-select"]').select('11');

    cy.get('[data-testid="recurring-submit"]').should('not.be.disabled').click();
    cy.wait('@createByAmount');
  });

  it('DCA3: Kreiranje BY_QUANTITY naloga salje mode=BY_QUANTITY', () => {
    cy.intercept('POST', '**/api/recurring-orders', (req) => {
      expect(req.body.mode).to.equal('BY_QUANTITY');
      expect(req.body.value).to.equal(3);
      expect(req.body.listingId).to.equal(101);
      req.reply({ statusCode: 201, body: { ...mockRecurringOrders[1], id: 304 } });
    }).as('createByQty');

    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.wait('@myAccounts');

    cy.get('[data-testid="recurring-listing-search"]').type('AAPL');
    cy.wait('@listingSearch');
    cy.get('[data-testid="recurring-listing-results"]').contains('AAPL').click();
    cy.get('[data-testid="recurring-mode-BY_QUANTITY"]').click();
    cy.get('[data-testid="recurring-value-input"]').type('3');
    cy.get('[data-testid="recurring-account-select"]').select('11');

    cy.get('[data-testid="recurring-submit"]').should('not.be.disabled').click();
    cy.wait('@createByQty');
  });

  it('DCA4: Pauza aktivnog naloga salje PATCH /recurring-orders/{id}/pause (Active=false)', () => {
    cy.intercept('PATCH', '**/api/recurring-orders/301/pause', {
      statusCode: 200, body: { ...mockRecurringOrders[0], active: false },
    }).as('pause');

    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.get('[data-testid="recurring-pause-301"]').click();
    cy.wait('@pause');
  });

  it('DCA5: Nastavi pauziranog naloga salje PATCH /recurring-orders/{id}/resume', () => {
    cy.intercept('PATCH', '**/api/recurring-orders/302/resume', {
      statusCode: 200, body: { ...mockRecurringOrders[1], active: true },
    }).as('resume');

    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.get('[data-testid="tab-paused"]').click(); // #302 je pauziran
    cy.get('[data-testid="recurring-resume-302"]').click();
    cy.wait('@resume');
  });

  it('DCA6: Otkazivanje (window.confirm OK) salje DELETE /recurring-orders/{id}', () => {
    cy.intercept('DELETE', '**/api/recurring-orders/301', { statusCode: 204 }).as('cancel');

    cy.visit('/recurring-orders', { onBeforeLoad: setupClientSession });
    cy.wait('@recurring');
    cy.on('window:confirm', () => true);
    cy.get('[data-testid="recurring-cancel-301"]').click();
    cy.wait('@cancel');
    cy.get('[data-testid="recurring-row-301"]').should('not.exist');
  });

  // NAPOMENA: stvarno cron izvrsenje naloga (kreiranje order-a u intervalu) je
  // BE-scheduled (RecurringOrderScheduler), nije FE-observable.
});

// ============================================================
//  FEATURE 4: Audit log (FE3) — /audit-log (supervisorOnly)
// ============================================================

describe('TODO_final: Audit log', () => {
  it('AUD1: Supervizor vidi audit zapise', () => {
    cy.intercept('GET', '**/api/audit-logs*', { statusCode: 200, body: mockAuditPage }).as('audit');
    cy.visit('/audit-log', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@audit');
    cy.get('[data-testid="audit-row-401"]').should('exist');
    cy.get('[data-testid="audit-row-402"]').should('exist');
    cy.contains('Promena limita').should('be.visible');
  });

  it('AUD2: Admin takodje ima pristup (supervisorOnly dozvoljava admina)', () => {
    cy.intercept('GET', '**/api/audit-logs*', { statusCode: 200, body: mockAuditPage }).as('audit');
    cy.visit('/audit-log', { onBeforeLoad: setupAdminSession });
    cy.wait('@audit');
    cy.get('[data-testid="audit-row-401"]').should('exist');
  });

  it('AUD3: Filter po tipu akcije + email salje query parametre na /audit-logs', () => {
    cy.intercept('GET', '**/api/audit-logs*', { statusCode: 200, body: mockAuditPage }).as('auditInit');
    cy.visit('/audit-log', { onBeforeLoad: setupSupervisorSession });
    cy.wait('@auditInit');

    // Sledeci poziv hvatamo posebnim alias-om da asertujemo query parametre
    cy.intercept('GET', '**/api/audit-logs*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('actionType')).to.equal('ORDER_APPROVED');
      expect(url.searchParams.get('actorEmail')).to.equal('nikola.supervisor@banka.rs');
      req.reply({ statusCode: 200, body: { ...mockAuditPage, content: [mockAuditPage.content[1]], totalElements: 1 } });
    }).as('auditFiltered');

    cy.get('[data-testid="audit-filter-action"]').select('ORDER_APPROVED');
    cy.get('[data-testid="audit-filter-actor"]').type('nikola.supervisor@banka.rs');
    cy.get('[data-testid="audit-filter-apply"]').click();
    cy.wait('@auditFiltered');
    cy.get('[data-testid="audit-row-402"]').should('exist');
  });

  it('AUD4: CLIENT pristup /audit-log je odbijen (redirect na /403)', () => {
    // supervisorOnly ProtectedRoute -> Navigate to /403 za klijenta (security gate)
    cy.intercept('GET', '**/api/audit-logs*', { statusCode: 200, body: mockAuditPage });
    cy.visit('/audit-log', { onBeforeLoad: setupClientSession });
    cy.url().should('include', '/403');
  });
});

// ============================================================
//  FEATURE 5: In-app notifikacije (FE1) — /notifications + Bell
// ============================================================

describe('TODO_final: In-app notifikacije', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/notifications/unread-count', { statusCode: 200, body: { count: 1 } }).as('unread');
    cy.intercept('GET', '**/api/notifications*', (req) => {
      // /notifications/unread-count se hvata gornjim, specificnijim intercept-om.
      // Ovaj hvata samo listu (GET /notifications?page=&size=).
      if (req.url.includes('/notifications/unread-count')) {
        req.reply({ statusCode: 200, body: { count: 1 } });
        return;
      }
      req.reply({ statusCode: 200, body: mockNotificationsPage });
    }).as('list');
  });

  it('NOTIF1: Stranica prikazuje notifikacije + neprocitani indikator', () => {
    cy.visit('/notifications', { onBeforeLoad: setupClientSession });
    cy.wait('@list');
    cy.get('[data-testid="notification-row-501"]').should('exist');
    cy.contains('Primljena uplata 5.000 RSD').should('be.visible');
    // 501 je read=false -> unread dot
    cy.get('[data-testid="unread-dot-501"]').should('exist');
  });

  it('NOTIF2: Bell u sidebar-u prikazuje badge sa brojem neprocitanih', () => {
    // NotificationBell se montira u MainLayout sidebar-u. Pokrecemo na drugoj
    // ruti (ne /notifications) da widget bude prisutan, pa cekamo unread-count.
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.wait('@unread');
    cy.get('[data-testid="notification-bell"]', { timeout: 10000 }).should('exist');
    cy.get('[data-testid="notification-badge"]').should('contain', '1');
  });

  it('NOTIF3: Filter "Neprocitane" salje read=false na GET /notifications', () => {
    cy.intercept('GET', '**/api/notifications*', (req) => {
      if (req.url.includes('/notifications/unread-count')) {
        req.reply({ statusCode: 200, body: { count: 1 } });
        return;
      }
      const url = new URL(req.url);
      if (url.searchParams.get('read') === 'false') {
        req.reply({ statusCode: 200, body: { ...mockNotificationsPage, content: [mockNotificationsPage.content[0]], totalElements: 1 } });
      } else {
        req.reply({ statusCode: 200, body: mockNotificationsPage });
      }
    }).as('listFiltered');

    cy.visit('/notifications', { onBeforeLoad: setupClientSession });
    cy.get('[data-testid="filter-unread"]').click();
    cy.wait('@listFiltered');
    cy.get('[data-testid="notification-row-501"]').should('exist');
  });
});

// ============================================================
//  FEATURE 6: TOTP verifikacija (VerificationModal) — /payments/new
// ============================================================

describe('TODO_final: TOTP verifikacija', () => {
  // VerificationModal se montira u NewPaymentPage. Da bismo ga otvorili,
  // popunjavamo minimalno validnu intra-bank uplatu (newPaymentSchema:
  // 18-cifren racun, iznos > 0, ime primaoca, paymentCode 2xx, svrha).
  const fillValidPaymentForm = () => {
    cy.get('#fromAccount', { timeout: 10000 }).select('222000000000000001');
    cy.get('#toAccount').clear().type('222000000000000999');
    cy.get('#recipientName').clear().type('Marko Petrovic');
    cy.get('#amount').clear().type('1000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').clear().type('Test uplata');
  };

  const setupPaymentMocks = () => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: [{ id: 1, accountNumber: '222000000000000001', name: 'Glavni', accountType: 'CHECKING', currency: 'RSD', balance: 50000, availableBalance: 50000, status: 'ACTIVE' }],
    }).as('accounts');
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    // OTP request + dev-otp lookup koje VerificationModal poziva pri open-u
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OK' } }).as('requestOtp');
    cy.intercept('GET', '**/api/payments/my-otp', { statusCode: 200, body: { active: true, code: '123456', attempts: 0, maxAttempts: 3 } }).as('myOtp');
  };

  const openOtpModal = () => {
    fillValidPaymentForm();
    cy.contains('button', 'Nastavi na verifikaciju').click();
    // Sc 12: confirm dialog pre OTP-a
    cy.get('[data-testid="payment-confirm-dialog"]').should('be.visible');
    cy.get('[data-testid="payment-confirm-submit"]').click();
  };

  it('TOTP1: Modal se otvara sa TOTP 30s prozorom posle confirm dialoga', () => {
    setupPaymentMocks();
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    openOtpModal();
    cy.wait('@requestOtp');
    cy.contains('Verifikacija (TOTP)').should('be.visible');
    cy.get('[data-testid="totp-window-progress"]').should('exist');
    cy.get('[data-testid="totp-window-seconds"]').should('contain', 'Novi kod za');
    cy.get('#otp').should('exist');
  });

  it('TOTP2: Validan kod uspesno potvrdjuje placanje (POST /payments)', () => {
    setupPaymentMocks();
    cy.intercept('POST', '**/api/payments', (req) => {
      expect(req.body.otpCode).to.equal('123456');
      req.reply({ statusCode: 200, body: { id: 700, status: 'COMPLETED' } });
    }).as('payOk');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    openOtpModal();
    cy.get('#otp').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@payOk');
    // Posle uspeha modal se zatvara (showVerification=false)
    cy.contains('Verifikacija (TOTP)').should('not.exist');
  });

  it('TOTP3: 3 pogresna pokusaja iscrpe pokusaje i otkazuju transakciju', () => {
    setupPaymentMocks();
    // BE odbija OTP sa 403 -> modal dekrementira "Preostalo pokusaja"
    cy.intercept('POST', '**/api/payments', {
      statusCode: 403,
      body: { error: 'Verifikacioni kod nije tacan.' },
    }).as('payReject');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    openOtpModal();

    // Pokusaj 1 (3 -> 2)
    cy.get('#otp').clear().type('000000');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@payReject');
    cy.contains('Verifikacioni kod nije tacan.').should('be.visible');
    cy.contains('Preostalo pokušaja').parent().should('contain', '2');

    // Pokusaj 2 (2 -> 1)
    cy.get('#otp').clear().type('111111');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@payReject');
    cy.contains('Preostalo pokušaja').parent().should('contain', '1');

    // Pokusaj 3 (1 -> 0) -> toast "Maksimalan broj pokusaja. Transakcija otkazana."
    cy.get('#otp').clear().type('222222');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@payReject');
    cy.contains('Maksimalan broj pokusaja').should('exist');
    // Modal se zatvara posle ~1.5s (setTimeout onClose)
    cy.contains('Verifikacija (TOTP)', { timeout: 8000 }).should('not.exist');
  });

  // NAPOMENA: stvarna RFC6238 TOTP validacija je BE (TotpService); FE samo
  // prikazuje 30s window indikator (FE-observable, pokriveno u TOTP1).
});

// ============================================================
//  FEATURE 7: MyOrders filteri — /orders/my GET query parametri
// ============================================================

describe('TODO_final: MyOrders filteri', () => {
  it('ORD1: Inicijalni GET /orders/my bez filtera (page/size)', () => {
    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('page')).to.equal('0');
      expect(url.searchParams.has('status')).to.equal(false);
      req.reply({ statusCode: 200, body: mockOrdersPage });
    }).as('ordersInit');

    cy.visit('/orders/my', { onBeforeLoad: setupClientSession });
    cy.wait('@ordersInit');
    cy.contains('AAPL').should('be.visible');
  });

  it('ORD2: Status filter salje status=PENDING na /orders/my', () => {
    cy.intercept('GET', '**/api/orders/my*', { statusCode: 200, body: mockOrdersPage }).as('ordersInit');
    cy.visit('/orders/my', { onBeforeLoad: setupClientSession });
    cy.wait('@ordersInit');

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('status')).to.equal('PENDING');
      req.reply({ statusCode: 200, body: mockOrdersPage });
    }).as('ordersStatus');

    cy.get('[data-testid="orders-status-filter"]').select('PENDING');
    cy.wait('@ordersStatus');
  });

  it('ORD3: Tip hartije filter salje listingType=STOCK', () => {
    cy.intercept('GET', '**/api/orders/my*', { statusCode: 200, body: mockOrdersPage }).as('ordersInit');
    cy.visit('/orders/my', { onBeforeLoad: setupClientSession });
    cy.wait('@ordersInit');

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('listingType')).to.equal('STOCK');
      req.reply({ statusCode: 200, body: mockOrdersPage });
    }).as('ordersType');

    cy.get('[data-testid="orders-listing-type-filter"]').select('STOCK');
    cy.wait('@ordersType');
  });

  it('ORD4: Datumski filteri salju dateFrom i dateTo', () => {
    cy.intercept('GET', '**/api/orders/my*', { statusCode: 200, body: mockOrdersPage }).as('ordersInit');
    cy.visit('/orders/my', { onBeforeLoad: setupClientSession });
    cy.wait('@ordersInit');

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('dateFrom')).to.equal('2026-05-01');
      req.reply({ statusCode: 200, body: mockOrdersPage });
    }).as('ordersFrom');
    cy.get('[data-testid="orders-date-from-filter"]').type('2026-05-01');
    cy.wait('@ordersFrom');

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('dateTo')).to.equal('2026-05-31');
      req.reply({ statusCode: 200, body: mockOrdersPage });
    }).as('ordersTo');
    cy.get('[data-testid="orders-date-to-filter"]').type('2026-05-31');
    cy.wait('@ordersTo');
  });
});
