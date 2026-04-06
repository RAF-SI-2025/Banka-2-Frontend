/// <reference types="cypress" />
// Comprehensive E2E tests for Accounts and Cards flows
import { setupAdminSession, setupClientSession } from '../support/commands';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAccounts = [
  {
    id: 1,
    accountNumber: '265000000000000001',
    name: 'Glavni racun',
    ownerName: 'Stefan Jovanovic',
    accountType: 'CHECKING',
    currency: 'RSD',
    balance: 150000,
    availableBalance: 145000,
    reservedBalance: 5000,
    maintenanceFee: 200,
    dailyLimit: 500000,
    monthlyLimit: 2000000,
    dailySpending: 10000,
    monthlySpending: 50000,
    status: 'ACTIVE',
    createdAt: '2025-01-01',
  },
  {
    id: 2,
    accountNumber: '265000000000000002',
    name: 'Devizni EUR',
    ownerName: 'Stefan Jovanovic',
    accountType: 'FOREIGN',
    currency: 'EUR',
    balance: 1500,
    availableBalance: 1500,
    reservedBalance: 0,
    maintenanceFee: 5,
    dailyLimit: 10000,
    monthlyLimit: 50000,
    dailySpending: 0,
    monthlySpending: 0,
    status: 'ACTIVE',
    createdAt: '2025-02-01',
  },
  {
    id: 3,
    accountNumber: '265000000000000003',
    name: 'Poslovni racun',
    ownerName: 'Stefan Jovanovic',
    accountType: 'BUSINESS',
    currency: 'RSD',
    balance: 500000,
    availableBalance: 500000,
    reservedBalance: 0,
    maintenanceFee: 500,
    dailyLimit: 1000000,
    monthlyLimit: 5000000,
    dailySpending: 0,
    monthlySpending: 0,
    status: 'ACTIVE',
    createdAt: '2025-03-01',
  },
];

const mockAccountDetail = {
  id: 1,
  accountNumber: '265000000000000001',
  name: 'Glavni racun',
  ownerName: 'Stefan Jovanovic',
  accountType: 'CHECKING',
  currency: 'RSD',
  balance: 150000,
  availableBalance: 145000,
  reservedBalance: 5000,
  maintenanceFee: 200,
  dailyLimit: 500000,
  monthlyLimit: 2000000,
  dailySpending: 10000,
  monthlySpending: 50000,
  status: 'ACTIVE',
  createdAt: '2025-01-01',
};

const mockTransactions = {
  content: [
    {
      id: 1,
      fromAccountNumber: '265000000000000001',
      toAccountNumber: '265000000000000099',
      recipientName: 'Petar Petrovic',
      amount: 5000,
      currency: 'RSD',
      paymentPurpose: 'Uplata za racun',
      paymentCode: '289',
      status: 'COMPLETED',
      createdAt: '2025-03-20T10:00:00',
    },
    {
      id: 2,
      fromAccountNumber: '265000000000000088',
      toAccountNumber: '265000000000000001',
      recipientName: 'Jovan Jovic',
      amount: 15000,
      currency: 'RSD',
      paymentPurpose: 'Plata',
      paymentCode: '220',
      status: 'COMPLETED',
      createdAt: '2025-03-19T14:00:00',
    },
    {
      id: 3,
      fromAccountNumber: '265000000000000001',
      toAccountNumber: '265000000000000077',
      recipientName: 'Marija Markovic',
      amount: 2500,
      currency: 'RSD',
      paymentPurpose: 'Poklon',
      paymentCode: '289',
      status: 'PENDING',
      createdAt: '2025-03-18T09:00:00',
    },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockCards: Array<Record<string, unknown>> = [
  {
    id: 101,
    cardNumber: '4111111111111111',
    cardType: 'VISA',
    cardName: 'Visa Debit',
    accountId: 1,
    accountNumber: '265000000000000001',
    ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2028-06-30',
    status: 'ACTIVE',
    cardLimit: 200000,
    limit: 200000,
    createdAt: '2025-01-15',
  },
  {
    id: 102,
    cardNumber: '5500000000000004',
    cardType: 'MASTERCARD',
    cardName: 'MasterCard Gold',
    accountId: 1,
    accountNumber: '265000000000000001',
    ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2027-12-31',
    status: 'BLOCKED',
    cardLimit: 100000,
    limit: 100000,
    createdAt: '2025-02-20',
  },
  {
    id: 103,
    cardNumber: '3566002020360505',
    cardType: 'DINACARD',
    cardName: 'DinaCard Standard',
    accountId: 2,
    accountNumber: '265000000000000002',
    ownerName: 'STEFAN JOVANOVIC',
    holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2026-03-15',
    status: 'DEACTIVATED',
    cardLimit: 50000,
    limit: 50000,
    createdAt: '2024-03-15',
  },
];

const emptyTransactions = { content: [], totalElements: 0, totalPages: 0 };

// ─── Helper: setup common intercepts ──────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake-access-token' },
  });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  // Default cards intercept — individual tests override with their own alias
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS TESTS (15+ tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Accounts - Account List Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: mockTransactions,
    }).as('getTransactions');
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('getCards');
  });

  it('loads the account list page with header', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.contains('h1', 'Racuni').should('be.visible');
    cy.contains('Pregled svih racuna i transakcija').should('be.visible');
  });

  it('displays account cards with balance information', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    // First account — Glavni racun with RSD balance
    cy.contains('Glavni racun').should('be.visible');
    // Available balance should be shown (145,000)
    cy.contains('145').should('exist');

    // Second account — Devizni EUR
    cy.contains('Devizni EUR').should('be.visible');

    // Third account — Poslovni racun
    cy.contains('Poslovni racun').should('be.visible');
  });

  it('shows account type labels for CHECKING, FOREIGN, BUSINESS', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('Tekuci').should('exist');
    cy.contains('Devizni').should('exist');
    cy.contains('Poslovni').should('exist');
  });

  it('displays currency badges with correct currency codes', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('RSD').should('exist');
    cy.contains('EUR').should('exist');
  });

  it('navigates to account details on double-click', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    // Mock the detail endpoint before navigating
    cy.intercept('GET', '**/api/accounts/1', {
      statusCode: 200,
      body: mockAccountDetail,
    }).as('getAccountDetail');

    // Double-click on the first account card (CHECKING => /accounts/1)
    cy.contains('Glavni racun').parents('[class*="rounded-2xl"]').first().dblclick();
    cy.url().should('include', '/accounts/1');
  });

  it('navigates to business account details for BUSINESS type', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.intercept('GET', '**/api/accounts/3', {
      statusCode: 200,
      body: mockAccounts[2],
    }).as('getBusinessDetail');

    // Double-click on business account
    cy.contains('Poslovni racun').parents('[class*="rounded-2xl"]').first().dblclick();
    cy.url().should('include', '/accounts/3/business');
  });

  it('navigates to details via the Detalji button click', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.intercept('GET', '**/api/accounts/1', {
      statusCode: 200,
      body: mockAccountDetail,
    }).as('getAccountDetail');

    cy.contains('Detalji').first().click();
    cy.url().should('include', '/accounts/');
  });

  it('displays total balance summary card for RSD accounts', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    // Total RSD balance: 150000 + 500000 = 650000
    cy.contains('Ukupno stanje (RSD racuni)').should('be.visible');
    cy.contains('650').should('exist');
    // Should mention foreign accounts
    cy.contains('devizn').should('exist');
  });

  it('shows empty account list message when no accounts exist', () => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: [],
    }).as('getEmptyAccounts');

    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getEmptyAccounts');

    cy.contains('Nema pronadjenih racuna').should('be.visible');
  });

  it('filters accounts by type when filter is applied', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    // Open filters
    cy.get('button[title="Filteri"]').click();

    // Select CHECKING filter — click the SelectTrigger (combobox) button to open dropdown
    cy.get('button[role="combobox"]').click();
    cy.get('[role="option"]').contains('Tekuci').click();

    // Wait for filter to apply
    cy.wait(300);

    // Only CHECKING account should be visible in the account cards
    cy.contains('h3', 'Glavni racun').should('be.visible');
    // The filtered-out account names should not appear in any h3 (account card title)
    cy.contains('h3', 'Devizni EUR').should('not.exist');
    cy.contains('h3', 'Poslovni racun').should('not.exist');
  });

  it('shows daily and monthly limit progress bars on account cards', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    // Account 1 has dailyLimit=500000, dailySpending=10000 => 2%
    cy.contains('Dnevno').should('exist');
    cy.contains('Mesecno').should('exist');
  });

  it('shows Novi racun button for client (non-admin) users', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('button', 'Novi racun').should('be.visible');
  });

  it('hides Novi racun button for admin users', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('button', 'Novi racun').should('not.exist');
  });

  it('opens new account form and submits request', () => {
    cy.intercept('POST', '**/api/accounts/requests', {
      statusCode: 201,
      body: { id: 10, accountType: 'CHECKING', currency: 'RSD', status: 'PENDING' },
    }).as('submitAccountRequest');

    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('button', 'Novi racun').click();
    cy.contains('Otvaranje novog racuna').should('be.visible');
    cy.contains('button', 'Otvori racun').click();
    cy.wait('@submitAccountRequest');
    cy.contains('Zahtev za otvaranje racuna je uspesno podnet').should('be.visible');
  });

  it('displays transaction history for selected account', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransactions');

    // Transaction data should be visible in the table
    cy.contains('Petar Petrovic').should('exist');
  });

  it('shows account status badges (Aktivan)', () => {
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.contains('Aktivan').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT DETAILS PAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Accounts - Account Details Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');
    cy.intercept('GET', '**/api/accounts/1', {
      statusCode: 200,
      body: mockAccountDetail,
    }).as('getAccountById');
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: mockTransactions,
    }).as('getTransactions');
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('getCards');
  });

  it('loads account details page with hero section', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    // Hero section with gradient
    cy.get('[class*="bg-gradient-to-br"][class*="from-indigo"]').should('exist');
    cy.contains('Glavni racun').should('be.visible');
    cy.contains('265-0000000000000-01').should('be.visible');
  });

  it('displays balance and available balance', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    // Balance: 150,000
    cy.contains('Stanje').should('be.visible');
    cy.contains('150').should('exist');
    // Available balance: 145,000
    cy.contains('Raspolozivo').should('exist');
  });

  it('shows daily and monthly limit progress rings', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('Dnevna potrosnja').should('be.visible');
    cy.contains('Mesecna potrosnja').should('be.visible');
    // The percentage should be visible
    cy.contains('iskorisceno').should('exist');
  });

  it('opens rename account dialog and saves new name', () => {
    cy.intercept('PATCH', '**/api/accounts/1/name', {
      statusCode: 200,
      body: { ...mockAccountDetail, name: 'Novi naziv' },
    }).as('renameSave');

    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('button', 'Preimenuj').click();
    cy.get('input[placeholder="Novi naziv racuna"]').clear().type('Novi naziv');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@renameSave');
    cy.contains('Naziv racuna je uspesno promenjen').should('be.visible');
  });

  it('opens change limits dialog and saves new limits via OTP verification', () => {
    cy.intercept('POST', '**/api/payments/request-otp', {
      statusCode: 200,
      body: { sent: true, message: 'OTP sent' },
    }).as('requestOtp');
    cy.intercept('PATCH', '**/api/accounts/1/limits', {
      statusCode: 200,
      body: {},
    }).as('changeLimits');

    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('button', 'Promeni limit').click();
    cy.contains('Promena limita').should('be.visible');
    cy.get('#dailyLimit').clear().type('600000');
    cy.get('#monthlyLimit').clear().type('3000000');
    // Clicking "Sacuvaj limite" opens OTP verification modal
    cy.contains('button', 'Sacuvaj limite').click();
    cy.wait('@requestOtp');
    cy.contains('Verifikacija transakcije').should('be.visible');
    // Enter OTP code and submit
    cy.get('#otp').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@changeLimits');
    cy.contains('Limiti su uspesno sacuvani').should('be.visible');
  });

  it('displays transaction history on details page', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');
    cy.wait('@getTransactions');

    cy.contains('Poslednje transakcije').should('be.visible');
    cy.contains('Petar Petrovic').should('exist');
  });

  it('shows empty transaction state when no transactions exist', () => {
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: emptyTransactions,
    }).as('getEmptyTx');

    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');
    cy.wait('@getEmptyTx');

    cy.contains('Nema transakcija za ovaj racun').should('be.visible');
  });

  it('shows back button that navigates to accounts list', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('Nazad na racune').should('be.visible');
  });

  it('shows account type and status badges in hero section', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('Aktivan').should('be.visible');
    cy.contains('Tekuci').should('be.visible');
  });

  it('shows balance detail cards (Ukupno stanje, Raspolozivo, Rezervisano, Odrzavanje)', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('Ukupno stanje').should('be.visible');
    cy.contains('Raspolozivo').should('exist');
    cy.contains('Rezervisano').should('be.visible');
    cy.contains('Odrzavanje').should('be.visible');
  });

  it('shows action buttons (Novo placanje, Transfer, etc.)', () => {
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccountById');

    cy.contains('button', 'Novo placanje').should('be.visible');
    cy.contains('button', 'Transfer').should('be.visible');
    cy.contains('button', 'Promeni limit').should('be.visible');
    cy.contains('button', 'Preimenuj').should('be.visible');
    cy.contains('button', 'Sve transakcije').should('be.visible');
  });

  it('shows not found state for invalid account ID', () => {
    cy.intercept('GET', '**/api/accounts/999', {
      statusCode: 404,
      body: { message: 'Not found' },
    }).as('getNotFound');

    cy.visit('/accounts/999', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getNotFound');

    cy.contains('Racun nije pronadjen').should('be.visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CARDS TESTS (10+ tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cards - Card List Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');
    // Default cards intercept (individual tests may override with their own alias)
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: [],
    });
  });

  it('loads the card list page with header', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('h1', 'Moje kartice').should('be.visible');
    cy.contains('Upravljajte karticama vezanim za vase racune').should('be.visible');
  });

  it('displays cards with masked card number and gradient', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    // Masked number: first 4 and last 4 digits visible
    cy.contains('4111').should('exist');
    cy.contains('1111').should('exist');
    cy.contains('****').should('exist');

    // Card gradient backgrounds should exist
    cy.get('[class*="bg-gradient-to-br"]').should('have.length.at.least', 3);
  });

  it('shows card status badges (Aktivna, Blokirana, Deaktivirana)', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Aktivna').should('exist');
    cy.contains('Blokirana').should('exist');
    cy.contains('Deaktivirana').should('exist');
  });

  it('allows blocking an active card via toggle', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');
    cy.intercept('PATCH', '**/api/cards/101/block', {
      statusCode: 200,
      body: {},
    }).as('blockCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    // Find the active card's toggle switch and click it
    // The active card has a Switch with checked={true}
    cy.get('button[role="switch"][aria-checked="true"]').first().click();
    cy.wait('@blockCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('allows admin to unblock a blocked card', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');
    cy.intercept('PATCH', '**/api/cards/102/unblock', {
      statusCode: 200,
      body: {},
    }).as('unblockCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');

    // Admin sees a Switch for blocked card (checked=false)
    cy.get('button[role="switch"][aria-checked="false"]').first().click();
    cy.wait('@unblockCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('shows "Kontaktirajte banku" for non-admin on blocked card', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Kontaktirajte banku').should('be.visible');
  });

  it('allows admin to deactivate a card with confirmation', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');
    cy.intercept('PATCH', '**/api/cards/101/deactivate', {
      statusCode: 200,
      body: {},
    }).as('deactivateCard');

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');

    // Stub window.confirm to return true
    cy.on('window:confirm', () => true);

    cy.contains('button', 'Deaktiviraj').first().click();
    cy.wait('@deactivateCard');
    cy.contains('Akcija uspesno izvrsena').should('be.visible');
  });

  it('shows card limit information and limit ring', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    // Limit label and value should be visible
    cy.contains('Limit').should('exist');
    // Limit ring SVG should exist
    cy.get('svg circle').should('have.length.at.least', 2);
  });

  it('opens new card request form and submits', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');
    cy.intercept('POST', '**/api/cards/requests', {
      statusCode: 201,
      body: { id: 200, status: 'PENDING' },
    }).as('submitCardRequest');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('button', 'Nova kartica').click();
    cy.contains('Zahtev za novu karticu').should('be.visible');

    // Select account from dropdown — pick account 2 (Devizni EUR)
    // Account 1 already has 2 non-deactivated cards (max for personal), so pick account 2
    cy.contains('Izaberite racun').click();
    cy.get('[role="option"]').contains('Devizni EUR').click();

    // Submit the form
    cy.contains('button', 'Kreiraj karticu').click();
    cy.wait('@submitCardRequest');
    cy.contains('Zahtev za karticu je uspesno podnet').should('be.visible');
  });

  it('shows empty card list with message and request button', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: [],
    }).as('getEmptyCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getEmptyCards');

    cy.contains('Nemate kartica').should('be.visible');
    cy.contains('Trenutno nemate nijednu karticu vezanu za vase racune').should('be.visible');
    cy.contains('button', 'Zatrazite karticu').should('be.visible');
  });

  it('displays multiple cards per account in the grid', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    // All 3 cards should be rendered
    cy.contains('Visa Debit').should('exist');
    cy.contains('MasterCard Gold').should('exist');
    cy.contains('DinaCard Standard').should('exist');
  });

  it('shows stats row with total, active, and blocked counts', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Ukupno kartica').should('be.visible');
    cy.contains('Aktivne').should('be.visible');
    cy.contains('Blokirane').should('be.visible');
  });

  it('shows deactivated card text instead of actions', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Kartica je deaktivirana').should('exist');
  });

  it('shows card owner name and expiry date', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Vlasnik').should('exist');
    cy.contains('STEFAN JOVANOVIC').should('exist');
    cy.contains('Vazi do').should('exist');
    // Expiry format MM/YY
    cy.contains('06/28').should('exist');
  });

  it('shows loading skeleton while cards are loading', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
      delay: 2000,
    }).as('getCardsDelayed');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });

    // Skeleton placeholders should show while loading
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });

  it('hides Nova kartica button for admin users', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getCards');

    cy.contains('button', 'Nova kartica').should('not.exist');
  });

  it('shows account number for each card in details section', () => {
    cy.intercept('GET', '**/api/cards', {
      statusCode: 200,
      body: mockCards,
    }).as('getCards');

    cy.visit('/cards', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getCards');

    cy.contains('Racun').should('exist');
    cy.contains('265000000000000001').should('exist');
  });
});
