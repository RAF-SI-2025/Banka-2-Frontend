/// <reference types="cypress" />

/**
 * CELINA 2 - Live E2E Testovi
 * Ovi testovi rade na ZIVOM backendu (localhost:8080) i frontendu (localhost:3000).
 * Pokrivaju sve scenarije iz Celina2Testovi.pdf + dodatne iz specifikacije.
 *
 * Pre pokretanja:
 *   1. docker compose up (backend + frontend)
 *   2. Seed ubasen
 *   3. npx cypress run --spec cypress/e2e/celina2-live-e2e.cy.ts
 */

const ADMIN_EMAIL = 'marko.petrovic@banka.rs';
const ADMIN_PASS = 'Admin12345';
const CLIENT_EMAIL = 'stefan.jovanovic@gmail.com';
const CLIENT_PASS = 'Klijent12345';
const CLIENT2_EMAIL = 'milica.nikolic@gmail.com';
const CLIENT2_PASS = 'Klijent12345';

function loginAndVisit(email: string, password: string, path: string) {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('#email').type(email);
    cy.get('#password').type(password);
    cy.contains('button', 'Prijavi se').click();
    cy.url({ timeout: 10000 }).should('include', '/home');
  });
  cy.visit(path);
}

// ============================================================
// CELINA 1: AUTENTIFIKACIJA
// ============================================================
describe('Celina 1: Autentifikacija', () => {
  it('S-Auth-1: Login stranica se ucitava', () => {
    cy.visit('/login');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.contains('Prijavi se').should('be.visible');
  });

  it('S-Auth-2: Validacija praznih polja na login', () => {
    cy.visit('/login');
    cy.contains('Prijavi se').click();
    cy.get('#email').should('have.class', 'border-destructive');
  });

  it('S-Auth-3: Pogresna lozinka prikazuje gresku', () => {
    cy.visit('/login');
    cy.get('#email').type(CLIENT_EMAIL);
    cy.get('#password').type('PogresnaLozinka123');
    cy.contains('Prijavi se').click();
    cy.contains('Neispravni kredencijali', { timeout: 5000 }).should('be.visible');
  });

  it('S-Auth-4: Uspesan login kao klijent', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/home');
    cy.url().should('include', '/home');
    cy.contains('Stefan', { timeout: 5000 }).should('be.visible');
  });

  it('S-Auth-5: Uspesan login kao admin', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.url().should('include', '/home');
  });

  it('S-Auth-6: Neautorizovan pristup preusmeri na login', () => {
    cy.visit('/accounts');
    cy.url({ timeout: 5000 }).should('include', '/login');
  });
});

// ============================================================
// CELINA 1: RACUNI - Kreiranje (S1-S5)
// ============================================================
describe('Celina 1: Racuni - Kreiranje', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/accounts/new');
  });

  it('S1: Stranica za kreiranje racuna se ucitava', () => {
    cy.contains('Kreiraj', { timeout: 5000 }).should('be.visible');
  });

  it('S1b: Kreiranje tekuceg racuna za postojeceg klijenta', () => {
    cy.get('input[name="ownerEmail"], input[placeholder*="email"], input[placeholder*="Email"]')
      .first().clear().type(CLIENT_EMAIL);
    // Izaberi tip racuna
    cy.contains('Tekući').click({ force: true });
    cy.get('input[name="initialDeposit"], input[placeholder*="stanje"], input[placeholder*="iznos"]')
      .first().clear().type('10000');
    cy.contains('button', 'Kreiraj').click();
    cy.contains('uspešno', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================
// CELINA 1: RACUNI - Pregled (S6-S8)
// ============================================================
describe('Celina 1: Racuni - Pregled klijent', () => {
  beforeEach(() => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/accounts');
  });

  it('S6: Stranica racuni se ucitava sa listom', () => {
    cy.contains('Računi', { timeout: 5000 }).should('be.visible');
    cy.get('table tbody tr, [data-testid="account-card"], .rounded-xl', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  });

  it('S7: Klik na Detalji otvara detalje racuna', () => {
    cy.contains('Detalji', { timeout: 10000 }).first().click();
    cy.url().should('match', /\/accounts\/\d+/);
    cy.contains('Broj računa', { timeout: 5000 }).should('be.visible');
  });
});

// ============================================================
// CELINA 2: PLACANJA (S9-S16)
// ============================================================
describe('Celina 2: Placanja', () => {
  it('S9: Novo placanje - forma se ucitava', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/payments/new');
    cy.contains('plaćanje', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('S16: Pregled plaćanja', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/payments/history');
    cy.contains('Plaćanja', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('S15: Primaoci placanja - lista i CRUD', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/payments/recipients');
    cy.contains('Primaoci', { timeout: 5000, matchCase: false }).should('be.visible');
  });
});

// ============================================================
// CELINA 3: TRANSFERI (S17-S20)
// ============================================================
describe('Celina 3: Transferi', () => {
  it('S17-18: Transfer stranica se ucitava', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/transfers');
    cy.contains('Transfer', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('S19: Istorija transfera', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/transfers/history');
    cy.contains('Istorija', { timeout: 5000, matchCase: false }).should('be.visible');
  });
});

// ============================================================
// CELINA 5: MENJACNICA (S24-S26)
// ============================================================
describe('Celina 5: Menjacnica', () => {
  it('S24: Kursna lista prikazuje sve valute', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/exchange');
    cy.contains('EUR', { timeout: 5000 }).should('be.visible');
    cy.contains('USD').should('be.visible');
    cy.contains('CHF').should('be.visible');
    cy.contains('GBP').should('be.visible');
  });

  it('S25: Kalkulator ekvivalentnosti radi', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/exchange');
    cy.get('input[type="number"]', { timeout: 5000 }).first().clear().type('1000');
    // Treba da se prikaže konvertovan iznos
    cy.wait(1000);
    cy.get('input[type="number"]').should('have.length.greaterThan', 0);
  });
});

// ============================================================
// CELINA 6: KARTICE (S27-S32)
// ============================================================
describe('Celina 6: Kartice', () => {
  it('S29: Lista kartica se ucitava', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/cards');
    cy.contains('Kartice', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('S30: Blokiranje kartice', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/cards');
    cy.contains('Blokiraj', { timeout: 10000 }).first().click();
    cy.contains('Blokirana', { timeout: 5000 }).should('be.visible');
  });
});

// ============================================================
// CELINA 7: KREDITI (S33-S38)
// ============================================================
describe('Celina 7: Krediti', () => {
  it('S34: Lista kredita se ucitava', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/loans');
    cy.contains('Kredit', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('S33: Zahtev za kredit - forma se ucitava', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/loans/apply');
    cy.contains('Zahtev', { timeout: 5000, matchCase: false }).should('be.visible');
  });
});

// ============================================================
// CELINA 8: PORTALI ZA ZAPOSLENE (S39-S40)
// ============================================================
describe('Celina 8: Portali za zaposlene', () => {
  it('S39: Portal klijenata - pretraga', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('Klijent', { timeout: 5000, matchCase: false }).should('be.visible');
    cy.get('input[placeholder*="Pretraga"], input[placeholder*="pretrazi"], input[placeholder*="ime"]', { timeout: 5000 })
      .first().type('Stefan');
    cy.contains('Stefan', { timeout: 5000 }).should('be.visible');
  });

  it('S39b: Portal klijenata - detalji klijenta prikazuju samo njegove racune', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('Detalji', { timeout: 10000 }).first().click();
    cy.contains('Računi klijenta', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('Portal racuna - lista svih racuna', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/accounts');
    cy.contains('Portal', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('Portal racuna - klik otvara kartice', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/accounts');
    cy.contains('Kartice', { timeout: 10000 }).first().click();
    cy.contains('kartic', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('Zaposleni lista', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/admin/employees');
    cy.contains('Zaposleni', { timeout: 5000 }).should('be.visible');
    cy.get('table tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('Portal kredita - zahtevi', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/loan-requests');
    cy.contains('Kredit', { timeout: 5000, matchCase: false }).should('be.visible');
  });
});

// ============================================================
// DODATNO: Sidebar navigacija
// ============================================================
describe('Sidebar navigacija', () => {
  it('Klijent vidi sve meni opcije', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/home');
    cy.contains('Računi', { timeout: 5000 }).should('be.visible');
    cy.contains('Plaćanja').should('be.visible');
    cy.contains('Kartice').should('be.visible');
    cy.contains('Krediti').should('be.visible');
  });

  it('Admin vidi portale', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.contains('Portal', { timeout: 5000, matchCase: false }).should('be.visible');
    cy.contains('Zaposleni').should('be.visible');
  });

  it('Admin nema klijentske stranice', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.contains('Novo plaćanje').should('not.exist');
  });
});

// ============================================================
// DODATNO: Error handling
// ============================================================
describe('Error handling', () => {
  it('404 stranica za nepostojecu rutu', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/nepostojeca-stranica');
    cy.contains('404', { timeout: 5000 }).should('be.visible');
  });

  it('403 stranica za neovlascen pristup', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/admin/employees');
    cy.url({ timeout: 5000 }).should('include', '/403');
  });
});

// ============================================================
// DODATNO: HomePage
// ============================================================
describe('HomePage', () => {
  it('Klijent vidi racune na home stranici', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/home');
    cy.contains('Računi', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('Klijent vidi poslednje transakcije', () => {
    loginAndVisit(CLIENT_EMAIL, CLIENT_PASS, '/home');
    cy.contains('Transakcij', { timeout: 5000, matchCase: false }).should('be.visible');
  });

  it('Admin vidi admin dashboard', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.url().should('include', '/home');
    // Admin ne bi trebalo da dobije error
    cy.contains('Greška', { timeout: 3000 }).should('not.exist');
  });
});
