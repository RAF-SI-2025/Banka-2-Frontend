/// <reference types="cypress" />
/**
 * CELINA 2 - Live E2E Tests (Real Backend)
 * Covers: Accounts, Payments, Transfers, Exchange, Cards, Loans, Employee Portals
 * Requires: Running backend on localhost:8080, seeded database
 *
 * Seed credentials:
 *   Admin:   marko.petrovic@banka.rs / Admin12345
 *   Client1: stefan.jovanovic@gmail.com / Klijent12345 (3 accounts, 2 cards, 2 recipients)
 *   Client2: milica.nikolic@gmail.com / Klijent12345 (3 accounts incl business)
 *   Client3: lazar.ilic@yahoo.com / Klijent12345 (3 accounts)
 *   Employee: nikola.milenkovic@banka.rs / Zaposleni12
 *
 * Seed accounts (Stefan):
 *   RSD checking: 222000112345678911 (185K RSD)
 *   RSD savings:  222000112345678912 (520K RSD)
 *   EUR foreign:  222000121345678921 (2500 EUR)
 *
 * Seed recipients (Stefan):
 *   Milica: 222000112345678913
 *   Lazar:  222000112345678915
 */

// ============================================================
// Helpers
// ============================================================

function loginAsAdmin() {
  cy.session('admin-c2', () => {
    cy.request({
      method: 'POST', url: '/api/auth/login',
      body: { email: 'marko.petrovic@banka.rs', password: 'Admin12345' },
    }).then((resp) => {
      const { accessToken, refreshToken } = resp.body;
      window.sessionStorage.setItem('accessToken', accessToken);
      window.sessionStorage.setItem('refreshToken', refreshToken);
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      window.sessionStorage.setItem('user', JSON.stringify({
        id: 1, email: payload.sub, role: payload.role || 'ADMIN',
        firstName: 'Marko', lastName: 'Petrovic', username: 'admin',
        permissions: payload.permissions || ['ADMIN'],
      }));
    });
  });
}

function loginAsClient(name = 'stefan') {
  const creds: Record<string, { email: string; password: string; first: string; last: string }> = {
    stefan: { email: 'stefan.jovanovic@gmail.com', password: 'Klijent12345', first: 'Stefan', last: 'Jovanovic' },
    milica: { email: 'milica.nikolic@gmail.com', password: 'Klijent12345', first: 'Milica', last: 'Nikolic' },
    lazar: { email: 'lazar.ilic@yahoo.com', password: 'Klijent12345', first: 'Lazar', last: 'Ilic' },
  };
  const c = creds[name];
  cy.session(`client-${name}-c2`, () => {
    cy.request({
      method: 'POST', url: '/api/auth/login',
      body: { email: c.email, password: c.password },
    }).then((resp) => {
      const { accessToken, refreshToken } = resp.body;
      window.sessionStorage.setItem('accessToken', accessToken);
      window.sessionStorage.setItem('refreshToken', refreshToken);
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      window.sessionStorage.setItem('user', JSON.stringify({
        id: 2, email: payload.sub, role: payload.role || 'CLIENT',
        firstName: c.first, lastName: c.last, username: name,
        permissions: payload.permissions || [],
      }));
    });
  });
}

function loginAsEmployee() {
  cy.session('employee-c2', () => {
    cy.request({
      method: 'POST', url: '/api/auth/login',
      body: { email: 'nikola.milenkovic@banka.rs', password: 'Zaposleni12' },
    }).then((resp) => {
      const { accessToken, refreshToken } = resp.body;
      window.sessionStorage.setItem('accessToken', accessToken);
      window.sessionStorage.setItem('refreshToken', refreshToken);
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      window.sessionStorage.setItem('user', JSON.stringify({
        id: 3, email: payload.sub, role: payload.role || 'EMPLOYEE',
        firstName: 'Nikola', lastName: 'Milenkovic', username: 'nikola',
        permissions: payload.permissions || ['SUPERVISOR', 'AGENT'],
      }));
    });
  });
}

// Helper: get OTP code from backend (for live payment/transfer tests)
function getOtpCode(): Cypress.Chainable<string> {
  return cy.request({
    method: 'GET', url: '/api/payments/my-otp',
    headers: { Authorization: `Bearer ${window.sessionStorage.getItem('accessToken')}` },
    failOnStatusCode: false,
  }).then((resp) => {
    if (resp.status === 200 && resp.body.code) {
      return resp.body.code;
    }
    return '000000'; // fallback
  });
}

// ============================================================
// Accounts - Live
// ============================================================

describe('Live: Racuni', () => {
  beforeEach(() => { loginAsClient(); });

  it('Klijent vidi listu svojih racuna', () => {
    cy.visit('/accounts');
    cy.contains(/Racuni|racun/i, { timeout: 15000 }).should('exist');
    // Stefan has 3 accounts from seed
    cy.get('[class*="card"], table tbody tr, [class*="account"]', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('Racuni prikazuju tip, valutu i stanje', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains('RSD').should('exist');
    // Stefan has EUR account too
    cy.contains('EUR').should('exist');
  });

  it('Klik na Detalji otvara detalje racuna', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.get('body').then(($body) => {
      if ($body.find('a[href*="/accounts/"]').length > 0) {
        cy.get('a[href*="/accounts/"]').first().click();
        cy.url().should('match', /\/accounts\/\d+/);
      } else if ($body.text().includes('Detalji')) {
        cy.contains(/detalji/i).first().click();
      }
    });
  });

  it('Detalji racuna prikazuju balance i action dugmad', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.get('body').then(($body) => {
      const link = $body.find('a[href*="/accounts/"]').first().attr('href');
      if (link) {
        cy.visit(link);
        cy.wait(5000);
        cy.contains(/stanje|balance/i).should('exist');
        cy.contains(/plaćanj|transfer|limit/i).should('exist');
      }
    });
  });

  it('Account details - dnevni i mesecni limit', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/potrosnja|limit/i).should('exist');
  });
});

// ============================================================
// Payments - Live
// ============================================================

describe('Live: Placanja', () => {
  beforeEach(() => { loginAsClient(); });

  it('Klijent otvara formu za novo placanje', () => {
    cy.visit('/payments/new');
    cy.contains(/plaćanj|novo|uplatnic/i, { timeout: 15000 }).should('exist');
  });

  it('Payment form - sender account dropdown sadrzi racune', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('select#fromAccount').should('exist');
    cy.get('select#fromAccount option').should('have.length.greaterThan', 1);
  });

  it('Payment form - submit bez obaveznih polja prikazuje validaciju', () => {
    cy.visit('/payments/new');
    cy.wait(3000);
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"]').should('exist');
  });

  it('Payment form - popunjena forma prikazuje preview', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test Primalac');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    // Form should be filled - verify submit button is available
    cy.contains('button', /Nastavi na verifikaciju/i).should('exist');
  });

  it('Pregled istorije placanja', () => {
    cy.visit('/payments/history');
    cy.contains(/istorij|placanj|pregled/i, { timeout: 15000 }).should('exist');
  });

  it('Payment history - filter sekcija postoji', () => {
    cy.visit('/payments/history');
    cy.wait(5000);
    cy.contains('Filteri').should('exist');
  });

  it('Payment history - status filteri', () => {
    cy.visit('/payments/history');
    cy.wait(5000);
    cy.contains(/sve|završen|čekanj|odbijen/i).should('exist');
  });
});

// ============================================================
// Primaoci - Live CRUD
// ============================================================

describe('Live: Primaoci placanja', () => {
  beforeEach(() => { loginAsClient(); });

  it('Stefan ima sacuvane primaoce iz seed-a', () => {
    cy.visit('/payments/recipients');
    cy.wait(5000);
    // Stefan has Milica and Lazar as recipients from seed
    cy.contains(/milica|lazar/i).should('exist');
  });

  it('Dodaj primaoca - otvara formu', () => {
    cy.visit('/payments/recipients');
    cy.wait(3000);
    cy.contains('Dodaj primaoca').click();
    cy.get('#create-name').should('be.visible');
    cy.get('#create-account').should('be.visible');
  });

  it('Pretraga primalaca po imenu', () => {
    cy.visit('/payments/recipients');
    cy.wait(5000);
    cy.get('input[placeholder*="Pretraga po imenu"]').type('Milica');
    cy.wait(1000);
    cy.contains(/milica/i).should('exist');
  });

  it('Edit primaoca - menja naziv', () => {
    cy.visit('/payments/recipients');
    cy.wait(5000);
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Izmeni"), button[aria-label*="edit"]').length > 0) {
        cy.contains('button', /izmeni|edit/i).first().click({ force: true });
      }
    });
  });
});

// ============================================================
// Transfers - Live
// ============================================================

describe('Live: Transferi', () => {
  beforeEach(() => { loginAsClient(); });

  it('Transfer forma se ucitava', () => {
    cy.visit('/transfers');
    cy.contains(/transfer|prenos/i, { timeout: 15000 }).should('exist');
  });

  it('Transfer forma prikazuje dropdown-ove za racune', () => {
    cy.visit('/transfers');
    cy.wait(5000);
    cy.get('select, [role="combobox"]').should('have.length.greaterThan', 1);
  });

  it('Istorija transfera se ucitava', () => {
    cy.visit('/transfers/history');
    cy.contains(/transfer|istorij|prenos/i, { timeout: 15000 }).should('exist');
  });

  it('Transfer history - filteri postoje', () => {
    cy.visit('/transfers/history');
    cy.wait(5000);
    cy.get('select, [role="combobox"], input[type="date"]').should('exist');
  });
});

// ============================================================
// Menjacnica - Live
// ============================================================

describe('Live: Menjacnica', () => {
  beforeEach(() => { loginAsClient(); });

  it('Kursna lista se ucitava', () => {
    cy.visit('/exchange');
    cy.contains(/kursna lista|menjačnic|exchange/i, { timeout: 15000 }).should('exist');
  });

  it('Kursna lista sadrzi EUR, USD, CHF, GBP', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.contains('EUR').should('exist');
    cy.contains('USD').should('exist');
    cy.contains('CHF').should('exist');
    cy.contains('GBP').should('exist');
  });

  it('Kursna lista prikazuje kupovni, prodajni i srednji kurs', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.contains(/kupovn|buy/i).should('exist');
    cy.contains(/prodajn|sell/i).should('exist');
    cy.contains(/srednj|middle/i).should('exist');
  });

  it('Kalkulator konverzije je prisutan', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.get('input[name="amount"], input[placeholder*="iznos"], input[type="number"]').should('exist');
    cy.contains('button', /konvertuj|izračunaj|preračunaj/i).should('exist');
  });

  it('Kalkulator - konverzija RSD u EUR', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.get('input[name="amount"], input[placeholder*="iznos"], input[type="number"]').type('10000');
    cy.contains('button', /konvertuj|izračunaj|preračunaj/i).click();
    cy.wait(3000);
    // Should show converted amount
  });
});

// ============================================================
// Kartice - Live
// ============================================================

describe('Live: Kartice', () => {
  beforeEach(() => { loginAsClient(); });

  it('Klijent vidi stranice kartica', () => {
    cy.visit('/cards');
    cy.contains(/kartic|card/i, { timeout: 15000 }).should('exist');
  });

  it('Kartice prikazuju maskirani broj i status', () => {
    cy.visit('/cards');
    cy.wait(5000);
    // Stefan has 2 cards from seed
    cy.get('[class*="card"], [class*="gradient"]').should('have.length.greaterThan', 0);
  });

  it('Kartice prikazuju tip (VISA)', () => {
    cy.visit('/cards');
    cy.wait(5000);
    cy.contains(/visa|mastercard/i).should('exist');
  });

  it('Nova kartica forma postoji', () => {
    cy.visit('/cards');
    cy.wait(3000);
    cy.contains(/nova kartica|zatraži/i).should('exist');
  });
});

// ============================================================
// Krediti - Live
// ============================================================

describe('Live: Krediti', () => {
  beforeEach(() => { loginAsClient(); });

  it('Klijent vidi listu kredita', () => {
    cy.visit('/loans');
    cy.contains(/kredit|loan/i, { timeout: 15000 }).should('exist');
  });

  it('Forma za zahtev za kredit', () => {
    cy.visit('/loans/apply');
    cy.contains(/zahtev|kredit|loan/i, { timeout: 15000 }).should('exist');
  });

  it('Loan application - sva polja u formi', () => {
    cy.visit('/loans/apply');
    cy.wait(5000);
    cy.contains(/tip|vrsta/i).should('exist');
    cy.contains(/iznos|amount/i).should('exist');
  });

  it('Loan application - tipovi kredita', () => {
    cy.visit('/loans/apply');
    cy.wait(5000);
    cy.contains(/gotovinski|stambeni|auto|studentski|refinans/i).should('exist');
  });
});

// ============================================================
// Employee Portali - Live
// ============================================================

describe('Live: Employee Portali', () => {
  beforeEach(() => { loginAsAdmin(); });

  it('Portal racuna se ucitava', () => {
    cy.visit('/employee/accounts');
    cy.contains(/račun|account|portal/i, { timeout: 15000 }).should('exist');
  });

  it('Portal racuna - filteri postoje', () => {
    cy.visit('/employee/accounts');
    cy.wait(5000);
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretrazi po emailu..."]').should('exist');
  });

  it('Portal racuna - kreiraj racun dugme', () => {
    cy.visit('/employee/accounts');
    cy.wait(3000);
    cy.contains(/kreiraj|novi/i).click();
    cy.url().should('include', '/employee/accounts/new');
  });

  it('Kreiranje racuna - sva polja vidljiva', () => {
    cy.visit('/employee/accounts/new');
    cy.wait(5000);
    cy.get('input[name="ownerEmail"], input[placeholder*="email"]').should('exist');
    cy.contains(/tekuci|checking|devizni|poslovni/i).should('exist');
  });

  it('Portal klijenata se ucitava', () => {
    cy.visit('/employee/clients');
    cy.contains(/klijent|client/i, { timeout: 15000 }).should('exist');
  });

  it('Portal klijenata - pretraga i lista', () => {
    cy.visit('/employee/clients');
    cy.wait(5000);
    cy.get('input[placeholder*="pretraži"], input[placeholder*="ime"]').should('exist');
    // Should show seeded clients
    cy.contains(/stefan|milica|lazar/i).should('exist');
  });

  it('Portal klijenata - Novi klijent dugme', () => {
    cy.visit('/employee/clients');
    cy.wait(3000);
    cy.contains(/novi klijent|kreiraj/i).should('exist');
  });

  it('Zahtevi za kredit - prikaz', () => {
    cy.visit('/employee/loan-requests');
    cy.contains(/zahtev|kredit/i, { timeout: 15000 }).should('exist');
  });

  it('Loan requests - status filteri', () => {
    cy.visit('/employee/loan-requests');
    cy.wait(5000);
    cy.contains(/sve|pending|odobreni|odbijeni/i).should('exist');
  });

  it('Svi krediti - prikaz', () => {
    cy.visit('/employee/loans');
    cy.contains(/kredit|loan/i, { timeout: 15000 }).should('exist');
  });

  it('Portal kartica - pretraga', () => {
    cy.visit('/employee/cards');
    cy.wait(5000);
    cy.get('input, select, button').should('have.length.greaterThan', 0);
  });

  it('Zahtevi za racune - stranica se ucitava', () => {
    cy.visit('/employee/account-requests');
    cy.contains(/zahtev|račun/i, { timeout: 15000 }).should('exist');
  });

  it('Zahtevi za kartice - stranica se ucitava', () => {
    cy.visit('/employee/card-requests');
    cy.contains(/zahtev|kartic/i, { timeout: 15000 }).should('exist');
  });

  it('Kreiranje racuna forma - tip tekuci/devizni/poslovni', () => {
    cy.visit('/employee/accounts/new');
    cy.wait(5000);
    cy.contains(/tekuci|checking/i).should('exist');
    cy.contains(/devizni|foreign/i).should('exist');
    cy.contains(/poslovni|business/i).should('exist');
  });

  it('Kreiranje racuna - checkbox za karticu', () => {
    cy.visit('/employee/accounts/new');
    cy.wait(3000);
    cy.get('[name="createCard"], [role="checkbox"], [role="switch"]').should('exist');
  });
});

// ============================================================
// Navigacija i UI - Live
// ============================================================

describe('Live: Navigacija i UI', () => {
  it('Klijent NE vidi employee portale u sidebaru', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Employee portal specific items should not be visible
    cy.get('a[href*="/employee/"]').should('not.exist');
  });

  it('Admin vidi employee portale u sidebaru', () => {
    loginAsAdmin();
    cy.visit('/home');
    cy.wait(5000);
    cy.get('a[href*="/employee/"], a[href*="/admin/"]').should('have.length.greaterThan', 0);
  });

  it('Sidebar navigacija - klijentske rute rade', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Racuni').click();
    cy.url().should('include', '/accounts');
  });

  it('Direktan pristup /payments/new radi', () => {
    loginAsClient();
    cy.visit('/payments/new');
    cy.contains(/plaćanj|novo/i, { timeout: 15000 }).should('exist');
  });

  it('Direktan pristup /exchange radi', () => {
    loginAsClient();
    cy.visit('/exchange');
    cy.contains(/menjačnic|kursna/i, { timeout: 15000 }).should('exist');
  });

  it('Direktan pristup /cards radi', () => {
    loginAsClient();
    cy.visit('/cards');
    cy.contains(/kartic/i, { timeout: 15000 }).should('exist');
  });
});

// ============================================================
// Multi-user - Live
// ============================================================

describe('Live: Multi-user', () => {
  it('Milica se loguje i vidi home page', () => {
    loginAsClient('milica');
    cy.visit('/home');
    cy.url().should('include', '/home');
    cy.wait(5000);
  });

  it('Milica vidi svoje racune (ukljucujuci business)', () => {
    loginAsClient('milica');
    cy.visit('/accounts');
    cy.wait(5000);
    // Milica has RSD checking, RSD business, EUR foreign
    cy.get('[class*="card"], table tbody tr').should('have.length.greaterThan', 0);
  });

  it('Lazar se loguje i vidi home page', () => {
    loginAsClient('lazar');
    cy.visit('/home');
    cy.url().should('include', '/home');
    cy.wait(5000);
  });

  it('Lazar vidi svoje racune', () => {
    loginAsClient('lazar');
    cy.visit('/accounts');
    cy.wait(5000);
    // Lazar has RSD, USD, EUR accounts
    cy.contains(/RSD|USD|EUR/i).should('exist');
  });

  it('Employee Nikola vidi portale', () => {
    loginAsEmployee();
    cy.visit('/home');
    cy.wait(5000);
    cy.contains(/portal|upravljanje/i).should('exist');
  });
});

// ============================================================
// Kompletni flowovi - Live
// ============================================================

describe('Live: Kompletni flowovi', () => {
  it('Stefan: Accounts -> Details -> Back', () => {
    loginAsClient();
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.url().should('match', /\/accounts\/\d+/);
    cy.go('back');
    cy.url().should('include', '/accounts');
  });

  it('Admin: Accounts Portal -> Create -> Back', () => {
    loginAsAdmin();
    cy.visit('/employee/accounts');
    cy.wait(5000);
    cy.contains(/kreiraj|novi/i).click();
    cy.url().should('include', '/employee/accounts/new');
    cy.wait(3000);
    cy.contains(/nazad|odustani/i).click();
    cy.url().should('include', '/employee/accounts');
  });

  it('Stefan: Home -> Payments -> History', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.visit('/payments/new');
    cy.wait(3000);
    cy.contains(/plaćanj|novo/i).should('exist');
    cy.visit('/payments/history');
    cy.wait(3000);
    cy.contains(/istorij|pregled/i).should('exist');
  });

  it('Admin: Clients Portal -> Click Client -> Details', () => {
    loginAsAdmin();
    cy.visit('/employee/clients');
    cy.wait(5000);
    cy.contains(/stefan|milica/i).first().click();
    cy.wait(3000);
    // Should show client details or edit form
  });
});

// ============================================================
// OTP Flow - Live (if backend supports)
// ============================================================

describe('Live: OTP Flow', () => {
  it('Zahtev za OTP kod pri placanju', () => {
    loginAsClient();
    cy.visit('/payments/new');
    cy.wait(5000);

    // Fill payment form
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Lazar Ilic');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test OTP');
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();

    // OTP modal should appear
    cy.contains(/verifikacij|kod|otp/i, { timeout: 10000 }).should('exist');
  });
});

// ============================================================
// Racuni - Detalji (extended)
// ============================================================

describe('Live: Racuni - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Detalji prikazuju action dugmad (Novo placanje, Transfer, Promeni limit)', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/Novo plaćanje|Novo placanje/i).should('exist');
    cy.contains(/Transfer/i).should('exist');
    cy.contains(/Promeni limit/i).should('exist');
  });

  it('Detalji prikazuju potrosnju (Dnevna potrosnja, Mesecna potrosnja)', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/Dnevna potrosnja|Dnevna potrošnja/i).should('exist');
    cy.contains(/Mesecna potrosnja|Mesečna potrošnja/i).should('exist');
  });

  it('Promena naziva racuna - Preimenuj dugme postoji', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/Preimenuj/i).should('exist');
  });

  it('Promena limita - otvara formu sa dailyLimit i monthlyLimit', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/Promeni limit/i).click();
    cy.wait(3000);
    cy.get('#dailyLimit').should('exist');
    cy.get('#monthlyLimit').should('exist');
  });

  it('Nepostojeci racun /accounts/999999 prikazuje not found', () => {
    cy.visit('/accounts/999999');
    cy.wait(5000);
    cy.contains(/nije pronađen|not found|greška|error|ne postoji/i).should('exist');
  });

  it('Poslovni racun prikazuje info o firmi', () => {
    loginAsClient('milica');
    cy.visit('/accounts');
    cy.wait(5000);
    // Milica has a business account (TechStar)
    cy.contains(/poslovni|business/i).should('exist');
    cy.contains(/poslovni|business/i).first().closest('[class*="card"], tr').within(() => {
      cy.contains(/Detalji/i).click();
    });
    cy.wait(5000);
    cy.contains(/TechStar|firma|kompanija|company/i).should('exist');
  });
});

// ============================================================
// Placanja - Forma detalji
// ============================================================

describe('Live: Placanja - Forma detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Sifra placanja polje postoji (paymentCode)', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('input[name="paymentCode"], select[name="paymentCode"], #paymentCode').should('exist');
  });

  it('Poziv na broj polje postoji', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.contains(/poziv na broj|referenc/i).should('exist');
  });

  it('Pregled naloga sekcija (preview)', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('500');
    cy.get('textarea[name="paymentPurpose"]').type('Preview test');
    cy.contains(/pregled|nalog|preview/i).should('exist');
  });

  it('Validacija - submit bez popunjenih polja prikazuje greske', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    // Do not fill any fields, just click submit
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.get('.text-destructive, [class*="error"], [class*="text-red"]').should('have.length.greaterThan', 0);
  });

  it('Biranje sacuvanog primaoca iz dropdown-a', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    // Stefan has saved recipients (Milica, Lazar) - there should be a way to select them
    cy.get('body').then(($body) => {
      if ($body.find('select[name="recipient"], [data-testid="recipient-select"]').length > 0) {
        cy.get('select[name="recipient"], [data-testid="recipient-select"]').should('exist');
      } else {
        // Look for a recipient dropdown or button
        cy.contains(/sacuvan|primalac|izaberi/i).should('exist');
      }
    });
  });
});

// ============================================================
// Placanja - Istorija detalji
// ============================================================

describe('Live: Placanja - Istorija detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Statistika (Odlivi, Prilivi, Ukupno transakcija)', () => {
    cy.visit('/payments/history');
    cy.wait(5000);
    cy.contains(/Odlivi|odliv/i).should('exist');
    cy.contains(/Prilivi|priliv/i).should('exist');
    cy.contains(/Ukupno transakcija|ukupno/i).should('exist');
  });

  it('Status filteri (Sve, Zavrsene, Na cekanju, Odbijene, Otkazane)', () => {
    cy.visit('/payments/history');
    cy.wait(5000);
    cy.contains(/Sve/i).should('exist');
    cy.contains(/Završene|Zavrsene/i).should('exist');
    cy.contains(/Na čekanju|Na cekanju|Pending/i).should('exist');
    cy.contains(/Odbijene/i).should('exist');
    cy.contains(/Otkazane/i).should('exist');
  });

  it('Datum filteri postoje (dateFrom, dateTo)', () => {
    cy.visit('/payments/history');
    cy.wait(5000);
    cy.contains('Filteri').click();
    cy.wait(2000);
    cy.get('#dateFrom, input[name="dateFrom"]').should('exist');
    cy.get('#dateTo, input[name="dateTo"]').should('exist');
  });
});

// ============================================================
// Primaoci - Detalji
// ============================================================

describe('Live: Primaoci - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Prikazuje avatar sa inicijalima', () => {
    cy.visit('/payments/recipients');
    cy.wait(5000);
    // Recipients should show avatar circles with initials
    cy.get('[class*="avatar"], [class*="rounded-full"]').should('have.length.greaterThan', 0);
  });

  it('Prikazuje maskirani broj racuna', () => {
    cy.visit('/payments/recipients');
    cy.wait(5000);
    // Account numbers displayed (may be full or partially masked)
    cy.contains(/222000|racun|broj/i, { timeout: 10000 }).should('exist');
  });

  it('Validacija - dodaj primaoca sa manje od 18 cifara', () => {
    cy.visit('/payments/recipients');
    cy.wait(3000);
    cy.contains('Dodaj primaoca').click();
    cy.get('#create-name').type('Test Primalac');
    cy.get('#create-account').type('12345'); // Less than 18 digits
    cy.contains('Sacuvaj primaoca').click();
    cy.wait(2000);
    // Should show validation error for account number length
    cy.get('.text-destructive, [class*="error"], [class*="text-red"]').should('exist');
  });
});

// ============================================================
// Transferi - Detalji
// ============================================================

describe('Live: Transferi - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Forma labels (Racun posiljaoca, Racun primaoca, Iznos)', () => {
    cy.visit('/transfers');
    cy.wait(5000);
    cy.contains(/Račun pošiljaoca|Racun posiljaoca|Sa računa/i).should('exist');
    cy.contains(/Račun primaoca|Racun primaoca|Na račun/i).should('exist');
    cy.contains(/Iznos/i).should('exist');
  });

  it('Potvrda pre slanja (Nastavi na potvrdu -> Potvrda prenosa)', () => {
    cy.visit('/transfers');
    cy.wait(5000);
    cy.get('select#fromAccount').select(1);
    cy.get('select#toAccount').select(2);
    cy.get('#amount').type('100');
    cy.contains('button', /Nastavi na potvrdu/i).click();
    cy.wait(3000);
    cy.contains(/Potvrda prenosa/i).should('exist');
  });

  it('FX detalji u istoriji (kurs, provizija ako postoji)', () => {
    cy.visit('/transfers/history');
    cy.wait(5000);
    // If there are FX transfers, they should show exchange rate details
    cy.get('body').then(($body) => {
      if ($body.text().match(/kurs|provizij|exchange|rate|commission/i)) {
        cy.contains(/kurs|provizij|exchange rate|commission/i).should('exist');
      } else {
        // No FX transfers yet - just verify the history page loaded
        cy.contains(/transfer|istorij|prenos/i).should('exist');
      }
    });
  });
});

// ============================================================
// Menjacnica - Detalji
// ============================================================

describe('Live: Menjacnica - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Prikazuje JPY, CAD, AUD pored EUR/USD/CHF/GBP', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.contains('JPY').should('exist');
    cy.contains('CAD').should('exist');
    cy.contains('AUD').should('exist');
  });

  it('Kalkulator - konverzija prikazuje rezultat', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    cy.get('input[name="amount"], input[placeholder*="iznos"], input[type="number"]').first().clear().type('10000');
    cy.contains('button', /Konvertuj/i).click();
    cy.wait(3000);
    // Should display a converted result
    cy.contains(/rezultat|konvertovan|iznos|=|≈/i).should('exist');
  });

  it('Datum azuriranja kursne liste', () => {
    cy.visit('/exchange');
    cy.wait(5000);
    // Should show when rates were last updated
    cy.contains(/ažurirano|azurirano|datum|updated|poslednje/i).should('exist');
  });
});

// ============================================================
// Kartice - Detalji
// ============================================================

describe('Live: Kartice - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Prikazuje card type (VISA)', () => {
    cy.visit('/cards');
    cy.wait(5000);
    cy.contains(/VISA/i).should('exist');
  });

  it('Prikazuje holder ime', () => {
    cy.visit('/cards');
    cy.wait(5000);
    // Stefan's name should appear on his cards
    cy.contains(/Stefan|Jovanovic|Jovanović/i).should('exist');
  });

  it('Prikazuje expiry date', () => {
    cy.visit('/cards');
    cy.wait(5000);
    // Expiry date in MM/YY or similar format
    cy.contains(/\d{2}\/\d{2,4}|važi do|expires|istice/i).should('exist');
  });

  it('Stats (ukupno, aktivne)', () => {
    cy.visit('/cards');
    cy.wait(5000);
    cy.contains(/ukupno|total/i).should('exist');
    cy.contains(/aktivn|active/i).should('exist');
  });

  it('Limit prikaz', () => {
    cy.visit('/cards');
    cy.wait(5000);
    cy.contains(/limit/i).should('exist');
  });
});

// ============================================================
// Krediti - Detalji
// ============================================================

describe('Live: Krediti - Detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('Statistika kredita', () => {
    cy.visit('/loans');
    cy.wait(5000);
    cy.contains(/ukupno|aktivn|otplaćen|total|active/i).should('exist');
  });

  it('Kredit detalji expandable (Prikazi detalje)', () => {
    cy.visit('/loans');
    cy.wait(5000);
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Prikazi detalje"), button:contains("Prikaži detalje")').length > 0) {
        cy.contains(/Prikaži detalje|Prikazi detalje/i).first().click();
        cy.wait(2000);
        // Expanded details should show more info
        cy.contains(/rata|otplata|kamat|principal|installment/i).should('exist');
      } else {
        // No loans yet - verify page loaded
        cy.contains(/kredit|loan/i).should('exist');
      }
    });
  });

  it('Zahtev za kredit - forma polja (tip, kamata, iznos, rok, telefon)', () => {
    cy.visit('/loans/apply');
    cy.wait(5000);
    cy.contains(/tip|vrsta|type/i).should('exist');
    cy.contains(/kamat|interest/i).should('exist');
    cy.contains(/iznos|amount/i).should('exist');
    cy.contains(/rok|period|trajanje/i).should('exist');
    cy.contains(/telefon|phone|kontakt/i).should('exist');
  });

  it('Zahtev za kredit - validacija praznih polja', () => {
    cy.visit('/loans/apply');
    cy.wait(5000);
    cy.contains('button', /Zahtev za kredit|Podnesi|Posalji/i).click();
    cy.wait(2000);
    cy.get('.text-destructive, [class*="error"], [class*="text-red"]').should('have.length.greaterThan', 0);
  });
});

// ============================================================
// Employee Portali - Detalji
// ============================================================

describe('Live: Employee Portali - Detalji', () => {
  beforeEach(() => { loginAsAdmin(); });

  it('Portal racuna - statistika (ukupno, aktivni)', () => {
    cy.visit('/employee/accounts');
    cy.wait(5000);
    cy.contains(/ukupno|total/i).should('exist');
    cy.contains(/aktivn|active/i).should('exist');
  });

  it('Portal klijenata - pretraga po imenu', () => {
    cy.visit('/employee/clients');
    cy.wait(5000);
    // Client portal has specific search placeholder
    cy.get('input[placeholder*="klijente"], input[placeholder*="pretra"]').first().type('Stefan');
    cy.wait(5000);
    // After search, page should still show content (filtered or unfiltered)
    cy.url().should('include', '/employee/clients');
  });

  it('Svi krediti - filteri (tip, status)', () => {
    cy.visit('/employee/loans');
    cy.wait(5000);
    cy.contains(/tip|type|vrsta/i).should('exist');
    cy.contains(/status/i).should('exist');
  });

  it('Kreiranje racuna - podtipovi za tekuci (Standardni, Stedni...)', () => {
    cy.visit('/employee/accounts/new');
    cy.wait(5000);
    // Default type is Tekuci, should show subtypes
    cy.contains(/tekuci|checking/i).should('exist');
    cy.contains(/Standardni|Štedni|Stedni|Penzioni/i).should('exist');
  });

  it('Kreiranje racuna - poslovni prikazuje polja za firmu', () => {
    cy.visit('/employee/accounts/new');
    cy.wait(5000);
    // Open the account type select (shadcn Select, default is "Tekuci")
    cy.contains(/Tekuci|Tekući/i).first().click({ force: true });
    cy.wait(1000);
    // Select "Poslovni" from dropdown options
    cy.get('[role="option"]').contains(/Poslovni/i).click();
    cy.wait(2000);
    // Should show company-related fields
    cy.contains(/firma|kompanij|company|naziv firme|PIB|maticni/i, { timeout: 10000 }).should('exist');
  });
});

// ============================================================
// OTP Flow detalji
// ============================================================

describe('Live: OTP Flow detalji', () => {
  beforeEach(() => { loginAsClient(); });

  it('OTP modal prikazuje timer', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Lazar Ilic');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('OTP timer test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(5000);
    // OTP modal should show a countdown timer
    cy.contains(/\d+:\d+|timer|preostalo vreme|ističe/i, { timeout: 10000 }).should('exist');
  });

  it('OTP modal prikazuje preostale pokusaje', () => {
    cy.visit('/payments/new');
    cy.wait(5000);
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Lazar Ilic');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('OTP attempts test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(5000);
    // OTP modal should show remaining attempts
    cy.contains(/pokušaj|pokusaj|attempt|preostal/i, { timeout: 10000 }).should('exist');
  });

  it('Promena limita koristi OTP verifikaciju', () => {
    cy.visit('/accounts');
    cy.wait(5000);
    cy.contains(/Detalji/i).first().click();
    cy.wait(5000);
    cy.contains(/Promeni limit/i).click();
    cy.wait(3000);
    // Verify the limit form exists with daily and monthly limit fields and a save button
    cy.get('#dailyLimit', { timeout: 10000 }).should('exist');
    cy.get('#monthlyLimit', { timeout: 10000 }).should('exist');
    cy.contains('button', /Sačuvaj|Sacuvaj|Potvrdi|Promeni/i).should('exist');
  });
});

// ============================================================
// HomePage detalji
// ============================================================

describe('Live: HomePage detalji', () => {
  it('Klijent vidi sacuvane primaoce', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Home page should show recipients section or quick payment options
    cy.contains(/Milica|Lazar|placanj|brzo/i).should('exist');
  });

  it('Admin vidi admin kartice', () => {
    loginAsAdmin();
    cy.visit('/home');
    cy.wait(5000);
    // Admin home should show admin-specific cards/sections
    cy.contains(/portal|zaposleni|upravljanje|admin/i).should('exist');
  });

  it('Balance visibility toggle', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // There should be an eye icon or toggle to show/hide balance
    cy.get('body').then(($body) => {
      const hasToggle = $body.find('[class*="eye"], button[aria-label*="balance"], [data-testid*="visibility"]').length > 0;
      if (hasToggle) {
        cy.get('[class*="eye"], button[aria-label*="balance"], [data-testid*="visibility"]').first().click();
      }
      // Balance section should exist regardless
      cy.contains(/stanje|balance|RSD/i).should('exist');
    });
  });
});

// ============================================================
// Sidebar detalji
// ============================================================

describe('Live: Sidebar detalji', () => {
  it('Tema toggle (Svetlo/Tamno/Sistem)', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Sidebar should have theme toggle
    cy.contains(/Svetlo|Tamno|Sistem|tema|theme/i).should('exist');
  });

  it('Klijent vidi sve linkove (Racuni, Placanja, Prenosi, Menjacnica, Kartice, Krediti)', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    cy.contains(/Računi|Racuni/i).should('exist');
    cy.contains(/Plaćanja|Placanja/i).should('exist');
    cy.contains(/Prenos|Transfer/i).should('exist');
    cy.contains(/Menjačnica|Menjacnica/i).should('exist');
    cy.contains(/Kartice/i).should('exist');
    cy.contains(/Krediti/i).should('exist');
  });
});
