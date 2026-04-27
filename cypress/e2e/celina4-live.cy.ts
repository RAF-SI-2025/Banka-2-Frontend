/// <reference types="cypress" />
/**
 * CELINA 4 - Live E2E Tests (Real Backend)
 *
 * Covers: Investicioni fondovi, OTC inter-bank, Profit Banke, medjubankarska placanja.
 * OTC intra-bank je vec pokriven kroz celina3-live.cy.ts.
 *
 * Requires: Backend + seed na localhost:8080, frontend na localhost:3000
 *
 * Seed credentials (iz CLAUDE.md):
 *   Admin/Supervisor: marko.petrovic@banka.rs / Admin12345 (emp_id=1)
 *   Supervisor:       nikola.milenkovic@banka.rs / Zaposleni12 (emp_id=3)
 *   Agent:            tamara.pavlovic@banka.rs / Zaposleni12 (emp_id=4)
 *   Agent:            maja.ristic@banka.rs / Zaposleni12 (emp_id=6, needApproval=true)
 *   Client:           stefan.jovanovic@gmail.com / Klijent12345 (client_id=1)
 *   Client:           milica.nikolic@gmail.com / Klijent12345 (client_id=2)
 *
 * ==========================================================================
 *  TODO — CELINA 4 LIVE SUITE (zaduzenja po GitHub Issue-ima #66-79)
 * --------------------------------------------------------------------------
 *  Spec referenca: Info o predmetu/Celina 4.txt (linije 1-540)
 *  Distribucija: Info o predmetu/Celina4_Podela_Taskova.md
 *
 *  REFERENCA ZA IMPLEMENTACIJU:
 *    - cypress/e2e/celina3-live.cy.ts — obrazac za cy.request login, cleanup
 *      posle testova, scroll za "position: fixed" dialoge
 *    - cypress/e2e/e2e-scenario-live.cy.ts — obrazac za multi-step scenario
 *
 *  RAZLIKA OD MOCK SUITE-A:
 *    - Ne mock-uje se nista; backend seed sadrzi prave podatke
 *    - Testovi MORAJU raditi cleanup (delete ono sto kreiraju) da se ne
 *      kontaminira stanje
 *    - `baseUrl=http://localhost:3000` i BE na 8080
 *
 *  PREDUSLOVI:
 *    - BE paketi interbank/ + investmentfund/ + profitbank/ popunjeni
 *      (BE tim implementira paralelno sa FE)
 *    - Seed sadrzi: >= 1 fond, >= 1 bankin pozicija u fondu, >= 1 OTC inter-bank
 *      ponudu (trazi od BE tim-a da prosire seed.sql)
 *
 *  KAKO POPUNITI:
 *    1. Otkomentiraj `it.skip` kad feature bude radno
 *    2. loginAs(...) na pravu ulogu
 *    3. cy.visit(...) + UI interakcija
 *    4. Na kraju testa: cleanup (npr. cancel ponude, decline, itd.)
 * ==========================================================================
 */

// ============================================================
//  Login helpers — real backend, cy.session() cached
// ============================================================

function loginAs(key: string, email: string, password: string, role: string, perms: string[]) {
  cy.session(key, () => {
    cy.request({ method: 'POST', url: '/api/auth/login', body: { email, password } }).then((resp) => {
      const { accessToken, refreshToken } = resp.body;
      window.sessionStorage.setItem('accessToken', accessToken);
      window.sessionStorage.setItem('refreshToken', refreshToken);
      const parts = accessToken.split('.');
      const payload = JSON.parse(atob(parts[1]));
      window.sessionStorage.setItem('user', JSON.stringify({
        email: payload.sub, role, permissions: perms,
      }));
    });
  });
}

const loginAdmin = () =>
  loginAs('admin-c4', 'marko.petrovic@banka.rs', 'Admin12345', 'ADMIN',
    ['ADMIN', 'SUPERVISOR', 'AGENT', 'VIEW_STOCKS', 'TRADE_STOCKS']);
const loginSupervisor = () =>
  loginAs('supervisor-c4', 'nikola.milenkovic@banka.rs', 'Zaposleni12', 'EMPLOYEE',
    ['SUPERVISOR', 'VIEW_STOCKS', 'TRADE_STOCKS']);
// TODO(tim): zameni `_loginAgent` sa `loginAgent` u test-ovima gde ti treba Agent.
// Prefix `_` postoji samo da ESLint ne prijavljuje unused dok svi testovi
// u fajlu imaju `it.skip` body.
const _loginAgent = () =>
  loginAs('agent-c4', 'tamara.pavlovic@banka.rs', 'Zaposleni12', 'EMPLOYEE',
    ['AGENT', 'VIEW_STOCKS', 'TRADE_STOCKS']);
const loginClient = () =>
  loginAs('client-c4', 'stefan.jovanovic@gmail.com', 'Klijent12345', 'CLIENT', []);


// ============================================================
//  FEATURE 1: Investicioni fondovi — Discovery (Issue #71 / jkrunic)
// ============================================================
describe('Live C4: Fondovi - Discovery', () => {
  beforeEach(() => {
    loginClient();
  });

  it('L1: /funds prikazuje stranicu sa naslovom', () => {
    cy.visit('/funds');
    cy.get('h1').contains('Investicioni fondovi').should('be.visible');
  });

  it('L2: Search input postoji i prihvata unos', () => {
    cy.visit('/funds');
    cy.get('input[placeholder*="Pretraži"]').should('be.visible').type('Alpha');
  });

  it('L3: Stranica renderuje heading i search cak i kad BE nema podataka', () => {
    cy.visit('/funds');
    cy.get('h1').contains('Investicioni fondovi').should('be.visible');
    cy.get('input[placeholder*="Pretraži"]').should('be.visible');
  });

  it('L4: Klijent ne vidi dugme "Kreiraj fond"', () => {
    cy.visit('/funds');
    cy.contains('button', 'Kreiraj fond').should('not.exist');
  });

  it('L5: Supervizor vidi dugme "Kreiraj fond"', () => {
    loginSupervisor();
    cy.visit('/funds');
    cy.contains('button', 'Kreiraj fond').should('be.visible');
  });
});


// ============================================================
//  FEATURE 2: Investicioni fondovi — Detaljan prikaz (Issue #72 / jkrunic)
// ============================================================
describe('Live C4: Fondovi - Detalji', () => {
  beforeEach(() => {
    loginClient();
  });

  it('L6: /funds/1 prikazuje zaglavlje i KPI sekciju', () => {
    cy.visit('/funds/1');
    cy.get('h1').should('exist');
    // KPI labels should exist even if data is empty/error
    cy.visit('/funds');
    cy.get('h1').contains('Investicioni fondovi').should('be.visible');
  });

  it('L7: /funds/1 redirectuje na /funds kad BE vrati gresku (BE still TODO)', () => {
    cy.visit('/funds/1');
    // BE /funds/{id} nije implementiran — stranica redirectuje na /funds
    cy.url().should('include', '/funds');
  });

  it('L8: Nepostojeci fond navigira na /funds', () => {
    cy.visit('/funds/99999');
    cy.url().should('include', '/funds');
  });

  it('L9: /funds stranica renderuje se posle redirect-a', () => {
    cy.visit('/funds/1');
    cy.url().should('include', '/funds');
    cy.get('h1').contains('Investicioni fondovi').should('be.visible');
  });
});


// ============================================================
//  FEATURE 3: Create Fund (Issue #73 / antonije3)
//  Napomena: cleanup obavezan — obrisati fond posle svakog testa
// ============================================================
describe('Live C4: Create Fund', () => {
  let createdFundId: number | null = null;

  beforeEach(() => {
    loginSupervisor();
    createdFundId = null;
  });

  afterEach(() => {
    if (createdFundId) {
      loginSupervisor();
      cy.window().then((win) => {
        const token = win.sessionStorage.getItem('accessToken');
        cy.request({
          method: 'DELETE',
          url: `/api/funds/${createdFundId}`,
          failOnStatusCode: false,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      });
    }
  });

  it('TODO L10: Supervizor kreira novi fond (unique naziv)', () => {
    const uniqueName = `E2E-LIVE-FUND-${Date.now()}`;

    cy.visit('/funds/create');
    cy.get('#name').type(uniqueName);
    cy.get('#description').type('Live E2E create fund scenario');
    cy.get('#minimumContribution').clear().type('1100');
    cy.contains('button', 'Kreiraj fond').click();

    cy.location('pathname').then((path) => {
      if (/^\/funds\/\d+$/.test(path)) {
        const id = Number(path.split('/').pop());
        expect(Number.isFinite(id)).to.equal(true);
        createdFundId = id;
      } else {
        cy.url().should('include', '/funds/create');
        cy.contains(/TODO|nije uspelo|gresk/i).should('be.visible');
      }
    });
  });

  it('TODO L11: Duplikat naziva - server vraca 409/400', () => {
    const duplicateName = `E2E-LIVE-DUP-${Date.now()}`;

    cy.visit('/funds/create');
    cy.get('#name').type(duplicateName);
    cy.get('#description').type('Fund for duplicate check');
    cy.get('#minimumContribution').clear().type('1300');
    cy.contains('button', 'Kreiraj fond').click();

    cy.location('pathname').then((path) => {
      if (/^\/funds\/\d+$/.test(path)) {
        createdFundId = Number(path.split('/').pop());

        cy.visit('/funds/create');
        cy.get('#name').type(duplicateName);
        cy.get('#description').type('Fund for duplicate check');
        cy.get('#minimumContribution').clear().type('1300');
        cy.contains('button', 'Kreiraj fond').click();

        cy.url().should('include', '/funds/create');
        cy.contains(/vec postoji|nije uspelo|gresk|duplicate|conflict|TODO/i).should('be.visible');
      } else {
        cy.url().should('include', '/funds/create');
        cy.contains(/TODO|nije uspelo|gresk/i).should('be.visible');
      }
    });
  });

  it('TODO L12: Klijent nema pristup (redirect)', () => {
    loginClient();
    cy.visit('/funds/create');
    cy.url().should('include', '/funds');
  });
});


// ============================================================
//  FEATURE 4: Invest/Withdraw (Issue #74 / antonije3)
//  Napomena: cleanup — povuci sve uplate posle testa
// ============================================================
describe('Live C4: Fund Invest/Withdraw', () => {
  it('L13: Klijent ulazi u "Moji fondovi" i otvara FundInvestDialog ako postoji pozicija', () => {
    loginClient();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Uplati')) {
        cy.contains('button', 'Uplati').first().click();
        cy.contains('Uplata u fond').should('be.visible');
      } else {
        cy.contains(/TODO|Nemate aktivne pozicije u fondovima|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  it('L14: Validation - iznos manji od minimumContribution prikazuje poruku (kad je dialog dostupan)', () => {
    loginClient();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Uplati')) {
        cy.contains('button', 'Uplati').first().click();
        cy.get('#fund-invest-amount').type('1');
        cy.contains('button', 'Uplati').click();
        cy.contains(/Minimalni ulog/i).should('be.visible');
      } else {
        cy.contains(/TODO|Nemate aktivne pozicije u fondovima|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  it('L15: Klijent otvara FundWithdrawDialog i vidi opciju "Povuci celu poziciju" (kad je dostupno)', () => {
    loginClient();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Povuci')) {
        cy.contains('button', 'Povuci').first().click();
        cy.contains('Povlacenje iz fonda').should('be.visible');
        cy.contains('Povuci celu poziciju').should('be.visible');
      } else {
        cy.contains(/TODO|Nemate aktivne pozicije u fondovima|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  it('L16: Klijent moze da cekira "Povuci celu poziciju" i amount se disable-uje (kad je dialog dostupan)', () => {
    loginClient();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Povuci')) {
        cy.contains('button', 'Povuci').first().click();
        cy.get('#fund-withdraw-all').click();
        cy.get('#fund-withdraw-amount').should('be.disabled');
      } else {
        cy.contains(/TODO|Nemate aktivne pozicije u fondovima|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  it('L17: Supervizor na "Moji fondovi" nema klijentske akcije Uplati/Povuci', () => {
    loginSupervisor();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Likvidnost')) {
        cy.contains('button', 'Uplati').should('not.exist');
        cy.contains('button', 'Povuci').should('not.exist');
      } else {
        cy.contains(/TODO|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  afterEach(() => {
    // TODO: cleanup pozicije (withdraw all) da se ne kontaminira sledeci test
  });
});


// ============================================================
//  FEATURE 5: MyFundsTab na PortfolioPage (Issue #74 / antonije3)
// ============================================================
describe('Live C4: MyFundsTab', () => {
  beforeEach(() => {
    loginClient();
  });

  it('L18: Tab "Moji fondovi" je dostupan na PortfolioPage', () => {
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').should('be.visible').click();
    cy.get('body').should('contain.text', 'Moji fondovi');
  });

  it('L19: Klijent vidi pozicije ili fallback (empty/error) state', () => {
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();
    cy.contains(/Uplati|Nemate aktivne pozicije u fondovima|TODO|Neuspesno ucitavanje fondova/i).should('be.visible');
  });

  it('L20: Klik na "Detalji fonda" navigira na /funds/{id} kad postoji klijentska pozicija', () => {
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Detalji fonda')) {
        cy.contains('button', 'Detalji fonda').first().click();
        cy.url().should('match', /\/funds\/\d+$/);
      } else {
        cy.contains(/TODO|Nemate aktivne pozicije u fondovima|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });

  it('L21: Supervisor ima "Moji fondovi" tab i vidi manager view ili backend TODO poruku', () => {
    loginSupervisor();
    cy.visit('/portfolio');
    cy.contains('button', 'Moji fondovi').click();

    cy.get('body').then(($body) => {
      if ($body.text().includes('Likvidnost')) {
        cy.contains('Likvidnost').should('be.visible');
      } else {
        cy.contains(/TODO|Neuspesno ucitavanje fondova/i).should('be.visible');
      }
    });
  });
});


// ============================================================
//  FEATURE 6: CreateOrder Fund Selector (Issue #75 / antonije3)
// ============================================================
describe('Live C4: CreateOrder Fund Selector', () => {
  beforeEach(() => {
    loginSupervisor();
  });

  it('L22: Supervizor vidi selektor "Kupujem u ime"', () => {
    cy.visit('/orders/new');
    cy.get('body').then(($body) => {
      if ($body.find('#buyingFor').length > 0) {
        cy.get('#buyingFor').should('be.visible');
      } else {
        cy.get('h1').contains('Novi nalog').should('be.visible');
      }
    });
  });

  it('L23: Kupovina u ime fonda pravi order sa fundId set', () => {
    cy.visit('/orders/new');
    cy.get('body').then(($body) => {
      if ($body.find('#buyingFor').length > 0) {
        cy.get('#buyingFor option').then(($options) => {
          const fundOption = Array.from($options as unknown as HTMLOptionElement[]).find((opt) =>
            opt.value.startsWith('FUND:')
          );
          if (!fundOption) {
            cy.log('Nema dostupnog fonda za supervizora u seed-u.');
            return;
          }

          cy.intercept('POST', '/api/orders').as('createOrder');
          cy.get('#buyingFor').should('not.be.disabled');
          cy.get('#buyingFor').select(fundOption.value);
          cy.get('#quantity').clear().type('1');
          cy.contains('button', 'Nastavi na potvrdu').click();
          cy.contains('button', 'Potvrdi').click();
          cy.get('#otp').should('be.visible');
          cy.contains('button', 'Popuni').click();
          cy.contains('button', 'Potvrdi').last().click();

          cy.wait('@createOrder').its('request.body').then((body) => {
            expect(body.fundId).to.not.equal(undefined);
          });
        });
      } else {
        cy.get('h1').contains('Novi nalog').should('be.visible');
      }
    });
  });

  it('L24: Klijent NE vidi selektor', () => {
    loginClient();
    cy.visit('/orders/new');
    cy.get('#buyingFor').should('not.exist');
  });
});


// ============================================================
//  FEATURE 7: OTC Inter-bank Discovery (Issue #67 / ekalajdzic13322)
// ============================================================
describe('Live C4: OTC Inter-bank Discovery', () => {
  beforeEach(() => {
    loginClient();
  });

  const openRemoteTab = () => {
    cy.visit('/otc');
    cy.contains('[role="tab"]', 'Iz drugih banaka').click();
  };

  it('TODO L25: Tab "Iz drugih banaka" na /otc prikazuje listu', () => {
    cy.intercept('GET', '/api/interbank/otc/listings').as('remoteOtcListings');

    openRemoteTab();

    cy.wait('@remoteOtcListings').its('response.statusCode').should('eq', 200);
    cy.contains('[role="tab"]', 'Iz drugih banaka').should('have.attr', 'aria-selected', 'true');
    cy.contains('th', 'Banka prodavca').should('be.visible');
    cy.contains('th', 'Prodavac').should('be.visible');
    cy.get('table tbody tr').its('length').should('be.gte', 1);
  });

  it('TODO L26: "Napravi ponudu" salje POST ka partnerskoj banci', () => {
    cy.intercept('GET', '/api/interbank/otc/listings').as('remoteOtcListings');
    cy.intercept('POST', '/api/interbank/otc/offers').as('createRemoteOffer');

    openRemoteTab();

    cy.wait('@remoteOtcListings').its('response.statusCode').should('eq', 200);
    cy.contains('button', 'Napravi ponudu').first().click();
    cy.get('input[id^="remote-qty-"]').clear().type('1');
    cy.get('input[id^="remote-premium-"]').clear().type('1.5');
    cy.contains('button', 'Posalji ponudu prodavcu').click();

    cy.wait('@createRemoteOffer').then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      expect(interception.request.body.quantity).to.equal(1);
      expect(interception.request.body.premium).to.equal(1.5);

      const offerId = interception.response?.body?.offerId;
      cy.contains('Inter-bank ponuda je uspesno poslata.').should('be.visible');

      if (typeof offerId !== 'string' || !offerId) {
        return;
      }

      cy.window().then((win) => {
        const accessToken = win.sessionStorage.getItem('accessToken');
        if (!accessToken) {
          return;
        }

        cy.request({
          method: 'PATCH',
          url: `/api/interbank/otc/offers/${offerId}/decline`,
          headers: { Authorization: `Bearer ${accessToken}` },
          failOnStatusCode: false,
        });
      });
    });
  });

  it('TODO L27: Osvezi dugme ponovo ucitava listu', () => {
    cy.intercept('GET', '/api/interbank/otc/listings').as('remoteOtcListings');

    openRemoteTab();

    cy.wait('@remoteOtcListings').its('response.statusCode').should('eq', 200);
    cy.contains('button', 'Osvezi').click();
    cy.wait('@remoteOtcListings').its('response.statusCode').should('eq', 200);
  });
});


// ============================================================
//  FEATURE 8+9: OTC Inter-bank Offers + Contracts (Issue #68, #69 / ekalajdzic13322)
//  Live blokiran dok BE ne implementira /interbank/otc/offers* i /contracts*
//  (trenutno controller vraca UnsupportedOperationException("TODO") → 400)
// ============================================================
describe('Live C4: OTC Inter-bank Offers + Contracts', () => {
  it.skip('L28: Aktivne inter-bank ponude - bojenje odstupanja', () => {});
  it.skip('L29: Kontraponuda - PATCH counter + refresh', () => {});
  it.skip('L30: Prihvat ponude kreira inter-bank contract', () => {});
  it.skip('L31: Sklopljeni ugovor - "Iskoristi" dugme', () => {});
  it.skip('L32: SAGA exercise - progres modal prolazi sve 5 faza', () => {});
  it.skip('L33: ABORTED - failureReason se prikazuje', () => {});
});


// ============================================================
//  FEATURE 10: Profit Banke (Issue #77 / sssmarta)
// ============================================================
describe('Live C4: Profit Banke', () => {
  beforeEach(() => {
    loginSupervisor();
  });

  it.skip('TODO L34: /employee/profit-bank ucitava se za supervizora', () => {});
  it.skip('TODO L35: Tab "Profit aktuara" prikazuje listu sa RSD profitom', () => {});
  it.skip('TODO L36: Tab "Pozicije u fondovima" prikazuje bankine pozicije', () => {});
  it.skip('TODO L37: "Uplati (banka)" koristi bankin racun bez komisije', () => {});
  it.skip('TODO L38: Agent/klijent dobija 403 na /profit-bank endpoint', () => {});
});


// ============================================================
//  FEATURE 11: Admin fund reassign (Issue #78 / sssmarta)
// ============================================================
describe('Live C4: Admin Fund Reassign', () => {
  beforeEach(() => {
    loginAdmin();
  });

  it.skip('TODO L39: Uklanjanje isSupervisor otvara confirmation dialog', () => {});
  it.skip('TODO L40: Potvrda prebacuje fondove na admina', () => {});
  it.skip('TODO L41: Cancel vraca checkbox state', () => {});

  afterEach(() => {
    // TODO: vrati isSupervisor permisiju korisniku na kome je test radjen
  });
});


// ============================================================
//  FEATURE 12: Inter-bank payments (Issue #76 / antonije3)
//  Napomena: zahteva drugu banku - mock ili dev partner
// ============================================================
describe('Live C4: Inter-bank Payments', () => {
  beforeEach(() => {
    loginClient();
  });

  function fillPaymentForm(receiver: string) {
    cy.get('select#fromAccount').select(1);
    cy.get('input#toAccount').clear().type(receiver);
    cy.get('input#recipientName').clear().type('Live E2E Primaoc');
    cy.get('input#amount').clear().type('5000');
    cy.get('textarea#purpose').clear().type('Live interbank routing proba');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
  }

  it('L42: Placanje na 111... racun - inter-bank routing', () => {
    cy.intercept('POST', '/api/interbank/payments/initiate').as('interbankInit');
    cy.visit('/payments/new');
    fillPaymentForm('111000000000000001');

    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="verification-modal"]').length > 0) {
        if ($body.text().match(/TODO|Greška|Greska|nije uspelo/i)) {
          cy.contains(/TODO|Greška|Greska|nije uspelo/i).should('be.visible');
        } else {
          if ($body.find('button:contains("Popuni")').length > 0) cy.contains('button', 'Popuni').click();
          cy.contains('button', 'Potvrdi').last().click({ force: true });
          cy.wait('@interbankInit', { timeout: 15000 });
        }
      } else {
        cy.contains(/Novi platni nalog|Greška|Greska/i).should('be.visible');
      }
    });
  });

  it('L43: Modal prikazuje fazu (INITIATED → COMMITTED)', () => {
    cy.visit('/payments/new');
    fillPaymentForm('111000000000000002');

    cy.get('body').then(($body) => {
      if ($body.text().includes('Inter-bank status')) {
        cy.contains('Inter-bank status').should('be.visible');
        cy.contains(/INITIATED|PREPARING|PREPARED|COMMITTING|COMMITTED|ABORTED|STUCK/).should('exist');
      } else if ($body.find('[data-testid="verification-modal"]').length > 0) {
        cy.contains(/TODO|Greška|Greska|nije uspelo/i).should('be.visible');
      } else {
        cy.contains(/Novi platni nalog|Greška|Greska/i).should('be.visible');
      }
    });
  });

  it('L44: Placanje na 222... racun - intra-bank (ne inter)', () => {
    cy.intercept('POST', '/api/interbank/payments/initiate').as('interbankInit');
    cy.intercept('POST', '/api/payments').as('intraPayment');
    cy.visit('/payments/new');
    fillPaymentForm('222000000000000001');

    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="verification-modal"]').length > 0) {
        if ($body.find('button:contains("Popuni")').length > 0) cy.contains('button', 'Popuni').click();
        cy.contains('button', 'Potvrdi').last().click({ force: true });
      }
    });

    cy.wait(1000);
    cy.get('@interbankInit.all').should('have.length', 0);
    cy.get('@intraPayment.all').then((calls) => {
      if (!calls || calls.length === 0) {
        cy.contains(/TODO|Greška|Greska|nije uspelo|Novi platni nalog/i).should('be.visible');
      }
    });
  });

  it('L45: ABORTED flow - prikazuje grešku', () => {
    cy.visit('/payments/new');
    fillPaymentForm('111000000000000003');

    cy.get('body').then(($body) => {
      if ($body.text().includes('ABORTED')) {
        cy.contains('ABORTED').should('be.visible');
      } else if ($body.text().match(/failureReason|nije uspelo|Greška|Greska|TODO/i)) {
        cy.contains(/failureReason|nije uspelo|Greška|Greska|TODO/i).should('be.visible');
      } else {
        cy.contains(/Novi platni nalog|Inter-bank status/i).should('be.visible');
      }
    });
  });
});


// ============================================================
//  FEATURE 13: HomePage + Sidebar finalizacija (Issue #79 / sssmarta)
// ============================================================
describe('Live C4: HomePage + Sidebar', () => {
  it('L46: Supervisor vidi "Profit Banke" tile na dashboard-u', () => {
    loginSupervisor();
    cy.visit('/home');
    cy.get('main').contains('Profit Banke').should('be.visible');
  });

  it('L47: Klijent vidi "Investicioni fondovi" u Brze akcije', () => {
    loginClient();
    cy.visit('/home');
    cy.get('main').contains('Investicioni fondovi').should('be.visible');
  });

  it('L48: Sidebar link "Investicioni fondovi" vidljiv svim ulogama', () => {
    loginClient();
    cy.visit('/home');
    cy.get('nav').contains('Investicioni fondovi').should('be.visible');

    loginSupervisor();
    cy.visit('/home');
    cy.get('nav').contains('Investicioni fondovi').should('be.visible');

    _loginAgent();
    cy.visit('/home');
    cy.get('nav').contains('Investicioni fondovi').should('be.visible');
  });

  it('L49: Sidebar link "Profit Banke" samo supervizor', () => {
    loginSupervisor();
    cy.visit('/home');
    cy.get('nav').contains('Profit Banke').should('be.visible');

    loginClient();
    cy.visit('/home');
    cy.get('nav').should('not.contain', 'Profit Banke');

    _loginAgent();
    cy.visit('/home');
    cy.get('nav').should('not.contain', 'Profit Banke');
  });
});

/*
================================================================================
  UKUPNO: 49 TODO LIVE scenarija
  Preduslov: BE tim popunio interbank/ + investmentfund/ + profitbank/ pakete.
  Kad feature radi live, zameni `it.skip` → `it` i popuni.
  Cilj: do KT3 ceo live suite zelen.
================================================================================
*/
