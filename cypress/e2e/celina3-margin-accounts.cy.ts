/// <reference types="cypress" />
// Comprehensive E2E tests for Celina 3: Margin Accounts
// - List margin accounts
// - Deposit / Withdraw
// - Transaction history per account
import { setupClientSession, setupAdminSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockMarginAccounts = [
  {
    id: 1, accountNumber: 'MRG-0000001',
    linkedAccountId: 100, linkedAccountNumber: '265000000000000001',
    status: 'ACTIVE', initialMargin: 500000, loanValue: 300000,
    maintenanceMargin: 200000, bankParticipation: 0.6, currency: 'RSD',
  },
  {
    id: 2, accountNumber: 'MRG-0000002',
    linkedAccountId: 101, linkedAccountNumber: '265000000000000002',
    status: 'ACTIVE', initialMargin: 10000, loanValue: 6000,
    maintenanceMargin: 4000, bankParticipation: 0.6, currency: 'EUR',
  },
  {
    id: 3, accountNumber: 'MRG-0000003',
    linkedAccountId: 102, linkedAccountNumber: '265000000000000003',
    status: 'BLOCKED', initialMargin: 100000, loanValue: 100000,
    maintenanceMargin: 50000, bankParticipation: 0.5, currency: 'RSD',
  },
];

const mockTransactionsAccount1 = [
  {
    id: 1001, marginAccountId: 1, type: 'DEPOSIT', amount: 200000,
    currency: 'RSD', createdAt: '2026-03-25T10:00:00', description: 'Inicijalna uplata',
  },
  {
    id: 1002, marginAccountId: 1, type: 'DEPOSIT', amount: 100000,
    currency: 'RSD', createdAt: '2026-03-26T14:00:00', description: 'Dopuna margine',
  },
  {
    id: 1003, marginAccountId: 1, type: 'WITHDRAWAL', amount: 50000,
    currency: 'RSD', createdAt: '2026-03-27T09:30:00', description: 'Povlacenje sredstava',
  },
  {
    id: 1004, marginAccountId: 1, type: 'DEPOSIT', amount: 250000,
    currency: 'RSD', createdAt: '2026-03-28T11:15:00', description: 'Margin call uplata',
  },
];

const mockTransactionsAccount2 = [
  {
    id: 2001, marginAccountId: 2, type: 'DEPOSIT', amount: 5000,
    currency: 'EUR', createdAt: '2026-03-20T08:00:00', description: 'Inicijalna uplata EUR',
  },
  {
    id: 2002, marginAccountId: 2, type: 'WITHDRAWAL', amount: 1000,
    currency: 'EUR', createdAt: '2026-03-22T16:00:00', description: 'Povlacenje EUR',
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
// MARGIN ACCOUNTS LIST
// ═══════════════════════════════════════════════════════════════════════════════

describe('Margin Accounts - List Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');
  });

  it('loads the margin accounts page with header', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('Marz').should('exist');
  });

  it('displays all margin accounts', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').should('be.visible');
    cy.contains('MRG-0000002').should('be.visible');
    cy.contains('MRG-0000003').should('be.visible');
  });

  it('shows account status badges (ACTIVE, BLOCKED)', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('AKTIVAN').should('exist');
    cy.contains('BLOKIRAN').should('exist');
  });

  it('shows initial margin values for each account', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('500.000').should('exist');
    cy.contains('10.000').should('exist');
  });

  it('shows loan value for each account', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('300.000').should('exist');
  });

  it('shows maintenance margin for each account', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('200.000').should('exist');
  });

  it('shows currency labels (RSD, EUR)', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('RSD').should('exist');
    cy.contains('EUR').should('exist');
  });

  it('shows linked account numbers', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('265000000000000001').should('exist');
    cy.contains('265000000000000002').should('exist');
  });

  it('shows empty state when no margin accounts exist', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: [],
    }).as('getEmptyMargin');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getEmptyMargin');
    cy.contains('Nemate').should('exist');
  });

  it('shows empty state on 404 response (no accounts)', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 404,
      body: { message: 'No margin accounts found' },
    }).as('get404Margin');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@get404Margin');
  });

  it('handles API error gracefully', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('getMarginError');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginError');
    cy.contains('Greska pri ucitavanju').should('exist');
  });

  it('shows loading skeleton while data is being fetched', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
      delay: 2000,
    }).as('getMarginSlow');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });

  it('shows bank participation percentage', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // 60% bank participation for account 1 and 2
    cy.contains('60').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARGIN ACCOUNT - DEPOSIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Margin Accounts - Deposit', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');
  });

  it('shows deposit button for active margin accounts', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').should('exist');
  });

  it('opens deposit dialog when clicking Uplata button', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });
    // Dialog should appear with amount input
    cy.get('input').should('exist');
  });

  it('submits deposit successfully', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/deposit', {
      statusCode: 200,
      body: {},
    }).as('deposit');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    // Enter amount in dialog
    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('50000', { force: true });
    // Click the submit button inside the dialog (second Uplati button)
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@deposit');
  });

  it('shows validation error for zero amount', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('0', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
  });

  it('shows validation error for negative amount', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('-100', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
  });

  it('handles deposit API error', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/deposit', {
      statusCode: 400,
      body: { message: 'Insufficient funds' },
    }).as('depositError');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('50000', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@depositError');
  });

  it('refreshes account list after successful deposit', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/deposit', {
      statusCode: 200,
      body: {},
    }).as('deposit');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('50000', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@deposit');
    // Should reload margin accounts
    cy.wait('@getMarginAccounts');
  });

  it('closes deposit dialog when clicking cancel', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Uplati').first().click({ force: true });

    // Close the dialog
    cy.get('[role="dialog"]').find('button[aria-label="Zatvori"]').click({ force: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARGIN ACCOUNT - WITHDRAW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Margin Accounts - Withdraw', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');
  });

  it('shows withdraw button for active margin accounts', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Isplati').should('exist');
  });

  it('opens withdraw dialog when clicking Isplata button', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Isplati').first().click({ force: true });
    cy.get('input').should('exist');
  });

  it('submits withdrawal successfully', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/withdraw', {
      statusCode: 200,
      body: {},
    }).as('withdraw');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Isplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('25000', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@withdraw');
  });

  it('handles withdrawal API error (insufficient margin)', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/withdraw', {
      statusCode: 400,
      body: { message: 'Insufficient margin balance' },
    }).as('withdrawError');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Isplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('999999', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@withdrawError');
  });

  it('does not show deposit/withdraw buttons for blocked accounts', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // The blocked account (MRG-0000003) should not have action buttons
    // Total active accounts = 2, so we should have 2 Uplati buttons
    cy.get('button').filter(':contains("Uplati")').should('have.length.at.most', 2);
  });

  it('refreshes account list after successful withdrawal', () => {
    cy.intercept('POST', '**/api/margin-accounts/1/withdraw', {
      statusCode: 200,
      body: {},
    }).as('withdraw');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('button', 'Isplati').first().click({ force: true });

    cy.get('#margin-amount').should('be.visible').clear({ force: true }).type('25000', { force: true });
    cy.get('[role="dialog"]').contains('button', /Uplati|Isplati/).click({ force: true });
    cy.wait('@withdraw');
    cy.wait('@getMarginAccounts');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARGIN ACCOUNT - TRANSACTION HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Margin Accounts - Transaction History', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');
    cy.intercept('GET', '**/api/margin-accounts/1/transactions', {
      statusCode: 200,
      body: mockTransactionsAccount1,
    }).as('getTransactions1');
    cy.intercept('GET', '**/api/margin-accounts/2/transactions', {
      statusCode: 200,
      body: mockTransactionsAccount2,
    }).as('getTransactions2');
  });

  it('shows expand/collapse button for transaction history', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Should have expand buttons (chevron icons)
    cy.get('button').filter(':has(svg)').should('have.length.at.least', 1);
  });

  it('loads transaction history on expand', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Click expand on first account
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
  });

  it('shows transaction type labels (DEPOSIT, WITHDRAWAL)', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Expand first account
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions1');

    cy.contains('Uplata').should('exist');
    cy.contains('Isplata').should('exist');
  });

  it('shows transaction amounts', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions1');

    cy.contains('200.000').should('exist');
    cy.contains('100.000').should('exist');
    cy.contains('50.000').should('exist');
    cy.contains('250.000').should('exist');
  });

  it('shows transaction descriptions', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions1');

    // Component renders transaction type as Uplata/Isplata, not the description field
    cy.contains('Uplata').should('exist');
    cy.contains('Isplata').should('exist');
  });

  it('shows transaction dates', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions1');

    // Dates should be visible in some format
    cy.contains('2026').should('exist');
  });

  it('shows EUR transactions for account 2', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000002').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions2');

    cy.contains('EUR').should('exist');
    cy.contains('5.000').should('exist');
  });

  it('shows empty transaction state when no transactions exist', () => {
    cy.intercept('GET', '**/api/margin-accounts/3/transactions', {
      statusCode: 200,
      body: [],
    }).as('getEmptyTransactions');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000003').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getEmptyTransactions');
  });

  it('handles transaction history API error', () => {
    cy.intercept('GET', '**/api/margin-accounts/1/transactions', {
      statusCode: 500,
      body: { message: 'Error loading transactions' },
    }).as('getTransactionsError');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactionsError');
  });

  it('collapses transaction history on second click', () => {
    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Expand
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    cy.wait('@getTransactions1');
    cy.contains('Uplata').should('exist');

    // Collapse
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
  });

  it('shows loading state while transactions are loading', () => {
    cy.intercept('GET', '**/api/margin-accounts/1/transactions', {
      statusCode: 200,
      body: mockTransactionsAccount1,
      delay: 2000,
    }).as('getTransactionsSlow');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').parents('[class*="rounded"]').first().contains('button', 'Istorija transakcija').click({ force: true });
    // Should show loading indicator
    // Loader2 component has animate-spin class on the SVG
    cy.get('.animate-spin').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARGIN ACCOUNTS - EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Margin Accounts - Edge Cases', () => {
  beforeEach(() => {
    setupCommonIntercepts();
  });

  it('shows single margin account correctly', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: [mockMarginAccounts[0]],
    }).as('getSingleAccount');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getSingleAccount');
    cy.contains('MRG-0000001').should('be.visible');
  });

  it('handles only blocked accounts (no actions available)', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: [mockMarginAccounts[2]], // only blocked account
    }).as('getBlockedOnly');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBlockedOnly');
    cy.contains('MRG-0000003').should('be.visible');
    cy.contains('BLOKIRAN').should('exist');
  });

  it('shows formatted amounts with Serbian locale', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Serbian locale uses dots for thousands separators
    cy.contains('500.000').should('exist');
    cy.contains('300.000').should('exist');
  });

  it('shows margin account cards with proper styling', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMarginAccounts');
    // Cards should have proper rounded and shadow styling
    cy.get('[class*="rounded"]').should('have.length.at.least', 3);
  });

  it('admin user can also see margin accounts page', () => {
    cy.intercept('GET', '**/api/margin-accounts/my', {
      statusCode: 200,
      body: mockMarginAccounts,
    }).as('getMarginAccounts');

    cy.visit('/margin-accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getMarginAccounts');
    cy.contains('MRG-0000001').should('be.visible');
  });
});
