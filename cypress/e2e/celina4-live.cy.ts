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

  it.skip('TODO L1: /funds prikazuje listu iz seed-a', () => {
    // TODO: cy.visit('/funds'); cy.get('table tbody tr').should('have.length.gt', 0)
  });

  it.skip('TODO L2: Search filtrira po nazivu fonda', () => {});
  it.skip('TODO L3: Sort menja redosled + back-to-top', () => {});
  it.skip('TODO L4: Klik na red otvara /funds/{id}', () => {});
  it.skip('TODO L5: Supervizor vidi "Kreiraj fond", klijent ne', () => {});
});


// ============================================================
//  FEATURE 2: Investicioni fondovi — Detaljan prikaz (Issue #72 / jkrunic)
// ============================================================
describe('Live C4: Fondovi - Detalji', () => {
  beforeEach(() => {
    loginClient();
  });

  it.skip('TODO L6: Detalji fonda - 4 KPI karte + holdings tabela', () => {});
  it.skip('TODO L7: Performance grafik renderuje se sa podacima', () => {});
  it.skip('TODO L8: 404 kad fond ne postoji', () => {});
  it.skip('TODO L9: "Uplati u fond" dugme otvara dialog', () => {});
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
      // TODO(antonije3): cleanup — obrisi fond preko API-ja (DELETE /funds/{id})
      // Ili: markiraj kao inactive ako BE nema DELETE
    }
  });

  it.skip('TODO L10: Supervizor kreira novi fond (unique naziv)', () => {
    // TODO: cy.visit('/funds/create'), popuni, submit, capture id u createdFundId
  });

  it.skip('TODO L11: Duplikat naziva - server vraca 409/400', () => {});
  it.skip('TODO L12: Klijent nema pristup (redirect)', () => {});
});


// ============================================================
//  FEATURE 4: Invest/Withdraw (Issue #74 / antonije3)
//  Napomena: cleanup — povuci sve uplate posle testa
// ============================================================
describe('Live C4: Fund Invest/Withdraw', () => {
  it.skip('TODO L13: Klijent uplacuje 1500 RSD u fond, vidi novu poziciju', () => {});
  it.skip('TODO L14: Iznos manji od minimumContribution - 400 + toast', () => {});
  it.skip('TODO L15: Povlacenje celog iznosa - pozicija nestaje', () => {});
  it.skip('TODO L16: Povlacenje kad fond ima < amount - status=PENDING', () => {});
  it.skip('TODO L17: Supervizor uplacuje u ime banke (bez FX komisije)', () => {});

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

  it.skip('TODO L18: Tab "Moji fondovi" prikazuje moje pozicije', () => {});
  it.skip('TODO L19: Empty state kad klijent nema poziciju', () => {});
  it.skip('TODO L20: Klik navigira na /funds/{id}', () => {});
  it.skip('TODO L21: Supervisor prikazuje fondove kojima upravlja', () => {});
});


// ============================================================
//  FEATURE 6: CreateOrder Fund Selector (Issue #75 / antonije3)
// ============================================================
describe('Live C4: CreateOrder Fund Selector', () => {
  beforeEach(() => {
    loginSupervisor();
  });

  it.skip('TODO L22: Supervizor vidi selektor "Kupujem u ime"', () => {});
  it.skip('TODO L23: Kupovina u ime fonda pravi order sa fundId set', () => {});
  it.skip('TODO L24: Klijent NE vidi selektor', () => {});
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
//  Napomena: SAGA flow zahteva seed ponudu — BE tim treba da pripremi
// ============================================================
describe('Live C4: OTC Inter-bank Offers + Contracts', () => {
  it.skip('TODO L28: Aktivne inter-bank ponude - bojenje odstupanja', () => {});
  it.skip('TODO L29: Kontraponuda - PATCH counter + refresh', () => {});
  it.skip('TODO L30: Prihvat ponude kreira inter-bank contract', () => {});
  it.skip('TODO L31: Sklopljeni ugovor - "Iskoristi" dugme', () => {});
  it.skip('TODO L32: SAGA exercise - progres modal prolazi sve 5 faza', () => {});
  it.skip('TODO L33: ABORTED - failureReason se prikazuje', () => {});
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

  it.skip('TODO L42: Placanje na 111... racun - inter-bank routing', () => {});
  it.skip('TODO L43: Modal prikazuje fazu (INITIATED → COMMITTED)', () => {});
  it.skip('TODO L44: Placanje na 222... racun - intra-bank (ne inter)', () => {});
  it.skip('TODO L45: ABORTED flow - prikazuje grešku', () => {});
});


// ============================================================
//  FEATURE 13: HomePage + Sidebar finalizacija (Issue #79 / sssmarta)
// ============================================================
describe('Live C4: HomePage + Sidebar', () => {
  it.skip('TODO L46: Supervisor vidi "Profit Banke" tile na dashboard-u', () => {});
  it.skip('TODO L47: Klijent vidi "Investicioni fondovi" u Brze akcije', () => {});
  it.skip('TODO L48: Sidebar link "Investicioni fondovi" vidljiv svim ulogama', () => {});
  it.skip('TODO L49: Sidebar link "Profit Banke" samo supervizor', () => {});
});

/*
================================================================================
  UKUPNO: 49 TODO LIVE scenarija
  Preduslov: BE tim popunio interbank/ + investmentfund/ + profitbank/ pakete.
  Kad feature radi live, zameni `it.skip` → `it` i popuni.
  Cilj: do KT3 ceo live suite zelen.
================================================================================
*/
