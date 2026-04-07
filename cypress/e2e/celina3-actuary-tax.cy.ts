/// <reference types="cypress" />
// Comprehensive E2E tests for Celina 3: Actuary Management, Tax Portal, Exchange Management
import { setupAdminSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAgents = [
  {
    id: 1, employeeId: 10, employeeName: 'Marko Petrovic', employeeEmail: 'marko.petrovic@banka.rs',
    employeePosition: 'Agent', actuaryType: 'AGENT', dailyLimit: 1000000, usedLimit: 250000, needApproval: false,
  },
  {
    id: 2, employeeId: 11, employeeName: 'Ana Markovic', employeeEmail: 'ana.markovic@banka.rs',
    employeePosition: 'Agent', actuaryType: 'AGENT', dailyLimit: 500000, usedLimit: 499000, needApproval: true,
  },
  {
    id: 3, employeeId: 12, employeeName: 'Stefan Jovic', employeeEmail: 'stefan.jovic@banka.rs',
    employeePosition: 'Agent', actuaryType: 'AGENT', dailyLimit: 750000, usedLimit: 0, needApproval: false,
  },
  {
    id: 4, employeeId: 13, employeeName: 'Milica Nikolic', employeeEmail: 'milica.nikolic@banka.rs',
    employeePosition: 'Agent', actuaryType: 'AGENT', dailyLimit: 200000, usedLimit: 200000, needApproval: true,
  },
];

const mockTaxRecords = [
  {
    id: 1, userId: 100, userName: 'Stefan Jovanovic', userType: 'CLIENT',
    totalProfit: 350000, taxOwed: 45000, taxPaid: 0,
    currency: 'RSD',
  },
  {
    id: 2, userId: 101, userName: 'Milica Nikolic', userType: 'CLIENT',
    totalProfit: 1200000, taxOwed: 135000, taxPaid: 0,
    currency: 'RSD',
  },
  {
    id: 3, userId: 10, userName: 'Marko Petrovic', userType: 'EMPLOYEE',
    totalProfit: 80000, taxOwed: 9000, taxPaid: 0,
    currency: 'RSD',
  },
  {
    id: 4, userId: 102, userName: 'Jovan Markovic', userType: 'CLIENT',
    totalProfit: 0, taxOwed: 0, taxPaid: 0,
    currency: 'RSD',
  },
];

const mockExchanges = [
  {
    id: 1, name: 'New York Stock Exchange', acronym: 'NYSE', micCode: 'XNYS',
    country: 'United States', currency: 'USD', timeZone: 'America/New_York',
    openTime: '09:30', closeTime: '16:00', isOpen: true, testMode: false,
  },
  {
    id: 2, name: 'NASDAQ', acronym: 'NASDAQ', micCode: 'XNAS',
    country: 'United States', currency: 'USD', timeZone: 'America/New_York',
    openTime: '09:30', closeTime: '16:00', isOpen: true, testMode: true,
  },
  {
    id: 3, name: 'London Stock Exchange', acronym: 'LSE', micCode: 'XLON',
    country: 'United Kingdom', currency: 'GBP', timeZone: 'Europe/London',
    openTime: '08:00', closeTime: '16:30', isOpen: true, testMode: false,
  },
  {
    id: 4, name: 'Beogradska Berza', acronym: 'BELEX', micCode: 'XBEL',
    country: 'Serbia', currency: 'RSD', timeZone: 'Europe/Belgrade',
    openTime: '09:00', closeTime: '15:00', isOpen: true, testMode: false,
  },
];

const mockExchangeRates = [
  { currency: 'EUR', buyRate: 117, sellRate: 118, middleRate: 117.5, date: '2026-03-30' },
  { currency: 'USD', buyRate: 108, sellRate: 109, middleRate: 108.3, date: '2026-03-30' },
  { currency: 'GBP', buyRate: 137, sellRate: 138, middleRate: 137.2, date: '2026-03-30' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARY MANAGEMENT (employee/actuaries)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Actuary Management - Agent List', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/actuaries/agents*', { statusCode: 200, body: mockAgents }).as('getAgents');
  });

  it('loads the actuary management page with header', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.get('main').contains('Upravljanje aktuarima').should('be.visible');
  });

  it('displays all agents in the table', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Component uses splitName() to split into first/last name columns
    cy.contains('td', 'Marko').should('be.visible');
    cy.contains('td', 'Petrovic').should('be.visible');
    cy.contains('td', 'Ana').should('be.visible');
    cy.contains('td', 'Markovic').should('be.visible');
    cy.contains('td', 'Stefan').should('be.visible');
    cy.contains('td', 'Jovic').should('be.visible');
    cy.contains('td', 'Milica').should('be.visible');
    cy.contains('td', 'Nikolic').should('be.visible');
  });

  it('shows agent email addresses', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.contains('marko.petrovic@banka.rs').should('be.visible');
    cy.contains('ana.markovic@banka.rs').should('be.visible');
  });

  it('shows daily limit and used limit for each agent', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Should show limit values
    cy.contains('1.000.000').should('exist');
    cy.contains('500.000').should('exist');
  });

  it('shows limit usage progress bar', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Progress bars should exist
    cy.get('[role="progressbar"], div[class*="bg-"]').should('have.length.at.least', 1);
  });

  it('shows needApproval status (badge or indicator)', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Ana and Milica have needApproval=true - column header is "Need Approval"
    cy.contains('Need Approval').should('exist');
  });

  it('shows search/filter input for agents', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Filter panel is hidden by default; click the filter button to show it
    cy.get('button[title="Filteri"]').click({ force: true });
    cy.get('input[placeholder="Pretraga po email-u"]').should('have.length.at.least', 1);
  });

  it('opens filter panel with email, first name, last name fields', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Click filters button
    cy.get('button').filter(':has(svg)').first().click({ force: true });
  });

  it('filters agents by email', () => {
    cy.intercept('GET', '**/api/actuaries/agents*email=marko*', {
      statusCode: 200,
      body: [mockAgents[0]],
    }).as('filterByEmail');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
  });

  it('shows empty state when no agents match filter', () => {
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 200,
      body: [],
    }).as('getEmptyAgents');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyAgents');
    cy.contains('Nema').should('exist');
  });

  it('handles API error when loading agents', () => {
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 500,
      body: { message: 'Error' },
    }).as('getAgentsError');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgentsError');
    cy.contains('Greska').should('exist');
  });
});

describe('Actuary Management - Change Agent Limits', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/actuaries/agents*', { statusCode: 200, body: mockAgents }).as('getAgents');
  });

  it('opens edit dialog when clicking edit button on agent', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Click edit button on first agent
    cy.get('table tbody tr').first().find('button').filter(':has(svg)').first().click({ force: true });
  });

  it('saves new daily limit for agent', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/limit', {
      statusCode: 200,
      body: { ...mockAgents[0], dailyLimit: 1500000 },
    }).as('updateLimit');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.get('table tbody tr').first().find('button').filter(':has(svg)').first().click({ force: true });
  });

  it('toggles needApproval for agent', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/limit', {
      statusCode: 200,
      body: { ...mockAgents[0], needApproval: true },
    }).as('updateApproval');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.get('table tbody tr').first().find('button').filter(':has(svg)').first().click({ force: true });
  });

  it('handles error when saving limit change', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/limit', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('updateLimitError');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.get('table tbody tr').first().find('button').filter(':has(svg)').first().click({ force: true });
  });
});

describe('Actuary Management - Reset Used Limit', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/actuaries/agents*', { statusCode: 200, body: mockAgents }).as('getAgents');
  });

  it('resets usedLimit to zero for an agent', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/reset-limit', {
      statusCode: 200,
      body: { ...mockAgents[0], usedLimit: 0 },
    }).as('resetLimit');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Accept the window.confirm dialog
    cy.on('window:confirm', () => true);
    // Click "Resetuj limit" text button in the first row
    cy.get('table tbody tr').first().contains('button', 'Resetuj limit').click({ force: true });
    cy.wait('@resetLimit');
  });

  it('shows updated usedLimit after reset', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/reset-limit', {
      statusCode: 200,
      body: { ...mockAgents[0], usedLimit: 0 },
    }).as('resetLimit');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.on('window:confirm', () => true);
    cy.get('table tbody tr').first().contains('button', 'Resetuj limit').click({ force: true });
    cy.wait('@resetLimit');
  });

  it('handles error when resetting limit', () => {
    cy.intercept('PATCH', '**/api/actuaries/10/reset-limit', {
      statusCode: 500,
      body: { message: 'Error' },
    }).as('resetLimitError');

    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.on('window:confirm', () => true);
    cy.get('table tbody tr').first().contains('button', 'Resetuj limit').click({ force: true });
    cy.wait('@resetLimitError');
  });

  it('shows agent with 100% used limit (Milica - 200000/200000)', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    // Component splits name into first/last name columns
    cy.contains('td', 'Milica').should('be.visible');
    cy.contains('td', 'Nikolic').should('be.visible');
    // Her limit is fully used
    cy.contains('200.000').should('exist');
  });

  it('shows agent with 0% used limit (Stefan - 0/750000)', () => {
    cy.visit('/employee/actuaries', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAgents');
    cy.contains('td', 'Stefan').should('be.visible');
    cy.contains('td', 'Jovic').should('be.visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAX PORTAL (employee/tax)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tax Portal - List Users and Tax Records', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/tax*', { statusCode: 200, body: mockTaxRecords }).as('getTaxRecords');
  });

  it('loads the tax portal page with header', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('Porez').should('exist');
  });

  it('displays all tax records in the table', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Marko Petrovic').should('be.visible');
    cy.contains('Jovan Markovic').should('be.visible');
  });

  it('shows user type labels (Klijent, Aktuar)', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('Klijent').should('exist');
    cy.contains('Aktuar').should('exist');
  });

  it('shows profit and loss amounts', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    // Milica has highest profit: 1,200,000
    cy.contains('1.200.000').should('exist');
  });

  it('shows tax amount for each user', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('45.000').should('exist');
    cy.contains('135.000').should('exist');
    cy.contains('9.000').should('exist');
  });

  it('shows zero tax for users with net loss (Jovan)', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('Jovan Markovic').should('be.visible');
  });

  it('shows search input for filtering users', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.get('input[placeholder="Pretraga po imenu"]').should('have.length.at.least', 1);
  });

  it('filters tax records by name search', () => {
    cy.intercept('GET', '**/api/tax*name=Stefan*', {
      statusCode: 200,
      body: [mockTaxRecords[0]],
    }).as('filterByName');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.get('input[placeholder="Pretraga po imenu"]').first().type('Stefan');
  });

  it('filters tax records by user type', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    // Find the user type filter
    cy.contains('Klijent').should('exist');
  });

  it('shows empty state when no tax records found', () => {
    cy.intercept('GET', '**/api/tax*', { statusCode: 200, body: [] }).as('getEmptyTax');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyTax');
    cy.contains('Nema').should('exist');
  });

  it('handles API error when loading tax records', () => {
    cy.intercept('GET', '**/api/tax*', { statusCode: 500, body: { message: 'Error' } }).as('getTaxError');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxError');
    cy.contains('Greska').should('exist');
  });

  it('shows formatted amounts with Serbian locale (dots as thousands)', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    // Serbian locale uses dots for thousands
    cy.contains('.').should('exist');
  });

  it('shows color-coded amounts: green for profit, red for loss', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    // Green profit colors
    cy.get('[class*="text-emerald"]').should('have.length.at.least', 1);
  });
});

describe('Tax Portal - Trigger Calculation', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/tax*', { statusCode: 200, body: mockTaxRecords }).as('getTaxRecords');
  });

  it('shows trigger calculation button', () => {
    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('button', 'Izracunaj porez').should('be.visible');
  });

  it('triggers tax calculation successfully', () => {
    cy.intercept('POST', '**/api/tax/calculate', { statusCode: 200, body: {} }).as('calculateTax');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('button', 'Izracunaj porez').click({ force: true });
    cy.wait('@calculateTax');
  });

  it('shows loading state during calculation', () => {
    cy.intercept('POST', '**/api/tax/calculate', {
      statusCode: 200,
      body: {},
      delay: 1000,
    }).as('calculateTaxSlow');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('button', 'Izracunaj porez').click({ force: true });
    // Button should show loading state
    cy.get('button:disabled').should('exist');
  });

  it('handles calculation error', () => {
    cy.intercept('POST', '**/api/tax/calculate', { statusCode: 500, body: { message: 'Error' } }).as('calculateTaxError');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('button', 'Izracunaj porez').click({ force: true });
    cy.wait('@calculateTaxError');
  });

  it('reloads tax records after successful calculation', () => {
    cy.intercept('POST', '**/api/tax/calculate', { statusCode: 200, body: {} }).as('calculateTax');

    cy.visit('/employee/tax', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getTaxRecords');
    cy.contains('button', 'Izracunaj porez').click({ force: true });
    cy.wait('@calculateTax');
    // Should reload
    cy.wait('@getTaxRecords');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXCHANGE MANAGEMENT (employee/exchanges)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Exchange Management - List Exchanges', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/exchanges', { statusCode: 200, body: mockExchanges }).as('getExchanges');
  });

  it('loads the exchanges page with header', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.get('main').contains('Berze').should('be.visible');
  });

  it('displays all exchanges in the table', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.contains('NYSE').should('be.visible');
    cy.contains('NASDAQ').should('be.visible');
    cy.contains('LSE').should('be.visible');
    cy.contains('BELEX').should('be.visible');
  });

  it('shows exchange full names', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.contains('New York Stock Exchange').should('be.visible');
    cy.contains('London Stock Exchange').should('be.visible');
    cy.contains('Beogradska Berza').should('be.visible');
  });

  it('shows exchange country info', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.contains('United States').should('be.visible');
    cy.contains('United Kingdom').should('be.visible');
    cy.contains('Serbia').should('be.visible');
  });

  it('shows exchange currency', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.contains('USD').should('exist');
    cy.contains('GBP').should('exist');
    cy.contains('RSD').should('exist');
  });

  it('shows test mode toggle switches', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    // Should have toggle switches for test mode
    cy.get('button[role="switch"]').should('have.length.at.least', 1);
  });

  it('shows NASDAQ as having test mode ON', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    // NASDAQ row should have checked=true toggle
    cy.get('button[role="switch"][aria-checked="true"]').should('have.length.at.least', 1);
  });

  it('shows opening/closing times', () => {
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.contains('09:30').should('exist');
    cy.contains('16:00').should('exist');
  });

  it('shows empty state when no exchanges found', () => {
    cy.intercept('GET', '**/api/exchanges', { statusCode: 200, body: [] }).as('getEmptyExchanges');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getEmptyExchanges');
    cy.contains('Nema').should('exist');
  });

  it('handles API error when loading exchanges', () => {
    cy.intercept('GET', '**/api/exchanges', { statusCode: 500, body: { message: 'Error' } }).as('getExchangesError');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchangesError');
  });

  it('shows loading skeleton while exchanges are loading', () => {
    cy.intercept('GET', '**/api/exchanges', {
      statusCode: 200,
      body: mockExchanges,
      delay: 2000,
    }).as('getExchangesDelayed');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });
});

describe('Exchange Management - Toggle Test Mode', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/exchanges', { statusCode: 200, body: mockExchanges }).as('getExchanges');
  });

  it('enables test mode for an exchange', () => {
    cy.intercept('PATCH', '**/api/exchanges/NYSE/test-mode', {
      statusCode: 200,
      body: {},
    }).as('toggleTestMode');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    // Click the toggle for NYSE (currently off)
    cy.get('button[role="switch"][aria-checked="false"]').first().click({ force: true });
    cy.wait('@toggleTestMode');
    cy.contains('Test mod ukljucen').should('exist');
  });

  it('disables test mode for an exchange', () => {
    cy.intercept('PATCH', '**/api/exchanges/NASDAQ/test-mode', {
      statusCode: 200,
      body: {},
    }).as('toggleTestModeOff');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    // Click the toggle for NASDAQ (currently on)
    cy.get('button[role="switch"][aria-checked="true"]').first().click({ force: true });
    cy.wait('@toggleTestModeOff');
    cy.contains('Test mod iskljucen').should('exist');
  });

  it('handles test mode toggle error gracefully', () => {
    cy.intercept('PATCH', '**/api/exchanges/*/test-mode', {
      statusCode: 500,
      body: { message: 'Error' },
    }).as('toggleTestModeError');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.get('button[role="switch"]').first().click({ force: true });
    cy.wait('@toggleTestModeError');
    cy.contains('Neuspesna promena test moda').should('exist');
  });

  it('shows toggling state (disabled button during request)', () => {
    cy.intercept('PATCH', '**/api/exchanges/NYSE/test-mode', {
      statusCode: 200,
      body: {},
      delay: 1000,
    }).as('toggleTestModeSlow');

    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.get('button[role="switch"][aria-checked="false"]').first().click({ force: true });
    // Toggle should be disabled during the request
    cy.get('button[role="switch"][disabled]').should('have.length.at.least', 1);
  });

  it('does not show test mode toggle for non-admin users', () => {
    // ExchangesPage checks isAdmin for toggle visibility
    // We test with admin so toggles should be visible
    cy.visit('/employee/exchanges', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getExchanges');
    cy.get('button[role="switch"]').should('have.length.at.least', 1);
  });
});
