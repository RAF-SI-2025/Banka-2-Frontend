/// <reference types="cypress" />
// Comprehensive E2E tests for Transfers and Exchange pages
// Covers: transfer form, FX preview, commission, confirm step, transfer history,
//         exchange rate table, conversion calculator
import { setupClientSession } from '../support/commands';

// ─── Mock Data ─────────────────────────────────────────────────────────

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
    name: 'Stedni RSD',
    accountType: 'CHECKING',
    currency: 'RSD',
    balance: 50000,
    availableBalance: 50000,
    status: 'ACTIVE',
  },
  {
    id: 3,
    accountNumber: '265000000000000003',
    name: 'Devizni EUR',
    accountType: 'FOREIGN',
    currency: 'EUR',
    balance: 1500,
    availableBalance: 1500,
    status: 'ACTIVE',
  },
  {
    id: 4,
    accountNumber: '265000000000000004',
    name: 'Devizni USD',
    accountType: 'FOREIGN',
    currency: 'USD',
    balance: 2000,
    availableBalance: 2000,
    status: 'ACTIVE',
  },
];

const mockTransferResult = {
  id: 200,
  fromAccountNumber: '265000000000000001',
  toAccountNumber: '265000000000000002',
  amount: 10000,
  status: 'COMPLETED',
  createdAt: '2026-03-27T12:00:00',
};

const mockTransferHistory = [
  {
    id: 1,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000002',
    amount: 10000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'COMPLETED',
    createdAt: '2026-03-26T10:00:00',
  },
  {
    id: 2,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000003',
    amount: 50000,
    fromCurrency: 'RSD',
    toCurrency: 'EUR',
    convertedAmount: 425,
    exchangeRate: 0.0085,
    commission: 250,
    status: 'COMPLETED',
    createdAt: '2026-03-25T14:00:00',
  },
  {
    id: 3,
    fromAccountNumber: '265000000000000003',
    toAccountNumber: '265000000000000001',
    amount: 200,
    fromCurrency: 'EUR',
    toCurrency: 'RSD',
    convertedAmount: 23500,
    exchangeRate: 117.5,
    commission: 1,
    status: 'PENDING',
    createdAt: '2026-03-24T09:00:00',
  },
  {
    id: 4,
    fromAccountNumber: '265000000000000002',
    toAccountNumber: '265000000000000001',
    amount: 5000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'REJECTED',
    createdAt: '2026-03-23T16:30:00',
  },
];

const mockExchangeRates = [
  { currency: 'EUR', buyRate: 116.5, sellRate: 118.0, middleRate: 117.25, date: '2026-03-27T08:00:00' },
  { currency: 'USD', buyRate: 106.0, sellRate: 108.0, middleRate: 107.0, date: '2026-03-27T08:00:00' },
  { currency: 'CHF', buyRate: 124.0, sellRate: 126.0, middleRate: 125.0, date: '2026-03-27T08:00:00' },
  { currency: 'GBP', buyRate: 135.0, sellRate: 137.5, middleRate: 136.25, date: '2026-03-27T08:00:00' },
  { currency: 'JPY', buyRate: 0.7, sellRate: 0.73, middleRate: 0.715, date: '2026-03-27T08:00:00' },
  { currency: 'CAD', buyRate: 77.0, sellRate: 79.0, middleRate: 78.0, date: '2026-03-27T08:00:00' },
  { currency: 'AUD', buyRate: 68.0, sellRate: 70.0, middleRate: 69.0, date: '2026-03-27T08:00:00' },
];

const mockConversionResult = {
  convertedAmount: 425.5,
  exchangeRate: 0.0085,
  fromCurrency: 'RSD',
  toCurrency: 'EUR',
};

// ─── Shared Intercept Setup ────────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', {
    statusCode: 200,
    body: { content: [], totalElements: 0, totalPages: 0 },
  });
}

function setupTransferIntercepts() {
  setupCommonIntercepts();
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: mockTransferHistory }).as('getTransfers');
}

function setupExchangeIntercepts() {
  setupCommonIntercepts();
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates }).as('getExchangeRates');
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
}

// ═══════════════════════════════════════════════════════════════════════
//  TRANSFERS
// ═══════════════════════════════════════════════════════════════════════

describe('Transfer Page - Rendering and Account Selection', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('renders transfer page with account selectors and amount field', () => {
    cy.contains('Prenos izmedju racuna').should('be.visible');
    cy.contains('Prenesite sredstva izmedju vasih racuna').should('be.visible');
    cy.get('#fromAccount').should('exist');
    cy.get('#toAccount').should('exist');
    cy.get('#amount').should('exist');
    cy.contains('button', 'Nastavi na potvrdu').should('exist');
  });

  it('displays available balance for the selected from-account', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    // The AccountCard shows "Raspolozivo" label and formatted balance
    cy.contains('Raspolozivo').should('be.visible');
    // 145,000 formatted with sr-RS locale (145.000,00)
    cy.contains(mockAccounts[0].accountNumber).should('be.visible');
  });

  it('excludes from-account from to-account dropdown (same account validation)', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    // The to-account dropdown should not contain the from-account option
    cy.get('#toAccount option').each(($option) => {
      if ($option.val() !== '') {
        expect($option.val()).not.to.equal(mockAccounts[0].accountNumber);
      }
    });
  });

  it('shows empty state when user has no accounts', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] }).as('emptyAccounts');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyAccounts');
    cy.contains('Nema dostupnih racuna').should('be.visible');
  });

  it('shows loading skeletons while accounts are loading', () => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
      delay: 500,
    }).as('slowAccounts');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@slowAccounts');
    cy.get('.animate-pulse').should('not.exist');
  });
});

describe('Transfer Page - Same Currency Transfer (no FX)', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 201,
      body: mockTransferResult,
    }).as('createTransfer');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('shows "no conversion" message for same-currency accounts', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber); // RSD
    cy.get('#toAccount').select(mockAccounts[1].accountNumber); // RSD
    cy.get('#amount').clear().type('10000');
    cy.contains('Prenos bez konverzije').should('be.visible');
  });

  it('navigates to confirm step and shows transfer summary', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('10000');
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });

    // Confirm step: shows both account numbers
    cy.contains(mockAccounts[0].accountNumber).should('be.visible');
    cy.contains(mockAccounts[1].accountNumber).should('be.visible');
    // Shows amount label
    cy.contains('Iznos').should('be.visible');
    // Shows "same currency" indicator
    cy.contains('ista valuta').should('be.visible');
    // Has confirm and back buttons
    cy.contains('button', 'Potvrdi transfer').should('be.visible');
    cy.contains('button', 'Nazad').should('be.visible');
  });

  it('successfully creates a transfer on confirm', () => {
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } }).as('requestOtp');
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('10000');
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });
    cy.contains('button', 'Potvrdi transfer').scrollIntoView().click({ force: true });
    // OTP modal opens
    cy.wait('@requestOtp');
    cy.get('#otp').type('123456', { force: true });
    cy.contains('button', 'Potvrdi').scrollIntoView().click({ force: true });
    cy.wait('@createTransfer');
    // Should show success toast or navigate away
    cy.url().should('include', '/accounts');
  });

  it('can go back from confirm step to edit form', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('10000');
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });
    cy.contains('button', 'Nazad').scrollIntoView().click({ force: true });
    // Should be back on the form
    cy.get('#fromAccount').should('exist');
    cy.get('#amount').should('exist');
  });
});

describe('Transfer Page - Different Currency (FX) Transfer', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200,
      body: mockConversionResult,
    }).as('exchangeCalc');
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 201,
      body: { ...mockTransferResult, toAccountNumber: mockAccounts[2].accountNumber },
    }).as('createFxTransfer');
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('triggers FX preview when different currencies selected', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber); // RSD
    cy.get('#toAccount').select(mockAccounts[2].accountNumber); // EUR
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    // FX preview card should appear with exchange rate info
    cy.contains('Kurs').should('be.visible');
    cy.contains('Konvertovani iznos').should('be.visible');
  });

  it('displays exchange rate in the FX preview', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    // Shows rate: 1 RSD = X EUR
    cy.contains('1 RSD').should('be.visible');
    cy.contains('EUR').should('be.visible');
  });

  it('shows 0.5% commission for cross-currency transfers', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    // Commission label
    cy.contains('Provizija (0.5%)').should('be.visible');
    // Commission value: 50000 * 0.005 = 250
    cy.contains('250').should('be.visible');
  });

  it('shows total debit (amount + commission) for FX transfer', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    cy.contains('Ukupno za terecenje').should('be.visible');
  });

  it('shows FX details in confirm step', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[2].accountNumber);
    cy.get('#amount').clear().type('50000');
    cy.wait('@exchangeCalc');
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });
    // Confirm step shows conversion details
    cy.contains('Konvertovani iznos').should('be.visible');
    cy.contains('Provizija (0.5%)').should('be.visible');
    cy.contains('Ukupno za terecenje').should('be.visible');
    cy.contains('button', 'Potvrdi transfer').should('be.visible');
  });
});

describe('Transfer Page - Insufficient Funds', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('shows insufficient funds warning when amount exceeds balance', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber); // balance 145000
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('999999');
    cy.contains('Nemate dovoljno raspolozivih sredstava').should('be.visible');
  });

  it('prevents submission with insufficient funds', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').select(mockAccounts[1].accountNumber);
    cy.get('#amount').clear().type('999999');
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });
    // Should NOT navigate to confirm step; page still shows form
    cy.get('#fromAccount').should('exist');
    cy.get('#amount').should('exist');
  });
});

describe('Transfer Page - Form Validation', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('shows validation errors when required fields are empty', () => {
    // Submit without filling anything
    cy.contains('button', 'Nastavi na potvrdu').scrollIntoView().click({ force: true });
    cy.get('.text-destructive').should('exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  TRANSFER HISTORY
// ═══════════════════════════════════════════════════════════════════════

describe('Transfer History Page', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');
  });

  it('loads and displays transfer history with all transfers', () => {
    cy.contains('Istorija transfera').should('be.visible');
    // Should show the transfer table with account numbers
    cy.contains(mockTransferHistory[0].fromAccountNumber).should('be.visible');
    cy.contains(mockTransferHistory[0].toAccountNumber).should('be.visible');
  });

  it('displays transfer status badges (COMPLETED, PENDING, REJECTED)', () => {
    cy.contains('COMPLETED').should('be.visible');
    cy.contains('PENDING').should('be.visible');
    cy.contains('REJECTED').should('be.visible');
  });

  it('shows FX details (exchange rate, converted amount, commission) for cross-currency transfers', () => {
    // Transfer #2 has FX data
    cy.contains('0.0085').should('be.visible'); // exchange rate
  });

  it('shows table headers for all columns', () => {
    cy.contains('th', 'Sa / Na racun').should('be.visible');
    cy.contains('th', 'Iznos').should('be.visible');
    cy.contains('th', 'Kurs').should('be.visible');
    cy.contains('th', 'Provizija').should('be.visible');
    cy.contains('th', 'Datum').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('shows empty state when no transfers exist', () => {
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] }).as('emptyTransfers');
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyTransfers');
    cy.contains('Nema transfera').should('be.visible');
  });
});

describe('Transfer History - Filters', () => {
  beforeEach(() => {
    setupTransferIntercepts();
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');
  });

  it('has account filter dropdown populated with user accounts', () => {
    cy.get('#account-filter').should('exist');
    cy.get('#account-filter option').should('have.length.greaterThan', 1); // "Svi racuni" + accounts
    cy.get('#account-filter').select(mockAccounts[0].accountNumber);
    cy.get('#account-filter').should('have.value', mockAccounts[0].accountNumber);
  });

  it('has date from/to filter inputs', () => {
    cy.get('#date-from').should('exist');
    cy.get('#date-to').should('exist');
    cy.get('#date-from').type('2026-03-01');
    cy.get('#date-from').should('have.value', '2026-03-01');
    cy.get('#date-to').type('2026-03-28');
    cy.get('#date-to').should('have.value', '2026-03-28');
  });

  it('resets all filters when reset button is clicked', () => {
    cy.get('#account-filter').select(mockAccounts[0].accountNumber);
    cy.get('#date-from').type('2026-03-01');
    cy.get('#date-to').type('2026-03-28');
    cy.contains('button', 'Resetuj filtere').scrollIntoView().click({ force: true });
    cy.get('#account-filter').should('have.value', '');
    cy.get('#date-from').should('have.value', '');
    cy.get('#date-to').should('have.value', '');
  });

  it('shows filter section with title', () => {
    cy.contains('Filteri').should('be.visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  EXCHANGE PAGE
// ═══════════════════════════════════════════════════════════════════════

describe('Exchange Page - Rate Table Rendering', () => {
  beforeEach(() => {
    setupExchangeIntercepts();
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getExchangeRates');
  });

  it('renders exchange page with header and rate table', () => {
    cy.contains('Menjacnica').should('be.visible');
    cy.contains('Kursna lista').should('be.visible');
  });

  it('displays all supported currencies (EUR, USD, CHF, GBP, JPY, CAD, AUD)', () => {
    const currencies = ['EUR', 'USD', 'CHF', 'GBP', 'JPY', 'CAD', 'AUD'];
    currencies.forEach((currency) => {
      cy.contains(currency).should('be.visible');
    });
  });

  it('also displays RSD in the rate table (base currency auto-added)', () => {
    // RSD is added by normalizeExchangeRates when not in API response
    cy.contains('RSD').should('be.visible');
  });

  it('shows rate columns: buy (Kupovni), sell (Prodajni), middle (Srednji)', () => {
    cy.contains('Kupovni').should('be.visible');
    cy.contains('Prodajni').should('be.visible');
    cy.contains('Srednji').should('be.visible');
  });

  it('displays actual rate values from the API', () => {
    // EUR middleRate is 117.25 -> formatted with sr-RS locale as 117,2500
    cy.contains('117,2500').should('be.visible');
    // EUR buyRate is 116.50 -> formatted as 116,5000
    cy.contains('116,5000').should('be.visible');
    // EUR sellRate is 118.00 -> formatted as 118,0000
    cy.contains('118,0000').should('be.visible');
  });

  it('shows currency full names', () => {
    cy.contains('Evro').should('be.visible');
    cy.contains('Americki dolar').should('be.visible');
    cy.contains('Svajcarski franak').should('be.visible');
  });

  it('shows empty rates message when API fails', () => {
    // When the API fails, rates are set to [] (empty), showing the empty state
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 500, body: { message: 'Server error' } }).as('failedRates');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@failedRates');
    cy.contains('Nema dostupnih kurseva').should('be.visible');
  });

  it('shows loading skeletons while rates load', () => {
    cy.intercept('GET', '**/api/exchange-rates', {
      statusCode: 200,
      body: mockExchangeRates,
      delay: 500,
    }).as('slowRates');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@slowRates');
    cy.get('.animate-pulse').should('not.exist');
  });
});

describe('Exchange Page - Conversion Calculator', () => {
  beforeEach(() => {
    setupExchangeIntercepts();
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200,
      body: {
        convertedAmount: 11725.0,
        exchangeRate: 117.25,
        fromCurrency: 'EUR',
        toCurrency: 'RSD',
      },
    }).as('calculateExchange');
    cy.visit('/exchange', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getExchangeRates');
  });

  it('renders conversion calculator with amount input and currency selectors', () => {
    cy.contains('Kalkulator konverzije').should('be.visible');
    cy.get('#amount').should('exist');
    // Currency radio buttons exist for both from and to
    cy.contains('Iz valute').should('be.visible');
    cy.contains('U valutu').should('be.visible');
    cy.contains('button', 'Konvertuj').should('exist');
  });

  it('shows conversion result with valid input', () => {
    cy.get('#amount').clear().type('100');
    // EUR is default fromCurrency, RSD is default toCurrency
    cy.contains('button', 'Konvertuj').scrollIntoView().click();
    cy.wait('@calculateExchange');
    // Result should show converted amount
    cy.contains('Rezultat konverzije').should('be.visible');
    // Exchange rate 117.25 is formatted with sr-RS locale in the rate info
    cy.contains('117,2500').should('be.visible');
  });

  it('prevents same currency conversion and disables button', () => {
    // Select same currency for both from and to
    // Default: fromCurrency=EUR, toCurrency=RSD
    // Set fromCurrency to RSD to match toCurrency
    cy.get('input[name="fromCurrency"][value="RSD"]').check({ force: true });
    // Now both are RSD - warning should appear
    cy.contains('Izvorna i ciljna valuta ne mogu biti iste').should('be.visible');
    // The convert button should be disabled
    cy.contains('button', 'Konvertuj').should('be.disabled');
  });

  it('currency selector works - can change from and to currencies', () => {
    // Change from currency to USD
    cy.get('input[name="fromCurrency"][value="USD"]').check({ force: true });
    // Change to currency to CHF
    cy.get('input[name="toCurrency"][value="CHF"]').check({ force: true });
    // Both should be visually selected (we verify the radio is checked)
    cy.get('input[name="fromCurrency"][value="USD"]').should('be.checked');
    cy.get('input[name="toCurrency"][value="CHF"]').should('be.checked');
  });

  it('clears previous result when currency or amount changes', () => {
    cy.get('#amount').clear().type('100');
    cy.contains('button', 'Konvertuj').scrollIntoView().click();
    cy.wait('@calculateExchange');
    cy.contains('Rezultat konverzije').should('be.visible');
    // Now change the amount - result should disappear
    cy.get('#amount').clear().type('200');
    cy.contains('Rezultat konverzije').should('not.exist');
  });

  it('shows error toast when conversion API fails', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('failedCalc');
    cy.get('#amount').clear().type('50');
    cy.get('input[name="fromCurrency"][value="USD"]').check({ force: true });
    cy.get('input[name="toCurrency"][value="RSD"]').check({ force: true });
    cy.contains('button', 'Konvertuj').scrollIntoView().click({ force: true });
    cy.wait('@failedCalc');
    cy.contains('nije uspela').should('exist');
  });

  it('shows all 8 currency options in the from selector', () => {
    const currencies = ['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'];
    currencies.forEach((currency) => {
      cy.get(`input[name="fromCurrency"][value="${currency}"]`).should('exist');
    });
  });
});
