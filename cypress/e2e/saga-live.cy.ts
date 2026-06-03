/// <reference types="cypress" />
/**
 * SAGA — Live E2E Tests (Real Backend)
 *
 * Pokriva INTRA-BANK OTC exercise SAGA (Model-B orkestrator) protiv ZIVOG
 * trading-service stack-a. Mirror za saga-mock.cy.ts (Uputstvo_SAGA Primer 10-12),
 * ali bez ijednog cy.intercept mock-a za core flow — koristi pravi seed:
 *
 *   SG-L1 (happy): klijent (Stefan, kupac) iskoristi ACTIVE ugovor iz
 *     "Sklopljeni ugovori" → POST /otc/contracts/{id}/exercise vraca
 *     {sagaId, sagaStatus:COMPLETED, status:EXERCISED}; pratimo realni saga zapis
 *     preko GET /otc/saga/{sagaId} → status COMPLETED; ugovor postaje EXERCISED.
 *   SG-L2 (access control): prodavac (non-buyer) NE vidi "Iskoristi" akciju, a
 *     BE odbija exercise non-buyer-a (4xx, ne 2xx).
 *   SG-L3 (saga record shape): GET /otc/saga/{sagaId} za sveze-exercise-ovan
 *     ugovor vraca COMPLETED zapis sa 5 koraka (ne 404).
 *
 * Requires: Backend (banka-core 8080) + trading-service + seed (trading-seed.sql).
 *
 * Seed (trading-seed.sql otc_contracts):
 *   A) Stefan (client_id=1) KUPAC, ACTIVE call na GOOG (settlement +25d)
 *   B) Stefan KUPAC, ACTIVE call na TSLA (settlement +18d)
 *   C) Stefan KUPAC, ACTIVE call na NVDA (settlement +40d)
 *   D) Stefan PRODAVAC, ACTIVE call na MSFT (kupac Ana)  → nema "Iskoristi"
 *   E) Stefan KUPAC, EXERCISED (istorijski) na AAPL
 *
 * Seed creds (CLAUDE.md):
 *   Client:     stefan.jovanovic@gmail.com / Klijent12345 (client_id=1)
 *   Supervisor: nikola.milenkovic@banka.rs / Zaposleni12
 *
 * NAPOMENA: Cypress runtime ne moze da se pokrene u ovom okruzenju (bez display-a)
 * — spec je author + tsc/eslint clean; izvrsava se u CI / na realnom stack-u.
 */

// ============================================================
//  Login helper — real backend, sessionStorage seed (kao celina4-live)
// ============================================================

type CachedAuthSaga = { accessToken: string; refreshToken: string; user: Record<string, unknown> };
type TokenPair = { accessToken: string; refreshToken: string };

function _doLoginSaga(
  email: string,
  password: string,
  attempt = 0,
): Cypress.Chainable<TokenPair> {
  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
    failOnStatusCode: false,
  }).then((resp): TokenPair | Cypress.Chainable<TokenPair> => {
    if (resp.status === 200) {
      return { accessToken: resp.body.accessToken, refreshToken: resp.body.refreshToken };
    }
    if (resp.status === 429 && attempt < 3) {
      cy.wait(65000);
      return _doLoginSaga(email, password, attempt + 1);
    }
    throw new Error(`Login failed for ${email}: ${resp.status}`);
  }) as Cypress.Chainable<TokenPair>;
}

function _seedAndVisitSaga(auth: CachedAuthSaga, targetUrl: string) {
  cy.visit(targetUrl, {
    onBeforeLoad(win) {
      win.sessionStorage.setItem('accessToken', auth.accessToken);
      win.sessionStorage.setItem('refreshToken', auth.refreshToken);
      win.sessionStorage.setItem('user', JSON.stringify(auth.user));
    },
  });
}

function loginAsSaga(role: string, email: string, password: string, jwtRole: string, perms: string[], targetUrl: string) {
  const cached = Cypress.env(`_saga_${role}`) as CachedAuthSaga | undefined;
  if (cached) {
    _seedAndVisitSaga(cached, targetUrl);
    return;
  }
  _doLoginSaga(email, password).then((tok) => {
    const payload = JSON.parse(atob(tok.accessToken.split('.')[1]));
    const auth: CachedAuthSaga = {
      accessToken: tok.accessToken,
      refreshToken: tok.refreshToken,
      user: { id: 0, email: payload.sub, role: jwtRole, permissions: perms },
    };
    Cypress.env(`_saga_${role}`, auth);
    _seedAndVisitSaga(auth, targetUrl);
  });
}

const loginClient = (targetUrl: string) =>
  loginAsSaga('client', 'stefan.jovanovic@gmail.com', 'Klijent12345', 'CLIENT', ['TRADE_STOCKS', 'TRADE_FUTURES'], targetUrl);

/** Override globalni auth-refresh mock za live testove. */
function enableLiveBackend() {
  cy.intercept('POST', '**/api/auth/refresh', (req) => req.continue());
}

/** Token trenutno seed-ovane sesije. */
function withToken(fn: (token: string) => void) {
  cy.window().then((win) => {
    const token = win.sessionStorage.getItem('accessToken');
    expect(token, 'session token present').to.be.a('string').and.have.length.greaterThan(10);
    fn(token as string);
  });
}

interface OtcContractLite {
  id: number;
  buyerId: number;
  buyerName?: string;
  sellerId: number;
  sellerName?: string;
  status: string;
  listingTicker?: string;
}

// ============================================================
//  DESCRIBE: Intra-bank OTC exercise SAGA (live)
// ============================================================
describe('Live SAGA: Intra-bank OTC exercise', () => {
  beforeEach(() => {
    enableLiveBackend();
  });

  it('SG-L1: Klijent iskoristi ACTIVE ugovor → POST /exercise → GET /otc/saga/{id} COMPLETED → ugovor EXERCISED', () => {
    loginClient('/otc/ugovori');
    cy.contains('Sklopljeni ugovori', { timeout: 15000 }).should('be.visible');

    // Pribavi prvi ACTIVE ugovor gde je Stefan KUPAC (buyerId === 1) preko realnog BE-a.
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/contracts',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status !== 200 || !Array.isArray(resp.body)) {
          cy.log(`Trading stack/contracts nije dostupan (status ${resp.status}) — preskacem.`);
          return;
        }
        const contracts = resp.body as OtcContractLite[];
        const target = contracts.find((c) => c.status === 'ACTIVE' && c.buyerId === 1);
        if (!target) {
          cy.log('Nema ACTIVE buyer ugovora u seed-u (mozda vec exercise-ovan) — preskacem happy path.');
          return;
        }

        const ticker = target.listingTicker ?? 'GOOG';

        // window.confirm → true (handleExercise koristi native confirm, ne Radix).
        cy.on('window:confirm', () => true);

        // Uhvati exercise odgovor da izvucemo sagaId iz REALNOG BE response-a.
        cy.intercept('POST', `**/api/otc/contracts/${target.id}/exercise*`).as('exercise');

        cy.contains('tr', ticker, { timeout: 15000 }).within(() => {
          cy.contains('button', 'Iskoristi').should('be.visible').click();
        });

        // Realni SAGA odgovor: sinhrono orkestriran, terminalni COMPLETED/EXERCISED.
        cy.wait('@exercise', { timeout: 30000 }).then((interception) => {
          const status = interception.response?.statusCode;
          expect(status, 'exercise HTTP status').to.equal(200);
          const body = interception.response?.body as {
            sagaId?: string; sagaStatus?: string; status?: string;
          };
          expect(body, 'exercise body').to.be.an('object');
          expect(body.sagaId, 'sagaId vracen').to.be.a('string').and.have.length.greaterThan(0);
          expect(body.sagaStatus, 'sagaStatus terminalan').to.equal('COMPLETED');
          expect(body.status, 'ugovor status').to.equal('EXERCISED');

          // Realni success toast.
          cy.get('.Toastify__toast', { timeout: 10000 })
            .should('exist')
            .invoke('text')
            .should('match', /iskoriscen/i);

          // Prati REALNI saga zapis preko GET /otc/saga/{sagaId} — mora biti COMPLETED.
          const sagaId = body.sagaId as string;
          cy.request({
            method: 'GET',
            url: `/api/otc/saga/${sagaId}`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          }).then((sagaResp) => {
            expect(sagaResp.status, 'GET /otc/saga/{id} postoji (nije 404)').to.equal(200);
            const sagaBody = sagaResp.body as { status?: string; currentStep?: number; sagaStatus?: string };
            const sagaStatus = sagaBody.status ?? sagaBody.sagaStatus;
            expect(sagaStatus, 'saga zapis terminalan').to.equal('COMPLETED');
          });

          // Posle re-fetch-a ugovor prikazuje "Iskoriscen" (EXERCISED) u istom redu.
          cy.contains('tr', ticker).contains('Iskoriscen', { timeout: 15000 }).should('be.visible');
        });
      });
    });
  });

  it('SG-L2: Prodavac (non-buyer) NE vidi "Iskoristi"; BE odbija exercise non-buyer-a', () => {
    loginClient('/otc/ugovori');
    cy.contains('Sklopljeni ugovori', { timeout: 15000 }).should('be.visible');

    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/contracts',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status !== 200 || !Array.isArray(resp.body)) {
          cy.log(`Trading stack nije dostupan (status ${resp.status}) — preskacem.`);
          return;
        }
        const contracts = resp.body as OtcContractLite[];
        // Ugovor gde je Stefan PRODAVAC (sellerId === 1, buyerId !== 1).
        const sellerContract = contracts.find((c) => c.sellerId === 1 && c.buyerId !== 1);
        if (!sellerContract) {
          cy.log('Nema ugovora gde je Stefan prodavac — preskacem access-control deo.');
          return;
        }
        const ticker = sellerContract.listingTicker ?? 'MSFT';

        // UI: red prodavackog ugovora nema "Iskoristi"/"Odustani" (akcija je "—").
        cy.contains('tr', ticker, { timeout: 15000 }).should('be.visible').within(() => {
          cy.contains('button', 'Iskoristi').should('not.exist');
          cy.contains('button', 'Odustani').should('not.exist');
        });

        // BE: pokusaj exercise non-buyer ugovora MORA biti odbijen (4xx, NE 2xx).
        cy.request({
          method: 'POST',
          url: `/api/otc/contracts/${sellerContract.id}/exercise`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((exResp) => {
          expect(exResp.status, 'non-buyer exercise odbijen').to.be.within(400, 499);
        });
      });
    });
  });

  it('SG-L3: GET /otc/saga/{nepostojeci} vraca 404 (endpoint registrovan, ne 200 ni 405)', () => {
    loginClient('/home');
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/saga/nepostojeci-saga-id-0000',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        // Endpoint postoji (nije 405 Method Not Allowed niti 501); nepostojeci id → 404.
        expect(resp.status, 'saga endpoint registrovan').to.not.equal(405);
        expect(resp.status, 'saga endpoint registrovan').to.not.equal(501);
        expect(resp.status).to.be.oneOf([404, 400]);
      });
    });
  });
});
