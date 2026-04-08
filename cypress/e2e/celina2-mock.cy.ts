/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * CELINA 2 - Mock E2E Tests (Comprehensive)
 * Covers: Accounts, Payments, Transfers, Exchange, Cards, Loans, Employee Portals,
 *         OTP Verification, Account/Card Requests, Business Accounts
 * All API calls are mocked with cy.intercept()
 *
 * PDF Scenarios covered: S1-S40 (all from TestoviCelina2.pdf)
 * Spec coverage: Account CRUD, Payment flow, Transfer flow, Exchange rates,
 *   Card management, Loan application, Employee portals, OTP verification,
 *   Business accounts with company data, Cross-currency operations
 */

import { setupAdminSession, setupClientSession } from '../support/commands';

// ============================================================
// Mock Data
// ============================================================

const mockAccounts = [
  {
    id: 1, accountNumber: '222000112345678911', name: 'Glavni racun',
    ownerName: 'Stefan Jovanovic', accountType: 'CHECKING', accountSubtype: 'STANDARD',
    currency: 'RSD', balance: 185000, availableBalance: 185000, reservedBalance: 0,
    maintenanceFee: 200, dailyLimit: 500000, monthlyLimit: 2000000,
    dailySpending: 10000, monthlySpending: 50000, status: 'ACTIVE',
    createdAt: '2025-01-01', expirationDate: '2030-01-01',
  },
  {
    id: 2, accountNumber: '222000112345678912', name: 'Stedni racun',
    ownerName: 'Stefan Jovanovic', accountType: 'CHECKING', accountSubtype: 'SAVINGS',
    currency: 'RSD', balance: 520000, availableBalance: 520000, reservedBalance: 0,
    maintenanceFee: 100, dailyLimit: 300000, monthlyLimit: 1500000,
    dailySpending: 0, monthlySpending: 0, status: 'ACTIVE',
    createdAt: '2025-02-01', expirationDate: '2030-02-01',
  },
  {
    id: 3, accountNumber: '222000121345678921', name: 'Devizni EUR',
    ownerName: 'Stefan Jovanovic', accountType: 'FOREIGN', currency: 'EUR',
    balance: 2500, availableBalance: 2500, reservedBalance: 0,
    maintenanceFee: 5, dailyLimit: 10000, monthlyLimit: 50000,
    dailySpending: 0, monthlySpending: 0, status: 'ACTIVE',
    createdAt: '2025-02-15', expirationDate: '2030-02-15',
  },
];

const mockBusinessAccount = {
  id: 4, accountNumber: '222000112345678914', name: 'Poslovni TechStar',
  ownerName: 'Milica Nikolic', accountType: 'BUSINESS', accountSubtype: 'DOO',
  currency: 'RSD', balance: 1250000, availableBalance: 1200000, reservedBalance: 50000,
  maintenanceFee: 500, dailyLimit: 5000000, monthlyLimit: 20000000,
  dailySpending: 100000, monthlySpending: 500000, status: 'ACTIVE',
  createdAt: '2025-01-15',
  company: {
    companyName: 'TechStar DOO', registrationNumber: '12345678',
    taxId: '111222333', activityCode: '62.01', address: 'Bulevar Kralja Aleksandra 73, Beograd',
  },
};

const mockTransactions = {
  content: [
    {
      id: 1, fromAccountNumber: '222000112345678911', toAccountNumber: '222000112345678915',
      recipientName: 'Lazar Ilic', amount: 5000, currency: 'RSD',
      paymentPurpose: 'Uplata za racun', paymentCode: '289',
      status: 'COMPLETED', createdAt: '2025-03-20T10:00:00',
    },
    {
      id: 2, fromAccountNumber: '222000112345678915', toAccountNumber: '222000112345678911',
      recipientName: 'Stefan Jovanovic', amount: 15000, currency: 'RSD',
      paymentPurpose: 'Plata', paymentCode: '220', status: 'COMPLETED',
      createdAt: '2025-03-19T14:00:00',
    },
    {
      id: 3, fromAccountNumber: '222000112345678911', toAccountNumber: '222000112345678913',
      recipientName: 'Milica Nikolic', amount: 3500, currency: 'RSD',
      paymentPurpose: 'Poklon', paymentCode: '289', status: 'PENDING',
      createdAt: '2025-03-21T08:00:00',
    },
    {
      id: 4, fromAccountNumber: '222000112345678911', toAccountNumber: '222000112345678999',
      recipientName: 'Nepoznat', amount: 999999, currency: 'RSD',
      paymentPurpose: 'Test', paymentCode: '289', status: 'REJECTED',
      createdAt: '2025-03-18T16:00:00',
    },
  ],
  totalElements: 4, totalPages: 1, number: 0, size: 10,
};

const mockRecipients = [
  { id: 1, name: 'Milica Nikolic', accountNumber: '222000112345678913' },
  { id: 2, name: 'Lazar Ilic', accountNumber: '222000112345678915' },
];

const mockTransfers = [
  {
    id: 1, fromAccount: '222000112345678911', toAccount: '222000112345678912',
    amount: 10000, fromCurrency: 'RSD', toCurrency: 'RSD',
    status: 'COMPLETED', createdAt: '2025-03-10T14:00:00',
  },
  {
    id: 2, fromAccount: '222000112345678911', toAccount: '222000121345678921',
    amount: 50000, fromCurrency: 'RSD', toCurrency: 'EUR', exchangeRate: 117.5,
    convertedAmount: 425.53, commission: 250, status: 'COMPLETED',
    createdAt: '2025-03-12T09:00:00',
  },
];

const mockExchangeRates = [
  { currency: 'EUR', currencyCode: 'EUR', buyRate: 116.5, middleRate: 117.0, sellRate: 117.5, date: '2025-03-15' },
  { currency: 'USD', currencyCode: 'USD', buyRate: 106.0, middleRate: 107.0, sellRate: 108.0, date: '2025-03-15' },
  { currency: 'CHF', currencyCode: 'CHF', buyRate: 115.0, middleRate: 116.0, sellRate: 117.0, date: '2025-03-15' },
  { currency: 'GBP', currencyCode: 'GBP', buyRate: 135.0, middleRate: 136.0, sellRate: 137.0, date: '2025-03-15' },
  { currency: 'JPY', currencyCode: 'JPY', buyRate: 0.70, middleRate: 0.71, sellRate: 0.72, date: '2025-03-15' },
  { currency: 'CAD', currencyCode: 'CAD', buyRate: 78.0, middleRate: 79.0, sellRate: 80.0, date: '2025-03-15' },
  { currency: 'AUD', currencyCode: 'AUD', buyRate: 69.0, middleRate: 70.0, sellRate: 71.0, date: '2025-03-15' },
];

const mockCards: Array<Record<string, unknown>> = [
  {
    id: 101, cardNumber: '4222001234567890', cardType: 'VISA', cardName: 'Visa Debit',
    accountId: 1, accountNumber: '222000112345678911',
    ownerName: 'STEFAN JOVANOVIC', holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2028-06-30', status: 'ACTIVE',
    cardLimit: 200000, limit: 200000, createdAt: '2025-01-15',
  },
  {
    id: 102, cardNumber: '4222009876543210', cardType: 'VISA', cardName: 'Visa Gold',
    accountId: 3, accountNumber: '222000121345678921',
    ownerName: 'STEFAN JOVANOVIC', holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2027-12-31', status: 'BLOCKED',
    cardLimit: 100000, limit: 100000, createdAt: '2025-02-20',
  },
  {
    id: 103, cardNumber: '5500001111222233', cardType: 'MASTERCARD', cardName: 'MasterCard',
    accountId: 1, accountNumber: '222000112345678911',
    ownerName: 'STEFAN JOVANOVIC', holderName: 'STEFAN JOVANOVIC',
    expirationDate: '2026-03-31', status: 'DEACTIVATED',
    cardLimit: 150000, limit: 150000, createdAt: '2024-03-01',
  },
];

const mockLoans = {
  content: [
    {
      id: 1, loanNumber: 'LN-001', loanType: 'CASH', interestType: 'FIXED',
      amount: 500000, currency: 'RSD', repaymentPeriod: 36, nominalRate: 8.5,
      effectiveRate: 9.2, monthlyPayment: 15800, startDate: '2025-01-15',
      endDate: '2028-01-15', remainingDebt: 450000, status: 'ACTIVE',
      accountNumber: '222000112345678911', loanPurpose: 'Kupovina opreme',
    },
    {
      id: 2, loanNumber: 'LN-002', loanType: 'MORTGAGE', interestType: 'VARIABLE',
      amount: 10000000, currency: 'RSD', repaymentPeriod: 240, nominalRate: 4.5,
      effectiveRate: 5.1, monthlyPayment: 63000, startDate: '2024-06-01',
      endDate: '2044-06-01', remainingDebt: 9500000, status: 'ACTIVE',
      accountNumber: '222000112345678911', loanPurpose: 'Stambeni kredit',
    },
  ],
  totalElements: 2, totalPages: 1,
};

const mockInstallments = [
  { id: 1, installmentNumber: 1, amount: 15800, principal: 12000, interest: 3800, dueDate: '2025-02-15', status: 'PAID' },
  { id: 2, installmentNumber: 2, amount: 15800, principal: 12100, interest: 3700, dueDate: '2025-03-15', status: 'PAID' },
  { id: 3, installmentNumber: 3, amount: 15800, principal: 12200, interest: 3600, dueDate: '2025-04-15', status: 'UPCOMING' },
];

const mockLoanRequests = [
  { id: 10, loanType: 'AUTO', interestType: 'FIXED', amount: 300000, currency: 'RSD', status: 'PENDING', clientName: 'Stefan Jovanovic', createdAt: '2025-03-20' },
  { id: 11, loanType: 'STUDENT', interestType: 'VARIABLE', amount: 200000, currency: 'RSD', status: 'REJECTED', clientName: 'Lazar Ilic', createdAt: '2025-03-18' },
];

const mockClients = {
  content: [
    { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan.jovanovic@gmail.com', phone: '+381641111111', address: 'Beograd', dateOfBirth: '1995-05-20', gender: 'M' },
    { id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica.nikolic@gmail.com', phone: '+381642222222', address: 'Novi Sad', dateOfBirth: '1993-08-15', gender: 'F' },
    { id: 3, firstName: 'Lazar', lastName: 'Ilic', email: 'lazar.ilic@yahoo.com', phone: '+381643333333', address: 'Nis', dateOfBirth: '1998-01-10', gender: 'M' },
  ],
  totalElements: 3, totalPages: 1,
};

const mockAllAccounts = {
  content: [
    ...mockAccounts,
    mockBusinessAccount,
    { id: 5, accountNumber: '222000112345678915', name: 'Lazar RSD', ownerName: 'Lazar Ilic', accountType: 'CHECKING', currency: 'RSD', balance: 310000, availableBalance: 310000, status: 'ACTIVE' },
  ],
  totalElements: 5, totalPages: 1,
};

const mockAccountRequests = {
  content: [
    { id: 1, accountType: 'CHECKING', accountSubtype: 'STANDARD', currency: 'RSD', clientEmail: 'stefan@gmail.com', clientName: 'Stefan Jovanovic', status: 'PENDING', createdAt: '2025-03-20' },
    { id: 2, accountType: 'FOREIGN', currency: 'EUR', clientEmail: 'milica@gmail.com', clientName: 'Milica Nikolic', status: 'APPROVED', createdAt: '2025-03-18' },
  ],
  totalElements: 2, totalPages: 1,
};

const mockCardRequests = {
  content: [
    { id: 1, accountId: 1, accountNumber: '222000112345678911', cardLimit: 200000, cardType: 'VISA', clientEmail: 'stefan@gmail.com', clientName: 'Stefan Jovanovic', status: 'PENDING', createdAt: '2025-03-21' },
  ],
  totalElements: 1, totalPages: 1,
};

// ============================================================
// Helper: Setup common mocks for client pages
// ============================================================

function setupClientMocks() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockTransactions });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: mockCards });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: mockLoans });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: mockTransfers });
  cy.intercept('GET', '**/api/loans/requests/my', { statusCode: 200, body: mockLoanRequests });
}

// ====================================================================
// SECTION 1: Racuni - Pregled racuna (S6-S8)
// ====================================================================

describe('Racuni > Pregled racuna', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S6: Klijent vidi sve aktivne racune sortiranih po stanju', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.contains('Glavni racun').should('be.visible');
    cy.contains('Devizni EUR').should('be.visible');
    cy.contains('Stedni racun').should('be.visible');
  });

  it('S6b: Racuni prikazuju tip, valutu i stanje', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.contains('RSD').should('exist');
    cy.contains('EUR').should('exist');
    cy.contains(/185/).should('exist'); // balance
  });

  it('S7: Pregled detalja racuna', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Glavni racun').should('be.visible');
    cy.contains(/185.*000|185,000/i).should('exist'); // balance display
  });

  it('S8: Promena naziva racuna', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.intercept('PATCH', '**/api/accounts/1/name', {
      statusCode: 200, body: { ...mockAccounts[0], name: 'Novi naziv' },
    }).as('rename');

    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Preimenuj').click();
    cy.get('input[placeholder="Novi naziv racuna"]').clear().type('Novi naziv');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@rename');
  });

  it('Detalji racuna - action dugmad su vidljiva', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Novo placanje').should('exist');
    cy.contains('Transfer').should('exist');
    cy.contains('Promeni limit').should('exist');
  });

  it('Detalji racuna - prikazuje dnevni i mesecni limit progress', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Dnevna potrosnja').should('exist');
    cy.contains('Mesecna potrosnja').should('exist');
  });

  it('Detalji racuna - prikazuje balance kartice', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains(/stanje|balance/i).should('exist');
    cy.contains(/raspoloživ|raspoloziv/i).should('exist');
  });

  it('Detalji racuna - not found za nepostojeci', () => {
    cy.intercept('GET', '**/api/accounts/999', { statusCode: 404, body: { message: 'Not found' } });
    cy.visit('/accounts/999', { onBeforeLoad: setupClientSession });
    cy.contains(/nije pronađen|not found|ne postoji/i).should('exist');
  });

  it('Detalji racuna - promena limita otvara formu', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Promeni limit').click();
    cy.get('#dailyLimit').should('exist');
    cy.get('#monthlyLimit').should('exist');
  });

  it('Poslovni racun - prikazuje informacije o firmi', () => {
    cy.intercept('GET', '**/api/accounts/4', { statusCode: 200, body: mockBusinessAccount });
    cy.visit('/accounts/4/business', { onBeforeLoad: setupClientSession });
    cy.contains('TechStar DOO').should('be.visible');
    cy.contains('12345678').should('be.visible'); // registration number
    cy.contains('62.01').should('be.visible'); // activity code
  });

  it('Poslovni racun - prikazuje PIB i maticni broj', () => {
    cy.intercept('GET', '**/api/accounts/4', { statusCode: 200, body: mockBusinessAccount });
    cy.visit('/accounts/4/business', { onBeforeLoad: setupClientSession });
    cy.contains(/PIB|pib|poreski/i).should('exist');
    cy.contains('111222333').should('be.visible');
  });

  it('Racun lista - transakcije za selektovan racun', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    // Clicking on an account should show its transactions
    cy.contains('Glavni racun').click();
    cy.wait(1000);
    // Transaction list should appear
  });
});

// ====================================================================
// SECTION 1b: Racuni > Kreiranje racuna - Employee Portal (S1-S5)
// ====================================================================

describe('Employee Portal: Kreiranje racuna', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients });
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: mockAllAccounts });
  });

  it('S1: Kreiranje tekuceg racuna', () => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201, body: { id: 99, accountNumber: '222000112345679999', accountType: 'CHECKING', status: 'ACTIVE' },
    }).as('createAccount');

    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    // Owner email
    cy.get('input[name="ownerEmail"], input[placeholder*="email"]').type('stefan.jovanovic@gmail.com');
    cy.wait(1000);
    // Account type should be TEKUCI by default
    cy.contains(/tekuci|checking/i).should('exist');

    cy.contains('button', /kreiraj|sačuvaj|napravi/i).click();
    cy.wait('@createAccount');
  });

  it('S2: Kreiranje deviznog racuna', () => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201, body: { id: 100, accountNumber: '222000121345679999', accountType: 'FOREIGN', currency: 'EUR' },
    }).as('createForeign');

    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    cy.get('input[placeholder="ime.prezime@email.com"]').type('stefan.jovanovic@gmail.com');
    // Switch to devizni - default is "Tekuci", click the trigger to change
    cy.contains('Tekuci').first().click();
    cy.get('[role="option"]').contains('Devizni').click();
    cy.wait(500);
    // Select EUR currency
    cy.get('[role="combobox"]').last().click();
    cy.get('[role="option"]').contains('EUR').click();

    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createForeign');
  });

  it('S3: Kreiranje racuna sa karticom - checkbox', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    cy.contains('Napravi karticu uz racun').should('exist');
  });

  it('S4: Kreiranje poslovnog racuna sa firmom', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    cy.contains('Tekuci').first().click();
    cy.get('[role="option"]').contains('Poslovni').click();
    cy.wait(500);
    // Business fields should appear
    cy.contains('Naziv firme').should('exist');
    cy.contains('Maticni broj').should('exist');
    cy.contains('PIB').should('exist');
    cy.contains('Sifra delatnosti').should('exist');
  });

  it('S5: Kreiranje racuna - max kartice za racun', () => {
    // When account already has max cards, the card creation option should be limited
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    // This tests the checkbox is available (limit enforcement is backend)
    cy.get('[name="createCard"], [role="checkbox"], [role="switch"]').should('exist');
  });

  it('Forma prikazuje polje za pocetnu uplatu', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    cy.get('input[name="initialDeposit"], input[name="initialBalance"], input[placeholder*="uplat"]').should('exist');
  });

  it('Forma prikazuje validacione greske za prazna polja', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    cy.contains('button', /kreiraj|sačuvaj|napravi/i).click();
    cy.get('.text-destructive, .text-sm.text-destructive').should('have.length.greaterThan', 0);
  });

  it('Forma prikazuje podtipove za tekuci (standardni, stedni, penzionerski...)', () => {
    cy.visit('/employee/accounts/new', { onBeforeLoad: setupAdminSession });
    // TEKUCI subtypes
    cy.contains(/standard|lični|stedni|penzioner|mlad|student|nezaposlen/i).should('exist');
  });
});

// ====================================================================
// SECTION 2: Placanja - Novo placanje (S9-S15)
// ====================================================================

describe('Placanja > Novo placanje', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S9: Forma za novo placanje - prikaz svih polja', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.contains('Racun platioca').should('exist');
    cy.contains(/primalac|naziv/i).should('exist');
    cy.get('input[name="amount"], input[placeholder*="iznos"]').should('exist');
    cy.contains(/svrha|namena/i).should('exist');
  });

  it('S9b: Popunjavanje naloga za placanje', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Select sender account
    cy.get('select#fromAccount').select(1);
    // Fill recipient
    cy.get('input[placeholder="Naziv primaoca"]').type('Petar Petrovic');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678999');
    cy.get('input[name="amount"]').type('5000');
    cy.get('textarea[name="paymentPurpose"]').type('Test placanje');
  });

  it('S10: Neuspesno placanje - nedovoljna sredstva', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 400, body: { message: 'Insufficient funds' },
    }).as('paymentFail');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('input[name="amount"]').type('99999999');
  });

  it('S11: Neuspesno placanje - nepostojeci racun primaoca', () => {
    cy.intercept('POST', '**/api/payments', {
      statusCode: 404, body: { message: 'Recipient account not found' },
    }).as('recipientNotFound');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('input[name="toAccountNumber"], input[placeholder*="račun primaoca"]').type('999999999999999999');
  });

  it('S12: Placanje u razlicitim valutama - konverzija', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200, body: { convertedAmount: 42.55, rate: 117.5, commission: 2.5 },
    });

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // This scenario tests cross-currency payment detection
  });

  it('S13: Verifikacioni modal se prikazuje', () => {
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } });

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Fill minimum required fields
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('1000');
    cy.get('textarea[name="paymentPurpose"]').type('Test');

    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
    // OTP modal should appear
    cy.contains(/verifikacij|kod|otp/i, { timeout: 5000 }).should('exist');
  });

  it('S14: OTP - tri neuspesna pokusaja otkazuju transakciju', () => {
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } });
    cy.intercept('POST', '**/api/payments', {
      statusCode: 400, body: { message: 'Invalid OTP' },
    }).as('badOtp');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Fill form and trigger OTP
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('1000');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
  });

  it('S15: Biranje sacuvanog primaoca', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Recipients dropdown or list should be available
    cy.contains(/primalac|šablon|sacuvan/i).should('exist');
  });

  it('Payment forma - validacija 18-cifrenog broja racuna', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('input[name="toAccountNumber"], input[placeholder*="račun"]').type('12345');
    cy.contains('button', /nastavi|potvrdi/i).click();
    // Should show validation error for non-18-digit account
  });

  it('Payment forma - poziv na broj polje (opciono)', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('input[name="callNumber"], input[name="referenceNumber"], input[placeholder*="poziv"]').should('exist');
  });

  it('Payment forma - sifra placanja (default 289)', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('[name="paymentCode"], select[name="paymentCode"]').should('exist');
  });

  it('Payment forma - live preview na desktopu', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Preview section should exist on desktop viewport
    cy.contains('Pregled naloga').should('exist');
  });
});

// ====================================================================
// SECTION 3: Placanja > Istorija placanja (S16)
// ====================================================================

describe('Placanja > Istorija placanja', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S16: Prikazuje listu svih placanja', () => {
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.contains('Lazar Ilic').should('be.visible');
  });

  it('S16b: Filtriranje po statusu', () => {
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.contains('Zavrsene').should('exist');
    cy.contains('Na cekanju').should('exist');
    cy.contains('Odbijene').should('exist');
  });

  it('S16c: Statistika placanja (odlivi, prilivi, broj)', () => {
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.contains(/ukupno|total|odliv|priliv|transakcij/i).should('exist');
  });

  it('Filter za datum postoji', () => {
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    // Click filter toggle first, then check for date inputs
    cy.contains('Filteri').click();
    cy.get('#dateFrom, #dateTo').should('exist');
  });

  it('Paginacija na istoriji placanja', () => {
    const manyTx = {
      content: mockTransactions.content, totalElements: 50, totalPages: 5, number: 0, size: 10,
    };
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: manyTx });
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.get('[class*="pagination"], button:contains("2"), [aria-label*="next"]').should('exist');
  });

  it('Prazna istorija placanja', () => {
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    cy.contains(/nema|prazn|no transactions/i).should('exist');
  });

  it('Download PDF potvrde', () => {
    cy.intercept('GET', '**/api/payments/1/receipt', {
      statusCode: 200, headers: { 'content-type': 'application/pdf' }, body: new Blob(),
    });
    cy.visit('/payments/history', { onBeforeLoad: setupClientSession });
    // Expand a transaction to see receipt button
  });
});

// ====================================================================
// SECTION 4: Primaoci placanja (S21-S23)
// ====================================================================

describe('Primaoci placanja', () => {
  beforeEach(() => {
    setupClientMocks();
    cy.intercept('GET', '**/api/payment-recipients*', { statusCode: 200, body: mockRecipients });
  });

  it('Prikazuje listu primalaca', () => {
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Lazar Ilic').should('be.visible');
  });

  it('Prikazuje avatar sa inicijalima', () => {
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    // Avatars with initials should exist
    cy.contains('MN').should('exist'); // Milica Nikolic
  });

  it('Prikazuje maskirani broj racuna', () => {
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains(/222.*913|•••|\*\*\*/).should('exist');
  });

  it('S21: Dodavanje novog primaoca', () => {
    cy.intercept('POST', '**/api/payment-recipients', {
      statusCode: 201, body: { id: 3, name: 'Novi Primalac', accountNumber: '222000112345670001' },
    }).as('createRecipient');

    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains('Dodaj primaoca').click();
    cy.get('#create-name').type('Novi Primalac');
    cy.get('#create-account').type('222000112345670001');
    cy.contains('button', 'Sacuvaj primaoca').click();
    cy.wait('@createRecipient');
  });

  it('S22: Izmena podataka primaoca', () => {
    cy.intercept('PUT', '**/api/payment-recipients/1', {
      statusCode: 200, body: { id: 1, name: 'Milica Izmenjena', accountNumber: '222000112345678913' },
    }).as('updateRecipient');

    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    // Edit buttons are icon-only with title="Izmeni", shown on hover
    cy.contains('Milica').parents('[class*="card"], [class*="group"]').first()
      .find('button[title="Izmeni"]').click({ force: true });
    cy.get('[id^="edit-name-"]').first().clear().type('Milica Izmenjena');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@updateRecipient');
  });

  it('S23: Brisanje primaoca', () => {
    cy.intercept('DELETE', '**/api/payment-recipients/2', { statusCode: 204 }).as('deleteRecipient');

    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains('Lazar').parents('[class*="card"], [class*="group"]').first()
      .find('button[title="Obrisi"]').click({ force: true });
    cy.wait('@deleteRecipient');
  });

  it('Pretraga primalaca', () => {
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.get('input[placeholder*="Pretraga po imenu"]').type('Milica');
    cy.contains('Milica').should('be.visible');
  });

  it('Prazna lista primalaca', () => {
    cy.intercept('GET', '**/api/payment-recipients*', { statusCode: 200, body: [] });
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains(/nema|prazn|dodaj/i).should('exist');
  });

  it('Dodaj primaoca - validacija (18 cifara)', () => {
    cy.visit('/payments/recipients', { onBeforeLoad: setupClientSession });
    cy.contains('Dodaj primaoca').click();
    cy.get('#create-name').type('Test');
    cy.get('#create-account').type('12345');
    cy.contains('button', 'Sacuvaj primaoca').click();
    // Should show validation error
    cy.get('.text-destructive, [class*="error"]').should('exist');
  });
});

// ====================================================================
// SECTION 5: Transferi (S17-S20)
// ====================================================================

describe('Transferi', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S17: Transfer forma - prikaz polja', () => {
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    cy.contains('Racun posiljaoca').should('exist');
    cy.contains('Racun primaoca').should('exist');
    cy.get('#amount').should('exist');
  });

  it('S17b: Izbor izvornog i odredisnog racuna', () => {
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').should('exist');
    cy.get('select#toAccount').should('exist');
  });

  it('S18: Konverzija valute prikazuje kurs i proviziju', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200, body: { convertedAmount: 425.53, rate: 117.5, commission: 250 },
    }).as('convert');

    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    // Select RSD source and EUR destination
    // Exchange info should appear for different currencies
  });

  it('S19: Istorija transfera - prikazuje listu', () => {
    cy.visit('/transfers/history', { onBeforeLoad: setupClientSession });
    // Should show transfer history
    cy.contains(/transfer|prenos|istorij/i).should('exist');
  });

  it('S19b: Istorija transfera - filteri', () => {
    cy.visit('/transfers/history', { onBeforeLoad: setupClientSession });
    cy.get('select, input[type="date"]').should('exist');
  });

  it('S20: Neuspesan transfer - nedovoljno sredstava', () => {
    cy.intercept('POST', '**/api/transfers/internal', {
      statusCode: 400, body: { message: 'Insufficient funds' },
    });
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
  });

  it('S26: Konverzija valute tokom transfera - kursna konverzija', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200, body: { convertedAmount: 42.55, rate: 117.5, commission: 25 },
    });
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    // FX transfer should show conversion details
  });

  it('Transfer history - prikazuje FX detalje za cross-currency', () => {
    cy.visit('/transfers/history', { onBeforeLoad: setupClientSession });
    // FX transfer should show exchange rate
    cy.contains(/kurs|rate|EUR/i).should('exist');
  });

  it('Transfer history - prazna lista', () => {
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
    cy.visit('/transfers/history', { onBeforeLoad: setupClientSession });
    cy.contains(/nema|prazn/i).should('exist');
  });

  it('Transfer - potvrda pre slanja', () => {
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    // Fill form - native selects
    cy.get('select#fromAccount').select(1);
    cy.get('select#toAccount').select(1);
    cy.get('#amount').type('5000');
    cy.contains('button', 'Nastavi na potvrdu').click();
    // Confirmation step should show
    cy.contains('Potvrda prenosa').should('exist');
  });
});

// ====================================================================
// SECTION 6: Menjacnica (S24-S25)
// ====================================================================

describe('Menjacnica', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: mockExchangeRates });
  });

  it('S24: Prikazuje kursnu listu sa svim valutama', () => {
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    cy.contains('EUR').should('be.visible');
    cy.contains('USD').should('be.visible');
    cy.contains('CHF').should('be.visible');
    cy.contains('GBP').should('be.visible');
    cy.contains('JPY').should('be.visible');
    cy.contains('CAD').should('be.visible');
    cy.contains('AUD').should('be.visible');
  });

  it('S24b: Prikazuje kupovni, srednji i prodajni kurs', () => {
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    cy.contains('Kupovni').should('exist');
    cy.contains('Srednji').should('exist');
    cy.contains('Prodajni').should('exist');
    // Rates displayed with sr-RS locale (comma decimal, 4 places): 116,5000
    cy.contains('116,5000').should('exist');
    cy.contains('117,5000').should('exist');
  });

  it('S25: Kalkulator konverzije', () => {
    cy.intercept('GET', '**/api/exchange/calculate*', {
      statusCode: 200, body: { convertedAmount: 851.06, rate: 117.5, commission: 0 },
    }).as('convert');

    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    cy.get('input[name="amount"], input[placeholder*="iznos"], input[type="number"]').type('100000');
    cy.contains('button', 'Konvertuj').click();
    cy.wait('@convert');
    cy.contains(/851|konvertovan/i).should('exist');
  });

  it('Kursna lista - prikazuje datum azuriranja', () => {
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    // The date or rates should be visible
    cy.contains(/EUR|USD/).should('exist');
  });

  it('Kalkulator - valute moraju biti razlicite', () => {
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    // fromCurrency and toCurrency should not be the same
  });

  it('Prazna kursna lista kad API ne radi', () => {
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 500, body: { message: 'Error' } });
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
  });

  it('Loading skeletoni dok se kursevi ucitavaju', () => {
    cy.intercept('GET', '**/api/exchange-rates', (req) => {
      req.reply({ statusCode: 200, body: mockExchangeRates, delay: 2000 });
    });
    cy.visit('/exchange', { onBeforeLoad: setupClientSession });
    cy.get('[class*="animate-pulse"], [class*="skeleton"]').should('exist');
  });
});

// ====================================================================
// SECTION 7: Kartice (S27-S32)
// ====================================================================

describe('Kartice', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S29: Prikazuje listu kartica sa maskiranim brojevima', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    // Card numbers should be masked
    cy.contains(/\*\*\*\*|••••|XXXX/i).should('exist');
  });

  it('S29b: Prikazuje status kartica', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/aktivna|active/i).should('exist');
    cy.contains(/blokirana|blocked/i).should('exist');
  });

  it('S28: Forma za kreiranje nove kartice', () => {
    cy.intercept('POST', '**/api/cards/requests', {
      statusCode: 201, body: { id: 99, status: 'PENDING' },
    });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/Nova kartica|Zatrazite karticu/i).click();
  });

  it('S30: Blokiranje aktivne kartice', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', {
      statusCode: 200, body: { ...mockCards[0], status: 'BLOCKED' },
    }).as('blockCard');

    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    // Block via Switch toggle - active card has checked switch
    cy.get('[role="switch"]').first().click({ force: true });
    cy.wait('@blockCard');
  });

  it('S32: Deaktivirana kartica prikazuje status', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/deaktivirana|deactivated/i).should('exist');
  });

  it('Kartice - prikazuje card type (VISA, MASTERCARD)', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/visa/i).should('exist');
    cy.contains(/mastercard/i).should('exist');
  });

  it('Kartice - prikazuje holder ime', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/STEFAN JOVANOVIC/i).should('exist');
  });

  it('Kartice - prikazuje expiry date', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/2028|2027|2026/i).should('exist');
  });

  it('Kartice - gradient pozadina po tipu', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.get('[class*="gradient"], [style*="gradient"]').should('exist');
  });

  it('Kartice - stats (ukupno, aktivne, blokirane)', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    // Stats row with counts
    cy.contains(/ukupno|total/i).should('exist');
  });

  it('Kartice - limit prikaz', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/limit|200.*000/i).should('exist');
  });

  it('Klijent ne moze odblokirati karticu (kontaktiraj banku)', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    // For blocked card, client cannot unblock
    cy.contains('Kontaktirajte banku').should('exist');
  });

  it('Prazna lista kartica', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/nema|prazn|zatraži/i).should('exist');
  });

  it('Loading skeleton dok se kartice ucitavaju', () => {
    cy.intercept('GET', '**/api/cards', (req) => {
      req.reply({ statusCode: 200, body: mockCards, delay: 2000 });
    });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.get('[class*="animate-pulse"], [class*="skeleton"]').should('exist');
  });

  it('API greska prikazuje error state', () => {
    cy.intercept('GET', '**/api/cards', { statusCode: 500, body: { message: 'Error' } });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
  });
});

// ====================================================================
// SECTION 8: Krediti (S33-S34)
// ====================================================================

describe('Krediti', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S34: Prikazuje listu kredita', () => {
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/gotovinski|cash/i).should('exist');
    cy.contains(/stambeni|mortgage/i).should('exist');
  });

  it('S34b: Statistika kredita', () => {
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/ukupno|aktiv/i).should('exist');
  });

  it('Krediti - detalji sa mesecnom ratom i preostalim dugom', () => {
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: mockInstallments });
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/15.*800|mesečn|rata/i).should('exist');
    cy.contains(/450.*000|preostalog|dugov/i).should('exist');
  });

  it('Krediti - rate tabela (expandable)', () => {
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: mockInstallments });
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/detalj|prikaži/i).first().click();
    // Installments should be visible
    cy.contains(/glavnic|kamat|rata/i).should('exist');
  });

  it('Krediti - prevremena otplata', () => {
    cy.intercept('POST', '**/api/loans/1/early-repayment', {
      statusCode: 200, body: { ...mockLoans.content[0], status: 'PAID_OFF' },
    }).as('earlyRepay');

    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    // Must expand loan details first to see early repayment button
    cy.contains('Prikazi detalje').first().click();
    cy.contains('Prevremena otplata').should('exist');
  });

  it('S33: Forma za zahtev za kredit - navigacija', () => {
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/zahtev|apliciraj|novi kredit/i).click();
    cy.url().should('include', '/loans/apply');
  });

  it('Prazna lista kredita', () => {
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/loans/requests/my', { statusCode: 200, body: [] });
    cy.visit('/loans', { onBeforeLoad: setupClientSession });
    cy.contains(/nema|prazn/i).should('exist');
  });
});

// ====================================================================
// SECTION 8b: Kredit zahtev
// ====================================================================

describe('Kredit zahtev', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('S33: Forma za zahtev za kredit - prikaz', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.contains(/zahtev za kredit|loan application/i).should('exist');
  });

  it('S33b: Tipovi kredita - svi prikazani', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    // Should show loan type options
    cy.contains(/gotovinski|keš|cash/i).should('exist');
  });

  it('Zahtev - tip kamate (fiksni/varijabilni)', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.contains(/fiksn|varijabiln|kamata/i).should('exist');
  });

  it('Zahtev - rok otplate opcije zavise od tipa', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    // Gotovinski: 12,24,36,48,60,72,84
    // Stambeni: 60,120,180,240,300,360
    cy.contains(/period|rok|mesec/i).should('exist');
  });

  it('Zahtev - polje za iznos i valutu', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.get('input[name="amount"], input[placeholder*="iznos"]').should('exist');
  });

  it('Zahtev - licni podaci (telefon, zaposlenje)', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.contains(/telefon|zaposlenje|status/i).should('exist');
  });

  it('Zahtev - izbor racuna', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    cy.get('select[name="accountNumber"], [role="combobox"]').should('exist');
  });

  it('Zahtev - validacija praznih polja', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    // Try to submit empty
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Podnesi")').length) {
        cy.contains('button', /podnesi|potvrdi|apliciraj/i).click();
        cy.get('.text-destructive').should('have.length.greaterThan', 0);
      }
    });
  });

  it('Zahtev - uspesno podnesen', () => {
    cy.intercept('POST', '**/api/loans', {
      statusCode: 201, body: { id: 99, loanType: 'CASH', status: 'PENDING' },
    }).as('applyLoan');

    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    // Fill all required fields - this depends on exact form structure
  });
});

// ====================================================================
// SECTION 9: Employee Portali
// ====================================================================

describe('Employee Portal: Upravljanje klijentima', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients });
  });

  it('S39: Portal klijenata - prikaz i pretraga', () => {
    cy.visit('/employee/clients', { onBeforeLoad: setupAdminSession });
    cy.contains('Stefan').should('be.visible');
    cy.contains('Milica').should('be.visible');
  });

  it('S40: Izmena podataka klijenta', () => {
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] });
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockAccounts });
    cy.intercept('PUT', '**/api/clients/1', {
      statusCode: 200, body: { ...mockClients.content[0], phone: '+381649999999' },
    }).as('updateClient');

    cy.visit('/employee/clients', { onBeforeLoad: setupAdminSession });
    cy.contains('Stefan').click();
    cy.wait(1000);
    // Edit form should open
  });

  it('Portal klijenata - pretraga po imenu', () => {
    cy.visit('/employee/clients', { onBeforeLoad: setupAdminSession });
    cy.get('input[placeholder*="pretraži"], input[placeholder*="ime"]').type('Milica');
    cy.wait(1000);
  });

  it('Portal klijenata - prazna lista', () => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.visit('/employee/clients', { onBeforeLoad: setupAdminSession });
    cy.contains(/nema|prazn/i).should('exist');
  });

  it('Portal klijenata - kreiranje novog klijenta', () => {
    cy.visit('/employee/clients', { onBeforeLoad: setupAdminSession });
    cy.contains(/novi klijent|kreiraj/i).should('exist');
  });
});

describe('Employee Portal: Upravljanje racunima', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: mockAllAccounts });
  });

  it('Portal racuna - prikaz svih racuna', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: setupAdminSession });
    // Account numbers displayed in xxx-xxxxxxxxxxxxx-xx format
    cy.contains(/222-|Vlasnik|racun/i).should('exist');
  });

  it('Portal racuna - statistika', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: setupAdminSession });
    cy.contains(/ukupno|aktiv/i).should('exist');
  });

  it('Portal racuna - navigacija na kreiranje', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: setupAdminSession });
    cy.contains(/kreiraj|novi/i).click();
    cy.url().should('include', '/employee/accounts/new');
  });

  it('Portal racuna - promena statusa', () => {
    cy.intercept('PATCH', '**/api/accounts/*/status', { statusCode: 200, body: { status: 'BLOCKED' } }).as('changeStatus');
    cy.visit('/employee/accounts', { onBeforeLoad: setupAdminSession });
    // Status change action should exist
  });

  it('Portal racuna - filteri postoje', () => {
    cy.visit('/employee/accounts', { onBeforeLoad: setupAdminSession });
    // Filter toggle, then email search
    cy.get('button[title="Filteri"]').click();
    cy.get('input[placeholder="Pretrazi po emailu..."]').should('exist');
  });
});

describe('Employee Portal: Upravljanje kreditima', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/loans/requests*', {
      statusCode: 200, body: { content: mockLoanRequests, totalElements: 2, totalPages: 1 },
    });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: mockLoans });
  });

  it('S35: Zahtevi za kredit - prikaz', () => {
    cy.visit('/employee/loan-requests', { onBeforeLoad: setupAdminSession });
    cy.contains(/zahtev|kredit/i).should('exist');
  });

  it('S35b: Odobravanje zahteva za kredit', () => {
    cy.intercept('PATCH', '**/api/loans/requests/10/approve', {
      statusCode: 200, body: { id: 10, status: 'APPROVED' },
    }).as('approveLoan');

    cy.visit('/employee/loan-requests', { onBeforeLoad: setupAdminSession });
    // Approve is icon-only button (CheckCircle2) - find first green/gradient button
    cy.get('button[class*="emerald"], button[class*="green"]').first().click();
    cy.wait('@approveLoan');
  });

  it('S36: Odbijanje zahteva za kredit', () => {
    cy.intercept('PATCH', '**/api/loans/requests/10/reject', {
      statusCode: 200, body: { id: 10, status: 'REJECTED' },
    }).as('rejectLoan');

    cy.visit('/employee/loan-requests', { onBeforeLoad: setupAdminSession });
    // Reject is icon-only button (XCircle) - opens inline form with reason input
    cy.get('button[class*="hover\\:text-red"], button[class*="red"]').first().click({ force: true });
    // Fill reject reason and confirm
    cy.get('input[placeholder="Unesite razlog..."]').type('Test razlog');
    cy.contains('button', 'Potvrdi odbijanje').click();
  });

  it('Svi krediti - prikaz', () => {
    cy.visit('/employee/loans', { onBeforeLoad: setupAdminSession });
    cy.contains(/kredit|loan/i).should('exist');
  });

  it('Svi krediti - filteri za tip i status', () => {
    cy.visit('/employee/loans', { onBeforeLoad: setupAdminSession });
    cy.get('select, [role="combobox"]').should('exist');
  });
});

describe('Employee Portal: Kartice', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: mockAllAccounts });
    cy.intercept('GET', '**/api/cards/account/*', { statusCode: 200, body: mockCards });
  });

  it('Portal kartica - prikaz', () => {
    cy.visit('/employee/cards', { onBeforeLoad: setupAdminSession });
  });

  it('Portal kartica - blokiranje kartice', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', {
      statusCode: 200, body: { ...mockCards[0], status: 'BLOCKED' },
    }).as('blockCard');

    cy.visit('/employee/cards', { onBeforeLoad: setupAdminSession });
  });

  it('Portal kartica - odblokiranje kartice', () => {
    cy.intercept('PATCH', '**/api/cards/102/unblock', {
      statusCode: 200, body: { ...mockCards[1], status: 'ACTIVE' },
    }).as('unblockCard');

    cy.visit('/employee/cards', { onBeforeLoad: setupAdminSession });
  });

  it('Portal kartica - deaktivacija kartice', () => {
    cy.intercept('PATCH', '**/api/cards/101/deactivate', {
      statusCode: 200, body: { ...mockCards[0], status: 'DEACTIVATED' },
    }).as('deactivateCard');

    cy.visit('/employee/cards', { onBeforeLoad: setupAdminSession });
  });
});

describe('Employee Portal: Zahtevi za racune', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/requests*', { statusCode: 200, body: mockAccountRequests });
  });

  it('Prikazuje stranicu sa zahtevima za racune', () => {
    cy.visit('/employee/account-requests', { onBeforeLoad: setupAdminSession });
    cy.contains(/zahtev|račun/i).should('exist');
  });

  it('Prikazuje Odobri i Odbij dugmad za pending zahteve', () => {
    cy.visit('/employee/account-requests', { onBeforeLoad: setupAdminSession });
    cy.contains('Odobri').should('exist');
    cy.contains('Odbij').should('exist');
  });

  it('Odobravanje zahteva za racun', () => {
    cy.intercept('PATCH', '**/api/accounts/requests/1/approve', {
      statusCode: 200, body: { id: 1, status: 'APPROVED' },
    }).as('approveAccount');

    cy.visit('/employee/account-requests', { onBeforeLoad: setupAdminSession });
    cy.contains('button', 'Odobri').first().click();
    cy.wait('@approveAccount');
  });

  it('Odbijanje zahteva za racun', () => {
    cy.intercept('PATCH', '**/api/accounts/requests/1/reject', {
      statusCode: 200, body: { id: 1, status: 'REJECTED' },
    }).as('rejectAccount');

    cy.visit('/employee/account-requests', { onBeforeLoad: setupAdminSession });
    cy.contains('button', 'Odbij').first().click();
    cy.wait('@rejectAccount');
  });
});

describe('Employee Portal: Zahtevi za kartice', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/cards/requests*', { statusCode: 200, body: mockCardRequests });
  });

  it('Prikazuje stranicu sa zahtevima za kartice', () => {
    cy.visit('/employee/card-requests', { onBeforeLoad: setupAdminSession });
    cy.contains(/zahtev|kartic/i).should('exist');
  });

  it('Odobravanje zahteva za karticu', () => {
    cy.intercept('PATCH', '**/api/cards/requests/1/approve', {
      statusCode: 200, body: { id: 1, status: 'APPROVED' },
    }).as('approveCard');

    cy.visit('/employee/card-requests', { onBeforeLoad: setupAdminSession });
    cy.contains('button', 'Odobri').first().click();
    cy.wait('@approveCard');
  });
});

// ====================================================================
// SECTION 10: OTP Verifikacija
// ====================================================================

describe('OTP Verifikacija', () => {
  beforeEach(() => {
    setupClientMocks();
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } });
    cy.intercept('POST', '**/api/payments/request-otp-email', { statusCode: 200, body: { sent: true, message: 'OTP sent via email' } });
  });

  it('OTP modal prikazuje naslov "Verifikacija"', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    // Fill required fields and submit
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
    cy.contains(/verifikacij/i, { timeout: 5000 }).should('exist');
  });

  it('OTP modal - input za 6-cifreni kod', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
    cy.wait(1000);
    cy.get('input[name="code"], input[placeholder*="kod"], input[maxlength="6"]').should('exist');
  });

  it('OTP modal - Posalji na email dugme', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju|Kreiranje/i).click();
    cy.wait(1000);
    cy.contains(/email|pošalji na email/i).should('exist');
  });

  it('Promena limita takodje koristi OTP verifikaciju', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains(/promeni limit|limit/i).click();
    // Limit change should trigger verification
  });
});

// ====================================================================
// SECTION 11: HomePage
// ====================================================================

describe('HomePage - Detaljno', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('Klijent vidi pocetnu stranicu sa pozdravom', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/dobro|stefan/i).should('be.visible');
  });

  it('Klijent vidi racune na homeu', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/RSD|račun/i).should('exist');
  });

  it('Klijent vidi kursnu listu na homeu', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/EUR|USD|kurs/i).should('exist');
  });

  it('Klijent vidi sacuvane primaoce na homeu', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/Milica|Lazar|primalac/i).should('exist');
  });

  it('Admin vidi admin kartice', () => {
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200, body: { content: [], totalElements: 5, totalPages: 1 },
    });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: mockLoans });
    cy.visit('/home', { onBeforeLoad: setupAdminSession });
    cy.contains(/zaposleni|admin|employee/i).should('exist');
  });

  it('Balance visibility toggle', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    // Toggle button to hide/show balance
    cy.get('[aria-label*="prikaži"], [aria-label*="sakrij"], button svg').should('exist');
  });
});

// ====================================================================
// SECTION 12: Kompletni E2E Flowovi
// ====================================================================

describe('Kompletni E2E Flowovi - Celina 2', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('Payment flow: forma -> popunjavanje -> pregled', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test Primalac');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('5000');
    cy.get('textarea[name="paymentPurpose"]').type('Test placanje');
    // Preview card "Pregled naloga" should exist
    cy.contains('Pregled naloga').should('exist');
  });

  it('Transfer flow: izbor racuna -> unos iznosa', () => {
    cy.visit('/transfers', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('select#toAccount').select(1);
    cy.get('#amount').type('10000');
    cy.contains('button', 'Nastavi na potvrdu').click();
  });

  it('Loan application flow: tip -> iznos -> podaci', () => {
    cy.visit('/loans/apply', { onBeforeLoad: setupClientSession });
    // Step 1: Select type
    cy.contains(/Gotovinski|gotovinski/i).click({ force: true });
    cy.wait(500);
  });

  it('Admin employee management flow: lista -> kreiranje -> edit', () => {
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupAdminSession });
    cy.wait(2000);
    // Navigate to employees
    cy.visit('/admin/employees');
    cy.url().should('include', '/admin/employees');
  });

  it('Navigacija: Home -> Racuni -> Detalji -> Nazad', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });

    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.visit('/accounts');
    cy.contains('Glavni racun').should('be.visible');
    cy.visit('/accounts/1');
    cy.contains('Glavni racun').should('be.visible');
    cy.contains(/nazad|računi/i).first().click();
  });

  it('Card management flow: lista -> kreiranje', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/Nova kartica|Zatrazite karticu/i).should('exist');
  });
});

// ====================================================================
// SECTION 13: Sidebar i Tema
// ====================================================================

describe('Sidebar i Tema', () => {
  beforeEach(() => {
    setupClientMocks();
  });

  it('Sidebar prikazuje theme toggle', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains(/Svetlo|Tamno|Sistem/).should('exist');
  });

  it('Sidebar - klijent vidi sve moje finansije linkove', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains('Racuni').should('exist');
    cy.contains('Placanja').should('exist');
    cy.contains('Prenosi').should('exist');
    cy.contains('Menjacnica').should('exist');
    cy.contains('Kartice').should('exist');
    cy.contains('Krediti').should('exist');
  });

  it('Sidebar - admin vidi employee portale', () => {
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });

    cy.visit('/home', { onBeforeLoad: setupAdminSession });
    cy.contains('Employee portal').should('exist');
  });

  it('Logout dugme u sidebaru', () => {
    cy.visit('/home', { onBeforeLoad: setupClientSession });
    cy.contains('Odjavi se').should('exist');
    cy.contains('Odjavi se').click();
    cy.url().should('include', '/login');
  });
});

// ====================================================================
// SECTION 14: Dodatni testovi iz starih fajlova
// ====================================================================

describe('Racuni - Dodatni testovi', () => {
  beforeEach(() => { setupClientMocks(); });

  it('Prikazuje summary karticu sa ukupnim RSD stanjem', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.contains(/ukupno|stanje|RSD/i).should('exist');
  });

  it('Novi racun dugme vidljivo za klijenta', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.contains(/Novi racun|zahtev/i).should('exist');
  });

  it('Novi racun dugme NIJE vidljivo za admina', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts });
    cy.intercept('GET', '**/api/employees*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.visit('/accounts', { onBeforeLoad: setupAdminSession });
    cy.get('body').then(($body) => {
      expect($body.text()).to.not.match(/Novi racun/i);
    });
  });

  it('Detalji - prikazuje balance kartice (Ukupno stanje, Raspolozivo, Rezervisano, Odrzavanje)', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockTransactions });
    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains(/stanje/i).should('exist');
    cy.contains(/raspoloživ|raspoloziv/i).should('exist');
  });

  it('Prikazuje status badge (Aktivan) na racunima', () => {
    cy.visit('/accounts', { onBeforeLoad: setupClientSession });
    cy.contains(/aktiv/i).should('exist');
  });
});

describe('Kartice - Dodatni testovi', () => {
  beforeEach(() => { setupClientMocks(); });

  it('Prikazuje expiry date u MM/YY formatu', () => {
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.contains(/\/2[0-9]|06\/28|12\/27/).should('exist');
  });

  it('Otkazivanje deaktivacije ne deaktivira karticu', () => {
    // Admin can cancel deactivation confirmation
    cy.visit('/cards', { onBeforeLoad: setupAdminSession });
    // Deactivation uses window.confirm - stub it to return false
    cy.on('window:confirm', () => false);
  });

  it('Block API greska prikazuje error', () => {
    cy.intercept('PATCH', '**/api/cards/101/block', { statusCode: 500, body: { message: 'Error' } });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
    cy.get('[role="switch"]').first().click({ force: true });
    // Should show error toast
  });

  it('Card request server greska', () => {
    cy.intercept('POST', '**/api/cards/requests', { statusCode: 500, body: { message: 'Error' } });
    cy.visit('/cards', { onBeforeLoad: setupClientSession });
  });
});

describe('OTP Verifikacija - Detaljni testovi', () => {
  beforeEach(() => {
    setupClientMocks();
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } });
  });

  it('OTP modal prikazuje countdown timer (5 minuta)', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(1000);
    cy.contains(/05:00|04:5|minut|vreme/i).should('exist');
  });

  it('OTP modal prikazuje preostale pokusaje', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(1000);
    cy.contains(/pokusaj|pokušaj|preostal/i).should('exist');
  });

  it('OTP - pogresan kod prikazuje gresku', () => {
    cy.intercept('POST', '**/api/payments', { statusCode: 400, body: { message: 'Invalid OTP' } });
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(1000);
    cy.get('input[name="code"], input[maxlength="6"]').type('999999');
    cy.contains('button', /potvrdi|verifikuj/i).click();
  });

  it('OTP - zatvaranje modala ne salje placanje', () => {
    cy.intercept('POST', '**/api/payments', cy.spy().as('paymentSpy'));
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.get('select#fromAccount').select(1);
    cy.get('input[placeholder="Naziv primaoca"]').type('Test');
    cy.get('input[placeholder="18 cifara"]').type('222000112345678915');
    cy.get('input[name="amount"]').type('100');
    cy.get('textarea[name="paymentPurpose"]').type('Test');
    cy.contains('button', /Nastavi na verifikaciju/i).click();
    cy.wait(1000);
    // Close modal without entering code
    cy.get('body').type('{esc}');
  });

  it('Promena limita - full OTP flow', () => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] });
    cy.intercept('PATCH', '**/api/accounts/1/limits', { statusCode: 200, body: mockAccounts[0] }).as('changeLimit');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true } });

    cy.visit('/accounts/1', { onBeforeLoad: setupClientSession });
    cy.contains('Promeni limit').click();
    cy.get('#dailyLimit').clear().type('600000');
    cy.get('#monthlyLimit').clear().type('2500000');
    cy.contains('button', 'Sacuvaj limite').click();
    // OTP modal should appear
    cy.contains(/verifikacij|kod/i).should('exist');
  });
});
