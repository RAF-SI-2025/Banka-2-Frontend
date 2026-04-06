/// <reference types="cypress" />
import { setupAdminSession, setupClientSession } from '../support/commands';

// ---------------------------------------------------------------------------
// Shared mock data used across flows
// ---------------------------------------------------------------------------

const MOCK_ACCOUNTS = [
  {
    id: 1,
    accountNumber: '265000000000000001',
    name: 'Tekuci RSD',
    accountType: 'CHECKING',
    currency: 'RSD',
    availableBalance: 500000,
    balance: 500000,
    status: 'ACTIVE',
  },
  {
    id: 2,
    accountNumber: '265000000000000002',
    name: 'Devizni EUR',
    accountType: 'FOREIGN',
    currency: 'EUR',
    availableBalance: 3000,
    balance: 3000,
    status: 'ACTIVE',
  },
];

const MOCK_RECIPIENTS = [
  { id: 1, name: 'Marko Markovic', accountNumber: '265000000000099001' },
  { id: 2, name: 'Petar Petrovic', accountNumber: '265000000000099002' },
];

const MOCK_PAYMENT_RESULT = {
  id: 101,
  fromAccountNumber: '265000000000000001',
  toAccountNumber: '265000000000099001',
  amount: 15000,
  currency: 'RSD',
  recipientName: 'Marko Markovic',
  paymentCode: '289',
  paymentPurpose: 'Uplata za usluge',
  status: 'COMPLETED',
  createdAt: '2026-04-03T10:00:00Z',
};

const MOCK_PAYMENT_HISTORY = {
  content: [MOCK_PAYMENT_RESULT],
  totalElements: 1,
  totalPages: 1,
};

const MOCK_TRANSFER_RESULT = {
  id: 201,
  fromAccountNumber: '265000000000000001',
  toAccountNumber: '265000000000000002',
  amount: 10000,
  fromCurrency: 'RSD',
  toCurrency: 'EUR',
  exchangeRate: 0.0085,
  convertedAmount: 85,
  commission: 50,
  status: 'COMPLETED',
  createdAt: '2026-04-03T11:00:00Z',
};

const MOCK_EMPLOYEE = {
  id: 10,
  firstName: 'Ana',
  lastName: 'Nikolic',
  username: 'ana.nikolic',
  email: 'ana.nikolic@banka.rs',
  phone: '+381601234567',
  active: true,
  position: 'Software Developer',
  department: 'IT',
  dateOfBirth: '1995-05-15',
  gender: 'F',
  permissions: [],
  address: 'Knez Mihailova 10, Beograd',
};

const MOCK_LISTING_AAPL = {
  id: 42,
  ticker: 'AAPL',
  name: 'Apple Inc.',
  listingType: 'STOCK',
  exchangeAcronym: 'NASDAQ',
  price: 178.5,
  ask: 178.6,
  bid: 178.4,
  priceChange: 2.3,
  changePercent: 1.31,
  volume: 52340000,
  initialMarginCost: 500,
  maintenanceMargin: 400,
};

const MOCK_ORDER = {
  id: 301,
  listingId: 42,
  listingTicker: 'AAPL',
  listingName: 'Apple Inc.',
  listingType: 'STOCK',
  direction: 'BUY',
  quantity: 10,
  contractSize: 1,
  pricePerUnit: 178.5,
  orderType: 'MARKET',
  status: 'APPROVED',
  remainingPortions: 0,
  approximatePrice: 1785,
  allOrNone: false,
  afterHours: false,
  margin: false,
  isDone: false,
  accountId: 1,
  approvedBy: '',
  createdAt: '2026-04-03T12:00:00Z',
  lastModification: '2026-04-03T12:00:00Z',
};

const MOCK_PORTFOLIO_ITEM = {
  id: 501,
  listingTicker: 'AAPL',
  listingName: 'Apple Inc.',
  listingType: 'STOCK',
  quantity: 10,
  averageBuyPrice: 178.5,
  currentPrice: 182.0,
  profit: 35,
  profitPercent: 1.96,
  publicQuantity: 0,
  lastModified: '2026-04-03T12:00:00Z',
};

const MOCK_PORTFOLIO_SUMMARY = {
  totalValue: 1820,
  totalProfit: 35,
  paidTaxThisYear: 5.25,
  unpaidTaxThisMonth: 0,
};

const MOCK_LOAN_REQUEST = {
  id: 401,
  loanType: 'CASH',
  interestType: 'FIXED',
  amount: 500000,
  currency: 'RSD',
  loanPurpose: 'Renoviranje stana',
  repaymentPeriod: 24,
  accountNumber: '265000000000000001',
  phoneNumber: '+381641234567',
  status: 'PENDING',
  createdAt: '2026-04-03T13:00:00Z',
};

const MOCK_MY_LOANS = {
  content: [
    {
      id: 401,
      loanType: 'CASH',
      interestRateType: 'FIXED',
      amount: 500000,
      currency: 'RSD',
      status: 'PENDING',
      repaymentPeriod: 24,
      accountNumber: '265000000000000001',
      monthlyPayment: 22400,
      createdAt: '2026-04-03T13:00:00Z',
    },
  ],
  totalElements: 1,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Helper: set up intercepts shared across most flows
// ---------------------------------------------------------------------------

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake-access-token' },
  }).as('authRefresh');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
}

// ==========================================================================
// 1. COMPLETE PAYMENT FLOW
// ==========================================================================
describe('Complete Payment Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();

    // Accounts & recipients for the form
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: MOCK_ACCOUNTS,
    }).as('getMyAccounts');

    cy.intercept('GET', '**/api/payment-recipients', {
      statusCode: 200,
      body: MOCK_RECIPIENTS,
    }).as('getRecipients');

    // OTP request
    cy.intercept('POST', '**/api/payments/request-otp', {
      statusCode: 200,
      body: { sent: true, message: 'Kod je poslat.' },
    }).as('requestOtp');

    // Create payment with OTP
    cy.intercept('POST', '**/api/payments', {
      statusCode: 200,
      body: MOCK_PAYMENT_RESULT,
    }).as('createPayment');

    // Payment history
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: MOCK_PAYMENT_HISTORY,
    }).as('getPayments');

    // Receipt PDF
    cy.intercept('GET', '**/api/payments/101/receipt', {
      statusCode: 200,
      headers: { 'content-type': 'application/pdf' },
      body: new Blob(['fake-pdf-content'], { type: 'application/pdf' }),
    }).as('getReceipt');
  });

  it('should complete the full payment lifecycle: form -> OTP -> success -> history -> PDF', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyAccounts');
    cy.wait('@getRecipients');

    // --- Step 1: Fill the payment form ---

    // Select sender account (first option is auto-selected, verify it exists)
    cy.get('#fromAccount').should('exist');

    // Fill recipient account
    cy.get('#toAccount').clear().type('265000000000099001');

    // Fill recipient name
    cy.get('#recipientName').clear().type('Marko Markovic');

    // Fill amount
    cy.get('#amount').clear().type('15000');

    // Fill payment code (already defaults to 289)
    cy.get('#paymentCode').should('have.value', '289');

    // Fill purpose
    cy.get('#purpose').type('Uplata za usluge');

    // --- Step 2: Submit -> opens OTP modal ---
    cy.contains('button', 'Nastavi na verifikaciju').click();

    // OTP modal should appear and request code
    cy.wait('@requestOtp');

    // OTP modal is visible — enter 6-digit code
    cy.get('input[name="code"]').should('be.visible').type('123456');

    // Confirm OTP
    cy.contains('button', 'Potvrdi').click();

    // Payment is created
    cy.wait('@createPayment').its('request.body').should((body) => {
      expect(body.amount).to.eq(15000);
      expect(body.toAccount).to.eq('265000000000099001');
      expect(body.otpCode).to.eq('123456');
    });

    // --- Step 3: After success, save recipient prompt or redirect ---
    // The payment was to a recipient already in the list, so it should navigate to history
    // or show the save-recipient prompt. Either way, we eventually land on payment history.
    cy.url().should('include', '/payments');

    // --- Step 4: Navigate to payment history and verify ---
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyAccounts');
    cy.wait('@getPayments');

    // Verify the transaction appears in the list
    cy.contains('Marko Markovic').should('be.visible');
    cy.contains('15').should('exist'); // amount formatted

    // --- Step 5: Expand transaction and download PDF ---
    cy.contains('Marko Markovic').click();
    cy.contains('Preuzmi potvrdu').should('be.visible').click();
    cy.wait('@getReceipt');
  });
});

// ==========================================================================
// 2. COMPLETE TRANSFER FLOW
// ==========================================================================
describe('Complete Transfer Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();

    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: MOCK_ACCOUNTS,
    }).as('getMyAccounts');

    // Currency conversion preview
    cy.intercept('POST', '**/api/exchange/calculate', {
      statusCode: 200,
      body: { exchangeRate: 0.0085, convertedAmount: 85 },
    }).as('convertCurrency');

    cy.intercept('POST', '**/api/payments/request-otp', {
      statusCode: 200,
      body: { sent: true, message: 'Kod je poslat.' },
    }).as('requestOtp');

    // Internal transfer
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 200,
      body: MOCK_TRANSFER_RESULT,
    }).as('createTransfer');

    // FX transfer (cross-currency)
    cy.intercept('POST', '**/api/transfers/fx', {
      statusCode: 200,
      body: MOCK_TRANSFER_RESULT,
    }).as('createFxTransfer');

    // Transfer history
    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: [MOCK_TRANSFER_RESULT],
    }).as('getTransfers');
  });

  it('should complete: select accounts -> enter amount -> confirm -> OTP -> success -> history', () => {
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyAccounts');

    // --- Step 1: Fill the transfer form ---

    // Select sender account
    cy.get('#fromAccount').select('265000000000000001');

    // Select receiver account
    cy.get('#toAccount').select('265000000000000002');

    // Enter amount
    cy.get('#amount').clear().type('10000');

    // --- Step 2: Submit form -> show confirm step ---
    cy.contains('button', 'Nastavi na potvrdu').click();

    // Confirm step is shown with summary
    cy.contains('Potvrda prenosa').should('be.visible');
    cy.contains('265000000000000001').should('exist');
    cy.contains('265000000000000002').should('exist');

    // --- Step 3: Confirm transfer -> OTP modal ---
    cy.contains('button', 'Potvrdi transfer').click();
    cy.wait('@requestOtp');

    // Enter OTP code
    cy.get('input[name="code"]').should('be.visible').type('654321');
    cy.contains('button', 'Potvrdi').click();

    // Transfer is executed
    cy.wait('@createTransfer').its('request.body').should((body) => {
      expect(body.fromAccountNumber).to.eq('265000000000000001');
      expect(body.toAccountNumber).to.eq('265000000000000002');
      expect(body.amount).to.eq(10000);
      expect(body.otpCode).to.eq('654321');
    });

    // After success, navigates to accounts
    cy.url().should('include', '/accounts');

    // --- Step 4: Navigate to transfer history ---
    cy.visit('/transfers/history', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    // Verify the transfer appears
    cy.contains('265000000000000001').should('exist');
    cy.contains('265000000000000002').should('exist');
  });
});

// ==========================================================================
// 3. EMPLOYEE CREATES ACCOUNT + CARD
// ==========================================================================
describe('Employee Creates Account + Card Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();

    // Client search for account owner
    cy.intercept('GET', '**/api/clients*', {
      statusCode: 200,
      body: {
        content: [
          {
            id: 5,
            firstName: 'Stefan',
            lastName: 'Jovanovic',
            email: 'stefan.jovanovic@gmail.com',
          },
        ],
        totalElements: 1,
        totalPages: 1,
      },
    }).as('searchClients');

    // Create account
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: {
        id: 100,
        accountNumber: '265000000000100001',
        accountType: 'CHECKING',
        currency: 'RSD',
        availableBalance: 50000,
        balance: 50000,
        status: 'ACTIVE',
        ownerEmail: 'stefan.jovanovic@gmail.com',
      },
    }).as('createAccount');

    // Accounts portal list
    cy.intercept('GET', '**/api/accounts/all*', {
      statusCode: 200,
      body: {
        content: [
          {
            id: 100,
            accountNumber: '265000000000100001',
            accountType: 'CHECKING',
            currency: 'RSD',
            availableBalance: 50000,
            balance: 50000,
            status: 'ACTIVE',
            ownerFirstName: 'Stefan',
            ownerLastName: 'Jovanovic',
          },
        ],
        totalElements: 1,
        totalPages: 1,
      },
    }).as('getAccountsList');

    // Cards list
    cy.intercept('GET', '**/api/cards*', {
      statusCode: 200,
      body: [
        {
          id: 50,
          cardNumber: '4000123456789012',
          cardType: 'DEBIT',
          status: 'ACTIVE',
          accountNumber: '265000000000100001',
          expiryDate: '2029-04-01',
        },
      ],
    }).as('getCards');
  });

  it('should create tekuci account with card and verify in portal', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });

    // --- Step 1: Fill account owner email ---
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.wait('@searchClients');

    // Select the suggested client
    cy.contains('button', 'Stefan Jovanovic').click();

    // --- Step 2: Account type is already TEKUCI (default) ---
    // Verify currency is locked to RSD for tekuci
    cy.contains('RSD').should('exist');

    // --- Step 3: Enter initial deposit ---
    cy.get('#initialDeposit').clear().type('50000');

    // --- Step 4: Toggle "create card" switch ---
    // The Switch component from shadcn uses a button role
    cy.contains('Napravi karticu uz racun').click();

    // --- Step 5: Submit the form ---
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount').its('request.body').should((body) => {
      expect(body.ownerEmail).to.eq('stefan.jovanovic@gmail.com');
      expect(body.accountType).to.eq('CHECKING');
      expect(body.currency).to.eq('RSD');
      expect(body.createCard).to.eq(true);
      expect(body.initialDeposit).to.eq(50000);
    });

    // --- Step 6: Redirected to accounts portal ---
    cy.url().should('include', '/employee/accounts');
    cy.wait('@getAccountsList');

    // Verify the new account appears in the list
    cy.contains('265000000000100001').should('exist');
    cy.contains('Stefan').should('exist');

    // --- Step 7: Navigate to cards page and verify card was created ---
    cy.visit('/cards', { onBeforeLoad: setupAdminSession });
    cy.wait('@getCards');
    cy.contains('4000123456789012').should('exist');
  });
});

// ==========================================================================
// 4. LOAN APPLICATION FLOW
// ==========================================================================
describe('Loan Application Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();

    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: MOCK_ACCOUNTS,
    }).as('getMyAccounts');

    // Submit loan application
    cy.intercept('POST', '**/api/loans', {
      statusCode: 201,
      body: MOCK_LOAN_REQUEST,
    }).as('applyLoan');

    // My loans list
    cy.intercept('GET', '**/api/loans/my*', {
      statusCode: 200,
      body: MOCK_MY_LOANS,
    }).as('getMyLoans');

    // Loan requests
    cy.intercept('GET', '**/api/loans/requests/my', {
      statusCode: 200,
      body: [MOCK_LOAN_REQUEST],
    }).as('getMyRequests');
  });

  it('should complete multi-step loan application: type -> amount -> personal -> confirm -> check list', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyAccounts');

    // --- Step 1: Loan type ---
    cy.get('#loanType').should('exist').select('GOTOVINSKI');
    cy.get('#interestRateType').select('FIKSNI');

    // --- Step 2: Amount and period ---
    cy.get('#amount').clear().type('500000');
    cy.get('#loanPurpose').type('Renoviranje stana');
    cy.get('#repaymentPeriod').select('24');

    // Verify calculator is shown
    cy.contains('Kalkulacija kredita').should('be.visible');
    cy.contains('Kamatna stopa').should('be.visible');
    cy.contains('Mesecna rata').should('be.visible');

    // Select account
    cy.get('#accountNumber').select('265000000000000001');

    // --- Step 3: Personal info ---
    cy.get('#phoneNumber').type('+381641234567');
    cy.get('#employmentStatus').type('stalno');
    cy.get('#monthlyIncome').type('120000');
    cy.get('#employmentPeriod').type('36');

    // Check permanent employment checkbox
    cy.get('input[type="checkbox"]').check();

    // --- Step 4: Confirm and submit ---
    cy.contains('Potvrda i slanje').should('exist');
    cy.contains('button', 'Posalji zahtev').click();

    cy.wait('@applyLoan').its('request.body').should((body) => {
      expect(body.loanType).to.eq('CASH');
      expect(body.interestType).to.eq('FIXED');
      expect(body.amount).to.eq(500000);
      expect(body.currency).to.eq('RSD');
      expect(body.repaymentPeriod).to.eq(24);
      expect(body.accountNumber).to.eq('265000000000000001');
      expect(body.phoneNumber).to.eq('+381641234567');
      expect(body.loanPurpose).to.eq('Renoviranje stana');
    });

    // --- Step 5: Redirected to loans list ---
    cy.url().should('include', '/loans');
    cy.wait('@getMyLoans');
  });
});

// ==========================================================================
// 5. STOCK TRADING FLOW
// ==========================================================================
describe('Stock Trading Flow', () => {
  beforeEach(() => {
    setupCommonIntercepts();

    // Securities list
    cy.intercept('GET', '**/api/listings*', (req) => {
      if (req.url.includes('/history')) {
        req.reply({
          statusCode: 200,
          body: [],
        });
      } else if (req.url.match(/\/listings\/\d+$/)) {
        req.reply({
          statusCode: 200,
          body: MOCK_LISTING_AAPL,
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            content: [MOCK_LISTING_AAPL],
            totalElements: 1,
            totalPages: 1,
          },
        });
      }
    }).as('listings');

    // Accounts for order form
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: MOCK_ACCOUNTS,
    }).as('getMyAccounts');

    // Exchange management (for exchange open/close check)
    cy.intercept('GET', '**/api/exchanges/**', {
      statusCode: 200,
      body: { id: 1, name: 'NASDAQ', acronym: 'NASDAQ', isOpen: true },
    }).as('getExchangeStatus');

    // Options (empty)
    cy.intercept('GET', '**/api/options*', {
      statusCode: 200,
      body: [],
    }).as('getOptions');

    // Create order
    cy.intercept('POST', '**/api/orders', {
      statusCode: 201,
      body: MOCK_ORDER,
    }).as('createOrder');

    // My orders
    cy.intercept('GET', '**/api/orders/my*', {
      statusCode: 200,
      body: {
        content: [MOCK_ORDER],
        totalElements: 1,
        totalPages: 1,
      },
    }).as('getMyOrders');

    // Portfolio
    cy.intercept('GET', '**/api/portfolio/my', {
      statusCode: 200,
      body: [MOCK_PORTFOLIO_ITEM],
    }).as('getPortfolio');

    cy.intercept('GET', '**/api/portfolio/summary', {
      statusCode: 200,
      body: MOCK_PORTFOLIO_SUMMARY,
    }).as('getPortfolioSummary');
  });

  it('should search stock -> view detail -> buy -> check orders -> check portfolio', () => {
    // --- Step 1: Browse securities list ---
    cy.visit('/securities', { onBeforeLoad: setupClientSession });
    cy.wait('@listings');

    // Search for AAPL
    cy.get('input[placeholder*="Pretrazi"]').first().type('AAPL');

    // Verify AAPL appears in the table
    cy.contains('AAPL').should('be.visible');
    cy.contains('Apple Inc.').should('be.visible');

    // --- Step 2: Click on AAPL to see details ---
    cy.contains('tr', 'AAPL').click();

    cy.url().should('include', '/securities/');
    cy.contains('Apple Inc.').should('be.visible');

    // --- Step 3: Click Buy to go to order form ---
    cy.contains('button', 'Kupi AAPL').click();
    cy.url().should('include', '/orders/new');
    cy.wait('@getMyAccounts');

    // --- Step 4: Fill the order form (market order) ---
    // Listing should be pre-selected from URL params
    // Select quantity
    cy.get('#quantity').clear().type('10');

    // Order type should be MARKET by default
    cy.get('#orderType').should('have.value', 'MARKET');

    // Account should be auto-selected when loaded

    // --- Step 5: Submit the order -> confirmation dialog -> confirm ---
    cy.contains('button', 'Nastavi na potvrdu').click();
    cy.contains('Potvrda naloga').should('be.visible');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@createOrder');

    // --- Step 6: Check my orders ---
    cy.visit('/orders/my', { onBeforeLoad: setupClientSession });
    cy.wait('@getMyOrders');

    cy.contains('AAPL').should('be.visible');
    cy.contains('10').should('exist'); // quantity

    // --- Step 7: Check portfolio ---
    cy.visit('/portfolio', { onBeforeLoad: setupClientSession });
    cy.wait('@getPortfolio');
    cy.wait('@getPortfolioSummary');

    cy.contains('AAPL').should('be.visible');
  });
});

// ==========================================================================
// 6. ADMIN EMPLOYEE MANAGEMENT
// ==========================================================================
describe('Admin Employee Management Flow', () => {
  const NEW_EMPLOYEE_EMAIL = 'ana.nikolic@banka.rs';

  beforeEach(() => {
    setupCommonIntercepts();

    // Employee list
    cy.intercept('GET', '**/api/employees*', (req) => {
      if (req.url.match(/\/employees\/\d+$/)) {
        // Single employee fetch
        req.reply({
          statusCode: 200,
          body: MOCK_EMPLOYEE,
        });
      } else {
        // List fetch
        req.reply({
          statusCode: 200,
          body: {
            content: [MOCK_EMPLOYEE],
            totalElements: 1,
            totalPages: 1,
          },
        });
      }
    }).as('getEmployees');

    // Create employee
    cy.intercept('POST', '**/api/employees', {
      statusCode: 201,
      body: MOCK_EMPLOYEE,
    }).as('createEmployee');

    // Update employee
    cy.intercept('PUT', '**/api/employees/*', {
      statusCode: 200,
      body: {
        ...MOCK_EMPLOYEE,
        position: 'Team Lead',
        permissions: ['TRADE_STOCKS'],
      },
    }).as('updateEmployee');

    // Deactivate employee
    cy.intercept('PATCH', '**/api/employees/*/deactivate', {
      statusCode: 200,
      body: { ...MOCK_EMPLOYEE, active: false },
    }).as('deactivateEmployee');
  });

  it('should complete: list -> create -> verify in list -> edit -> deactivate', () => {
    // --- Step 1: View employee list ---
    cy.visit('/admin/employees', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');

    cy.contains('Ana').should('be.visible');
    cy.contains('Nikolic').should('be.visible');

    // --- Step 2: Navigate to create new employee ---
    cy.contains('Novi zaposleni').click();
    cy.url().should('include', '/admin/employees/new');

    // --- Step 3: Fill the create employee form ---
    cy.get('input[name="firstName"]').type('Ana');
    cy.get('input[name="lastName"]').type('Nikolic');
    cy.get('input[name="username"]').type('ana.nikolic');
    cy.get('input[name="email"]').type(NEW_EMPLOYEE_EMAIL);
    cy.get('input[name="phoneNumber"]').type('+381601234567');
    cy.get('input[name="address"]').type('Knez Mihailova 10, Beograd');

    // Date of birth — DateInput component uses dd/mm/yyyy format with id, no name attribute
    cy.get('#dateOfBirth').type('15/05/1995');

    // Select gender via the Select component (shadcn)
    cy.contains('button', /Pol|Gender|Izaberite/).first().then(($btn) => {
      if ($btn.length) {
        cy.wrap($btn).click();
        cy.contains(/Zenski|Female|F/).click();
      }
    });

    // Select position
    cy.contains('button', /Pozicija|Position|Izaberite/).then(($btn) => {
      if ($btn.length) {
        cy.wrap($btn).click();
        cy.contains('Software Developer').click();
      }
    });

    // Select department
    cy.contains('button', /Odeljenje|Department|Izaberite/).then(($btn) => {
      if ($btn.length) {
        cy.wrap($btn).click();
        cy.contains('IT').click();
      }
    });

    // Submit
    cy.contains('button', /Kreiraj|Sacuvaj|Dodaj/).click();
    cy.wait('@createEmployee').its('request.body').should((body) => {
      expect(body.firstName).to.eq('Ana');
      expect(body.lastName).to.eq('Nikolic');
      expect(body.email).to.eq(NEW_EMPLOYEE_EMAIL);
      expect(body.phone).to.eq('+381601234567');
      expect(body.active).to.eq(true);
    });

    // --- Step 4: Redirected to employee list, verify new employee ---
    cy.url().should('include', '/admin/employees');
    cy.wait('@getEmployees');
    cy.contains('Ana').should('be.visible');
    cy.contains('Nikolic').should('be.visible');

    // --- Step 5: Edit the employee ---
    // Click edit button (pencil icon) on the employee row
    cy.get('table').contains('tr', 'Ana').within(() => {
      cy.get('button').first().click();
    });

    cy.url().should('include', '/admin/employees/');
    cy.wait('@getEmployees'); // single employee fetch

    // Change position using Select
    cy.contains('button', /Software Developer/).then(($btn) => {
      if ($btn.length) {
        cy.wrap($btn).click();
        cy.contains('Team Lead').click();
      }
    });

    // Toggle a permission checkbox if visible
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="permission-checkbox"]').length > 0) {
        cy.get('[data-testid="permission-checkbox"]').first().click();
      } else if ($body.text().includes('TRADE_STOCKS')) {
        cy.contains('TRADE_STOCKS').click();
      }
    });

    // Save changes
    cy.contains('button', /Sacuvaj|Azuriraj|Save/).click();
    cy.wait('@updateEmployee');

    // --- Step 6: Back to list, verify updated employee ---
    cy.url().should('include', '/admin/employees');
    cy.wait('@getEmployees');
    cy.contains('Ana').should('be.visible');

    // --- Step 7: Deactivate the employee ---
    cy.visit('/admin/employees/10', { onBeforeLoad: setupAdminSession });
    cy.wait('@getEmployees');

    // Find and click deactivate button/switch
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Deaktiviraj")').length > 0) {
        cy.contains('button', 'Deaktiviraj').click();
      } else {
        // Toggle the isActive switch
        cy.get('[role="switch"]').then(($switches) => {
          // Click the first switch (isActive toggle)
          cy.wrap($switches.first()).click();
        });
        cy.contains('button', /Sacuvaj|Azuriraj|Save/).click();
      }
    });

    // Verify the deactivation API was called
    cy.wait(/(@deactivateEmployee|@updateEmployee)/);
  });
});
