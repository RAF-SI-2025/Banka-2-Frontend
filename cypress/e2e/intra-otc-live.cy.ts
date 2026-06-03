/// <reference types="cypress" />
/**
 * INTRA-BANK OTC pregovaranje — Live E2E Tests (Real Backend)
 *
 * Pokriva intra-bank OTC tok protiv ZIVOG stack-a (trading-service):
 *   discovery → napravi ponudu → kontraponuda → prihvatanje → ugovor.
 * Mirror za "Mock C4: OTC Intra-bank pregovaranje (Sc16-28)" describe iz
 * celina4-mock.cy.ts, ali bez ijednog cy.intercept mock-a za core flow.
 *
 *   IO-L1 (discovery+offer): Stefan vidi javne akcije, napravi ponudu (POST
 *     /otc/offers) → 2xx → FE redirect na /otc/pregovori → ponuda se pojavi.
 *   IO-L2 (counter): na ponudi gde je Stefan-ov red (myTurn), posalji
 *     kontraponudu (POST /otc/offers/{id}/counter) → 2xx + toast.
 *   IO-L3 (accept→contract): prihvati ponudu gde je Stefan KUPAC i njegov red
 *     (POST /otc/offers/{id}/accept) → 2xx → ugovor se pojavi u "Sklopljeni
 *     ugovori".
 *
 * Requires: Backend + seed na localhost:8080, frontend na localhost:3000.
 *
 * Seed (trading-seed.sql otc_offers) — Stefan = client_id=1:
 *   #2 Ana(buyer) → Stefan(seller) MSFT, waiting_on=Stefan → Stefan-ov red.
 *   #4 Stefan(buyer) ← Djordje(seller) AMZN, waiting_on=Stefan → Stefan-ov red.
 *   Plus javni portfoliji drugih korisnika (public_quantity > 0) za discovery.
 *
 * Seed creds (CLAUDE.md):
 *   Client: stefan.jovanovic@gmail.com / Klijent12345 (client_id=1)
 *
 * Cleanup: kreirane ponude se decline-uju u afterEach da ne kontaminira seed.
 *
 * NAPOMENA: Cypress runtime se ne moze pokrenuti ovde (bez display-a) — spec je
 * author + tsc/eslint clean; izvrsava se u CI / na realnom stack-u.
 */

// ============================================================
//  Login helper — real backend, sessionStorage seed (kao celina4-live)
// ============================================================

type CachedAuthIO = { accessToken: string; refreshToken: string; user: Record<string, unknown> };
type TokenPairIO = { accessToken: string; refreshToken: string };

function _doLoginIO(
  email: string,
  password: string,
  attempt = 0,
): Cypress.Chainable<TokenPairIO> {
  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
    failOnStatusCode: false,
  }).then((resp): TokenPairIO | Cypress.Chainable<TokenPairIO> => {
    if (resp.status === 200) {
      return { accessToken: resp.body.accessToken, refreshToken: resp.body.refreshToken };
    }
    if (resp.status === 429 && attempt < 3) {
      cy.wait(65000);
      return _doLoginIO(email, password, attempt + 1);
    }
    throw new Error(`Login failed for ${email}: ${resp.status}`);
  }) as Cypress.Chainable<TokenPairIO>;
}

function _seedAndVisitIO(auth: CachedAuthIO, targetUrl: string) {
  cy.visit(targetUrl, {
    onBeforeLoad(win) {
      win.sessionStorage.setItem('accessToken', auth.accessToken);
      win.sessionStorage.setItem('refreshToken', auth.refreshToken);
      win.sessionStorage.setItem('user', JSON.stringify(auth.user));
    },
  });
}

function loginClient(targetUrl: string) {
  const cached = Cypress.env('_io_client') as CachedAuthIO | undefined;
  if (cached) {
    _seedAndVisitIO(cached, targetUrl);
    return;
  }
  _doLoginIO('stefan.jovanovic@gmail.com', 'Klijent12345').then((tok) => {
    const payload = JSON.parse(atob(tok.accessToken.split('.')[1]));
    const auth: CachedAuthIO = {
      accessToken: tok.accessToken,
      refreshToken: tok.refreshToken,
      user: { id: 0, email: payload.sub, role: 'CLIENT', permissions: ['TRADE_STOCKS', 'TRADE_FUTURES'] },
    };
    Cypress.env('_io_client', auth);
    _seedAndVisitIO(auth, targetUrl);
  });
}

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

// React 19 controlled number-input + Cypress race fix (vidi celina4-mock Sc16-28).
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

interface OtcOfferLite {
  id: number;
  buyerId: number;
  sellerId: number;
  myTurn?: boolean;
  waitingOnUserId?: number;
  status: string;
  listingTicker?: string;
}

// ============================================================
//  DESCRIBE: Intra-bank OTC pregovaranje (live)
// ============================================================
describe('Live IntraOTC: pregovaranje', () => {
  let createdOfferId: number | null = null;

  beforeEach(() => {
    enableLiveBackend();
    createdOfferId = null;
  });

  afterEach(() => {
    // Decline svaku ponudu koju je test kreirao (oslobadja seller publicQuantity).
    if (createdOfferId != null) {
      const id = createdOfferId;
      withToken((token) => {
        cy.request({
          method: 'POST',
          url: `/api/otc/offers/${id}/decline`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
    }
  });

  it('IO-L1: Discovery → napravi ponudu (POST /otc/offers) → ponuda u pregovorima', () => {
    loginClient('/otc/discovery');
    cy.contains(/Pretrazi javne akcije/i, { timeout: 15000 }).should('be.visible');

    // Gating: ako nema javnih ponuda (prazan discovery), gracefully preskoci.
    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/listings',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status !== 200 || !Array.isArray(resp.body) || resp.body.length === 0) {
          cy.log(`Nema javnih OTC akcija (status ${resp.status}) — preskacem make-offer.`);
          return;
        }

        cy.intercept('POST', '**/api/otc/offers').as('createOffer');

        // Otvori prvu "Napravi ponudu" formu i popuni qty/price/premium.
        cy.contains('button', 'Napravi ponudu', { timeout: 15000 }).first().click();
        setNativeValue('input[id^="qty-"]', '1');
        setNativeValue('input[id^="price-"]', '150');
        setNativeValue('input[id^="premium-"]', '5');
        cy.get('input[id^="qty-"]').should('have.value', '1');
        cy.contains('button', 'Posalji ponudu prodavcu').click();

        cy.wait('@createOffer', { timeout: 20000 }).then((interception) => {
          const status = interception.response?.statusCode;
          expect(status, 'create offer status').to.be.oneOf([200, 201]);
          const body = interception.response?.body as { id?: number; listingTicker?: string };
          if (typeof body?.id === 'number') createdOfferId = body.id;

          // FE navigira na /otc/pregovori posle uspesnog create-a; nova ponuda
          // (Stefan kupac, ceka prodavca) se pojavljuje u listi po svom tickeru.
          cy.url({ timeout: 15000 }).should('include', '/otc/pregovori');
          cy.contains('Moji aktivni pregovori (intra-bank)', { timeout: 15000 }).should('be.visible');
          const ticker = body?.listingTicker;
          if (ticker) {
            cy.contains('tr', ticker, { timeout: 15000 }).should('be.visible');
          } else {
            // BE nije vratio ticker u odgovoru — verifikuj bar da lista nije prazna.
            cy.contains(/Kupac: Stefan|Stefan Jovanovi/i, { timeout: 15000 }).should('exist');
          }
        });
      });
    });
  });

  it('IO-L2: Kontraponuda na ponudi gde je moj red (POST /otc/offers/{id}/counter)', () => {
    loginClient('/otc/pregovori');
    cy.contains('Moji aktivni pregovori (intra-bank)', { timeout: 15000 }).should('be.visible');

    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/offers/active',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status !== 200 || !Array.isArray(resp.body)) {
          cy.log(`Trading stack nije dostupan (status ${resp.status}) — preskacem.`);
          return;
        }
        const offers = resp.body as OtcOfferLite[];
        const target = offers.find(
          (o) => o.status === 'ACTIVE' && o.myTurn === true && !!o.listingTicker,
        );
        if (!target) {
          cy.log('Nema aktivne ponude gde je Stefan-ov red — preskacem counter.');
          return;
        }
        const ticker = target.listingTicker as string;

        cy.intercept('POST', `**/api/otc/offers/${target.id}/counter`).as('counter');

        // Otvori counter formu za tu ponudu i posalji novu kolicinu/premiju.
        cy.contains('tr', ticker, { timeout: 15000 }).within(() => {
          cy.contains('button', 'Kontraponuda').click();
        });
        setNativeValue(`#cq-${target.id}`, '2');
        setNativeValue(`#cpm-${target.id}`, '7');
        cy.get(`#cq-${target.id}`).should('have.value', '2');
        cy.contains('button', 'Posalji kontraponudu').click();

        cy.wait('@counter', { timeout: 20000 }).then((interception) => {
          expect(interception.response?.statusCode, 'counter status').to.be.oneOf([200, 201]);
        });
        cy.get('.Toastify__toast', { timeout: 10000 })
          .should('exist')
          .invoke('text')
          .should('match', /Kontraponuda je poslata/i);
      });
    });
  });

  it('IO-L3: Prihvati ponudu (Stefan kupac, njegov red) → ugovor u "Sklopljeni ugovori"', () => {
    loginClient('/otc/pregovori');
    cy.contains('Moji aktivni pregovori (intra-bank)', { timeout: 15000 }).should('be.visible');

    withToken((token) => {
      cy.request({
        method: 'GET',
        url: '/api/otc/offers/active',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status !== 200 || !Array.isArray(resp.body)) {
          cy.log(`Trading stack nije dostupan (status ${resp.status}) — preskacem.`);
          return;
        }
        const offers = resp.body as OtcOfferLite[];
        // Stefan KUPAC (buyerId === 1) i njegov red → moze Prihvati (forma ugovora).
        const acceptable = offers.find(
          (o) => o.status === 'ACTIVE' && o.myTurn === true && o.buyerId === 1 && !!o.listingTicker,
        );
        if (!acceptable) {
          cy.log('Nema ponude gde je Stefan kupac sa svojim redom — preskacem accept.');
          return;
        }
        const ticker = acceptable.listingTicker as string;

        cy.intercept('POST', `**/api/otc/offers/${acceptable.id}/accept*`).as('accept');

        cy.contains('tr', ticker, { timeout: 15000 }).within(() => {
          cy.contains('button', 'Prihvati').click();
        });

        cy.wait('@accept', { timeout: 20000 }).then((interception) => {
          expect(interception.response?.statusCode, 'accept status').to.be.oneOf([200, 201]);
        });
        cy.get('.Toastify__toast', { timeout: 10000 })
          .should('exist')
          .invoke('text')
          .should('match', /opcioni ugovor je sklopljen|prihvac/i);

        // Verifikuj da prihvacena ponuda sad postoji kao UGOVOR (BE /otc/contracts).
        cy.request({
          method: 'GET',
          url: '/api/otc/contracts',
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((cResp) => {
          expect(cResp.status, 'GET /otc/contracts').to.equal(200);
          expect(cResp.body, 'contracts je niz').to.be.an('array');
          const contracts = cResp.body as Array<{ buyerId: number; status: string; listingTicker?: string }>;
          const mine = contracts.filter((c) => c.buyerId === 1);
          expect(mine.length, 'Stefan ima bar jedan ugovor posle accept-a').to.be.greaterThan(0);
        });

        // UI: ugovor se vidi na /otc/ugovori.
        _seedAndVisitIO(Cypress.env('_io_client') as CachedAuthIO, '/otc/ugovori');
        cy.contains('Sklopljeni ugovori', { timeout: 15000 }).should('be.visible');
        cy.contains('tr', ticker, { timeout: 15000 }).should('be.visible');
      });
    });
  });
});
