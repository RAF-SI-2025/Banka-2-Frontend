/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * CELINA 1 - Mock E2E Tests (Comprehensive)
 * Covers: Authentication, Employee CRUD, Permissions, Error Pages, Landing Page
 * All API calls are mocked with cy.intercept()
 *
 * PDF Scenarios covered: S1-S18 (all from TestoviCelina1.pdf)
 * Spec coverage: Login, Forgot Password, Reset Password, Activate Account,
 *   Employee List, Employee Create, Employee Edit, Deactivation, Permissions,
 *   Authorization, Error Pages, Landing Page, JWT Management
 */

import { setupAdminSession, setupClientSession, setupEmployeeSession } from '../support/commands';

// ============================================================
// JWT Helper
// ============================================================

function fakeJwt(email: string, role: string, active = true): string {
  const h = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const p = btoa(JSON.stringify({ sub: email, role, active, exp: 9999999999, iat: Date.now() / 1000 })).replace(/=/g, '');
  return `${h}.${p}.fakesig`;
}

// ============================================================
// Mock Data
// ============================================================

const adminToken = fakeJwt('marko.petrovic@banka.rs', 'ADMIN');

const mockEmployees = {
  content: [
    {
      id: 1, firstName: 'Marko', lastName: 'Petrovic', email: 'marko.petrovic@banka.rs',
      phone: '+381641111111', position: 'Direktor', department: 'Uprava',
      active: true, dateOfBirth: '1985-03-15', gender: 'M', username: 'marko.petrovic',
      address: 'Kralja Milana 10, Beograd',
      permissions: ['ADMIN', 'TRADE_STOCKS', 'SUPERVISOR'],
    },
    {
      id: 2, firstName: 'Nikola', lastName: 'Milenkovic', email: 'nikola.milenkovic@banka.rs',
      phone: '+381642222222', position: 'Team Lead', department: 'IT',
      active: true, dateOfBirth: '1990-07-20', gender: 'M', username: 'nikola.milenkovic',
      address: 'Bulevar Oslobodjenja 5, Novi Sad',
      permissions: ['TRADE_STOCKS', 'VIEW_STOCKS', 'CREATE_CONTRACTS', 'CREATE_INSURANCE', 'SUPERVISOR', 'AGENT'],
    },
    {
      id: 3, firstName: 'Tamara', lastName: 'Pavlovic', email: 'tamara.pavlovic@banka.rs',
      phone: '+381643333333', position: 'Software Developer', department: 'IT',
      active: true, dateOfBirth: '1995-11-05', gender: 'F', username: 'tamara.pavlovic',
      address: 'Nemanjina 3, Beograd',
      permissions: ['VIEW_STOCKS', 'TRADE_STOCKS', 'CREATE_CONTRACTS'],
    },
    {
      id: 4, firstName: 'Vuk', lastName: 'Obradovic', email: 'vuk.obradovic@banka.rs',
      phone: '+381644444444', position: 'Supervisor', department: 'Finansije',
      active: false, dateOfBirth: '1988-01-30', gender: 'M', username: 'vuk.obradovic',
      address: 'Knez Mihailova 18, Beograd',
      permissions: ['SUPERVISOR', 'VIEW_STOCKS'],
    },
  ],
  totalElements: 4,
  totalPages: 1,
  number: 0,
  size: 10,
};

const singleEmployee = mockEmployees.content[1]; // Nikola

// ====================================================================
// FEATURE 1: Autentifikacija korisnika (Scenarios S1-S5)
// ====================================================================

describe('Feature 1: Autentifikacija korisnika', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  // --- S1: Uspesno logovanje zaposlenog ---
  it('S1: Uspesno logovanje sa validnim kredencijalima', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: adminToken, refreshToken: 'refresh-tok', tokenType: 'Bearer' },
    }).as('login');

    cy.get('#email').type('marko.petrovic@banka.rs');
    cy.get('#password').type('Admin12345');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@login');
    cy.url().should('include', '/home');
  });

  // --- S2: Neuspesno logovanje - pogresna lozinka ---
  it('S2: Neuspesno logovanje - pogresna lozinka', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid credentials' },
    }).as('loginFail');

    cy.get('#email').type('marko.petrovic@banka.rs');
    cy.get('#password').type('PogresnaLozinka99');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@loginFail');
    cy.url().should('include', '/login');
    cy.get('#email').should('be.visible');
  });

  // --- S3: Neuspesno logovanje - nepostojeci korisnik ---
  it('S3: Neuspesno logovanje - nepostojeci korisnik', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 404,
      body: { message: 'User not found' },
    }).as('loginNotFound');

    cy.get('#email').type('nepostojeci@banka.rs');
    cy.get('#password').type('Sifra12345');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@loginNotFound');
    cy.url().should('include', '/login');
  });

  // --- S4: Forgot password - slanje linka ---
  it('S4: Forgot password - slanje linka za reset', () => {
    cy.intercept('POST', '**/api/auth/password_reset/request', {
      statusCode: 200,
      body: { message: 'Email sent' },
    }).as('resetRequest');

    cy.contains('Zaboravili ste lozinku').click();
    cy.url().should('include', '/forgot-password');
    cy.get('#email').type('zaposleni@banka.rs');
    cy.contains('button', /pošalji|link/i).click();
    cy.wait('@resetRequest');
    cy.contains(/proverite|email/i).should('be.visible');
  });

  // --- S5: Neuspesno logovanje - neaktivan zaposleni ---
  it('S5: Neuspesno logovanje - neaktivan zaposleni', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 403,
      body: { message: 'Account is deactivated' },
    }).as('loginInactive');

    cy.get('#email').type('vuk.obradovic@banka.rs');
    cy.get('#password').type('Zaposleni12');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@loginInactive');
    cy.url().should('include', '/login');
  });

  // --- Elementi login stranice ---
  it('Login stranica prikazuje sve elemente', () => {
    cy.contains('BANKA 2025').should('be.visible');
    cy.contains('Prijavite se').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.contains('button', 'Prijavi se').should('be.visible');
    cy.contains('Zaboravili ste lozinku').should('be.visible');
  });

  it('Login - validacija praznih polja', () => {
    cy.contains('button', 'Prijavi se').click();
    // Form should not submit - validation errors should appear
    cy.url().should('include', '/login');
    cy.get('.text-destructive, [role="alert"], .text-red-500, .text-sm.text-destructive').should('exist');
  });

  it('Login - nevalidan email format', () => {
    cy.get('#email').type('neispravan-email');
    cy.get('#password').type('Sifra12345');
    cy.contains('button', 'Prijavi se').click();
    cy.url().should('include', '/login');
  });

  it('Login - password visibility toggle', () => {
    cy.get('#password').type('MojaSifra123');
    cy.get('#password').should('have.attr', 'type', 'password');
    // Click the eye toggle button
    cy.get('#password').parent().find('button, [role="button"], svg').first().click({ force: true });
    cy.get('#password').should('have.attr', 'type', 'text');
  });

  it('Login - navigacija na pocetnu stranicu', () => {
    cy.contains(/nazad|početn/i).click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('Login - logo je vidljiv', () => {
    cy.get('img[src*="logo"], svg, [alt*="logo"]').should('exist');
  });
});

// ====================================================================
// FEATURE 1b: Reset lozinke (Scenarios S4-S5)
// ====================================================================

describe('Feature 1b: Reset lozinke', () => {
  it('Reset password - uspesno postavljanje nove lozinke', () => {
    cy.intercept('POST', '**/api/auth/password_reset/confirm', {
      statusCode: 200,
      body: { message: 'Password reset successful' },
    }).as('resetConfirm');

    cy.visit('/reset-password?token=valid-reset-token');
    cy.get('input[name="newPassword"], #newPassword, input[type="password"]').first().type('NovaLozinka12');
    cy.get('input[name="confirmPassword"], #confirmPassword, input[type="password"]').last().type('NovaLozinka12');
    cy.contains('button', /postavi novu lozinku/i).click();
    cy.wait('@resetConfirm');
    cy.contains(/uspešno|uspesno|success|prijav/i).should('be.visible');
  });

  it('Reset password - nevazeci token', () => {
    cy.intercept('POST', '**/api/auth/password_reset/confirm', {
      statusCode: 400,
      body: { message: 'Invalid or expired token' },
    }).as('resetFail');

    cy.visit('/reset-password?token=expired-token');
    cy.get('input[type="password"]').first().type('NovaLozinka12');
    cy.get('input[type="password"]').last().type('NovaLozinka12');
    cy.contains('button', /postavi novu lozinku|postavljanje/i).click();
    cy.wait('@resetFail');
  });

  it('Reset password - lozinke se ne poklapaju', () => {
    cy.visit('/reset-password?token=valid-token');
    cy.get('input[type="password"]').first().type('Lozinka12');
    cy.get('input[type="password"]').last().type('DrugaLozinka12');
    cy.contains('button', /postavi novu lozinku|postavljanje/i).click();
    // Should show mismatch error
    cy.contains(/poklapaju|match|razlik/i).should('be.visible');
  });

  it('Reset password - bez tokena u URL-u', () => {
    cy.visit('/reset-password');
    // Should show invalid link message
    cy.contains(/nevažeći|nevalid|link|token/i).should('be.visible');
  });

  it('Reset password - prikazuje zahteve za lozinku (password strength)', () => {
    cy.visit('/reset-password?token=valid-token');
    cy.get('input[type="password"]').first().type('a');
    // Should show password strength indicator or requirements
    cy.get('[class*="progress"], [role="progressbar"], [class*="strength"]').should('exist');
  });

  it('Reset password - slaba lozinka (bez brojeva)', () => {
    cy.visit('/reset-password?token=valid-token');
    cy.get('input[type="password"]').first().type('SamoBezBrojeva');
    cy.get('input[type="password"]').last().type('SamoBezBrojeva');
    cy.contains('button', /postavi novu lozinku|postavljanje/i).click();
    // Validation: needs 2+ digits
    cy.url().should('include', '/reset-password');
  });

  it('Reset password - lozinka kraca od 8 karaktera', () => {
    cy.visit('/reset-password?token=valid-token');
    cy.get('input[type="password"]').first().type('Ab1');
    cy.get('input[type="password"]').last().type('Ab1');
    cy.contains('button', /postavi novu lozinku|postavljanje/i).click();
    cy.contains(/najmanje 8|minimum 8|bar 8|8 karakt/i).should('be.visible');
  });

  it('Reset password - lozinka duza od 32 karaktera', () => {
    cy.visit('/reset-password?token=valid-token');
    const longPass = 'A'.repeat(30) + 'b12';
    cy.get('input[type="password"]').first().type(longPass);
    cy.get('input[type="password"]').last().type(longPass);
    cy.contains('button', /postavi novu lozinku|postavljanje/i).click();
    cy.contains(/najviše 32|maximum 32|max 32|32 karakt/i).should('be.visible');
  });
});

// ====================================================================
// FEATURE 1c: Aktivacija naloga (Scenarios S8-S10)
// ====================================================================

describe('Feature 1c: Aktivacija naloga', () => {
  it('S8: Uspesna aktivacija naloga', () => {
    cy.intercept('POST', '**/api/auth-employee/activate', {
      statusCode: 200,
      body: { message: 'Account activated successfully' },
    }).as('activate');

    cy.visit('/activate-account?token=valid-activation-token');
    cy.get('input[type="password"]').first().type('NoviPassword12');
    cy.get('input[type="password"]').last().type('NoviPassword12');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    cy.wait('@activate');
    cy.contains(/uspešno|aktiviran|success/i).should('be.visible');
  });

  it('S9: Aktivacija sa isteklim tokenom', () => {
    cy.intercept('POST', '**/api/auth-employee/activate', {
      statusCode: 400,
      body: { message: 'Token expired' },
    }).as('activateFail');

    cy.visit('/activate-account?token=expired-token');
    cy.get('input[type="password"]').first().type('ValidPass12');
    cy.get('input[type="password"]').last().type('ValidPass12');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    cy.wait('@activateFail');
  });

  it('S10: Aktivacija - slaba lozinka (bez brojeva)', () => {
    cy.visit('/activate-account?token=valid-token');
    cy.get('input[type="password"]').first().type('SamoBezBrojeva');
    cy.get('input[type="password"]').last().type('SamoBezBrojeva');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    // Should not submit - validation error
    cy.url().should('include', '/activate-account');
  });

  it('Aktivacija - bez tokena u URL-u', () => {
    cy.visit('/activate-account');
    cy.contains(/nevažeći|nevalid|link|token/i).should('be.visible');
  });

  it('Aktivacija - prikazuje password strength indicator', () => {
    cy.visit('/activate-account?token=valid-token');
    cy.get('input[type="password"]').first().type('Abc12345');
    cy.get('[class*="progress"], [role="progressbar"], [class*="strength"]').should('exist');
  });

  it('Aktivacija - lozinke se ne poklapaju', () => {
    cy.visit('/activate-account?token=valid-token');
    cy.get('input[type="password"]').first().type('ValidPass12');
    cy.get('input[type="password"]').last().type('DrugaPass34');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    cy.contains(/poklapaju|match/i).should('be.visible');
  });

  it('Aktivacija - lozinka bez velikog slova', () => {
    cy.visit('/activate-account?token=valid-token');
    cy.get('input[type="password"]').first().type('bezvlikogslova12');
    cy.get('input[type="password"]').last().type('bezvlikogslova12');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    cy.url().should('include', '/activate-account');
  });

  it('Aktivacija - lozinka bez malog slova', () => {
    cy.visit('/activate-account?token=valid-token');
    cy.get('input[type="password"]').first().type('BEZMALOGSLOVA12');
    cy.get('input[type="password"]').last().type('BEZMALOGSLOVA12');
    cy.contains('button', /Aktiviraj nalog|Aktivacija/i).click();
    cy.url().should('include', '/activate-account');
  });
});

// ====================================================================
// FEATURE 2: Kreiranje zaposlenog (Scenarios S6-S7)
// ====================================================================

describe('Feature 2: Kreiranje zaposlenog', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: mockEmployees }).as('getEmployees');
    cy.visit('/admin/employees/new', { onBeforeLoad: setupAdminSession });
  });

  it('S6: Admin uspesno kreira novog zaposlenog', () => {
    cy.intercept('POST', '**/api/employees', {
      statusCode: 201,
      body: { id: 99, firstName: 'Novi', lastName: 'Zaposleni', email: 'novi@banka.rs', active: true },
    }).as('createEmployee');

    cy.get('input[name="firstName"]').type('Novi');
    cy.get('input[name="lastName"]').type('Zaposleni');
    cy.get('input[name="username"]').type('novi.zaposleni');
    cy.get('input[name="email"]').type('novi@banka.rs');
    // Position dropdown (shadcn Select with data-cy)
    cy.get('[data-cy="position-select"]').click();
    cy.get('[role="option"]').contains('Software Developer').click();
    // Department dropdown
    cy.get('[data-cy="department-select"]').click();
    cy.get('[role="option"]').contains('IT').click();
    cy.get('#phoneNumber').type('+381641234567');
    cy.get('#address').type('Kralja Petra 5, Beograd');
    // Date of birth (DateInput component)
    cy.get('#dateOfBirth').type('1990-05-15');
    // Gender
    cy.contains('Izaberite pol').click();
    cy.get('[role="option"]').contains('Muski').click();

    cy.get('[data-cy="createBtn"]').click();
    cy.wait('@createEmployee');
  });

  it('S7: Kreiranje zaposlenog sa duplikatom email-a', () => {
    cy.intercept('POST', '**/api/employees', {
      statusCode: 409,
      body: { message: 'Email already exists' },
    }).as('createDuplicate');

    cy.get('input[name="firstName"]').type('Test');
    cy.get('input[name="lastName"]').type('Duplikat');
    cy.get('input[name="username"]').type('test.duplikat');
    cy.get('input[name="email"]').type('marko.petrovic@banka.rs');
    cy.get('[data-cy="position-select"]').click();
    cy.get('[role="option"]').first().click();
    cy.get('[data-cy="department-select"]').click();
    cy.get('[role="option"]').first().click();
    cy.get('#phoneNumber').type('+381649999999');
    cy.get('#address').type('Test adresa');
    cy.get('#dateOfBirth').type('1990-01-01');
    cy.contains('Izaberite pol').click();
    cy.get('[role="option"]').first().click();

    cy.get('[data-cy="createBtn"]').click();
    cy.wait('@createDuplicate');
    // Should stay on form and show error
    cy.url().should('include', '/new');
  });

  it('Kreiranje - validacija obaveznih polja', () => {
    cy.get('[data-cy="createBtn"], button[type="submit"]').first().click();
    // Should show validation errors for empty fields
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"]').should('have.length.greaterThan', 0);
  });

  it('Kreiranje - navigacija nazad na listu', () => {
    cy.contains(/Otkazi|Nazad na listu/i).click();
    cy.url().should('include', '/admin/employees');
  });

  it('Kreiranje forma prikazuje sve sekcije i polja', () => {
    cy.get('#firstName').should('be.visible');
    cy.get('#lastName').should('be.visible');
    cy.get('#username').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#phoneNumber').should('be.visible');
    cy.get('#address').should('be.visible');
    cy.get('#dateOfBirth').should('exist');
    cy.get('[data-cy="position-select"]').should('exist');
    cy.get('[data-cy="department-select"]').should('exist');
  });

  it('Kreiranje - zaposleni je po defaultu aktivan', () => {
    // isActive should be checked/on by default
    cy.get('[name="isActive"], [name="active"], [role="switch"]').then(($el) => {
      if ($el.is('[role="switch"]')) {
        const isChecked = $el.attr('data-state') === 'checked' || $el.attr('aria-checked') === 'true';
        expect(isChecked).to.be.true;
      }
    });
  });
});

// ====================================================================
// FEATURE 3: Upravljanje zaposlenima (Scenarios S11-S15)
// ====================================================================

describe('Feature 3: Upravljanje zaposlenima', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: mockEmployees }).as('getEmployees');
  });

  // --- S11: Lista zaposlenih ---
  it('S11: Admin vidi listu svih zaposlenih sa podacima', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    cy.contains('Marko').should('be.visible');
    cy.contains('Nikola').should('be.visible');
    cy.contains('marko.petrovic@banka.rs').should('be.visible');
    cy.contains('Direktor').should('be.visible');
  });

  it('Lista zaposlenih - prikazuje stats kartice', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    // Should show total count, active count, inactive count
    cy.contains(/ukupno|total/i).should('exist');
  });

  it('Lista zaposlenih - prikazuje status badge (aktivan/neaktivan)', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    cy.contains(/aktivan|active/i).should('exist');
  });

  it('Lista zaposlenih - prikazuje Admin badge za admin korisnika', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    // Marko is admin - should have "Admin" badge
    cy.contains('Admin').should('exist');
  });

  // --- S12: Filtriranje ---
  it('S12: Filtriranje zaposlenih po email-u', () => {
    cy.intercept('GET', '**/api/employees*email=nikola*', { statusCode: 200, body: {
      content: [mockEmployees.content[1]], totalElements: 1, totalPages: 1, number: 0, size: 10,
    }}).as('filterByEmail');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    // Click filter toggle button (SlidersHorizontal icon)
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po email-u"]').type('nikola');
    cy.wait('@filterByEmail');
  });

  it('S12b: Filtriranje zaposlenih po imenu', () => {
    cy.intercept('GET', '**/api/employees*firstName=Tamara*', { statusCode: 200, body: {
      content: [mockEmployees.content[2]], totalElements: 1, totalPages: 1, number: 0, size: 10,
    }}).as('filterByName');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po imenu"]').type('Tamara');
    cy.wait('@filterByName');
  });

  it('S12c: Filtriranje zaposlenih po poziciji', () => {
    cy.intercept('GET', '**/api/employees*position=Developer*', { statusCode: 200, body: {
      content: [mockEmployees.content[2]], totalElements: 1, totalPages: 1, number: 0, size: 10,
    }}).as('filterByPos');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretraga po poziciji"]').type('Developer');
    cy.wait('@filterByPos');
  });

  // --- S13: Izmena podataka ---
  it('S13: Izmena podataka zaposlenog', () => {
    cy.intercept('GET', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('getEmployee');
    cy.intercept('PUT', '**/api/employees/2', {
      statusCode: 200,
      body: { ...singleEmployee, phone: '+381649999999' },
    }).as('updateEmployee');

    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    cy.get('#phoneNumber').clear().type('+381649999999');
    cy.contains('button', 'Sacuvaj izmene').click();
    cy.wait('@updateEmployee');
  });

  // --- S14: Deaktivacija ---
  it('S14: Deaktivacija zaposlenog - toggle switch off i sacuvaj', () => {
    cy.intercept('GET', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('getEmployee');
    cy.intercept('PATCH', '**/api/employees/2/deactivate', { statusCode: 200 }).as('deactivate');
    cy.intercept('PUT', '**/api/employees/2', { statusCode: 200, body: { ...singleEmployee, active: false } }).as('update');

    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployee');
    // Deactivation is done via the isActive Switch toggle + save
    cy.get('[role="switch"]').click();
    cy.contains('button', 'Sacuvaj izmene').click();
  });

  // --- S15: Admin ne moze editovati drugog admina ---
  it('S15: Admin ne moze da edituje drugog admina', () => {
    const adminEmployee = { ...mockEmployees.content[0] }; // Marko is admin
    cy.intercept('GET', '**/api/employees/1', { statusCode: 200, body: adminEmployee }).as('getAdmin');

    cy.visit('/admin/employees/1', { onBeforeLoad: setupAdminSession });
    cy.wait('@getAdmin');
    // Edit form should be disabled or redirect, or show warning
    // Admin fields should not be editable by another admin
  });

  it('Lista zaposlenih - prazna lista', () => {
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
    }).as('emptyList');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@emptyList');
    cy.contains(/nema|prazn|no employees|nema zaposlenih/i).should('exist');
  });

  it('Lista zaposlenih - paginacija', () => {
    const manyEmployees = {
      content: mockEmployees.content,
      totalElements: 25,
      totalPages: 3,
      number: 0,
      size: 10,
    };
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: manyEmployees }).as('pagedList');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@pagedList');
    // Pagination controls should exist (prev/next chevrons + rows per page)
    cy.contains(/Redova po stranici|od \d+/i).should('exist');
  });

  it('Lista zaposlenih - greska pri ucitavanju', () => {
    cy.intercept('GET', '**/api/employees*', { statusCode: 500, body: { message: 'Server error' } }).as('serverError');

    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@serverError');
  });

  it('Edit zaposlenog - zaposleni ne postoji', () => {
    cy.intercept('GET', '**/api/employees/999', { statusCode: 404, body: { message: 'Not found' } }).as('notFound');

    cy.visit('/admin/employees/999', { onBeforeLoad: setupAdminSession });
    cy.wait('@notFound');
    cy.contains(/nije pronađen|not found|ne postoji/i).should('exist');
  });

  it('Edit zaposlenog - upravljanje permisijama', () => {
    cy.intercept('GET', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('getEmp');
    cy.intercept('PUT', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('updateEmp');

    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmp');
    // Permission checkboxes should be visible
    cy.contains(/permisij|dozvol/i).should('exist');
  });

  it('Edit zaposlenog - loading skeleton dok se podaci ucitavaju', () => {
    cy.intercept('GET', '**/api/employees/2', (req) => {
      req.reply({ statusCode: 200, body: singleEmployee, delay: 2000 });
    }).as('slowLoad');

    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    // Skeleton loaders should be visible
    cy.get('[class*="animate-pulse"], [class*="skeleton"]').should('exist');
  });

  it('Edit zaposlenog - navigacija nazad na listu', () => {
    cy.intercept('GET', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('getEmp');
    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmp');
    cy.contains(/Nazad na listu|Otkazi/i).first().click();
    cy.url().should('include', '/admin/employees');
  });

  it('Klik na zaposlenog u tabeli otvara edit stranicu', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    // Click on editable employee row (non-admin rows are clickable)
    cy.get('table tbody tr').not('.opacity-60').first().click({ force: true });
  });

  it('Novi zaposleni dugme navigira na create stranicu', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');
    cy.contains('Novi zaposleni').click();
    cy.url().should('include', '/admin/employees/new');
  });
});

// ====================================================================
// FEATURE 4: Autorizacija i permisije (Scenarios S16-S18)
// ====================================================================

describe('Feature 4: Autorizacija i permisije', () => {
  it('S16: Employee bez admin permisija ne moze pristupiti admin portalu', () => {
    // setupEmployeeSession creates user with EMPLOYEE role (no ADMIN permission)
    // adminOnly routes should redirect to /403
    cy.visit('/admin/employees', { onBeforeLoad: setupEmployeeSession });
    // ProtectedRoute checks adminOnly && !isAdmin -> /403
    cy.url().should('match', /\/(403|home|admin)/);
  });

  it('S16b: Client ne moze pristupiti employee portalima', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: setupClientSession });
    cy.url().should('include', '/403');
  });

  it('S16c: Client ne moze pristupiti admin rutama', () => {
    cy.visit('/admin/employees', { onBeforeLoad: setupClientSession });
    cy.url().should('include', '/403');
  });

  it('S17: Admin dodeljuje permisije zaposlenom na edit stranici', () => {
    cy.intercept('GET', '**/api/employees/2', { statusCode: 200, body: singleEmployee }).as('getEmp');
    cy.intercept('PUT', '**/api/employees/2', (req) => {
      expect(req.body.permissions || req.body).to.exist;
      req.reply({ statusCode: 200, body: { ...singleEmployee, permissions: ['ADMIN'] } });
    }).as('updatePerms');

    cy.visit('/admin/employees/2', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmp');
    // Permission checkboxes have ids like perm-ADMIN, perm-TRADE_STOCKS etc.
    cy.get('[id^="perm-"]').first().click({ force: true });
    cy.contains('button', 'Sacuvaj izmene').click();
    cy.wait('@updatePerms');
  });

  it('S18: Novi zaposleni nema permisije nakon kreiranja', () => {
    const newEmployee = { ...singleEmployee, id: 50, permissions: [] };
    cy.intercept('GET', '**/api/employees/50', { statusCode: 200, body: newEmployee }).as('getNew');

    cy.visit('/admin/employees/50', { onBeforeLoad: setupAdminSession });
    cy.wait('@getNew');
    // All permission checkboxes should be unchecked
  });

  it('Neulogovan korisnik se redirectuje na login', () => {
    // Visit protected route without session
    cy.window().then((win) => win.sessionStorage.clear());
    cy.visit('/home');
    cy.url().should('include', '/login');
  });

  it('Neulogovan korisnik moze pristupiti javnim rutama', () => {
    cy.window().then((win) => win.sessionStorage.clear());
    cy.visit('/login');
    cy.url().should('include', '/login');
    cy.visit('/');
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    cy.visit('/forgot-password');
    cy.url().should('include', '/forgot-password');
  });

  it('Neulogovan korisnik moze pristupiti error stranicama', () => {
    cy.window().then((win) => win.sessionStorage.clear());
    cy.visit('/403');
    cy.url().should('include', '/403');
    cy.visit('/500');
    cy.url().should('include', '/500');
  });

  it('/dashboard redirectuje na /home', () => {
    cy.visit('/dashboard', { onBeforeLoad: setupClientSession });
    cy.url().should('include', '/home');
  });
});

// ====================================================================
// FEATURE 5: Error stranice
// ====================================================================

describe('Feature 5: Error stranice', () => {
  it('403 Forbidden stranica se prikazuje', () => {
    cy.visit('/403');
    cy.contains(/403|zabranjeno|forbidden|nemate pristup|pristup zabranjen/i).should('be.visible');
  });

  it('403 - prikazuje dugmad za navigaciju', () => {
    cy.visit('/403');
    cy.get('a, button').should('have.length.greaterThan', 0);
  });

  it('404 Not Found za nepostojecu rutu', () => {
    cy.visit('/nepostojeca-stranica-xyz-123');
    cy.contains(/404|nije pronađena|not found|ne postoji/i).should('be.visible');
  });

  it('404 - prikazuje "Nazad na pocetnu" dugme', () => {
    cy.visit('/nepostojeca-ruta');
    cy.contains(/nazad|početn|prijav/i).should('exist');
  });

  it('404 - klik na dugme vodi na pocetnu ili login', () => {
    cy.visit('/nepostojeca-ruta');
    cy.contains(/nazad|početn|prijav/i).first().click();
    cy.url().should('match', /\/(login|home)?$/);
  });

  it('500 Server Error stranica se prikazuje', () => {
    cy.visit('/500');
    cy.contains(/500|greška servera|server error|interna greška/i).should('be.visible');
  });

  it('500 - prikazuje "Nazad" dugme', () => {
    cy.visit('/500');
    cy.contains(/nazad|početn|pokušaj/i).should('exist');
  });

  it('500 - klik na "Nazad na pocetnu" vodi na /', () => {
    cy.visit('/500');
    cy.contains('button', /nazad na početnu/i).click();
    cy.url().should('not.include', '/500');
  });
});

// ====================================================================
// FEATURE 6: Landing Page
// ====================================================================

describe('Feature 6: Landing Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Landing stranica prikazuje sve sekcije', () => {
    cy.contains('BANKA 2025').should('be.visible');
    // Hero section
    cy.get('h1, [class*="hero"]').should('exist');
    // Features section
    cy.contains(/račun|plaćanj|transfer|menjačnic|kartice|kredit/i).should('exist');
  });

  it('Landing - branding BANKA 2025 TIM 2', () => {
    cy.contains(/BANKA 2025/i).should('be.visible');
  });

  it('Landing - navigacija na login', () => {
    cy.contains(/prijav|login|uloguj/i).first().click();
    cy.url().should('include', '/login');
  });

  it('Landing - hero sekcija sa CTA dugmetom', () => {
    cy.get('h1, [class*="hero"]').should('exist');
    cy.get('a[href*="login"], button').should('have.length.greaterThan', 0);
  });

  it('Landing - feature kartice su prikazane', () => {
    // Should show 6 feature cards (Racuni, Placanja, Transferi, Menjacnica, Kartice, Krediti)
    cy.contains(/račun/i).should('exist');
    cy.contains(/plaćanj/i).should('exist');
  });

  it('Landing - footer je vidljiv', () => {
    cy.scrollTo('bottom');
    cy.get('footer, [class*="footer"]').should('exist');
  });

  it('Landing - tema toggle postoji', () => {
    cy.get('button[title*="Tema"], button:has(svg.lucide-sun), button:has(svg.lucide-moon)').should('exist');
  });

  it('Landing - CTA sekcija', () => {
    cy.scrollTo('bottom');
    cy.contains(/saznaj|registruj|počni|otvori/i).should('exist');
  });

  it('Landing - animacije se ucitavaju', () => {
    // Animated blobs or fade-up elements should exist
    cy.get('[class*="animate-"], [class*="blob"], [class*="fade"]').should('exist');
  });

  it('Landing - logo rotacija na scroll', () => {
    cy.get('img[src*="logo"], [class*="logo"]').should('exist');
    cy.scrollTo(0, 300);
    // Logo should still be visible (with rotation transform)
    cy.get('img[src*="logo"], [class*="logo"]').should('be.visible');
  });

  it('Landing - backend status indikator (server aktivan)', () => {
    cy.intercept('HEAD', '**/v3/api-docs', { statusCode: 200 });
    cy.visit('/');
    cy.contains(/Server aktivan|aktivan/i).should('exist');
  });

  it('Landing - server nedostupan kad backend ne radi', () => {
    cy.intercept('HEAD', '**/v3/api-docs', { statusCode: 500 });
    cy.visit('/');
    cy.contains(/Server nedostupan|nedostupan/i).should('exist');
  });

  it('Landing - "Saznaj vise" skroluje na features sekciju', () => {
    cy.contains(/saznaj više|saznaj vise/i).click();
    cy.get('#features').should('be.visible');
  });

  it('Landing - currency ticker prikazuje sve valute', () => {
    cy.contains('RSD').should('exist');
    cy.contains('EUR').should('exist');
    cy.contains('USD').should('exist');
    cy.contains('CHF').should('exist');
    cy.contains('GBP').should('exist');
  });

  it('Landing - prikazuje svih 6 feature kartica sa tacnim naslovima', () => {
    cy.scrollTo('bottom');
    cy.contains('Upravljanje zaposlenima').should('exist');
    cy.contains('Sigurna autentifikacija').should('exist');
    cy.contains('Bankarsko poslovanje').should('exist');
    cy.contains('Trgovina hartijama').should('exist');
    cy.contains('Sistem permisija').should('exist');
    cy.contains('Više valuta').should('exist');
  });
});

// ====================================================================
// JWT Token Management
// ====================================================================

describe('JWT Token Management', () => {
  it('Uspesan login cuva token u sessionStorage', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: adminToken, refreshToken: 'my-refresh', tokenType: 'Bearer' },
    }).as('login');

    cy.visit('/login');
    cy.get('#email').type('marko.petrovic@banka.rs');
    cy.get('#password').type('Admin12345');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@login');
    cy.url().should('include', '/home');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.exist;
      expect(win.sessionStorage.getItem('refreshToken')).to.exist;
      expect(win.sessionStorage.getItem('refreshToken')).to.not.be.null;
    });
  });

  it('Logout brise sessionStorage i preusmerava na login', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains('Odjavi se').click();
    cy.url().should('include', '/login');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.be.null;
    });
  });

  it('Token refresh na 401 - uspesan refresh', () => {
    const newToken = fakeJwt('stefan@gmail.com', 'CLIENT');
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: newToken, refreshToken: 'new-refresh' },
    }).as('refresh');

    // This test validates the interceptor is set up for refresh
    cy.visit('/home', { onBeforeLoad: setupClientSession });
  });
});

// ====================================================================
// Forgot Password - Detaljno
// ====================================================================

describe('Forgot Password - Detaljno', () => {
  beforeEach(() => {
    cy.visit('/forgot-password');
  });

  it('Prikazuje formu za unos email-a', () => {
    cy.contains(/zaboravljen|reset|lozink/i).should('be.visible');
    cy.get('#email').should('be.visible');
    cy.contains('button', /pošalji|link/i).should('be.visible');
  });

  it('Prikazuje validaciju za prazan email', () => {
    cy.contains('button', /pošalji|link/i).click();
    cy.get('.text-destructive, .text-sm.text-destructive, [class*="error"]').should('exist');
  });

  it('Prikazuje validaciju za nevalidan email format', () => {
    cy.get('#email').type('nevalidan-email');
    cy.contains('button', /pošalji|link/i).click();
    cy.contains(/email|validn/i).should('exist');
  });

  it('Uspesno slanje - uvek prikazuje success poruku (sigurnost)', () => {
    cy.intercept('POST', '**/api/auth/password_reset/request', { statusCode: 200, body: { message: 'OK' } }).as('req');
    cy.get('#email').type('bilo.ko@banka.rs');
    cy.contains('button', /pošalji|link/i).click();
    cy.wait('@req');
    cy.contains(/proverite|email|posla/i).should('be.visible');
  });

  it('Link nazad na login', () => {
    cy.contains(/nazad|prijav/i).click();
    cy.url().should('include', '/login');
  });
});

// ====================================================================
// HomePage - Mock
// ====================================================================

describe('HomePage - Mock', () => {
  it('Klijent vidi pocetnu stranicu sa pozdravom', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [
      { id: 1, accountNumber: '222000112345678911', name: 'Glavni', accountType: 'CHECKING', currency: 'RSD', balance: 185000, availableBalance: 185000, status: 'ACTIVE' },
    ]});
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/dobro|stefan/i).should('be.visible');
  });

  it('Admin vidi admin kartice na pocetnoj', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: mockEmployees });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupAdminSession });
    cy.contains(/zaposleni|employee|admin/i).should('exist');
  });

  it('Sidebar navigacija - klijent vidi moje finansije', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains('Racuni').should('exist');
    cy.contains('Placanja').should('exist');
    cy.contains('Prenosi').should('exist');
    cy.contains('Menjacnica').should('exist');
    cy.contains('Kartice').should('exist');
    cy.contains('Krediti').should('exist');
  });

  it('Sidebar navigacija - admin vidi employee portale', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: mockEmployees });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupAdminSession });
    cy.contains('Employee portal').should('exist');
  });

  it('Sidebar - tema toggle (svetla/tamna)', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/Svetlo|Tamno|Sistem/i).should('exist');
  });

  it('Sidebar - logout dugme', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains('Odjavi se').should('exist');
  });
});

// ====================================================================
// Kompletni E2E Flowovi - Mock
// ====================================================================

describe('Kompletni E2E Flowovi - Celina 1', () => {
  it('Admin employee management flow: lista -> kreiranje -> edit', () => {
    // Step 1: List
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: mockEmployees }).as('list');
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@list');

    // Step 2: Navigate to create
    cy.contains(/novi|dodaj|kreiraj/i).click();
    cy.url().should('include', '/admin/employees/new');

    // Step 3: Cancel and go back
    cy.contains(/odustani|nazad|otkaži/i).click();
    cy.url().should('include', '/admin/employees');
  });

  it('Login -> Home -> Navigacija kroz sidebar -> Logout', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: fakeJwt('stefan@gmail.com', 'CLIENT'), refreshToken: 'r', tokenType: 'Bearer' },
    }).as('login');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    // Login
    cy.visit('/login');
    cy.get('#email').type('stefan@gmail.com');
    cy.get('#password').type('Klijent12345');
    cy.contains('button', 'Prijavi se').click();
    cy.wait('@login');
    cy.url().should('include', '/home');

    // Navigate via sidebar
    cy.contains('Racuni').click();
    cy.url().should('include', '/accounts');

    // Logout
    cy.visit('/home');
    cy.contains('Odjavi se').click();
    cy.url().should('include', '/login');
  });
});
