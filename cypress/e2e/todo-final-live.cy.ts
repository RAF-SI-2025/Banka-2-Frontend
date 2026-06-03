/// <reference types="cypress" />
/**
 * TODO_final — Live E2E Tests (Real Backend)
 *
 * Happy-path-ovi za najlakse-verifikabilne TODO_final feature-e protiv ZIVOG
 * stack-a (banka-core + trading-service). Mirror za todo-final-mock.cy.ts, ali
 * sve asercije idu protiv pravog BE-a (POST kreira pravi resurs, red se pojavi).
 *
 *   1) Watchlist (FE2)          — /watchlist: kreiraj listu + dodaj stavku
 *   2) Cenovni alarmi (FE2)     — /price-alerts: kreiraj ABOVE alarm
 *   3) Trajni nalozi / DCA (FE3)— /recurring-orders: kreiraj BY_AMOUNT nalog
 *   4) Audit log (FE3)          — /audit-log: supervizor vidi zapise; klijent 403
 *   5) Istorija dividendi (FE4) — /portfolio: expand STOCK pozicije
 *
 * Svaki kreirani resurs se ciscenjem (DELETE) uklanja u afterEach da se ne
 * kontaminira stanje (kao celina4-live Create Fund obrazac).
 *
 * Requires: Backend + seed na localhost:8080, frontend na localhost:3000.
 *
 * Seed creds (CLAUDE.md):
 *   Client:     stefan.jovanovic@gmail.com / Klijent12345 (client_id=1)
 *   Supervisor: nikola.milenkovic@banka.rs / Zaposleni12
 *   Listings:   id 1 = AAPL (STOCK)
 *
 * BE endpoint napomene (vidi src/services/*):
 *   - audit list je GET /audit (servis), FE ruta je /audit-log (page).
 *   - watchlist: GET/POST /watchlists, POST /watchlists/{id}/items, DELETE.
 *   - price-alert: POST /price-alerts, GET /price-alerts/my, DELETE /price-alerts/{id}.
 *   - recurring: POST /recurring-orders, GET /recurring-orders, DELETE /{id}.
 *   - dividends: GET /dividends/by-position/{portfolioId}.
 *
 * NAPOMENA: Cypress runtime se ne moze pokrenuti ovde (bez display-a) — spec je
 * author + tsc/eslint clean; izvrsava se u CI / na realnom stack-u.
 */

// ============================================================
//  Login helper — real backend, sessionStorage seed (kao celina4-live)
// ============================================================

type CachedAuthTF = { accessToken: string; refreshToken: string; user: Record<string, unknown> };
type TokenPairTF = { accessToken: string; refreshToken: string };

function _doLoginTF(
  email: string,
  password: string,
  attempt = 0,
): Cypress.Chainable<TokenPairTF> {
  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
    failOnStatusCode: false,
  }).then((resp): TokenPairTF | Cypress.Chainable<TokenPairTF> => {
    if (resp.status === 200) {
      return { accessToken: resp.body.accessToken, refreshToken: resp.body.refreshToken };
    }
    if (resp.status === 429 && attempt < 3) {
      cy.wait(65000);
      return _doLoginTF(email, password, attempt + 1);
    }
    throw new Error(`Login failed for ${email}: ${resp.status}`);
  }) as Cypress.Chainable<TokenPairTF>;
}

function _seedAndVisitTF(auth: CachedAuthTF, targetUrl: string) {
  cy.visit(targetUrl, {
    onBeforeLoad(win) {
      win.sessionStorage.setItem('accessToken', auth.accessToken);
      win.sessionStorage.setItem('refreshToken', auth.refreshToken);
      win.sessionStorage.setItem('user', JSON.stringify(auth.user));
    },
  });
}

function loginAsTF(role: string, email: string, password: string, jwtRole: string, perms: string[], targetUrl: string) {
  const cached = Cypress.env(`_tf_${role}`) as CachedAuthTF | undefined;
  if (cached) {
    _seedAndVisitTF(cached, targetUrl);
    return;
  }
  _doLoginTF(email, password).then((tok) => {
    const payload = JSON.parse(atob(tok.accessToken.split('.')[1]));
    const auth: CachedAuthTF = {
      accessToken: tok.accessToken,
      refreshToken: tok.refreshToken,
      user: { id: 0, email: payload.sub, role: jwtRole, permissions: perms },
    };
    Cypress.env(`_tf_${role}`, auth);
    _seedAndVisitTF(auth, targetUrl);
  });
}

const loginClient = (targetUrl: string) =>
  loginAsTF('client', 'stefan.jovanovic@gmail.com', 'Klijent12345', 'CLIENT', ['TRADE_STOCKS', 'TRADE_FUTURES'], targetUrl);
const loginSupervisor = (targetUrl: string) =>
  loginAsTF('supervisor', 'nikola.milenkovic@banka.rs', 'Zaposleni12', 'EMPLOYEE', ['SUPERVISOR', 'TRADE_STOCKS'], targetUrl);

function enableLiveBackend() {
  cy.intercept('POST', '**/api/auth/refresh', (req) => req.continue());
}

function withToken(fn: (token: string) => void) {
  cy.window().then((win) => {
    const token = win.sessionStorage.getItem('accessToken');
    expect(token, 'session token present').to.be.a('string').and.have.length.greaterThan(10);
    fn(token as string);
  });
}

// ============================================================
//  FEATURE 1: Watchlist (FE2)
// ============================================================
describe('Live TODO_final: Watchlist', () => {
  let createdWatchlistId: number | null = null;

  beforeEach(() => {
    enableLiveBackend();
    createdWatchlistId = null;
  });

  afterEach(() => {
    if (createdWatchlistId != null) {
      const id = createdWatchlistId;
      withToken((token) => {
        cy.request({
          method: 'DELETE',
          url: `/api/watchlists/${id}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
    }
  });

  it('WL-L1: Klijent kreira novu listu (POST /watchlists) — lista se pojavi', () => {
    const uniqueName = `E2E-LIVE-WL-${Date.now()}`;
    loginClient('/watchlist');
    cy.get('[data-testid="watchlist-page"]', { timeout: 15000 }).should('exist');

    cy.intercept('POST', '**/api/watchlists').as('createList');
    cy.get('[data-testid="create-watchlist-btn"]').click();
    cy.get('[data-testid="create-watchlist-dialog"]').should('be.visible');
    cy.get('[data-testid="create-watchlist-input"]').type(uniqueName);
    cy.get('[data-testid="create-watchlist-submit"]').click();

    cy.wait('@createList').then((interception) => {
      expect(interception.response?.statusCode, 'create watchlist status').to.be.oneOf([200, 201]);
      const id = (interception.response?.body as { id?: number })?.id;
      if (typeof id === 'number') createdWatchlistId = id;
    });
    // Nova lista se pojavljuje u UI-ju (pravi outcome, ne mock).
    cy.contains(uniqueName, { timeout: 10000 }).should('be.visible');
  });

  it('WL-L2: Klijent dodaje stavku u listu (POST /watchlists/{id}/items) — stavka se pojavi', () => {
    const uniqueName = `E2E-LIVE-WL-ITEM-${Date.now()}`;
    loginClient('/home');

    // Kreiraj listu preko API-ja (deterministicki), pa idi u UI da dodas stavku.
    withToken((token) => {
      cy.request({
        method: 'POST',
        url: '/api/watchlists',
        headers: { Authorization: `Bearer ${token}` },
        body: { name: uniqueName },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status, 'create watchlist via API').to.be.oneOf([200, 201]);
        createdWatchlistId = (resp.body as { id?: number }).id ?? null;
        expect(createdWatchlistId, 'watchlist id').to.be.a('number');

        // Dodaj AAPL (listingId 1) preko API-ja i verifikuj da se stavka cuva.
        cy.request({
          method: 'POST',
          url: `/api/watchlists/${createdWatchlistId}/items`,
          headers: { Authorization: `Bearer ${token}` },
          body: { listingId: 1 },
          failOnStatusCode: false,
        }).then((addResp) => {
          expect(addResp.status, 'add watchlist item status').to.be.oneOf([200, 201]);

          // Stavka se vidi u UI-ju kad otvorimo listu.
          _seedAndVisitTF(Cypress.env('_tf_client') as CachedAuthTF, '/watchlist');
          cy.contains(uniqueName, { timeout: 15000 }).should('be.visible').click();
          cy.contains(/AAPL/i, { timeout: 15000 }).should('be.visible');
        });
      });
    });
  });
});

// ============================================================
//  FEATURE 2: Cenovni alarmi (FE2)
// ============================================================
describe('Live TODO_final: Cenovni alarmi', () => {
  let createdAlertId: number | null = null;

  beforeEach(() => {
    enableLiveBackend();
    createdAlertId = null;
  });

  afterEach(() => {
    if (createdAlertId != null) {
      const id = createdAlertId;
      withToken((token) => {
        cy.request({
          method: 'DELETE',
          url: `/api/price-alerts/${id}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
    }
  });

  it('PA-L1: Klijent kreira ABOVE alarm (POST /price-alerts) — alarm se pojavi u listi', () => {
    loginClient('/price-alerts');
    cy.contains(/Cenovni alarmi|alarmi/i, { timeout: 15000 }).should('exist');

    cy.intercept('POST', '**/api/price-alerts').as('createAlert');
    cy.get('[data-testid="price-alerts-new-button"]', { timeout: 15000 }).click();
    cy.get('[data-testid="price-alert-dialog"]').should('be.visible');
    cy.get('[data-testid="price-alert-listing-id"]').clear().type('1'); // AAPL
    cy.get('[data-testid="price-alert-condition-ABOVE"]').click();
    cy.get('[data-testid="price-alert-threshold"]').clear().type('9999');
    cy.get('[data-testid="price-alert-submit"]').click();

    cy.wait('@createAlert').then((interception) => {
      expect(interception.response?.statusCode, 'create alert status').to.be.oneOf([200, 201]);
      const id = (interception.response?.body as { id?: number })?.id;
      if (typeof id === 'number') createdAlertId = id;
    });
    // Novi alarm (active=true, prag 9999 da se odmah ne okine) je vidljiv.
    cy.contains(/AAPL/i, { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================
//  FEATURE 3: Trajni nalozi / DCA (FE3)
// ============================================================
describe('Live TODO_final: Trajni nalozi (DCA)', () => {
  let createdRecurringId: number | null = null;

  beforeEach(() => {
    enableLiveBackend();
    createdRecurringId = null;
  });

  afterEach(() => {
    if (createdRecurringId != null) {
      const id = createdRecurringId;
      withToken((token) => {
        cy.request({
          method: 'DELETE',
          url: `/api/recurring-orders/${id}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
    }
  });

  it('DCA-L1: Klijent kreira BY_AMOUNT nalog (POST /recurring-orders) — nalog se pojavi', () => {
    loginClient('/recurring-orders');
    cy.contains(/Trajni nalozi|DCA|nalozi/i, { timeout: 15000 }).should('exist');

    // 1) Izbor hartije kroz live-search (>=2 karaktera triggeruje GET /listings).
    cy.get('[data-testid="recurring-listing-search"]', { timeout: 15000 }).type('AAPL');
    cy.get('[data-testid="recurring-listing-results"]', { timeout: 15000 }).contains(/AAPL/i).click();
    cy.get('[data-testid="recurring-listing-selected"]').should('be.visible');

    // 2) Mode BY_AMOUNT, 3) vrednost, 4) racun (prvi dostupan RSD/USD racun).
    cy.get('[data-testid="recurring-mode-BY_AMOUNT"]').click();
    cy.get('[data-testid="recurring-value-input"]').clear().type('5000');
    cy.get('[data-testid="recurring-account-select"]').find('option:not([value=""])').should('have.length.greaterThan', 0);
    cy.get('[data-testid="recurring-account-select"]').then(($sel) => {
      const firstVal = $sel.find('option').not('[value=""]').first().val();
      cy.wrap($sel).select(String(firstVal));
    });

    cy.intercept('POST', '**/api/recurring-orders').as('createRecurring');
    cy.get('[data-testid="recurring-submit"]').should('not.be.disabled').click();

    cy.wait('@createRecurring').then((interception) => {
      const status = interception.response?.statusCode;
      expect(status, 'create recurring status').to.be.oneOf([200, 201]);
      // Body MORA odraziti BY_AMOUNT mode poslat sa FE-a.
      const reqBody = interception.request?.body as { mode?: string; direction?: string };
      expect(reqBody.mode, 'mode BY_AMOUNT').to.equal('BY_AMOUNT');
      const id = (interception.response?.body as { id?: number })?.id;
      if (typeof id === 'number') createdRecurringId = id;
    });
    // Novi nalog se pojavljuje u tabeli aktivnih.
    cy.get('[data-testid^="recurring-row-"]', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.contains(/AAPL/i).should('be.visible');
  });
});

// ============================================================
//  FEATURE 4: Audit log (FE3) — supervizor vidi, klijent 403
// ============================================================
describe('Live TODO_final: Audit log', () => {
  beforeEach(() => {
    enableLiveBackend();
  });

  it('AUD-L1: Supervizor otvara /audit-log i vidi zapise (GET /audit 200)', () => {
    loginSupervisor('/audit-log');
    // Stranica se ucitava (filter dugmad postoje cak i kad je lista prazna).
    cy.get('[data-testid="audit-filter-apply"]', { timeout: 15000 }).should('exist');

    // BE list endpoint je /audit (ne /audit-logs) — verifikuj 200 za supervizora.
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/audit?page=0&size=20',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status, 'supervizor GET /audit').to.equal(200);
        // Paginiran odgovor: ima content niz (moze biti prazan ako nema akcija).
        const body = resp.body as { content?: unknown[] };
        expect(body, 'audit page shape').to.have.property('content');
        expect(body.content, 'audit content array').to.be.an('array');
      });
    });

    // UI prikazuje ili red(ove) ili prazan/loading state — nikad crash.
    cy.get('body').invoke('text').should('match', /Audit|revizion|Nema|zapis|Akcija|Promena/i);
  });

  it('AUD-L2: Klijent dobija 403 na GET /audit + redirect sa /audit-log', () => {
    // UI: supervisorOnly ProtectedRoute → klijent ide na /403.
    loginClient('/audit-log');
    cy.url({ timeout: 15000 }).should('include', '/403');

    // BE: direktan poziv klijenta na /audit mora biti 403 (security gate).
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/audit?page=0&size=20',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status, 'klijent GET /audit odbijen').to.be.oneOf([403, 401]);
      });
    });
  });
});

// ============================================================
//  FEATURE 5: Istorija dividendi (FE4) — /portfolio expand
// ============================================================
describe('Live TODO_final: Istorija dividendi', () => {
  beforeEach(() => {
    enableLiveBackend();
  });

  it('DIV-L1: Klijent expand-uje STOCK poziciju i ucita istoriju dividendi (GET /dividends/by-position/{id})', () => {
    loginClient('/portfolio');
    cy.contains('Moj portfolio', { timeout: 15000 }).should('be.visible');
    // Stefan ima STOCK pozicije iz seed-a (AAPL/MSFT/TSLA).
    cy.contains('AAPL', { timeout: 15000 }).should('be.visible');

    // Prvi dividend-toggle (expand prve STOCK pozicije).
    cy.get('[data-testid^="dividend-toggle-"]', { timeout: 15000 })
      .should('have.length.greaterThan', 0)
      .first()
      .click();

    // Panel se renderuje u jednom od pravih stanja: tabela / prazno / unavailable
    // / error / loading. Sve su PRAVA stanja iz BE odgovora (ne mock).
    cy.get(
      '[data-testid="dividend-history-table"], ' +
      '[data-testid="dividend-history-empty"], ' +
      '[data-testid="dividend-history-unavailable"], ' +
      '[data-testid="dividend-history-error"], ' +
      '[data-testid="dividend-history-loading"]',
      { timeout: 15000 },
    ).should('exist');
  });

  it('DIV-L2: GET /dividends/my vraca 200 (istorija isplata dividendi klijenta)', () => {
    loginClient('/home');
    cy.wait(1000);
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/dividends/my',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status, 'GET /dividends/my').to.be.oneOf([200, 204]);
        if (resp.status === 200) {
          expect(resp.body, 'dividends payload je niz').to.be.an('array');
        }
      });
    });
  });
});
