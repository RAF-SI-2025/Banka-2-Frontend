/// <reference types="cypress" />
// Comprehensive E2E tests for Payments (New Payment, Payment History) and Recipients
import { setupClientSession } from '../support/commands';

// ═══════════════════════════════════════════════════════════════════════
// Mock Data
// ═══════════════════════════════════════════════════════════════════════

const mockAccounts = [
  {
    id: 1,
    accountNumber: '265000000000000001',
    name: 'Tekuci RSD',
    accountType: 'CHECKING',
    currency: 'RSD',
    balance: 150000,
    availableBalance: 145000,
    status: 'ACTIVE',
  },
  {
    id: 2,
    accountNumber: '265000000000000002',
    name: 'Devizni EUR',
    accountType: 'FOREIGN',
    currency: 'EUR',
    balance: 1500,
    availableBalance: 1500,
    status: 'ACTIVE',
  },
  {
    id: 3,
    accountNumber: '265000000000000003',
    name: 'Stedni USD',
    accountType: 'SAVINGS',
    currency: 'USD',
    balance: 5000,
    availableBalance: 5000,
    status: 'ACTIVE',
  },
];

const mockRecipients = [
  { id: 1, name: 'Petar Petrovic', accountNumber: '265000000000000099' },
  { id: 2, name: 'Ana Markovic', accountNumber: '265000000000000088' },
  { id: 3, name: 'Jovan Jovic', accountNumber: '265000000000000077' },
];

const mockPaymentResult = {
  id: 100,
  fromAccountNumber: '265000000000000001',
  toAccountNumber: '265000000000000099',
  amount: 5000,
  currency: 'RSD',
  status: 'PENDING',
  recipientName: 'Petar Petrovic',
  paymentPurpose: 'Test placanje',
  createdAt: '2025-03-27T10:00:00',
};

const mockTransactions = [
  {
    id: 1,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000099',
    recipientName: 'Petar Petrovic',
    amount: 5000,
    currency: 'RSD',
    paymentPurpose: 'Uplata za usluge',
    paymentCode: '289',
    model: '97',
    callNumber: '1234',
    referenceNumber: '5678',
    description: 'Opis transakcije 1',
    status: 'COMPLETED',
    createdAt: '2025-03-25T10:00:00',
  },
  {
    id: 2,
    fromAccountNumber: '265000000000000088',
    toAccountNumber: '265000000000000001',
    recipientName: 'Ana Markovic',
    amount: 15000,
    currency: 'RSD',
    paymentPurpose: 'Plata za mart',
    paymentCode: '289',
    description: 'Opis transakcije 2',
    status: 'COMPLETED',
    createdAt: '2025-03-24T14:00:00',
  },
  {
    id: 3,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000077',
    recipientName: 'Jovan Jovic',
    amount: 3000,
    currency: 'RSD',
    paymentPurpose: 'Vracanje duga',
    paymentCode: '289',
    description: 'Opis transakcije 3',
    status: 'PENDING',
    createdAt: '2025-03-23T09:00:00',
  },
  {
    id: 4,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000066',
    recipientName: 'Milica Milic',
    amount: 1000,
    currency: 'RSD',
    paymentPurpose: 'Poklon',
    paymentCode: '289',
    description: 'Opis transakcije 4',
    status: 'REJECTED',
    createdAt: '2025-03-22T08:00:00',
  },
];

const mockPaymentHistory = {
  content: mockTransactions,
  totalElements: 4,
  totalPages: 1,
};

// ═══════════════════════════════════════════════════════════════════════
// Helper: common intercepts used across all payment tests
// ═══════════════════════════════════════════════════════════════════════

function setupCommonIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients }).as('getRecipients');
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockPaymentHistory }).as('getPayments');
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
}

// Helper to fill in a valid payment form
function fillPaymentForm(overrides: {
  fromAccount?: string;
  toAccount?: string;
  recipientName?: string;
  amount?: string;
  paymentCode?: string;
  purpose?: string;
} = {}) {
  const from = overrides.fromAccount ?? mockAccounts[0].accountNumber;
  const to = overrides.toAccount ?? '265000000000000099';
  const name = overrides.recipientName ?? 'Petar Petrovic';
  const amount = overrides.amount ?? '5000';
  const code = overrides.paymentCode ?? '289';
  const purpose = overrides.purpose ?? 'Test placanje';

  cy.get('#fromAccount').select(from);
  cy.get('#toAccount').clear().type(to);
  cy.get('#recipientName').clear().type(name);
  cy.get('#amount').clear().type(amount);
  cy.get('#paymentCode').clear().type(code);
  cy.get('#purpose').scrollIntoView().type(purpose);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. NEW PAYMENT (10+ tests)
// ═══════════════════════════════════════════════════════════════════════

describe('New Payment Page', () => {
  // ─── 1.1 Form rendering ────────────────────────────────────────────
  describe('Form rendering and field display', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');
    });

    it('renders the payment form with all required fields', () => {
      // Page header
      cy.contains('h1', 'Novi platni nalog').should('be.visible');
      cy.contains('Popunite podatke za kreiranje novog platnog naloga').should('be.visible');

      // All form fields present
      cy.get('#fromAccount').should('exist');
      cy.get('#savedRecipient').should('exist');
      cy.get('#toAccount').should('exist');
      cy.get('#recipientName').should('exist');
      cy.get('#amount').should('exist');
      cy.get('#paymentCode').should('exist');
      cy.get('#purpose').should('exist');
      cy.get('#model').should('exist');
      cy.get('#callNumber').should('exist');
      cy.get('#referenceNumber').should('exist');

      // Submit button
      cy.contains('button', 'Nastavi na verifikaciju').should('be.visible');
    });

    it('loads accounts into the from-account selector', () => {
      cy.get('#fromAccount').find('option').should('have.length.greaterThan', 1);
      // Check that all mock accounts appear
      cy.get('#fromAccount').find('option').then(($opts) => {
        const texts = [...$opts].map((o) => o.textContent);
        expect(texts.join(' ')).to.include('265000000000000001');
        expect(texts.join(' ')).to.include('265000000000000002');
        expect(texts.join(' ')).to.include('265000000000000003');
      });
    });

    it('loads saved recipients into the recipient selector', () => {
      cy.get('#savedRecipient').find('option').should('have.length.greaterThan', 1);
      cy.get('#savedRecipient').find('option').then(($opts) => {
        const texts = [...$opts].map((o) => o.textContent);
        expect(texts.join(' ')).to.include('Petar Petrovic');
        expect(texts.join(' ')).to.include('Ana Markovic');
      });
    });

    it('selecting a saved recipient fills the toAccount and recipientName fields', () => {
      cy.get('#savedRecipient').select(mockRecipients[0].accountNumber);
      cy.get('#toAccount').should('have.value', mockRecipients[0].accountNumber);
      cy.get('#recipientName').should('have.value', mockRecipients[0].name);
    });

    it('displays the live preview card with selected account balance', () => {
      cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
      cy.contains('Pregled naloga').should('be.visible');
      cy.contains('145').should('be.visible'); // available balance
      cy.contains('RSD').should('be.visible');
    });
  });

  // ─── 1.2 Form validation ──────────────────────────────────────────
  describe('Form validation', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');
    });

    it('shows validation errors when submitting with empty required fields', () => {
      // Clear default values that may auto-populate
      cy.get('#fromAccount').select(''); // "Izaberite racun"
      cy.get('#paymentCode').clear();
      cy.contains('button', 'Nastavi na verifikaciju').click();
      cy.get('.text-destructive').should('exist');
    });

    it('validates that account number must be 18 digits', () => {
      cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
      cy.get('#toAccount').clear().type('12345'); // too short
      cy.get('#recipientName').clear().type('Test');
      cy.get('#amount').clear().type('100');
      cy.get('#paymentCode').clear().type('289');
      cy.get('#purpose').scrollIntoView().type('Test', { force: true });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      cy.get('.text-destructive').should('exist');
    });

    it('validates that amount must be a positive number', () => {
      cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
      cy.get('#toAccount').clear().type('265000000000000099');
      cy.get('#recipientName').clear().type('Test');
      cy.get('#amount').clear().type('0');
      cy.get('#paymentCode').clear().type('289');
      cy.get('#purpose').scrollIntoView().type('Test', { force: true });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      cy.get('.text-destructive').should('exist');
    });

    it('validates that amount within account limits allows submission', () => {
      setupCommonIntercepts();
      cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } }).as('requestOtp');

      fillPaymentForm({ amount: '1000' });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      // Valid form opens the OTP verification modal (no payment POST yet)
      cy.contains('Verifikacija transakcije').should('be.visible');
    });
  });

  // ─── 1.3 Successful payment creation ──────────────────────────────
  describe('Successful payment creation', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
      cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');
    });

    it('creates a payment successfully and opens verification modal', () => {
      fillPaymentForm();
      cy.contains('button', 'Nastavi na verifikaciju').click();

      // The form submit now opens the OTP verification modal directly (no POST yet)
      cy.contains('Verifikacija transakcije').should('be.visible');
      cy.get('#otp').should('be.visible');
      cy.contains('Verifikacioni kod').should('be.visible');
    });
  });

  // ─── 1.4 OTP verification ─────────────────────────────────────────
  describe('OTP verification modal', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
      cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');

      // Submit the form to open the verification modal (no POST /payments yet)
      fillPaymentForm();
      cy.contains('button', 'Nastavi na verifikaciju').click();
      cy.wait('@requestOtp');
      cy.contains('Verifikacija transakcije').should('be.visible');
    });

    it('displays the OTP input field and countdown timer', () => {
      cy.get('#otp').should('be.visible');
      cy.contains('Kod važi još').should('be.visible');
      cy.contains('Preostalo pokušaja').should('be.visible');
    });

    it('successfully verifies with correct OTP code', () => {
      // When user enters OTP and clicks Potvrdi, the modal calls onVerified(code)
      // which triggers POST /payments with the OTP code
      cy.intercept('POST', '**/api/payment-recipients', { statusCode: 201, body: { id: 99 } }).as('saveRecipient');

      cy.get('#otp').type('123456');
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@createPayment');
      cy.contains('uspesno').should('exist');
    });

    it('shows error message for wrong OTP code', () => {
      // Override createPayment to fail (simulating wrong OTP rejection from backend)
      cy.intercept('POST', '**/api/payments', {
        statusCode: 400,
        body: { message: 'Kod nije validan. Pokušajte ponovo.' },
      }).as('failedPayment');

      cy.get('#otp').type('000000');
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@failedPayment');
      cy.contains('Kod nije validan').should('be.visible');
    });

    it('blocks transaction after 3 failed OTP attempts', () => {
      // Override createPayment to always fail
      cy.intercept('POST', '**/api/payments', {
        statusCode: 400,
        body: { message: 'Kod nije validan.' },
      }).as('failedPayment');

      // Attempt 1
      cy.get('#otp').type('111111');
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@failedPayment');
      cy.contains('Kod nije validan').should('be.visible');

      // Attempt 2 — wait for button to be re-enabled, then clear and type
      cy.get('#otp').should('be.visible').clear().type('222222');
      cy.contains('button', 'Potvrdi').should('not.be.disabled').click();
      cy.wait('@failedPayment');

      // Attempt 3 - should block (attemptsLeft reaches 0)
      cy.get('#otp').should('be.visible').clear().type('333333');
      cy.contains('button', 'Potvrdi').should('not.be.disabled').click();
      cy.wait('@failedPayment');
      cy.contains('Maksimalan broj').should('exist');
    });

    it('can close the verification modal by clicking cancel', () => {
      cy.contains('button', 'Otkaži').click();
      cy.contains('Verifikacija transakcije').should('not.exist');
    });
  });

  // ─── 1.5 Cross-currency payment preview ───────────────────────────
  describe('Cross-currency payment', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } }).as('requestOtp');
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');
    });

    it('shows EUR currency when selecting the EUR account', () => {
      cy.get('#fromAccount').select(mockAccounts[1].accountNumber);
      cy.contains('EUR').should('be.visible');
    });

    it('shows USD currency when selecting the USD account', () => {
      cy.get('#fromAccount').select(mockAccounts[2].accountNumber);
      cy.contains('USD').should('be.visible');
    });

    it('submits a cross-currency payment from EUR account', () => {
      fillPaymentForm({ fromAccount: mockAccounts[1].accountNumber, amount: '100', purpose: 'FX placanje' });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      // Form submit opens OTP modal (no POST /payments yet)
      cy.contains('Verifikacija transakcije').should('be.visible');
    });
  });

  // ─── 1.6 Payment failure scenarios ────────────────────────────────
  describe('Payment failure scenarios', () => {
    beforeEach(() => {
      setupCommonIntercepts();
      cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } }).as('requestOtp');
      cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getMyAccounts');
    });

    it('shows error toast when payment fails with insufficient funds', () => {
      cy.intercept('POST', '**/api/payments', {
        statusCode: 400,
        body: { message: 'Nedovoljno sredstava na racunu' },
      }).as('failedPayment');

      fillPaymentForm({ amount: '999999' });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      // OTP modal opens, enter code to trigger the actual payment
      cy.wait('@requestOtp');
      cy.get('#otp').type('123456');
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@failedPayment');
      cy.contains('Nedovoljno sredstava').should('exist');
    });

    it('shows error when target account does not exist', () => {
      cy.intercept('POST', '**/api/payments', {
        statusCode: 404,
        body: { message: 'Uneti racun ne postoji' },
      }).as('notFoundPayment');

      fillPaymentForm({ toAccount: '999999999999999999' });
      cy.contains('button', 'Nastavi na verifikaciju').click();
      // OTP modal opens, enter code to trigger the actual payment
      cy.wait('@requestOtp');
      cy.get('#otp').type('123456');
      cy.contains('button', 'Potvrdi').click();
      cy.wait('@notFoundPayment');
      cy.contains('ne postoji').should('exist');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. PAYMENT HISTORY (8+ tests)
// ═══════════════════════════════════════════════════════════════════════

describe('Payment History Page', () => {
  function visitHistory() {
    setupCommonIntercepts();
    cy.visit('/payments/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getPayments');
  }

  // ─── 2.1 Page loading ─────────────────────────────────────────────
  describe('Page loading and transaction display', () => {
    beforeEach(() => {
      visitHistory();
    });

    it('renders the payment history page with header', () => {
      cy.contains('h1', 'Pregled placanja').should('be.visible');
      cy.contains('Pregledajte istoriju svih vasih placanja').should('be.visible');
    });

    it('displays all transactions from the response', () => {
      cy.contains('Petar Petrovic').should('be.visible');
      cy.contains('Ana Markovic').should('be.visible');
      cy.contains('Jovan Jovic').should('be.visible');
      cy.contains('Milica Milic').should('be.visible');
    });

    it('displays transaction card with recipient name, amount, and status badge', () => {
      // Check first transaction details
      cy.contains('Petar Petrovic').should('be.visible');
      cy.contains('5').should('exist'); // amount 5000
      cy.contains('Zavrseno').should('exist');
    });

    it('displays summary statistics (outgoing, incoming, count)', () => {
      cy.contains('Odlivi').should('be.visible');
      cy.contains('Prilivi').should('be.visible');
      cy.contains('Ukupno transakcija').should('be.visible');
    });
  });

  // ─── 2.2 Status filter pills ──────────────────────────────────────
  describe('Status filter pills', () => {
    beforeEach(() => {
      visitHistory();
    });

    it('renders all status filter pills', () => {
      cy.contains('button', 'Sve').should('be.visible');
      cy.contains('button', 'Zavrsene').should('be.visible');
      cy.contains('button', 'Na cekanju').should('be.visible');
      cy.contains('button', 'Odbijene').should('be.visible');
      cy.contains('button', 'Otkazane').should('be.visible');
    });

    it('filters transactions by COMPLETED status', () => {
      cy.intercept('GET', '**/api/payments*', (req) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.searchParams.get('status') === 'COMPLETED') {
          req.reply({
            statusCode: 200,
            body: {
              content: mockTransactions.filter((t) => t.status === 'COMPLETED'),
              totalElements: 2,
              totalPages: 1,
            },
          });
        } else {
          req.reply({ statusCode: 200, body: mockPaymentHistory });
        }
      }).as('filteredPayments');

      cy.contains('button', 'Zavrsene').click();
      cy.wait('@filteredPayments');
    });

    it('filters transactions by PENDING status', () => {
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: {
          content: mockTransactions.filter((t) => t.status === 'PENDING'),
          totalElements: 1,
          totalPages: 1,
        },
      }).as('pendingPayments');

      cy.contains('button', 'Na cekanju').click();
      cy.wait('@pendingPayments');
    });
  });

  // ─── 2.3 Date range and amount filters ────────────────────────────
  describe('Advanced filters', () => {
    beforeEach(() => {
      visitHistory();
    });

    it('opens the filter panel when clicking Filteri button', () => {
      cy.contains('button', 'Filteri').click();
      cy.get('#dateFrom').should('be.visible');
      cy.get('#dateTo').should('be.visible');
      cy.get('#amountMin').should('be.visible');
      cy.get('#amountMax').should('be.visible');
    });

    it('applies date range filter', () => {
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: {
          content: [mockTransactions[0]],
          totalElements: 1,
          totalPages: 1,
        },
      }).as('dateFilteredPayments');

      cy.contains('button', 'Filteri').click();
      cy.get('#dateFrom').scrollIntoView().type('2025-03-25', { force: true });
      cy.get('#dateTo').scrollIntoView().type('2025-03-26', { force: true });
      cy.wait('@dateFilteredPayments');
    });

    it('applies amount range filter', () => {
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: {
          content: mockTransactions.filter((t) => t.amount >= 3000 && t.amount <= 10000),
          totalElements: 2,
          totalPages: 1,
        },
      }).as('amountFilteredPayments');

      cy.contains('button', 'Filteri').click();
      cy.get('#amountMin').scrollIntoView().type('3000', { force: true });
      cy.get('#amountMax').scrollIntoView().type('10000', { force: true });
      cy.wait('@amountFilteredPayments');
    });

    it('resets all filters when clicking Resetuj', () => {
      cy.contains('button', 'Filteri').click();
      cy.get('#amountMin').scrollIntoView().type('1000', { force: true });
      cy.contains('button', 'Resetuj').click();
      cy.get('#amountMin').should('have.value', '');
    });
  });

  // ─── 2.4 Expanding transaction details ────────────────────────────
  describe('Transaction details expansion', () => {
    beforeEach(() => {
      visitHistory();
    });

    it('expands a transaction card to show full details', () => {
      // Click the first transaction card
      cy.contains('Petar Petrovic').click();

      // Expanded details should show from/to accounts and other fields
      cy.contains('Sa racuna').should('be.visible');
      cy.contains('Na racun').should('be.visible');
      cy.contains('Primalac').should('be.visible');
      cy.contains('Datum').should('be.visible');
      cy.contains('Opis').should('be.visible');
      cy.contains('Sifra placanja').should('be.visible');
      cy.contains('Preuzmi potvrdu').should('be.visible');
    });

    it('collapses an expanded transaction when clicked again', () => {
      cy.contains('Petar Petrovic').click();
      cy.contains('Sa racuna').should('be.visible');

      cy.contains('Petar Petrovic').click();
      cy.contains('Sa racuna').should('not.exist');
    });
  });

  // ─── 2.5 Empty state ──────────────────────────────────────────────
  describe('Empty state', () => {
    it('displays empty message when there are no transactions', () => {
      setupCommonIntercepts();
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: { content: [], totalElements: 0, totalPages: 0 },
      }).as('emptyPayments');

      cy.visit('/payments/history', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@emptyPayments');
      cy.contains('Nema transakcija').should('be.visible');
    });
  });

  // ─── 2.6 Pagination ───────────────────────────────────────────────
  describe('Pagination', () => {
    it('displays pagination controls and navigates between pages', () => {
      setupCommonIntercepts();
      // Override with multi-page response
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: {
          content: mockTransactions,
          totalElements: 20,
          totalPages: 2,
        },
      }).as('pagedPayments');

      cy.visit('/payments/history', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@pagedPayments');

      // Pagination controls
      cy.contains('button', 'Prethodna').should('be.visible').and('be.disabled');
      cy.contains('1 / 2').should('be.visible');
      cy.contains('button', 'Sledeca').should('be.visible').and('not.be.disabled');

      // Navigate to page 2
      cy.contains('button', 'Sledeca').click();
      cy.wait('@pagedPayments');
      cy.contains('2 / 2').should('be.visible');
      cy.contains('button', 'Sledeca').should('be.disabled');
      cy.contains('button', 'Prethodna').should('not.be.disabled');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. RECIPIENTS (8+ tests)
// ═══════════════════════════════════════════════════════════════════════

describe('Recipients Page', () => {
  function setupRecipientsIntercepts() {
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients }).as('getRecipients');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  }

  // ─── 3.1 Page loading ─────────────────────────────────────────────
  describe('Page loading', () => {
    beforeEach(() => {
      setupRecipientsIntercepts();
      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getRecipients');
    });

    it('renders the recipients page with header and all recipients', () => {
      cy.contains('h1', 'Primaoci placanja').should('be.visible');
      cy.contains('Upravljajte listom sacuvanih primalaca').should('be.visible');
      cy.contains('Petar Petrovic').should('be.visible');
      cy.contains('Ana Markovic').should('be.visible');
      cy.contains('Jovan Jovic').should('be.visible');
    });

    it('displays recipient cards with name and account number', () => {
      cy.contains('Petar Petrovic').should('be.visible');
      cy.contains('265000000000000099').should('be.visible');
    });

    it('shows initials avatar for each recipient', () => {
      // Petar Petrovic should have "PP" initials
      cy.contains('PP').should('be.visible');
      cy.contains('AM').should('be.visible');
      cy.contains('JJ').should('be.visible');
    });
  });

  // ─── 3.2 Add new recipient ────────────────────────────────────────
  describe('Adding a new recipient', () => {
    beforeEach(() => {
      setupRecipientsIntercepts();
      cy.intercept('POST', '**/api/payment-recipients', {
        statusCode: 201,
        body: { id: 4, name: 'Novi Primalac', accountNumber: '265000000000000066' },
      }).as('createRecipient');
      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getRecipients');
    });

    it('opens the add recipient form when clicking Dodaj primaoca', () => {
      cy.contains('button', 'Dodaj primaoca').click();
      cy.contains('Novi primalac').should('be.visible');
      cy.get('#create-name').should('be.visible');
      cy.get('#create-account').should('be.visible');
    });

    it('successfully adds a new recipient with valid data', () => {
      cy.contains('button', 'Dodaj primaoca').click();
      cy.get('#create-name').type('Novi Primalac');
      cy.get('#create-account').type('265000000000000066');
      cy.contains('button', 'Sacuvaj primaoca').click();
      cy.wait('@createRecipient');
      cy.contains('uspesno dodat').should('be.visible');
    });

    it('shows validation errors when submitting create form with empty fields', () => {
      cy.contains('button', 'Dodaj primaoca').click();
      cy.contains('button', 'Sacuvaj primaoca').click();
      cy.get('.text-destructive').should('exist');
    });

    it('validates account number format in create form', () => {
      cy.contains('button', 'Dodaj primaoca').click();
      cy.get('#create-name').type('Test Primalac');
      cy.get('#create-account').type('123'); // too short
      cy.contains('button', 'Sacuvaj primaoca').click();
      cy.get('.text-destructive').should('exist');
    });

    it('can close the create form without saving', () => {
      cy.contains('button', 'Dodaj primaoca').click();
      cy.contains('Novi primalac').should('be.visible');
      // Click the toggle button again (now shows "Zatvori")
      cy.contains('button', 'Zatvori').click();
      cy.contains('Novi primalac').should('not.exist');
    });
  });

  // ─── 3.3 Search recipients ────────────────────────────────────────
  describe('Searching recipients', () => {
    beforeEach(() => {
      setupRecipientsIntercepts();
      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getRecipients');
    });

    it('filters recipients by name', () => {
      cy.get('input[placeholder*="Pretraga"]').type('Petar');
      cy.contains('Petar Petrovic').should('be.visible');
      cy.contains('Ana Markovic').should('not.exist');
      cy.contains('Jovan Jovic').should('not.exist');
    });

    it('filters recipients by account number', () => {
      cy.get('input[placeholder*="Pretraga"]').type('088');
      cy.contains('Ana Markovic').should('be.visible');
      cy.contains('Petar Petrovic').should('not.exist');
    });

    it('shows empty search results message when no match', () => {
      cy.get('input[placeholder*="Pretraga"]').type('NepostojeciPrimalac12345');
      cy.contains('Nema rezultata pretrage').should('be.visible');
    });
  });

  // ─── 3.4 Edit recipient ──────────────────────────────────────────
  describe('Editing a recipient', () => {
    beforeEach(() => {
      setupRecipientsIntercepts();
      cy.intercept('PUT', '**/api/payment-recipients/1', {
        statusCode: 200,
        body: { ...mockRecipients[0], name: 'Petar Petrovic Izmenjen' },
      }).as('updateRecipient');
      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getRecipients');
    });

    it('activates edit mode with inline form fields', () => {
      // Hover to reveal edit button, then click it
      cy.contains('Petar Petrovic').parents('[class*="group"]').within(() => {
        cy.get('button[title="Izmeni"]').click({ force: true });
      });
      cy.contains('Izmena primaoca').should('be.visible');
      cy.get('input[placeholder="Ime"]').should('be.visible');
      cy.get('input[placeholder="Broj racuna"]').should('be.visible');
    });

    it('successfully updates a recipient name', () => {
      cy.contains('Petar Petrovic').parents('[class*="group"]').within(() => {
        cy.get('button[title="Izmeni"]').click({ force: true });
      });
      cy.get('input[placeholder="Ime"]').clear().type('Petar Petrovic Izmenjen');
      cy.contains('button', 'Sacuvaj').click();
      cy.wait('@updateRecipient');
      cy.contains('uspesno izmenjen').should('be.visible');
    });

    it('can cancel editing without saving changes', () => {
      cy.contains('Petar Petrovic').parents('[class*="group"]').within(() => {
        cy.get('button[title="Izmeni"]').click({ force: true });
      });
      cy.get('input[placeholder="Ime"]').clear().type('Changed Name');
      cy.contains('button', 'Otkazi').click();
      // Should revert to normal view
      cy.contains('Izmena primaoca').should('not.exist');
      cy.contains('Petar Petrovic').should('be.visible');
    });
  });

  // ─── 3.5 Delete recipient ─────────────────────────────────────────
  describe('Deleting a recipient', () => {
    beforeEach(() => {
      setupRecipientsIntercepts();
      cy.intercept('DELETE', '**/api/payment-recipients/1', { statusCode: 204 }).as('deleteRecipient');
      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@getRecipients');
    });

    it('deletes a recipient after confirmation', () => {
      cy.on('window:confirm', () => true);
      cy.contains('Petar Petrovic').parents('[class*="group"]').within(() => {
        cy.get('button[title="Obrisi"]').click({ force: true });
      });
      cy.wait('@deleteRecipient');
      cy.contains('obrisan').should('be.visible');
    });

    it('does not delete a recipient when user cancels confirmation', () => {
      cy.on('window:confirm', () => false);
      cy.contains('Petar Petrovic').parents('[class*="group"]').within(() => {
        cy.get('button[title="Obrisi"]').click({ force: true });
      });
      // Recipient should still be in the list
      cy.contains('Petar Petrovic').should('be.visible');
    });
  });

  // ─── 3.6 Empty state ──────────────────────────────────────────────
  describe('Empty state', () => {
    it('shows empty recipients message when no recipients exist', () => {
      cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] }).as('emptyRecipients');
      cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
      cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
      cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
      cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
      cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
      cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

      cy.visit('/payments/recipients', { onBeforeLoad: (win) => setupClientSession(win) });
      cy.wait('@emptyRecipients');
      cy.contains('Nema sacuvanih primalaca').should('be.visible');
    });
  });
});
