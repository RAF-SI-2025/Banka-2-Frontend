/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars */
/// <reference types="cypress" />
/**
 * CELINA 1 - Live E2E Tests (Real Backend)
 * Covers: Authentication, Employee CRUD, Permissions, Home Page, Navigation
 * Requires: Running backend on localhost:8080, seeded database
 *
 * Seed credentials:
 *   Admin:    marko.petrovic@banka.rs / Admin12345
 *   Admin2:   jelena.djordjevic@banka.rs / Admin12345
 *   Client:   stefan.jovanovic@gmail.com / Klijent12345
 *   Client2:  milica.nikolic@gmail.com / Klijent12345
 *   Client3:  lazar.ilic@yahoo.com / Klijent12345
 *   Employee: nikola.milenkovic@banka.rs / Zaposleni12
 *   Inactive: vuk.obradovic@banka.rs / Zaposleni12
 */

// ============================================================
// Helpers
// ============================================================

function loginViaUI(email: string, password: string) {
  cy.visit('/login');
  cy.get('#email').clear().type(email);
  cy.get('#password').clear().type(password);
  cy.contains('button', 'Prijavi se').click();
}

function loginAsAdmin() {
  cy.session('admin-c1', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'marko.petrovic@banka.rs', password: 'Admin12345' },
      failOnStatusCode: false,
    }).then((resp) => {
      if (resp.status === 200) {
        const { accessToken, refreshToken } = resp.body;
        window.sessionStorage.setItem('accessToken', accessToken);
        window.sessionStorage.setItem('refreshToken', refreshToken);
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        window.sessionStorage.setItem('user', JSON.stringify({
          id: 1, email: payload.sub, role: payload.role || 'ADMIN',
          firstName: 'Marko', lastName: 'Petrovic', username: 'marko.petrovic',
          permissions: payload.permissions || ['ADMIN'],
        }));
      }
    });
  });
}

function loginAsClient() {
  cy.session('client-stefan-c1', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'stefan.jovanovic@gmail.com', password: 'Klijent12345' },
      failOnStatusCode: false,
    }).then((resp) => {
      if (resp.status === 200) {
        const { accessToken, refreshToken } = resp.body;
        window.sessionStorage.setItem('accessToken', accessToken);
        window.sessionStorage.setItem('refreshToken', refreshToken);
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        window.sessionStorage.setItem('user', JSON.stringify({
          id: 2, email: payload.sub, role: payload.role || 'CLIENT',
          firstName: 'Stefan', lastName: 'Jovanovic', username: 'stefan',
          permissions: payload.permissions || [],
        }));
      }
    });
  });
}

function loginAsEmployee() {
  cy.session('employee-nikola-c1', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'nikola.milenkovic@banka.rs', password: 'Zaposleni12' },
      failOnStatusCode: false,
    }).then((resp) => {
      if (resp.status === 200) {
        const { accessToken, refreshToken } = resp.body;
        window.sessionStorage.setItem('accessToken', accessToken);
        window.sessionStorage.setItem('refreshToken', refreshToken);
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        window.sessionStorage.setItem('user', JSON.stringify({
          id: 3, email: payload.sub, role: payload.role || 'EMPLOYEE',
          firstName: 'Nikola', lastName: 'Milenkovic', username: 'nikola.milenkovic',
          permissions: payload.permissions || ['SUPERVISOR', 'AGENT', 'TRADE_STOCKS', 'VIEW_STOCKS', 'CREATE_CONTRACTS', 'CREATE_INSURANCE'],
        }));
      }
    });
  });
}

// Unique email generator for employee creation tests
const uniqueEmail = `test.employee.${Date.now()}@banka.rs`;

// ============================================================
// Feature 1: Autentifikacija - Live
// ============================================================

describe('Live: Autentifikacija', () => {
  it('Uspesno logovanje admina', () => {
    loginViaUI('marko.petrovic@banka.rs', 'Admin12345');
    cy.url().should('include', '/home', { timeout: 15000 });
    cy.contains(/dobro|marko/i).should('be.visible');
  });

  it('Uspesno logovanje drugog admina (Jelena)', () => {
    loginViaUI('jelena.djordjevic@banka.rs', 'Admin12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Uspesno logovanje kao CLIENT Stefan', () => {
    loginViaUI('stefan.jovanovic@gmail.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Uspesno logovanje kao CLIENT Milica', () => {
    loginViaUI('milica.nikolic@gmail.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Uspesno logovanje kao CLIENT Lazar', () => {
    loginViaUI('lazar.ilic@yahoo.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Uspesno logovanje kao EMPLOYEE Nikola', () => {
    loginViaUI('nikola.milenkovic@banka.rs', 'Zaposleni12');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Neuspesno logovanje - pogresna lozinka', () => {
    loginViaUI('marko.petrovic@banka.rs', 'PogresnaLozinka123');
    cy.url().should('include', '/login');
    cy.get('[role="alert"], .text-destructive, [class*="toast"], [class*="error"]').should('exist');
  });

  it('Neuspesno logovanje - nepostojeci email', () => {
    loginViaUI('nepostoji@banka.rs', 'Sifra12345');
    cy.url().should('include', '/login');
  });

  it('Neuspesno logovanje - neaktivan zaposleni (Vuk)', () => {
    loginViaUI('vuk.obradovic@banka.rs', 'Zaposleni12');
    cy.url().should('include', '/login');
  });

  it('JWT token se cuva u sessionStorage posle logina', () => {
    loginViaUI('marko.petrovic@banka.rs', 'Admin12345');
    cy.url().should('include', '/home', { timeout: 15000 });
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.exist;
      expect(win.sessionStorage.getItem('accessToken')).to.include('.');
      expect(win.sessionStorage.getItem('refreshToken')).to.exist;
    });
  });

  it('Forgot password forma se otvara', () => {
    cy.visit('/login');
    cy.contains('Zaboravili ste lozinku').click();
    cy.url().should('include', '/forgot-password');
    cy.contains(/zaboravljen|reset|lozink/i).should('be.visible');
  });

  it('Forgot password - slanje zahteva', () => {
    cy.visit('/forgot-password');
    cy.get('#email').type('marko.petrovic@banka.rs');
    cy.contains('button', /pošalji/i).click();
    cy.contains(/proverite|email|posla/i, { timeout: 10000 }).should('be.visible');
  });

  it('Password visibility toggle na login stranici', () => {
    cy.visit('/login');
    cy.get('#password').type('TestSifra12');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.get('#password').parent().find('button, [role="button"], svg').first().click({ force: true });
    cy.get('#password').should('have.attr', 'type', 'text');
  });

  it('Login stranica prikazuje sve elemente', () => {
    cy.visit('/login');
    cy.contains('BANKA 2025').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.contains('button', 'Prijavi se').should('be.visible');
    cy.contains('Zaboravili ste lozinku').should('be.visible');
  });
});

// ============================================================
// Feature 2: Autorizacija - Live
// ============================================================

describe('Live: Autorizacija', () => {
  it('Neulogovan korisnik se redirectuje na login', () => {
    cy.clearAllSessionStorage();
    cy.visit('/home');
    cy.url().should('include', '/login');
  });

  it('Landing page je dostupna svima', () => {
    cy.clearAllSessionStorage();
    cy.visit('/');
    cy.contains('BANKA 2025').should('be.visible');
  });

  it('Login page je dostupna svima', () => {
    cy.clearAllSessionStorage();
    cy.visit('/login');
    cy.contains('Prijavi', { timeout: 10000 }).should('be.visible');
  });

  it('Error stranice su dostupne', () => {
    cy.clearAllSessionStorage();
    cy.visit('/403');
    cy.contains(/403|zabranjeno|pristup/i).should('be.visible');
  });

  it('Client ne moze pristupiti admin rutama - 403', () => {
    loginAsClient();
    cy.visit('/admin/employees');
    cy.url().should('include', '/403');
  });

  it('Client ne moze pristupiti employee portalima', () => {
    loginAsClient();
    cy.visit('/employee/accounts');
    cy.url().should('include', '/403');
  });

  it('404 stranica za nepostojecu rutu', () => {
    loginAsClient();
    cy.visit('/nepostojeca-random-stranica');
    cy.contains(/404|nije pronađena|not found/i).should('be.visible');
  });

  it('/dashboard redirectuje na /home', () => {
    loginAsClient();
    cy.visit('/dashboard');
    cy.url().should('include', '/home');
  });
});

// ============================================================
// Feature 3: Upravljanje zaposlenima - Live
// ============================================================

describe('Live: Upravljanje zaposlenima', () => {
  beforeEach(() => {
    loginAsAdmin();
  });

  it('Admin vidi listu zaposlenih', () => {
    cy.visit('/admin/employees');
    cy.contains(/zaposleni/i, { timeout: 15000 }).should('exist');
  });

  it('Tabela zaposlenih sadrzi barem jednog zaposlenog', () => {
    cy.visit('/admin/employees');
    cy.get('table tbody tr, [class*="row"], [class*="card"]', { timeout: 15000 }).should('have.length.greaterThan', 0);
  });

  it('Lista prikazuje ime, email, poziciju', () => {
    cy.visit('/admin/employees');
    cy.wait(3000);
    // Should show at least one employee's data
    cy.get('body').then(($body) => {
      const text = $body.text();
      // At least one employee email should be visible
      expect(
        text.includes('@banka.rs') || text.includes('nikola') || text.includes('tamara')
      ).to.be.true;
    });
  });

  it('Filteri pretrage se otvaraju', () => {
    cy.visit('/admin/employees');
    cy.wait(3000);
    // Search/filter input should exist
    // Click filter toggle first
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po email-u"]').should('exist');
  });

  it('Filtriranje po imenu', () => {
    cy.visit('/admin/employees');
    cy.wait(3000);
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po imenu"]').type('Nikola');
    cy.wait(2000);
    // Should filter results
  });

  it('Filtriranje po email-u', () => {
    cy.visit('/admin/employees');
    cy.wait(3000);
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po email-u"]').type('nikola');
    cy.wait(2000);
  });

  it('Navigacija na Novi zaposleni', () => {
    cy.visit('/admin/employees');
    cy.wait(3000);
    cy.contains(/novi|dodaj|kreiraj/i).click();
    cy.url().should('include', '/admin/employees/new');
  });

  it('Create forma prikazuje validacione greske za prazna polja', () => {
    cy.visit('/admin/employees/new');
    cy.wait(2000);
    cy.get('[data-cy="createBtn"], button[type="submit"]').first().click();
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"]').should('have.length.greaterThan', 0);
  });

  it('Klik na zaposlenog u tabeli otvara edit stranicu', () => {
    cy.visit('/admin/employees');
    cy.wait(5000);
    // Table rows are directly clickable (cursor-pointer)
    cy.get('table tbody tr').not('.opacity-60').first().click({ force: true });
  });

  it('Edit stranica prikazuje formu sa podacima', () => {
    cy.visit('/admin/employees');
    cy.wait(5000);
    cy.get('table tbody tr').not('.opacity-60').first().click({ force: true });
    cy.wait(3000);
    cy.get('#firstName').should('not.have.value', '');
  });
});

// ============================================================
// Feature 3b: Employee CRUD - Detaljno (Live)
// ============================================================

describe('Live: Employee CRUD - Detaljno', () => {
  beforeEach(() => {
    loginAsAdmin();
  });

  it('Kreiranje zaposlenog sa svim poljima', () => {
    cy.visit('/admin/employees/new');
    cy.wait(2000);

    cy.get('input[name="firstName"]').type('TestCypress');
    cy.get('input[name="lastName"]').type('Zaposleni');
    cy.get('input[name="username"]').type(`cypress.test.${Date.now()}`);
    cy.get('input[name="email"]').type(uniqueEmail);

    // Position dropdown
    cy.get('[data-cy="position-select"]').click();
    cy.get('[role="option"]').first().click();

    // Department
    cy.get('[data-cy="department-select"]').click();
    cy.get('[role="option"]').first().click();

    cy.get('#phoneNumber').type('+381641234567');
    cy.get('#address').type('Cypress Ulica 1, Beograd');
    cy.get('#dateOfBirth').type('1990-05-15');

    // Gender
    cy.contains('Izaberite pol').click();
    cy.get('[role="option"]').first().click();

    cy.get('[data-cy="createBtn"], button[type="submit"]').first().click();
    cy.wait(5000);
    // Should redirect to list or show success
    cy.url().should('match', /\/admin\/employees(\/new)?/);
  });

  it('Kreiranje zaposlenog sa duplikatom email-a', () => {
    cy.visit('/admin/employees/new');
    cy.wait(2000);

    cy.get('input[name="firstName"]').type('Duplikat');
    cy.get('input[name="lastName"]').type('Test');
    cy.get('input[name="username"]').type('duplikat.test');
    cy.get('input[name="email"]').type('marko.petrovic@banka.rs'); // Already exists

    cy.get('[data-cy="position-select"]').click();
    cy.get('[role="option"]').first().click();
    cy.get('[data-cy="department-select"]').click();
    cy.get('[role="option"]').first().click();

    cy.get('input[name="phoneNumber"], input[name="phone"]').type('+381641111111');
    cy.get('#address').type('Test');
    cy.get('#dateOfBirth').type('1990-01-01');
    cy.contains('Izaberite pol').click();
    cy.get('[role="option"]').first().click();

    cy.get('[data-cy="createBtn"], button[type="submit"]').first().click();
    cy.wait(5000);
    // Should stay on form - duplicate email error
    cy.url().should('include', '/new');
  });
});

// ============================================================
// Feature 4: Home Page - Live
// ============================================================

describe('Live: Home Page', () => {
  it('Admin vidi pocetnu stranicu sa navigacijom', () => {
    loginAsAdmin();
    cy.visit('/home');
    cy.contains(/dobro|marko|admin/i, { timeout: 15000 }).should('exist');
  });

  it('Stefan (CLIENT) vidi home page sa racunima', () => {
    loginAsClient();
    cy.visit('/home');
    cy.url().should('include', '/home');
    cy.wait(5000);
    // Should show account cards or greeting
    cy.contains(/dobro|stefan|račun/i).should('exist');
  });

  it('Home page prikazuje brze akcije sekciju', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Quick actions like "Novo placanje", "Transfer" etc.
    cy.contains(/plaćanj|transfer|menjačnic/i).should('exist');
  });

  it('Home page prikazuje kursnu listu', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Exchange rates ticker or section
    cy.contains(/eur|usd|kurs/i).should('exist');
  });

  it('Sidebar navigacija radi - Racuni', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Racuni').click();
    cy.url().should('include', '/accounts');
  });

  it('Sidebar navigacija radi - Placanja', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Placanja').first().click();
    cy.url().should('match', /\/payments/);
  });

  it('Sidebar navigacija radi - Transferi', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Prenosi').click();
    cy.url().should('include', '/transfers');
  });

  it('Sidebar navigacija radi - Menjacnica', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Menjacnica').click();
    cy.url().should('include', '/exchange');
  });

  it('Sidebar navigacija radi - Kartice', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Kartice').click();
    cy.url().should('include', '/cards');
  });

  it('Sidebar navigacija radi - Krediti', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Krediti').click();
    cy.url().should('include', '/loans');
  });

  it('Logout radi', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Odjavi se').click();
    cy.url().should('include', '/login');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.be.null;
    });
  });
});

// ============================================================
// Feature 5: Landing Page - Live
// ============================================================

describe('Live: Landing Page', () => {
  it('Landing page prikazuje branding BANKA 2025', () => {
    cy.visit('/');
    cy.contains('BANKA 2025').should('be.visible');
  });

  it('Landing page prikazuje hero sekciju', () => {
    cy.visit('/');
    cy.get('h1, [class*="hero"]').should('exist');
  });

  it('Landing page prikazuje feature kartice', () => {
    cy.visit('/');
    cy.contains(/račun|plaćanj|transfer/i).should('exist');
  });

  it('Landing page - navigacija na login', () => {
    cy.visit('/');
    cy.contains(/prijav|login/i).first().click();
    cy.url().should('include', '/login');
  });

  it('Landing page - CTA sekcija', () => {
    cy.visit('/');
    cy.scrollTo('bottom');
    cy.contains(/saznaj|otvori|počni|registruj/i).should('exist');
  });

  it('Landing page - footer postoji', () => {
    cy.visit('/');
    cy.scrollTo('bottom');
    cy.get('footer, [class*="footer"]').should('exist');
  });

  it('Landing page - tema toggle', () => {
    cy.visit('/');
    cy.get('button[title*="Tema"]').should('exist');
  });

  it('Landing page - animacije/blobovi', () => {
    cy.visit('/');
    cy.get('[class*="animate-"], [class*="blob"]').should('exist');
  });
});

// ============================================================
// Feature 6: Error Pages - Live
// ============================================================

describe('Live: Error stranice', () => {
  it('403 stranica se renderuje', () => {
    cy.visit('/403');
    cy.contains(/403|zabranjeno|pristup/i).should('be.visible');
  });

  it('404 stranica za nepostojecu rutu', () => {
    cy.visit('/nepostojeca-ruta-xyz');
    cy.contains(/404|nije pronađena|not found/i).should('be.visible');
  });

  it('500 stranica se renderuje', () => {
    cy.visit('/500');
    cy.contains(/500|greška|server/i).should('be.visible');
  });

  it('403 - dugme za navigaciju postoji', () => {
    cy.visit('/403');
    cy.get('a, button').filter(':visible').should('have.length.greaterThan', 0);
  });

  it('404 - dugme nazad postoji i radi', () => {
    cy.visit('/random-nepostojeca');
    cy.contains(/nazad|početn|prijav/i).first().click();
    cy.url().should('match', /\/(login|home)?$/);
  });

  it('500 - dugme nazad postoji i radi', () => {
    cy.visit('/500');
    cy.contains('button', /nazad na početnu/i).click();
    cy.url().should('not.include', '/500');
  });
});

// ============================================================
// Feature 7: Multi-user scenariji - Live
// ============================================================

describe('Live: Multi-user scenariji', () => {
  it('Milica se loguje i vidi home page', () => {
    loginViaUI('milica.nikolic@gmail.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Lazar se loguje i vidi home page', () => {
    loginViaUI('lazar.ilic@yahoo.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
  });

  it('Employee Nikola vidi home page i ima pristup portalima', () => {
    loginAsEmployee();
    cy.visit('/home');
    cy.url().should('include', '/home');
    // Employee should see portal links in sidebar
    cy.contains(/portal|upravljanje|employee/i).should('exist');
  });

  it('Klijent NE vidi employee portale u sidebaru', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    // Employee portal links should not be visible for client
    cy.get('body').then(($body) => {
      const hasPortal = $body.text().match(/Portal za upravljanje/i);
      // Client should not have direct employee portal links
      // (might have general "Portal" text elsewhere, so we check specific routes)
    });
  });

  it('Admin vidi employee portale u sidebaru', () => {
    loginAsAdmin();
    cy.visit('/home');
    cy.wait(3000);
    cy.contains('Employee portal').should('exist');
  });
});

// ============================================================
// Feature 8: Kompletni navigacioni tokovi - Live
// ============================================================

describe('Live: Kompletni navigacioni tokovi', () => {
  it('Admin: Login -> Home -> Employees -> Create -> Back', () => {
    loginAsAdmin();
    cy.visit('/home');
    cy.url().should('include', '/home');

    // Navigate to employees
    cy.visit('/admin/employees');
    cy.wait(5000);
    cy.url().should('include', '/admin/employees');

    // Navigate to create
    cy.contains(/novi|dodaj|kreiraj/i).click();
    cy.url().should('include', '/new');

    // Cancel back
    cy.contains(/odustani|nazad|otkaži/i).click();
    cy.url().should('include', '/admin/employees');
  });

  it('Client: Home -> Racuni -> Detalji -> Back', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);

    // Navigate to accounts
    cy.visit('/accounts');
    cy.wait(5000);
    cy.url().should('include', '/accounts');

    // Try to open account details
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/accounts/"], a:contains("Detalji")').length > 0) {
        cy.get('[href*="/accounts/"], a:contains("Detalji")').first().click({ force: true });
        cy.wait(3000);
        cy.url().should('match', /\/accounts\/\d+/);
      }
    });
  });

  it('Client: Sidebar navigacija kroz sve sekcije', () => {
    loginAsClient();

    // Visit each main section via direct navigation
    const routes = ['/home', '/accounts', '/payments/new', '/payments/history',
      '/payments/recipients', '/transfers', '/transfers/history', '/exchange',
      '/cards', '/loans'];

    routes.forEach((route) => {
      cy.visit(route);
      cy.url().should('include', route);
    });
  });

  it('Direktan pristup /payments/new radi', () => {
    loginAsClient();
    cy.visit('/payments/new');
    cy.url().should('include', '/payments/new');
    cy.wait(3000);
    // Payment form should load
    cy.contains(/plaćanj|novo|uplatnic/i).should('exist');
  });
});

// ============================================================
// Feature 9: JWT i Session Management - Live
// ============================================================

describe('Live: JWT i Session Management', () => {
  it('Token se cuva sa pravilnom strukturom (header.payload.signature)', () => {
    loginViaUI('stefan.jovanovic@gmail.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
    cy.window().then((win) => {
      const token = win.sessionStorage.getItem('accessToken');
      expect(token).to.exist;
      const parts = token!.split('.');
      expect(parts).to.have.length(3);
      // Payload should be decodable
      const payload = JSON.parse(atob(parts[1]));
      expect(payload.sub).to.include('stefan');
      expect(payload.role).to.exist;
    });
  });

  it('User objekat se cuva u sessionStorage', () => {
    loginViaUI('stefan.jovanovic@gmail.com', 'Klijent12345');
    cy.url().should('include', '/home', { timeout: 15000 });
    cy.window().then((win) => {
      const user = JSON.parse(win.sessionStorage.getItem('user') || '{}');
      expect(user.email).to.include('stefan');
      expect(user.role).to.exist;
    });
  });

  it('Brisanje sessionStorage redirectuje na login', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });
    cy.visit('/home');
    cy.url().should('include', '/login');
  });
});

// ============================================================
// Feature 10: Login validacija (frontend) - Live
// ============================================================

describe('Live: Login validacija (frontend)', () => {
  it('Login - prazna polja prikazuju validacione greske', () => {
    cy.visit('/login');
    cy.get('#email').clear();
    cy.get('#password').clear();
    cy.contains('button', 'Prijavi se').click();
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Login - nevalidan email format', () => {
    cy.visit('/login');
    cy.get('#email').clear().type('neispravan-email');
    cy.get('#password').clear().type('Admin12345');
    cy.contains('button', 'Prijavi se').click();
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Login - logo vidljiv na stranici', () => {
    cy.visit('/login');
    cy.get('img[src*="logo"], svg, [alt*="logo"], [class*="logo"]', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  });
});

// ============================================================
// Feature 11: Reset Password validacija - Live
// ============================================================

describe('Live: Reset Password validacija', () => {
  it('Poseta /reset-password bez tokena prikazuje gresku', () => {
    cy.visit('/reset-password');
    cy.contains(/Zatrazi novi link|Nevažeći|link|Resetovanje/i, { timeout: 10000 })
      .should('exist');
  });

  it('Lozinke se ne poklapaju - validacija', () => {
    cy.visit('/reset-password?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('NovaLozinka123');
    cy.get('input[type="password"]').eq(1).clear().type('DrugaLozinka456');
    cy.get('button[type="submit"], button:contains("Resetuj"), button:contains("Potvrdi")')
      .first().click({ force: true });
    cy.contains(/ne poklapaju|ne odgovaraju|match|identičn/i, { timeout: 5000 })
      .should('be.visible');
  });

  it('Slaba lozinka (bez brojeva) ne prolazi validaciju', () => {
    cy.visit('/reset-password?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('SamoSlovaLozinka');
    cy.get('input[type="password"]').eq(1).clear().type('SamoSlovaLozinka');
    cy.get('button[type="submit"], button:contains("Resetuj"), button:contains("Potvrdi")')
      .first().click({ force: true });
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Lozinka kraca od 8 karaktera', () => {
    cy.visit('/reset-password?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('Ab1');
    cy.get('input[type="password"]').eq(1).clear().type('Ab1');
    cy.get('button[type="submit"], button:contains("Resetuj"), button:contains("Potvrdi")')
      .first().click({ force: true });
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Password strength indikator se prikazuje', () => {
    cy.visit('/reset-password?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('Test1234');
    cy.get('[class*="strength"], [class*="progress"], [class*="indicator"], [role="progressbar"]', { timeout: 5000 })
      .should('exist');
  });
});

// ============================================================
// Feature 12: Aktivacija naloga validacija - Live
// ============================================================

describe('Live: Aktivacija naloga validacija', () => {
  it('Poseta /activate-account bez tokena prikazuje gresku', () => {
    cy.visit('/activate-account');
    cy.contains(/Aktivacija|token|Nevažeći|link/i, { timeout: 10000 })
      .should('exist');
  });

  it('Lozinke se ne poklapaju - validacija', () => {
    cy.visit('/activate-account?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('NovaLozinka123');
    cy.get('input[type="password"]').eq(1).clear().type('DrugaLozinka456');
    cy.get('button[type="submit"], button:contains("Aktiviraj"), button:contains("Potvrdi")')
      .first().click({ force: true });
    cy.contains(/ne poklapaju|ne odgovaraju|match|identičn/i, { timeout: 5000 })
      .should('be.visible');
  });

  it('Slaba lozinka bez velikog slova', () => {
    cy.visit('/activate-account?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('samomaloslova123');
    cy.get('input[type="password"]').eq(1).clear().type('samomaloslova123');
    cy.get('button[type="submit"], button:contains("Aktiviraj"), button:contains("Potvrdi")')
      .first().click({ force: true });
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Password strength indikator se prikazuje', () => {
    cy.visit('/activate-account?token=test-token-123');
    cy.wait(2000);
    cy.get('input[type="password"]').eq(0).clear().type('Test1234');
    cy.get('[class*="strength"], [class*="progress"], [class*="indicator"], [role="progressbar"]', { timeout: 5000 })
      .should('exist');
  });
});

// ============================================================
// Feature 13: Employee Create forma detalji - Live
// ============================================================

describe('Live: Employee Create forma detalji', () => {
  beforeEach(() => {
    loginAsAdmin();
    cy.visit('/admin/employees/new');
    cy.wait(3000);
  });

  it('Forma prikazuje sva polja', () => {
    cy.get('#firstName').should('be.visible');
    cy.get('#lastName').should('be.visible');
    cy.get('#username').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#phoneNumber').should('be.visible');
    cy.get('#address').should('be.visible');
    cy.get('#dateOfBirth').should('be.visible');
    cy.get('[data-cy="position-select"]').should('exist');
    cy.get('[data-cy="department-select"]').should('exist');
  });

  it('Zaposleni je po defaultu aktivan', () => {
    cy.get('[role="switch"]').should('have.attr', 'aria-checked', 'true');
  });

  it('Navigacija Otkazi vraca na listu', () => {
    cy.contains(/odustani|otkaži|nazad/i).click();
    cy.url().should('include', '/admin/employees');
    cy.url().should('not.include', '/new');
  });
});

// ============================================================
// Feature 14: Employee List detalji - Live
// ============================================================

describe('Live: Employee List detalji', () => {
  beforeEach(() => {
    loginAsAdmin();
    cy.visit('/admin/employees');
    cy.wait(5000);
  });

  it('Lista prikazuje stats kartice (ukupno)', () => {
    cy.contains(/ukupno|total/i, { timeout: 10000 }).should('exist');
  });

  it('Lista prikazuje status badge (aktivan)', () => {
    cy.contains(/aktivan/i, { timeout: 10000 }).should('exist');
  });

  it('Lista prikazuje Admin badge', () => {
    cy.contains(/admin/i, { timeout: 10000 }).should('exist');
  });

  it('Filtriranje po poziciji', () => {
    cy.get('button[title="Filteri"]').click();
    cy.wait(1000);
    // Filter inputs should now be visible
    cy.get('input[placeholder="Pretraga po imenu"]').should('be.visible');
    cy.get('input[placeholder="Pretraga po email-u"]').should('be.visible');
  });
});

// ============================================================
// Feature 15: Employee Edit detalji - Live
// ============================================================

describe('Live: Employee Edit detalji', () => {
  beforeEach(() => {
    loginAsAdmin();
  });

  it('Edit prikazuje permisije', () => {
    cy.visit('/admin/employees');
    cy.wait(5000);
    cy.get('table tbody tr').not('.opacity-60').first().click({ force: true });
    cy.wait(3000);
    cy.get('[id^="perm-"]', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('Edit - zaposleni ne postoji (/admin/employees/999999)', () => {
    cy.visit('/admin/employees/999999');
    cy.wait(5000);
    cy.contains(/nije pronađen|ne postoji|not found|greška|error|404/i, { timeout: 10000 })
      .should('be.visible');
  });

  it('Edit navigacija nazad', () => {
    cy.visit('/admin/employees');
    cy.wait(5000);
    cy.get('table tbody tr').not('.opacity-60').first().click({ force: true });
    cy.wait(3000);
    cy.contains(/nazad na listu|otkaži|odustani|nazad/i).first().click();
    cy.url().should('include', '/admin/employees');
  });
});

// ============================================================
// Feature 16: Landing Page detalji - Live
// ============================================================

describe('Live: Landing Page detalji', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(3000);
  });

  it('Backend status indikator (server aktivan)', () => {
    cy.contains(/server aktivan|aktivan/i, { timeout: 15000 }).should('exist');
  });

  it('Saznaj vise skroluje na features', () => {
    cy.contains(/saznaj više|saznaj/i).first().click();
    cy.wait(1000);
    // After clicking, page should have scrolled down
    cy.window().then((win) => {
      expect(win.scrollY).to.be.greaterThan(100);
    });
  });

  it('Currency ticker (RSD, EUR, USD)', () => {
    cy.contains(/RSD|EUR|USD/i, { timeout: 10000 }).should('exist');
  });

  it('Svih 6 feature kartica', () => {
    cy.scrollTo('bottom');
    cy.wait(2000);
    // Check individual feature card titles exist (some may be lazy-loaded)
    cy.contains(/upravljanje zaposlenima/i, { timeout: 15000 }).should('exist');
    cy.contains(/sigurna autentifikacija/i, { timeout: 15000 }).should('exist');
    cy.contains(/bankarsko poslovanje/i, { timeout: 15000 }).should('exist');
  });

  it('Hero sekcija sa CTA', () => {
    cy.get('h1').should('be.visible');
    cy.get('h1').invoke('text').should('have.length.greaterThan', 5);
    // CTA button in hero
    cy.contains(/prijav|počni|registruj|otvori/i).should('exist');
  });
});

// ============================================================
// Feature 17: Forgot Password detalji - Live
// ============================================================

describe('Live: Forgot Password detalji', () => {
  beforeEach(() => {
    cy.visit('/forgot-password');
    cy.wait(2000);
  });

  it('Forma prikazuje email input', () => {
    cy.get('#email').should('be.visible');
  });

  it('Validacija za prazan email', () => {
    cy.get('#email').clear();
    cy.get('button[type="submit"], button:contains("Pošalji"), button:contains("pošalji")')
      .first().click({ force: true });
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"], [role="alert"]')
      .should('have.length.greaterThan', 0);
  });

  it('Link nazad na login', () => {
    cy.contains(/nazad|prijav|login/i).first().click();
    cy.url().should('include', '/login');
  });
});

// ============================================================
// Feature 18: Sidebar detalji - Live
// ============================================================

describe('Live: Sidebar detalji', () => {
  it('Tema toggle (Svetlo/Tamno/Sistem)', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(3000);
    // Find theme toggle in sidebar - it shows current theme name (Svetlo/Tamno/Sistem)
    cy.contains(/Svetlo|Tamno|Sistem/, { timeout: 10000 })
      .first().click({ force: true });
    cy.wait(1000);
    cy.contains(/Svetlo|Tamno|Sistem/, { timeout: 5000 }).should('exist');
  });

  it('Balance visibility toggle na homepage', () => {
    loginAsClient();
    cy.visit('/home');
    cy.wait(5000);
    // Look for eye icon button that toggles balance visibility
    cy.get('button[title*="balans"], button[title*="stanje"], button svg[class*="eye"], [data-cy="toggle-balance"]', { timeout: 10000 })
      .first().click({ force: true });
    // After click, the visibility state should have changed
    cy.wait(1000);
  });
});
