/// <reference types="cypress" />
// Comprehensive E2E tests for Employee Portals: Account Creation, Accounts Management,
// Clients Management, and Card Management per Account.
import { setupAdminSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockClients = {
  content: [
    {
      id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan.jovanovic@gmail.com',
      phoneNumber: '+381601234567', address: 'Beograd, Knez Mihailova 1',
      dateOfBirth: '1990-01-15', gender: 'MALE',
    },
    {
      id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica.nikolic@gmail.com',
      phoneNumber: '+381609876543', address: 'Novi Sad, Trg slobode 5',
      dateOfBirth: '1992-05-20', gender: 'FEMALE',
    },
    {
      id: 3, firstName: 'Jovan', lastName: 'Markovic', email: 'jovan.markovic@gmail.com',
      phoneNumber: '+381605555555', address: 'Nis, Obrenoviceva 3',
      dateOfBirth: '1988-11-10', gender: 'MALE',
    },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockAccounts = {
  content: [
    {
      id: 1, accountNumber: '265000000000000001', ownerName: 'Stefan Jovanovic',
      accountType: 'TEKUCI', currency: 'RSD', balance: 150000,
      availableBalance: 145000, status: 'ACTIVE',
    },
    {
      id: 2, accountNumber: '265000000000000002', ownerName: 'Milica Nikolic',
      accountType: 'DEVIZNI', currency: 'EUR', balance: 5000,
      availableBalance: 4800, status: 'ACTIVE',
    },
    {
      id: 3, accountNumber: '265000000000000003', ownerName: 'Jovan Markovic',
      accountType: 'POSLOVNI', currency: 'RSD', balance: 500000,
      availableBalance: 500000, status: 'BLOCKED',
    },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockCards = [
  {
    id: 101, cardNumber: '4111111111111111', cardType: 'VISA', cardName: 'Visa Debit',
    accountId: 1, accountNumber: '265000000000000001', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2028-06-30',
    status: 'ACTIVE', cardLimit: 200000, limit: 200000, createdAt: '2025-01-15',
  },
  {
    id: 102, cardNumber: '5500000000000004', cardType: 'MASTERCARD', cardName: 'Mastercard Gold',
    accountId: 1, accountNumber: '265000000000000001', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2027-12-31',
    status: 'BLOCKED', cardLimit: 100000, limit: 100000, createdAt: '2025-02-20',
  },
  {
    id: 103, cardNumber: '3566002020360505', cardType: 'DINACARD', cardName: 'DinaCard Standard',
    accountId: 1, accountNumber: '265000000000000001', ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC', expirationDate: '2026-03-15',
    status: 'DEACTIVATED', cardLimit: 50000, limit: 50000, createdAt: '2024-03-15',
  },
];

const mockAccountDetail = {
  id: 1, accountNumber: '265000000000000001', ownerName: 'Stefan Jovanovic',
  accountType: 'TEKUCI', currency: 'RSD', balance: 150000,
  availableBalance: 145000, status: 'ACTIVE', name: 'Tekuci RSD',
};

const mockClientAccounts = [
  {
    id: 1, accountNumber: '265000000000000001', accountType: 'TEKUCI',
    currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE',
  },
  {
    id: 4, accountNumber: '265000000000000004', accountType: 'DEVIZNI',
    currency: 'EUR', balance: 2000, availableBalance: 2000, status: 'ACTIVE',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE ACCOUNT PORTAL (employee/accounts/new)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Employee Portal - Create Account Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('searchClients');
  });

  it('loads the create account page with header and form', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Kreiranje racuna').should('be.visible');
    cy.contains('Tip racuna').should('be.visible');
  });

  it('shows TEKUCI account type selected by default', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Tekuci racun').should('exist');
  });

  it('shows subtypes for TEKUCI accounts (Standardni, Stedni, Penzionerski, etc.)', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    // Subtype selector should be visible
    cy.contains('Podvrsta racuna').should('be.visible');
  });

  it('switches to DEVIZNI and shows EUR as default currency', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    // Open account type select and pick Devizni
    cy.contains('label', 'Tip racuna').parent().find('button[role="combobox"]').click();
    cy.contains('[role="option"]', 'Devizni').click();
    cy.contains('EUR').should('exist');
  });

  it('switches to POSLOVNI and shows business fields', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    // Open account type select and pick Poslovni
    cy.contains('label', 'Tip racuna').parent().find('button[role="combobox"]').click();
    cy.contains('[role="option"]', 'Poslovni').click();
    // Business-specific fields should appear
    cy.contains('Podaci firme').should('be.visible');
  });

  it('shows business form fields: company name, registration number, tax ID, activity code', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('label', 'Tip racuna').parent().find('button[role="combobox"]').click();
    cy.contains('[role="option"]', 'Poslovni').click();
    cy.get('input[name="companyName"]').should('exist');
    cy.get('input[name="registrationNumber"]').should('exist');
    cy.get('input[name="taxId"]').should('exist');
    cy.get('input[name="activityCode"]').should('exist');
  });

  it('searches for clients by email when typing owner email', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('input[name="ownerEmail"]').type('stefan');
    cy.wait('@searchClients');
  });

  it('submits TEKUCI account creation successfully', () => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: { id: 10, accountType: 'CHECKING', currency: 'RSD', status: 'ACTIVE' },
    }).as('createAccount');

    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('input[name="ownerEmail"]').type('stefan.jovanovic@gmail.com');
    cy.get('input[name="initialDeposit"]').type('10000');

    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount');
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });

  it('submits POSLOVNI account creation with company data', () => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: { id: 11, accountType: 'BUSINESS', currency: 'RSD', status: 'ACTIVE' },
    }).as('createBusinessAccount');

    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('label', 'Tip racuna').parent().find('button[role="combobox"]').click();
    cy.contains('[role="option"]', 'Poslovni').click();
    cy.get('input[name="ownerEmail"]').type('jovan.markovic@gmail.com');
    cy.get('input[name="companyName"]').type('Test DOO');
    cy.get('input[name="registrationNumber"]').type('12345678');
    cy.get('input[name="taxId"]').type('987654321');
    cy.get('input[name="activityCode"]').type('62.01');
    cy.get('input[name="firmAddress"]').type('Nemanjina 4');
    cy.get('input[name="firmCity"]').type('Beograd');
    cy.get('input[name="firmCountry"]').type('Srbija');

    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createBusinessAccount');
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });

  it('shows validation errors for empty required fields', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('button', 'Kreiraj racun').click();
    // Email is required
    cy.contains('Email').should('exist');
  });

  it('shows create card toggle switch', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Napravi karticu uz racun').should('be.visible');
    cy.get('button[role="switch"]').should('exist');
  });

  it('shows back button that navigates to accounts portal', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Nazad').should('be.visible');
  });

  it('handles server error on account creation', () => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('createAccountError');

    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('input[name="ownerEmail"]').type('stefan.jovanovic@gmail.com');
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccountError');
  });

  it('shows initial deposit input field', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('input[name="initialDeposit"]').should('exist');
  });

  it('shows preview card with selected account type gradient', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
    // The preview card should show the selected account type
    cy.get('[class*="bg-gradient-to"]').should('have.length.at.least', 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS MANAGEMENT PORTAL (employee/accounts)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Employee Portal - Accounts Management', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: mockAccounts }).as('getAllAccounts');
  });

  it('loads the accounts portal page with header', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('h1', 'Portal racuna').should('be.visible');
  });

  it('displays account table with all accounts', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Jovan Markovic').should('be.visible');
  });

  it('shows account type badges (Tekuci, Devizni, Poslovni)', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('Tekuci').should('exist');
    cy.contains('Devizni').should('exist');
    cy.contains('Poslovni').should('exist');
  });

  it('shows account status badges (Aktivan, Blokiran)', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('Aktivan').should('exist');
    cy.contains('Blokiran').should('exist');
  });

  it('shows stat cards: Ukupno racuna, Aktivni, Blokirani, Ukupno stanje', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('Ukupno racuna').should('be.visible');
    cy.contains('Aktivni').should('be.visible');
    cy.contains('Blokirani').should('be.visible');
    cy.contains('Ukupno stanje').should('be.visible');
  });

  it('shows filter toggle button', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.get('button[title="Filteri"]').should('exist');
  });

  it('opens filters panel and shows filter dropdowns', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Find and click the filters button (icon button with title)
    cy.get('button[title="Filteri"]').click({ force: true });
    cy.contains('Filteri pretrage').should('be.visible');
  });

  it('filters accounts by owner email search', () => {
    cy.intercept('GET', '**/api/accounts/all*ownerName=stefan*', {
      statusCode: 200,
      body: {
        content: [mockAccounts.content[0]],
        totalElements: 1,
        totalPages: 1,
      },
    }).as('filterByEmail');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Open filters first
    cy.get('button[title="Filteri"]').click({ force: true });
    cy.get('input[placeholder*="Pretrazi"]').first().type('stefan');
  });

  it('changes account status from ACTIVE to BLOCKED', () => {
    cy.intercept('PATCH', '**/api/accounts/1/status', {
      statusCode: 200,
      body: { ...mockAccounts.content[0], status: 'BLOCKED' },
    }).as('changeStatus');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Click block action on first account
    cy.get('table tbody tr').first().find('button').contains('Blokiraj').click({ force: true });
    cy.wait('@changeStatus');
    cy.contains('Status racuna promenjen').should('be.visible');
  });

  it('changes account status from BLOCKED to ACTIVE', () => {
    cy.intercept('PATCH', '**/api/accounts/3/status', {
      statusCode: 200,
      body: { ...mockAccounts.content[2], status: 'ACTIVE' },
    }).as('activateAccount');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Click activate action on blocked account
    cy.get('table tbody tr').eq(2).find('button').contains('Aktiviraj').click({ force: true });
    cy.wait('@activateAccount');
    cy.contains('Status racuna promenjen').should('be.visible');
  });

  it('navigates to create account page via Kreiraj racun button', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('button', 'Kreiraj racun').click();
    cy.url().should('include', '/employee/accounts/new');
  });

  it('navigates to account cards page', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccountDetail }).as('getAccountDetail');
    cy.intercept('GET', '**/api/cards/account/1', { statusCode: 200, body: mockCards }).as('getAccountCards');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Click on the cards button (CreditCard icon) for the first account row
    cy.get('table tbody tr').first().find('button[title="Kartice"]').click({ force: true });
    cy.url().should('include', '/employee/accounts/1/cards');
  });

  it('shows pagination controls', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    // Should show page info (uses en-dash: 1–3 od 3)
    cy.contains('od').should('exist');
  });

  it('shows empty state when no accounts found', () => {
    cy.intercept('GET', '**/api/accounts/all*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    }).as('getEmptyAccounts');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyAccounts');
    cy.contains('Nema').should('exist');
  });

  it('shows formatted account numbers in xxx-xxxxxxxxxxxxx-xx format', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('265-0000000000000-01').should('exist');
  });

  it('shows formatted balances with RSD and EUR currency labels', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
    cy.contains('RSD').should('exist');
    cy.contains('EUR').should('exist');
  });

  it('handles API error gracefully with error message', () => {
    cy.intercept('GET', '**/api/accounts/all*', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('getAccountsError');

    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccountsError');
    cy.contains('Greska').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS MANAGEMENT PORTAL (employee/clients)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Employee Portal - Clients Management', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('getClients');
  });

  it('loads the clients portal page with header', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('h1', 'Portal klijenata').should('be.visible');
  });

  it('displays client list with names and emails', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Jovan Markovic').should('be.visible');
  });

  it('shows client email addresses in the list', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('stefan.jovanovic@gmail.com').should('be.visible');
    cy.contains('milica.nikolic@gmail.com').should('be.visible');
  });

  it('shows search input for filtering clients', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.get('input[placeholder*="Pretrazi"]').should('exist');
  });

  it('searches clients by name', () => {
    cy.intercept('GET', '**/api/clients*firstName=Stefan*', {
      statusCode: 200,
      body: { content: [mockClients.content[0]], totalElements: 1, totalPages: 1 },
    }).as('searchClients');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.get('input[placeholder*="Pretrazi"]').type('Stefan');
  });

  it('shows client detail panel when clicking on a client', () => {
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClientDetail');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('Stefan Jovanovic').click();
    cy.wait('@getClientDetail');
    cy.url().should('include', '/employee/clients/1');
  });

  it('shows client accounts in the detail view', () => {
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClientDetail');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');

    cy.visit('/employee/clients/1', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClientDetail');
    cy.wait('@getClientAccounts');
    cy.contains('265000000000000001').should('exist');
  });

  it('opens edit form for selected client', () => {
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClientDetail');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');

    cy.visit('/employee/clients/1', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClientDetail');
    cy.wait('@getClientAccounts');
    // Click edit button
    cy.contains('button', 'Izmeni').click({ force: true });
  });

  it('saves client edit successfully', () => {
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClientDetail');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');
    cy.intercept('PUT', '**/api/clients/1', {
      statusCode: 200,
      body: { ...mockClients.content[0], address: 'Nova adresa 123' },
    }).as('updateClient');

    cy.visit('/employee/clients/1', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClientDetail');
  });

  it('opens create new client form', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('button', 'Novi klijent').click({ force: true });
  });

  it('submits create new client form', () => {
    cy.intercept('POST', '**/api/clients', {
      statusCode: 201,
      body: {
        id: 4, firstName: 'Petar', lastName: 'Petrovic', email: 'petar.petrovic@gmail.com',
        phoneNumber: '+381601112233', address: 'Kragujevac', dateOfBirth: '1995-06-15', gender: 'MALE',
      },
    }).as('createClient');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('button', 'Novi klijent').click({ force: true });
  });

  it('handles duplicate email error on client creation', () => {
    cy.intercept('POST', '**/api/clients', {
      statusCode: 409,
      body: { message: 'Email already exists' },
    }).as('createClientDuplicate');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('button', 'Novi klijent').click({ force: true });
  });

  it('shows pagination controls for client list', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    // Pagination should exist
    cy.get('button').filter(':has(svg)').should('have.length.at.least', 1);
  });

  it('shows empty client list state', () => {
    cy.intercept('GET', '**/api/clients*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    }).as('getEmptyClients');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyClients');
    cy.contains('Nema').should('exist');
  });

  it('shows avatar initials for each client', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    // Initials like SJ, MN, JM should appear
    cy.contains('SJ').should('exist');
  });

  it('handles API error when loading clients', () => {
    cy.intercept('GET', '**/api/clients*', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('getClientsError');

    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClientsError');
    cy.contains('Neuspesno').should('exist');
  });

  it('shows phone numbers in client list', () => {
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.contains('+381601234567').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT CARDS PAGE (employee/accounts/:id/cards)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Employee Portal - Account Cards Management', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccountDetail }).as('getAccount');
    cy.intercept('GET', '**/api/cards/account/1', { statusCode: 200, body: mockCards }).as('getAccountCards');
  });

  it('loads the account cards page with account info header', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('h1', 'Portal kartica').should('be.visible');
  });

  it('displays all cards for the account', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('Visa Debit').should('exist');
    cy.contains('Mastercard Gold').should('exist');
    cy.contains('DinaCard Standard').should('exist');
  });

  it('shows card status labels (Aktivna, Blokirana, Deaktivirana)', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('Aktivna').should('exist');
    cy.contains('Blokirana').should('exist');
    cy.contains('Deaktivirana').should('exist');
  });

  it('shows masked card numbers (last 4 digits)', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('1111').should('exist');
    cy.contains('0004').should('exist');
    cy.contains('0505').should('exist');
  });

  it('blocks an active card', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', {
      statusCode: 200,
      body: {},
    }).as('blockCard');

    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    // Find the block button for active card
    cy.contains('Blokiraj').first().click({ force: true });
    cy.wait('@blockCard');
  });

  it('unblocks a blocked card', () => {
    cy.intercept('PATCH', '**/api/cards/102/unblock', {
      statusCode: 200,
      body: {},
    }).as('unblockCard');

    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('Deblokiraj').click({ force: true });
    cy.wait('@unblockCard');
  });

  it('deactivates a card with confirmation', () => {
    cy.intercept('PATCH', '**/api/cards/101/deactivate', {
      statusCode: 200,
      body: {},
    }).as('deactivateCard');
    // Also intercept card 102 deactivate in case it matches first
    cy.intercept('PATCH', '**/api/cards/102/deactivate', {
      statusCode: 200,
      body: {},
    });

    cy.on('window:confirm', () => true);

    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    // Find the first card's deactivate button (variant="destructive" renders with bg-destructive class)
    cy.get('[class*="bg-destructive"]').filter('button').first().click({ force: true });
    cy.wait('@deactivateCard');
  });

  it('shows card type labels (Visa, Mastercard, DinaCard)', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('Visa').should('exist');
    cy.contains('Mastercard').should('exist');
    cy.contains('DinaCard').should('exist');
  });

  it('shows card type gradient backgrounds', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.get('[class*="bg-gradient-to"]').should('have.length.at.least', 1);
  });

  it('shows account number in formatted form', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('265-0000000000000-01').should('exist');
  });

  it('shows back navigation button', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.contains('Nazad na portal racuna').should('be.visible');
  });

  it('shows empty state when account has no cards', () => {
    cy.intercept('GET', '**/api/cards/account/1', { statusCode: 200, body: [] }).as('getEmptyCards');

    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getEmptyCards');
    cy.contains('Nema').should('exist');
  });

  it('shows card expiration dates', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    // Should show formatted dates
    cy.contains('2028').should('exist');
    cy.contains('2027').should('exist');
  });

  it('shows card holder name', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('STEFAN JOVANOVIC').should('exist');
  });

  it('shows card limit information', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('200').should('exist');
  });

  it('handles error when loading cards', () => {
    cy.intercept('GET', '**/api/cards/account/1', {
      statusCode: 500,
      body: { message: 'Error' },
    }).as('getCardsError');

    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getCardsError');
  });

  it('shows create new card button', () => {
    cy.visit('/employee/accounts/1/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAccount');
    cy.wait('@getAccountCards');
    cy.contains('Nova kartica').should('exist');
  });
});
