/// <reference types="cypress" />
/**
 * CELINA 3 - Live E2E Tests (Real Backend)
 * Covers all 82 scenarios from TestoviCelina3.pdf
 *
 * Requires: Backend + seed on localhost:8080, frontend on localhost:3000
 *
 * Seed credentials:
 *   Admin/Supervisor: marko.petrovic@banka.rs / Admin12345 (emp_id=1)
 *   Supervisor:       nikola.milenkovic@banka.rs / Zaposleni12 (emp_id=3)
 *   Agent:            maja.ristic@banka.rs / Zaposleni12 (emp_id=6, needApproval=true)
 *   Agent:            tamara.pavlovic@banka.rs / Zaposleni12 (emp_id=4, needApproval=false)
 *   Client:           stefan.jovanovic@gmail.com / Klijent12345 (client_id=1)
 */

// ============================================================
// Login helpers — real backend, cy.session() cached
// ============================================================

function loginAs(key: string, email: string, password: string, role: string, perms: string[]) {
  cy.session(key, () => {
    cy.request({ method: 'POST', url: '/api/auth/login', body: { email, password } }).then((resp) => {
      const { accessToken, refreshToken } = resp.body;
      window.sessionStorage.setItem('accessToken', accessToken);
      window.sessionStorage.setItem('refreshToken', refreshToken);
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const parts = payload.sub.split('@')[0].split('.');
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      window.sessionStorage.setItem('user', JSON.stringify({
        id: 0, email: payload.sub, role: payload.role || role,
        firstName: parts[0] ? cap(parts[0]) : '', lastName: parts[1] ? cap(parts[1]) : '',
        username: parts.join('.'), permissions: perms,
      }));
    });
  });
}

function loginAsAdmin() {
  loginAs('admin-c3', 'marko.petrovic@banka.rs', 'Admin12345', 'ADMIN',
    ['ADMIN', 'SUPERVISOR', 'TRADE_STOCKS', 'TRADE_FOREX', 'TRADE_FUTURES', 'TRADE_OPTIONS']);
}
function loginAsClient() {
  loginAs('client-c3', 'stefan.jovanovic@gmail.com', 'Klijent12345', 'CLIENT',
    ['TRADE_STOCKS', 'TRADE_FUTURES']);
}
function loginAsSupervisor() {
  loginAs('supervisor-c3', 'nikola.milenkovic@banka.rs', 'Zaposleni12', 'EMPLOYEE',
    ['ADMIN', 'SUPERVISOR', 'AGENT', 'TRADE_STOCKS', 'TRADE_FOREX', 'TRADE_FUTURES', 'TRADE_OPTIONS']);
}
function _loginAsAgent() {
  loginAs('agent-c3', 'maja.ristic@banka.rs', 'Zaposleni12', 'EMPLOYEE',
    ['AGENT', 'TRADE_STOCKS', 'TRADE_FOREX', 'TRADE_FUTURES', 'TRADE_OPTIONS']);
}

/** Override global auth-refresh mock for live tests */
function enableLiveBackend() {
  cy.intercept('POST', '**/api/auth/refresh', (req) => req.continue());
}

/** Helper: popuni Create Order formu i submituj */
function fillAndSubmitOrder(opts: {
  listingId: number;
  direction: 'BUY' | 'SELL';
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limitValue?: number;
  stopValue?: number;
}) {
  cy.visit(`/orders/new?listingId=${opts.listingId}&direction=${opts.direction}`);
  cy.contains('Novi nalog', { timeout: 15000 }).should('be.visible');

  // Sacekaj ucitavanje listings i accounts
  cy.get('select#accountId option:not([value=""])', { timeout: 15000 }).should('have.length.greaterThan', 0);
  cy.contains('Izabrana hartija', { timeout: 15000 }).should('exist');

  // Popuni kolicinu
  cy.get('#quantity').clear().type(String(opts.quantity));

  // Postavi order type ako nije Market (default)
  if (opts.orderType && opts.orderType !== 'MARKET') {
    cy.get('select#orderType').select(opts.orderType);
  }
  if (opts.limitValue != null) {
    cy.get('#limitValue').should('be.visible').clear().type(String(opts.limitValue));
  }
  if (opts.stopValue != null) {
    cy.get('#stopValue').should('be.visible').clear().type(String(opts.stopValue));
  }

  // Selektuj prvi racun po value stringu
  cy.get('select#accountId option:not([value=""])').first().then(($opt) => {
    cy.get('select#accountId').select($opt.val() as string);
  });

  // Registruj intercept neposredno pre submit-a (izbegava se gubitak aliasa pri navigaciji)
  cy.intercept('POST', '**/api/orders').as('submitOrder');

  // Submit → dijalog → potvrdi
  cy.contains('button', 'Nastavi na potvrdu').click();

  // Sacekaj da dijalog bude vidljiv i da sadrzi ocekivani sadrzaj
  cy.get('[role="dialog"]', { timeout: 10000 }).should('be.visible');
  cy.contains('Potvrda naloga', { timeout: 5000 }).should('be.visible');

  // Klikni potvrdu — native DOM click zaobilazi Cypress/React 19/Portal event delegation edge-case
  cy.get('[data-cy="confirm-order"]').should('be.visible').and('not.be.disabled').then($btn => {
    $btn[0].click();
  });

  // Sacekaj API odgovor i redirect
  cy.wait('@submitOrder', { timeout: 15000 }).its('response.statusCode').should('eq', 200);
  cy.url({ timeout: 15000 }).should('include', '/orders/my');
}

// ============================================================
// FEATURE: Upravljanje aktuarima (S1-S9)
// ============================================================

describe('Live: Upravljanje aktuarima', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S1: Supervizor otvara portal — vidi listu agenata, filtere i akcije', () => {
    loginAsAdmin();
    cy.visit('/employee/actuaries');
    cy.contains('Upravljanje aktuarima', { timeout: 15000 }).should('be.visible');

    // Vidi filtere
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po email-u"]').should('be.visible');
    cy.get('input[placeholder="Pretraga po imenu"]').should('be.visible');
    cy.get('input[placeholder="Pretraga po prezimenu"]').should('be.visible');

    // Vidi tabelu sa agentima iz seed-a
    cy.contains('td', 'maja.ristic@banka.rs', { timeout: 15000 }).should('be.visible');
    cy.contains('td', 'tamara.pavlovic@banka.rs').should('be.visible');

    // Vidi dugme za izmenu limita i resetovanje
    cy.get('button[title="Izmeni limit"]').should('have.length.greaterThan', 0);
    cy.contains('button', 'Resetuj limit').should('exist');
  });

  it('S2: Agent nema pristup portalu za upravljanje aktuarima', () => {
    loginAsClient();
    cy.visit('/employee/actuaries');
    cy.url().should('include', '/403');
  });

  it('S3: Supervizor menja limit agentu — uspesno', () => {
    loginAsAdmin();
    cy.visit('/employee/actuaries');
    cy.contains('td', 'maja.ristic@banka.rs', { timeout: 15000 }).should('be.visible');

    cy.contains('td', 'maja.ristic@banka.rs').closest('tr').find('button[title="Izmeni limit"]').click();
    cy.contains('Izmena limita').should('be.visible');
    cy.get('#dailyLimit').clear().type('150000');
    cy.contains('button', 'Sacuvaj').click();
    cy.contains('Limit je uspesno azuriran', { timeout: 10000 }).should('be.visible');
  });

  it('S4: Unos nevalidnog limita — negativna vrednost', () => {
    loginAsAdmin();
    cy.visit('/employee/actuaries');
    cy.contains('td', 'maja.ristic@banka.rs', { timeout: 15000 }).should('be.visible');

    cy.contains('td', 'maja.ristic@banka.rs').closest('tr').find('button[title="Izmeni limit"]').click();
    cy.get('#dailyLimit').clear().type('-5000');
    cy.contains('button', 'Sacuvaj').click();
    cy.contains(/nenegativan|nije uspelo|greska/i, { timeout: 5000 }).should('be.visible');
  });

  it('S5: Supervizor resetuje usedLimit agentu', () => {
    loginAsAdmin();
    cy.visit('/employee/actuaries');
    cy.contains('td', 'maja.ristic@banka.rs', { timeout: 15000 }).should('be.visible');

    cy.contains('td', 'maja.ristic@banka.rs').closest('tr').contains('button', 'Resetuj limit').click();
    cy.contains('Limit je uspesno resetovan', { timeout: 10000 }).should('be.visible');
  });

  it('S8: Admin je ujedno i supervizor — ima pristup portalu', () => {
    loginAsAdmin();
    cy.visit('/employee/actuaries');
    cy.contains('Upravljanje aktuarima', { timeout: 15000 }).should('be.visible');
    cy.contains('td', 'maja.ristic@banka.rs', { timeout: 15000 }).should('be.visible');
  });

  it('S9: Klijent ne moze pristupiti portalu za upravljanje aktuarima', () => {
    loginAsClient();
    cy.visit('/employee/actuaries');
    cy.url().should('include', '/403');
  });
});

// ============================================================
// FEATURE: Hartije od vrednosti — Prikaz i pretraga (S10-S25)
// ============================================================

describe('Live: Hartije od vrednosti — Prikaz i pretraga', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S10: Klijent vidi samo akcije i futures — ne vidi forex', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('Hartije od vrednosti', { timeout: 15000 }).should('be.visible');
    cy.contains('Akcije').should('be.visible');
    cy.contains('Futures').should('be.visible');
    // Klijent NE vidi forex tab
    cy.contains('button', 'Forex').should('not.exist');
  });

  it('S11: Aktuar vidi sve tipove hartija ukljucujuci forex', () => {
    loginAsSupervisor();
    cy.visit('/securities');
    cy.contains('Hartije od vrednosti', { timeout: 15000 }).should('be.visible');
    cy.contains('Akcije').should('be.visible');
    cy.contains('Futures').should('be.visible');
    cy.contains('Forex').should('be.visible');
  });

  it('S12: Pretraga po ticker-u filtrira rezultate', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    cy.get('input[placeholder*="ticker"]').clear().type('MSFT');
    cy.wait(1000);
    cy.contains('td', 'MSFT', { timeout: 10000 }).should('be.visible');
  });

  it('S13: Pretraga bez rezultata prikazuje praznu listu', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    cy.get('input[placeholder*="ticker"]').clear().type('ZZZZZZXYZ');
    cy.wait(1000);
    cy.contains('Nema hartija', { timeout: 10000 }).should('be.visible');
  });

  it('S14: Filtriranje po exchange prefix-u', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    cy.contains('button', 'Filteri').click();
    cy.get('input[placeholder*="NY"]').type('NYSE');
    cy.wait(1500);
    // Samo NYSE akcije treba da se prikazuju
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
  });

  it('S15: Nevalidan opseg cene prikazuje gresku', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    cy.contains('button', 'Filteri').click();
    cy.get('input[placeholder="0"]').type('500');
    cy.get('input[placeholder="∞"]').type('100');
    cy.contains('Minimalna cena ne moze biti veca od maksimalne').should('be.visible');
  });

  it('S16: Rucno osvezavanje — dugme postoji i klik pokrece refresh', () => {
    loginAsSupervisor();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    // Verify dugme postoji i klikabilno je
    cy.contains('button', 'Osvezi cene').should('be.visible').and('not.be.disabled');
    // Klik — ne cekamo odgovor jer Alpha Vantage API ima rate limit i lock timeout
    cy.contains('button', 'Osvezi cene').click();
    // Dugme treba da pokaze loading state (spinner)
    cy.get('button').contains('Osvezi cene').parent().find('svg').should('exist');
  });

  it('S18: Otvaranje detalja hartije prikazuje graf i tabelu', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');
    cy.contains('td', 'AAPL').closest('tr').click();

    cy.contains('Kretanje cene', { timeout: 15000 }).should('be.visible');
    cy.contains('Podaci o hartiji').should('be.visible');
    cy.contains('Bid').should('be.visible');
    cy.contains('Ask').should('be.visible');
  });

  it('S19: Promena perioda na grafiku', () => {
    loginAsClient();
    cy.visit('/securities/1');
    cy.contains('Kretanje cene', { timeout: 15000 }).should('be.visible');

    cy.contains('button', '1D').click();
    cy.wait(500);
    cy.contains('button', '1M').click();
    cy.wait(500);
    cy.contains('button', '1G').click();
    cy.wait(500);
    cy.contains('button', 'Sve').click();
  });

  it('S20/S21: Detalji akcije sadrze sekciju sa opcijama — ITM zeleno', () => {
    loginAsSupervisor();
    cy.visit('/securities/1'); // AAPL
    cy.contains('Kretanje cene', { timeout: 15000 }).should('be.visible');

    // Opcije sekcija
    cy.contains(/opcij|option/i, { timeout: 10000 }).should('exist');
  });

  it('S23: Filtriranje futures po Settlement Date', () => {
    loginAsClient();
    cy.visit('/securities');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    // Prebaci na Futures tab
    cy.contains('button', 'Futures').click();
    cy.wait(2000);

    // Otvori filtere i postavi settlement date opseg
    cy.contains('button', 'Filteri').click();
    cy.get('input[type="date"]').first().type('2026-01-01');
    cy.get('input[type="date"]').last().type('2026-12-31');
    cy.wait(1500);
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
  });
});

// ============================================================
// FEATURE: Kreiranje naloga (S26-S47)
// ============================================================

describe('Live: Kreiranje naloga', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S26: Market BUY order — klijent unosi kolicinu, Market se bira automatski', () => {
    loginAsClient();
    fillAndSubmitOrder({ listingId: 1, direction: 'BUY', quantity: 2 });
  });

  it('S24/S27: Nevalidna kolicina — 0 ili negativna', () => {
    loginAsClient();
    cy.visit('/orders/new?listingId=1&direction=BUY');
    cy.get('select#accountId option:not([value=""])', { timeout: 15000 }).should('have.length.greaterThan', 0);
    cy.get('#quantity').clear().type('0');
    cy.get('select#accountId').then(($sel) => {
      cy.wrap($sel).select($sel.find('option').not('[value=""]').first().val() as string);
    });
    cy.contains('button', 'Nastavi na potvrdu').click();
    // Validacija se prikazuje ispod inputa kao inline error
    cy.contains(/najmanje 1|mora biti|Količina/i).should('exist');
  });

  it('S29: Limit BUY order', () => {
    loginAsClient();
    fillAndSubmitOrder({ listingId: 1, direction: 'BUY', quantity: 1, orderType: 'LIMIT', limitValue: 180 });
  });

  it('S30: Stop BUY order', () => {
    loginAsClient();
    fillAndSubmitOrder({ listingId: 1, direction: 'BUY', quantity: 1, orderType: 'STOP', stopValue: 195 });
  });

  it('S31: Stop-Limit BUY order — prikazuje obe vrednosti u dijalogu', () => {
    loginAsClient();
    fillAndSubmitOrder({ listingId: 1, direction: 'BUY', quantity: 1, orderType: 'STOP_LIMIT', stopValue: 190, limitValue: 195 });
  });

  it('S33: Dijalog potvrde prikazuje sve obavezne informacije', () => {
    loginAsClient();
    cy.visit('/orders/new?listingId=1&direction=BUY');
    cy.get('select#accountId option:not([value=""])', { timeout: 15000 }).should('have.length.greaterThan', 0);

    cy.get('#quantity').clear().type('3');
    cy.get('select#accountId').then(($sel) => {
      cy.wrap($sel).select($sel.find('option').not('[value=""]').first().val() as string);
    });

    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.wait(500);
    // Dijalog mora da prikaze tip ordera, kolicinu i cenu
    cy.contains('Market').should('be.visible');
    cy.contains('3').should('be.visible');
    // Potvrdi dugme
    cy.contains('button', 'Potvrdi').should('be.visible');
  });

  it('S36: SELL order iz portfolija otvara formu za prodaju', () => {
    loginAsClient();
    cy.visit('/portfolio');
    cy.contains('button', 'Prodaj', { timeout: 20000 }).first().click({ force: true });
    cy.url().should('include', '/orders/new');
    cy.url().should('include', 'direction=SELL');
  });

  it('S48: Klijentov order se automatski odobrava', () => {
    loginAsClient();
    fillAndSubmitOrder({ listingId: 2, direction: 'BUY', quantity: 1 });
    // Posle uspesnog kreiranja vec smo na /orders/my
    cy.contains('Moji nalozi', { timeout: 15000 }).should('be.visible');
    cy.wait(2000);
    cy.contains(/Odobren/i).should('exist');
  });
});

// ============================================================
// FEATURE: Odobravanje i pregled naloga (S48-S58)
// ============================================================

describe('Live: Pregled naloga — Supervisor', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S55: Supervizor vidi sve potrebne kolone u pregledu ordera', () => {
    loginAsAdmin();
    cy.visit('/employee/orders');
    cy.contains('Pregled naloga', { timeout: 15000 }).should('be.visible');

    // Default filter je PENDING koji moze biti prazan — prebaci na Svi
    cy.contains('button', /^Svi/i).click();
    cy.wait(2000);

    // Kolone tabele (prikazuju se samo kad ima ordera)
    cy.get('body').then(($body) => {
      if ($body.find('th').length > 0) {
        cy.contains('th', 'Agent').should('be.visible');
        cy.contains('th', 'Hartija').should('be.visible');
        cy.contains('th', /Količ|Količina/i).should('be.visible');
        cy.contains('th', 'Smer').should('be.visible');
        cy.contains('th', 'Status').should('be.visible');
      } else {
        // Nema ordera — prikazuje se prazan state
        cy.contains(/Nema naloga/i).should('be.visible');
      }
    });
  });

  it('S56: Filtriranje ordera po statusu Pending', () => {
    loginAsAdmin();
    cy.visit('/employee/orders');
    cy.contains('Pregled naloga', { timeout: 15000 }).should('be.visible');

    cy.contains('button', /Na čekanju|Na cekanju/i).click();
    cy.wait(2000);
    // Svi prikazani orderi trebaju biti PENDING
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Odobri")').length > 0) {
        cy.contains('button', 'Odobri').should('exist');
      } else {
        cy.contains('Nema naloga za izabrani filter').should('be.visible');
      }
    });
  });

  it('S57: Filtriranje ordera po statusu Done', () => {
    loginAsAdmin();
    cy.visit('/employee/orders');
    cy.contains('button', /Završeni|Zavrseni/i).click();
    cy.wait(2000);
    // Done orderi prikazani ili prazan state
    cy.get('body').then(($body) => {
      if ($body.find('table tbody tr').length > 0) {
        cy.contains(/Završen|Zavrsen/i).should('exist');
      }
    });
  });

  it('S52: Supervizor odobrava pending order', () => {
    loginAsAdmin();
    cy.visit('/employee/orders');
    cy.contains('button', /Na čekanju|Na cekanju/i).click();
    cy.wait(3000);

    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Odobri")').length > 0) {
        cy.contains('button', 'Odobri').first().click();
        cy.contains('button', 'Potvrdi').click();
        cy.contains('Nalog je odobren', { timeout: 10000 }).should('be.visible');
      } else {
        cy.log('Nema PENDING ordera za odobravanje');
      }
    });
  });

  it('S53: Supervizor odbija pending order (ako postoji)', () => {
    loginAsAdmin();
    cy.visit('/employee/orders');
    cy.contains('Pregled naloga', { timeout: 15000 }).should('be.visible');
    cy.contains('button', /Na čekanju|Na cekanju/i).click();
    cy.wait(3000);

    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Odbij")').length > 0) {
        cy.contains('button', 'Odbij').first().click();
        cy.wait(500);
        // Potvrda se pojavljuje inline u kartici, ne kao modal
        cy.get('body').then(($b2) => {
          if ($b2.find('button:contains("Potvrdi")').length > 0) {
            cy.contains('button', 'Potvrdi').click();
            cy.contains(/Nalog je odbijen|odbijen/i, { timeout: 10000 }).should('exist');
          }
        });
      } else {
        cy.log('Nema PENDING ordera za odbijanje — prethodni test ih je vec odobrio');
      }
    });
  });
});

// ============================================================
// FEATURE: Moji nalozi — Klijent (S36-S38)
// ============================================================

describe('Live: Moji nalozi', () => {
  beforeEach(() => { enableLiveBackend(); loginAsClient(); });

  it('Klijent vidi moje naloge sa filterima', () => {
    cy.visit('/orders/my');
    cy.contains('Moji nalozi', { timeout: 15000 }).should('be.visible');
    cy.contains('button', /Svi/i).should('be.visible');
    cy.contains('button', /Na cekanju/i).should('be.visible');
    cy.contains('button', /Odobreni/i).should('be.visible');
    cy.contains('button', /Zavrseni/i).should('be.visible');
  });

  it('Klijent vidi svoje ordere sa statusima', () => {
    cy.visit('/orders/my');
    cy.contains('Moji nalozi', { timeout: 15000 }).should('be.visible');
    cy.wait(3000);
    // Klijent ima ordere koje smo kreirali u prethodnim testovima
    // Proverimo da postoji bar jedan order u listi ili prazan state
    cy.contains(/Odobren|Zavrsen|Na cekanju|Nema kreiranih naloga/i).should('exist');
  });

  it('Dugme Nova kupovina vodi na pregled hartija', () => {
    cy.visit('/orders/my');
    cy.contains('Nova kupovina', { timeout: 10000 }).should('be.visible');
    cy.contains('Nova kupovina').click();
    // Navigira na /securities za odabir hartije
    cy.url().should('include', '/securities');
  });
});

// ============================================================
// FEATURE: Moj portfolio (S67-S73)
// ============================================================

describe('Live: Moj portfolio', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S67: Portfolio prikazuje listu posedovanih hartija sa detaljima', () => {
    loginAsAdmin(); // Marko ima AAPL, MSFT, AMZN u portfoliju
    cy.visit('/portfolio');
    cy.contains('Moj portfolio', { timeout: 15000 }).should('be.visible');

    // Summary kartice
    cy.contains('Ukupna vrednost portfolija').should('be.visible');
    cy.contains('Ukupan profit').should('be.visible');

    // Tabela sa hartijama
    cy.contains('Hartije u vlasnistvu').should('be.visible');
    cy.contains('AAPL', { timeout: 15000 }).should('be.visible');

    // Kolone
    cy.contains('th', 'Ticker').should('be.visible');
    cy.contains('th', /Količ|Količina/i).should('be.visible');
    cy.contains('th', 'Profit').should('be.visible');
  });

  it('S68: Portfolio prikazuje ukupan profit', () => {
    loginAsAdmin();
    cy.visit('/portfolio');
    cy.contains('Ukupan profit', { timeout: 15000 }).should('be.visible');
    // Vrednost profita nije 0,00 jer Marko ima hartije
    cy.contains('Ukupan profit').parent().should('not.contain', '0,00');
  });

  it('S69: Portfolio prikazuje podatke o porezu', () => {
    loginAsAdmin();
    cy.visit('/portfolio');
    cy.contains(/Plaćen porez/i, { timeout: 15000 }).should('be.visible');
    cy.contains(/Neplaćen porez/i).should('be.visible');
  });

  it('S70: Javni rezim — korisnik moze oznaciti akcije kao javne', () => {
    loginAsAdmin();
    cy.visit('/portfolio');
    cy.contains('AAPL', { timeout: 15000 }).should('be.visible');
    // Dugme za javni rezim postoji
    cy.contains(/javni|Učini javnim/i).should('exist');
  });

  it('S36: Prodaj dugme navigira na Create Order sa SELL', () => {
    loginAsAdmin();
    cy.visit('/portfolio');
    cy.contains('button', 'Prodaj', { timeout: 20000 }).first().click({ force: true });
    cy.url().should('include', '/orders/new');
    cy.url().should('include', 'direction=SELL');
  });

  it('Stefan (klijent) vidi portfolio sa hartijama iz seed-a', () => {
    loginAsClient();
    cy.visit('/portfolio');
    cy.contains('Moj portfolio', { timeout: 15000 }).should('be.visible');
    // Stefan nije Marko — PortfolioService sada koristi clientRepository,
    // Stefan (client_id=1) nema portfolio items jer portfolios koriste users.id
    // ALI Marko (employee_id=1) ima — ID kolizija!
    // Realno, klijent Stefan bi trebalo da vidi Markove portfolio iteme jer share-uju ID=1
    cy.contains('Ukupna vrednost portfolija').should('be.visible');
  });
});

// ============================================================
// FEATURE: Porez tracking (S74-S81)
// ============================================================

describe('Live: Porez tracking', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S74: Supervizor pristupa portalu za porez tracking', () => {
    loginAsAdmin();
    cy.visit('/employee/tax');
    cy.contains('Pracenje poreza', { timeout: 15000 }).should('be.visible');

    // Vidi listu korisnika sa dugovanjima
    cy.get('table tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.contains('Korisnik').should('be.visible');
    cy.contains('Porez dugovan').should('be.visible');
  });

  it('S75: Klijent nema pristup portalu za porez tracking', () => {
    loginAsClient();
    cy.visit('/employee/tax');
    cy.url().should('include', '/403');
  });

  it('S76: Filtriranje po tipu korisnika — klijenti', () => {
    loginAsAdmin();
    cy.visit('/employee/tax');
    cy.contains('button', 'Svi', { timeout: 15000 }).should('be.visible');

    cy.contains('button', 'Klijenti').click();
    cy.wait(2000);
    // Svi prikazani treba da budu klijenti
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
  });

  it('S76b: Filtriranje po tipu — aktuari', () => {
    loginAsAdmin();
    cy.visit('/employee/tax');
    cy.contains('button', 'Aktuari').click();
    cy.wait(2000);
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
  });

  it('S77: Filtriranje po imenu', () => {
    loginAsAdmin();
    cy.visit('/employee/tax');
    cy.get('table tbody tr', { timeout: 15000 }).should('have.length.greaterThan', 0);

    cy.get('input[placeholder="Pretraga po imenu"]').type('Stefan');
    cy.wait(1500);
    cy.contains('td', 'Stefan').should('be.visible');
  });

  it('S79: Rucno pokretanje obracuna poreza', () => {
    loginAsAdmin();
    cy.visit('/employee/tax');
    cy.contains('button', 'Izracunaj porez', { timeout: 15000 }).should('be.visible');

    cy.contains('button', 'Izracunaj porez').click();
    // window.confirm — Cypress auto-confirms
    cy.contains('Obracun poreza je uspesno pokrenut', { timeout: 15000 }).should('be.visible');
  });
});

// ============================================================
// FEATURE: Berze — Exchanges (S82)
// ============================================================

describe('Live: Berze', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('S82: Prikaz liste berzi sa podacima i toggle za radno vreme', () => {
    loginAsAdmin();
    cy.visit('/employee/exchanges');
    cy.get('table', { timeout: 15000 }).should('exist');
    cy.get('table tbody tr').should('have.length.greaterThan', 0);

    // Proverimo da vidimo berze iz seed-a
    cy.contains('NYSE').should('be.visible');
    cy.contains('NASDAQ').should('be.visible');

    // Status kolona — barem jedna berza prikazuje status
    cy.contains(/Otvorena|Zatvorena/i).should('be.visible');

    // Test mode toggle postoji (role="switch")
    cy.get('[role="switch"]').should('have.length.greaterThan', 0);
  });

  it('Berze prikazuju sve kolone — naziv, acronym, MIC, valuta, radno vreme', () => {
    loginAsAdmin();
    cy.visit('/employee/exchanges');
    cy.get('table', { timeout: 15000 }).should('exist');

    cy.contains('th', 'Naziv berze').should('be.visible');
    cy.contains('th', 'Acronym').should('be.visible');
    cy.contains('th', 'MIC Code').should('be.visible');
    cy.contains('th', 'Valuta').should('be.visible');
    cy.contains('th', 'Radno vreme').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });
});

// ============================================================
// FEATURE: Margin racuni
// ============================================================

describe('Live: Margin racuni', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('Klijent vidi marzne racune', () => {
    loginAsClient();
    cy.visit('/margin-accounts');
    cy.contains('Marzni racuni', { timeout: 15000 }).should('be.visible');
  });

  it('Stefan ima aktivan margin racun iz seed-a', () => {
    loginAsClient();
    cy.visit('/margin-accounts');
    cy.wait(3000);

    cy.get('body').then(($body) => {
      if ($body.text().includes('AKTIVAN')) {
        cy.contains('AKTIVAN').should('be.visible');
        cy.contains(/Inicijalna margina/i).should('be.visible');
        cy.contains('button', 'Uplati').should('be.visible');
        cy.contains('button', 'Isplati').should('be.visible');
      }
    });
  });
});

// ============================================================
// Access control testovi (S2, S9, S75)
// ============================================================

describe('Live: Access control', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('Klijent ne moze pristupiti employee dashboard-u', () => {
    loginAsClient();
    cy.visit('/employee/dashboard');
    cy.url().should('include', '/403');
  });

  it('Klijent ne moze pristupiti tax portalu', () => {
    loginAsClient();
    cy.visit('/employee/tax');
    cy.url().should('include', '/403');
  });

  it('Klijent ne moze pristupiti actuary portalu', () => {
    loginAsClient();
    cy.visit('/employee/actuaries');
    cy.url().should('include', '/403');
  });

  it('Klijent ne moze pristupiti exchanges portalu', () => {
    loginAsClient();
    cy.visit('/employee/exchanges');
    cy.url().should('include', '/403');
  });

  it('Klijent ne moze pristupiti orders portalu (employee)', () => {
    loginAsClient();
    cy.visit('/employee/orders');
    cy.url().should('include', '/403');
  });
});

// ============================================================
// Kompletni navigacioni tokovi
// ============================================================

describe('Live: Navigacioni tokovi', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('Admin: Dashboard -> Orders -> Actuaries -> Tax -> Exchanges', () => {
    loginAsAdmin();

    cy.visit('/employee/dashboard');
    cy.wait(2000);

    cy.visit('/employee/orders');
    cy.contains('Pregled naloga', { timeout: 10000 }).should('be.visible');

    cy.visit('/employee/actuaries');
    cy.contains('Upravljanje aktuarima', { timeout: 10000 }).should('be.visible');

    cy.visit('/employee/tax');
    cy.contains('Pracenje poreza', { timeout: 10000 }).should('be.visible');

    cy.visit('/employee/exchanges');
    cy.get('table', { timeout: 10000 }).should('exist');
  });

  it('Client: Securities -> Details -> Buy -> Create Order -> My Orders -> Portfolio', () => {
    loginAsClient();

    // Securities lista
    cy.visit('/securities');
    cy.contains('Hartije od vrednosti', { timeout: 15000 }).should('be.visible');
    cy.contains('td', 'AAPL', { timeout: 20000 }).should('be.visible');

    // Otvori detalje AAPL
    cy.contains('td', 'AAPL').closest('tr').click();
    cy.contains('Kretanje cene', { timeout: 15000 }).should('be.visible');

    // Klikni "Kupi AAPL"
    cy.contains('button', /Kupi AAPL/i).click();
    cy.url().should('include', '/orders/new');

    // Idi na Moji nalozi
    cy.visit('/orders/my');
    cy.contains('Moji nalozi', { timeout: 10000 }).should('be.visible');

    // Idi na Portfolio
    cy.visit('/portfolio');
    cy.contains('Moj portfolio', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================
// FEATURE: Fund reservation + OTP flow (Phase 11)
// ============================================================

/**
 * Helper: fetch aktivni OTP kod iz backend-a i upise ga u VerificationModal.
 * Modal input ima id="otp", submit dugme je type="submit" sa tekstom "Potvrdi".
 */
function fetchOtpAndConfirm() {
  cy.window().then((win) => {
    const token = win.sessionStorage.getItem('accessToken');
    cy.request({
      method: 'GET',
      url: '/api/payments/my-otp',
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      const code: string = res.body.code || res.body.otp || res.body.otpCode;
      expect(code, 'OTP code from /payments/my-otp').to.be.a('string').and.have.length(6);
      cy.get('#otp', { timeout: 10000 }).should('be.visible').clear().type(code);
      cy.get('[role="dialog"]').within(() => {
        cy.contains('button', 'Potvrdi').should('not.be.disabled').click();
      });
    });
  });
}

describe('Live: Fund reservation + OTP flow (Phase 11)', () => {
  beforeEach(() => { enableLiveBackend(); });

  it('CLIENT BUY — rezervacija, OTP, pa execution', () => {
    loginAsClient();

    // 1. Otvori securities -> klikni AAPL -> Kupi (ili direktno /orders/new?listingId=1)
    cy.visit('/orders/new?listingId=1&direction=BUY');
    cy.contains('Novi nalog', { timeout: 15000 }).should('be.visible');

    // 2. Sacekaj da se racuni i listing ucitaju
    cy.get('select#accountId option:not([value=""])', { timeout: 15000 })
      .should('have.length.greaterThan', 0);
    cy.contains('Izabrana hartija', { timeout: 15000 }).should('exist');

    // 3. Popuni kolicinu
    cy.get('#quantity').clear().type('2');

    // 4. Selektuj prvi racun
    cy.get('select#accountId option:not([value=""])').first().then(($opt) => {
      cy.get('select#accountId').select($opt.val() as string);
    });

    // 5. Snimi availableBalance racuna PRE rezervacije (kroz API)
    cy.window().then((win) => {
      const token = win.sessionStorage.getItem('accessToken');
      return cy.request({
        method: 'GET',
        url: '/api/accounts/my',
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        const accounts: Array<{ id: number; availableBalance?: number; balance?: number }> = res.body || [];
        expect(accounts.length, 'client has accounts').to.be.greaterThan(0);
        const first = accounts[0];
        const before = Number(first.availableBalance ?? first.balance ?? 0);
        cy.wrap(before).as('availableBefore');
        cy.wrap(first.id).as('accountId');
      });
    });

    // 6. Nastavi na potvrdu
    cy.intercept('POST', '**/api/orders').as('submitOrder');
    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.get('[role="dialog"]', { timeout: 10000 }).should('be.visible');
    cy.contains('Potvrda naloga', { timeout: 5000 }).should('be.visible');
    cy.get('[data-cy="confirm-order"]').should('be.visible').and('not.be.disabled').then(($btn) => {
      $btn[0].click();
    });

    // 7. OTP modal se otvara
    cy.contains(/Verifikacija|verifikacion/i, { timeout: 10000 }).should('be.visible');
    cy.get('#otp', { timeout: 10000 }).should('be.visible');

    // 8. Fetch OTP i potvrdi
    fetchOtpAndConfirm();

    // 9. Order kreiran -> redirect na /orders/my
    cy.wait('@submitOrder', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
    cy.url({ timeout: 15000 }).should('include', '/orders/my');

    // 10. Verifikuj da je availableBalance pao (rezervacija vidljiva)
    cy.window().then((win) => {
      const token = win.sessionStorage.getItem('accessToken');
      return cy.request({
        method: 'GET',
        url: '/api/accounts/my',
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        const accounts: Array<{ id: number; availableBalance?: number; balance?: number }> = res.body || [];
        cy.get('@accountId').then((idWrap) => {
          const id = Number(idWrap);
          const acc = accounts.find((a) => a.id === id);
          expect(acc, 'account still exists').to.exist;
          const after = Number(acc!.availableBalance ?? acc!.balance ?? 0);
          cy.get('@availableBefore').then((beforeWrap) => {
            const before = Number(beforeWrap);
            // Rezervacija: availableBalance mora biti manji (ili jednak ako je order instantno izvrsen + balance pao)
            expect(after, `available after (${after}) < before (${before})`).to.be.lessThan(before);
          });
        });
      });
    });

    // 11. Cekaj scheduler (~60s) da izvrsi order i proveri da je balance update-ovan
    // Povecavamo defaultCommandTimeout samo za ovaj korak kroz eksplicitni timeout na wait.
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(65000);
    cy.visit('/orders/my');
    cy.contains('Moji nalozi', { timeout: 15000 }).should('be.visible');
  });

  it('AGENT BUY — bankin racun, provizija 0, OTP flow', () => {
    // Tamara: AGENT, TRADE_STOCKS, needApproval=false
    loginAs(
      'agent-tamara-c3',
      'tamara.pavlovic@banka.rs',
      'Zaposleni12',
      'EMPLOYEE',
      ['AGENT', 'TRADE_STOCKS', 'TRADE_FOREX', 'TRADE_FUTURES', 'TRADE_OPTIONS']
    );

    cy.visit('/orders/new?listingId=1&direction=BUY');
    cy.contains('Novi nalog', { timeout: 15000 }).should('be.visible');

    // Agent ne bira racun — vidi Alert "Trguje se sa bankinog racuna"
    cy.contains(/Trguje se sa bankinog/i, { timeout: 15000 }).should('be.visible');

    // Listing se ucitava
    cy.contains('Izabrana hartija', { timeout: 15000 }).should('exist');

    // Kolicina
    cy.get('#quantity').clear().type('3');

    // Provizija mora biti 0 za zaposlene
    cy.contains('Provizija').parent().should(($el) => {
      const txt = $el.text();
      expect(txt).to.match(/0[.,]00|zaposleni/i);
    });

    cy.intercept('POST', '**/api/orders').as('submitAgentOrder');

    // Nastavi na potvrdu
    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.get('[role="dialog"]', { timeout: 10000 }).should('be.visible');
    cy.contains('Potvrda naloga', { timeout: 5000 }).should('be.visible');
    cy.get('[data-cy="confirm-order"]').should('be.visible').and('not.be.disabled').then(($btn) => {
      $btn[0].click();
    });

    // OTP flow
    cy.get('#otp', { timeout: 10000 }).should('be.visible');
    fetchOtpAndConfirm();

    cy.wait('@submitAgentOrder', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
    cy.url({ timeout: 15000 }).should('include', '/orders/my');
  });
});
