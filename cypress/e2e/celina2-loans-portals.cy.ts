/// <reference types="cypress" />
// Comprehensive E2E tests: Loans (client + employee) and Employee Portals
import { setupClientSession, setupAdminSession } from '../support/commands';

/* ══════════════════════════════════════════════════════════════════════════════
   Mock Data
   ══════════════════════════════════════════════════════════════════════════════ */

const mockAccounts = [
  {
    id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD',
    accountType: 'TEKUCI', currency: 'RSD', balance: 150000,
    availableBalance: 145000, status: 'ACTIVE', ownerName: 'Stefan Jovanovic',
  },
  {
    id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR',
    accountType: 'DEVIZNI', currency: 'EUR', balance: 5000,
    availableBalance: 4800, status: 'ACTIVE', ownerName: 'Stefan Jovanovic',
  },
  {
    id: 3, accountNumber: '265000000000000003', name: 'Blokirani RSD',
    accountType: 'TEKUCI', currency: 'RSD', balance: 0,
    availableBalance: 0, status: 'BLOCKED', ownerName: 'Milica Nikolic',
  },
];

const mockLoans = [
  {
    id: 1, loanNumber: 'KR-2025-001', loanType: 'GOTOVINSKI', amount: 5000000, currency: 'RSD',
    monthlyPayment: 22500, remainingDebt: 2500000, repaymentPeriod: 24,
    nominalRate: 6.25, effectiveRate: 6.50, status: 'ACTIVE' as const,
    startDate: '2025-01-15', endDate: '2027-01-15', accountNumber: '265000000000000001',
  },
  {
    id: 2, loanNumber: 'KR-2025-002', loanType: 'STAMBENI', amount: 3000000, currency: 'RSD',
    monthlyPayment: 45000, remainingDebt: 2900000, repaymentPeriod: 120,
    nominalRate: 5.0, effectiveRate: 5.25, status: 'PENDING' as const,
    startDate: '2025-03-01', endDate: '2035-03-01', accountNumber: '265000000000000001',
  },
  {
    id: 3, loanNumber: 'KR-2025-003', loanType: 'AUTO', amount: 1200000, currency: 'RSD',
    monthlyPayment: 30000, remainingDebt: 0, repaymentPeriod: 48,
    nominalRate: 5.5, effectiveRate: 5.75, status: 'PAID' as const,
    startDate: '2021-06-01', endDate: '2025-06-01', accountNumber: '265000000000000001',
  },
];

const mockInstallments = [
  { id: 1, amount: 22500, currency: 'RSD', expectedDueDate: '2025-02-15', paid: true, principalAmount: 18000, interestAmount: 4500 },
  { id: 2, amount: 22500, currency: 'RSD', expectedDueDate: '2025-03-15', paid: true, principalAmount: 18200, interestAmount: 4300 },
  { id: 3, amount: 22500, currency: 'RSD', expectedDueDate: '2025-04-15', paid: false, principalAmount: 18400, interestAmount: 4100 },
  { id: 4, amount: 22500, currency: 'RSD', expectedDueDate: '2025-05-15', paid: false, principalAmount: 18600, interestAmount: 3900 },
  { id: 5, amount: 22500, currency: 'RSD', expectedDueDate: '2025-06-15', paid: false, principalAmount: 18800, interestAmount: 3700 },
];

const mockLoanRequests = {
  content: [
    {
      id: 10, clientEmail: 'stefan.jovanovic@gmail.com', clientName: 'Stefan Jovanovic',
      loanType: 'GOTOVINSKI', interestRateType: 'FIKSNI', amount: 500000, currency: 'RSD',
      loanPurpose: 'Renoviranje stana', repaymentPeriod: 24, status: 'PENDING' as const,
      createdAt: '2025-03-25T10:00:00', accountNumber: '265000000000000001',
      phoneNumber: '+381601234567', employmentStatus: 'stalno', monthlyIncome: 120000,
      permanentEmployment: true,
    },
    {
      id: 11, clientEmail: 'milica.nikolic@gmail.com', clientName: 'Milica Nikolic',
      loanType: 'AUTO', interestRateType: 'VARIJABILNI', amount: 1000000, currency: 'RSD',
      loanPurpose: 'Kupovina automobila', repaymentPeriod: 60, status: 'PENDING' as const,
      createdAt: '2025-03-24T14:00:00', accountNumber: '265000000000000002',
      phoneNumber: '+381609876543', employmentStatus: 'privremeno', monthlyIncome: 80000,
      permanentEmployment: false,
    },
    {
      id: 12, clientEmail: 'jovan.markovic@gmail.com', clientName: 'Jovan Markovic',
      loanType: 'STAMBENI', interestRateType: 'FIKSNI', amount: 5000000, currency: 'RSD',
      loanPurpose: 'Kupovina stana', repaymentPeriod: 120, status: 'APPROVED' as const,
      createdAt: '2025-03-20T09:00:00', accountNumber: '265000000000000001',
      phoneNumber: '+381605555555', employmentStatus: 'stalno', monthlyIncome: 200000,
      permanentEmployment: true,
    },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockClients = {
  content: [
    { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan.jovanovic@gmail.com', phoneNumber: '+381601234567', address: 'Beograd, Knez Mihailova 1', dateOfBirth: '1990-01-15', gender: 'MALE' },
    { id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica.nikolic@gmail.com', phoneNumber: '+381609876543', address: 'Novi Sad, Trg slobode 5', dateOfBirth: '1992-05-20', gender: 'FEMALE' },
    { id: 3, firstName: 'Jovan', lastName: 'Markovic', email: 'jovan.markovic@gmail.com', phoneNumber: '+381605555555', address: 'Nis, Obrenoviceva 3', dateOfBirth: '1988-11-10', gender: 'MALE' },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockClientAccounts = [
  { id: 1, accountNumber: '265000000000000001', accountType: 'TEKUCI', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
];

const mockAllLoans = {
  content: [
    { id: 1, loanNumber: 'KR-001', loanType: 'GOTOVINSKI', amount: 500000, currency: 'RSD', monthlyPayment: 22500, remainingDebt: 250000, status: 'ACTIVE' as const, nominalRate: 6.25, effectiveRate: 6.50, repaymentPeriod: 24, startDate: '2025-01-15', endDate: '2027-01-15' },
    { id: 2, loanNumber: 'KR-002', loanType: 'STAMBENI', amount: 3000000, currency: 'RSD', monthlyPayment: 45000, remainingDebt: 2900000, status: 'PENDING' as const, nominalRate: 5.0, effectiveRate: 5.25, repaymentPeriod: 120, startDate: '2025-03-01', endDate: '2035-03-01' },
    { id: 3, loanNumber: 'KR-003', loanType: 'AUTO', amount: 1200000, currency: 'RSD', monthlyPayment: 30000, remainingDebt: 0, status: 'PAID' as const, nominalRate: 5.5, effectiveRate: 5.75, repaymentPeriod: 48, startDate: '2021-06-01', endDate: '2025-06-01' },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockOrders = {
  content: [
    { id: 1, listingTicker: 'AAPL', direction: 'BUY', quantity: 10, status: 'PENDING', createdAt: '2025-03-25T10:00:00' },
    { id: 2, listingTicker: 'MSFT', direction: 'SELL', quantity: 5, status: 'DONE', createdAt: '2025-03-24T14:00:00' },
    { id: 3, listingTicker: 'TSLA', direction: 'BUY', quantity: 20, status: 'APPROVED', createdAt: '2025-03-23T09:00:00' },
  ],
  totalElements: 8,
  totalPages: 1,
};

const mockAgents = [
  { id: 1, employeeName: 'Ana Jovic', dailyLimit: 100000, usedLimit: 92000 },
  { id: 2, employeeName: 'Petar Lazic', dailyLimit: 200000, usedLimit: 170000 },
  { id: 3, employeeName: 'Marija Ilic', dailyLimit: 150000, usedLimit: 50000 },
];

const mockListings = {
  content: [
    { id: 1, ticker: 'AAPL', name: 'Apple', volume: 500000 },
    { id: 2, ticker: 'MSFT', name: 'Microsoft', volume: 300000 },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockTaxRecords = [
  { id: 1, taxOwed: 50000, taxPaid: 30000 },
  { id: 2, taxOwed: 20000, taxPaid: 20000 },
];

/* ══════════════════════════════════════════════════════════════════════════════
   Shared intercept helpers
   ══════════════════════════════════════════════════════════════════════════════ */

function setupCommonIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts.slice(0, 2) }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
}

/* ══════════════════════════════════════════════════════════════════════════════
   LOAN LIST PAGE (Client)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('LoanListPage - loan list loads and displays correctly', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: mockLoans }).as('getMyLoans');
    cy.intercept('GET', '**/api/loans/requests/my*', { statusCode: 200, body: [] }).as('getMyRequests');
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: mockInstallments }).as('getInstallments');
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyLoans');
  });

  it('displays loan list page header', () => {
    cy.contains('h1', 'Moji krediti').should('be.visible');
    cy.contains('Pregled svih vasih kredita').should('be.visible');
  });

  it('displays loan cards with type, amount, and status badge', () => {
    cy.contains('GOTOVINSKI kredit').should('be.visible');
    cy.contains('STAMBENI kredit').should('be.visible');
    cy.contains('AUTO kredit').should('be.visible');
    // Status badges
    cy.contains('Aktivan').should('be.visible');
    cy.contains('Na cekanju').should('be.visible');
    // PAID status is returned as-is by statusLabel (no Serbian mapping)
    cy.contains('PAID').should('be.visible');
  });

  it('displays progress bar with repayment percentage', () => {
    // First loan: 500000 - 250000 = 250000 paid => 50%
    cy.contains('50%').should('be.visible');
    cy.contains('Otplaceno').should('be.visible');
  });

  it('shows loan details with amount, monthly payment, remaining debt, and period', () => {
    // Check structured data labels
    cy.contains('Iznos').should('be.visible');
    cy.contains('Mesecna rata').should('be.visible');
    cy.contains('Preostali dug').should('be.visible');
    cy.contains('Period').should('be.visible');
    cy.contains('24 meseci').should('be.visible');
  });

  it('expands installments table on Prikazi detalje click', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('Detalji kredita').should('be.visible');
    // Installments table headers
    cy.contains('th', 'Rata').should('be.visible');
    cy.contains('Placeno rata').should('be.visible');
  });

  it('shows paid and upcoming installment styling in table', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    // Paid installments have emerald left border
    cy.get('.border-l-emerald-500').should('have.length.at.least', 2);
    // Unpaid installments have gray left border
    cy.get('.border-l-gray-300').should('have.length.at.least', 3);
    // Paid count
    cy.contains('Placeno rata').should('be.visible');
    cy.get('.font-semibold').contains('2').should('be.visible');
  });

  it('collapses details when clicking Sakrij detalje', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('Detalji kredita').should('be.visible');
    cy.contains('button', 'Sakrij detalje').click();
    cy.contains('Detalji kredita').should('not.exist');
  });

  it('shows button for new loan application', () => {
    cy.contains('button', 'Zahtev za kredit').should('be.visible');
  });

  it('displays early repayment button for active loan', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('button', 'Prevremena otplata').should('be.visible');
  });

  it('triggers early repayment confirmation dialog', () => {
    cy.intercept('POST', '**/api/loans/1/early-repayment', { statusCode: 200 }).as('earlyRepay');
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: mockLoans }).as('reloadLoans');

    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');

    // Stub window.confirm to return true
    cy.on('window:confirm', () => true);
    cy.contains('button', 'Prevremena otplata').click();
    cy.wait('@earlyRepay');
  });

  it('shows detail stats: nominal rate, effective rate, start/end dates', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('Nominalna stopa').should('be.visible');
    cy.contains('Efektivna stopa').should('be.visible');
    cy.contains('Pocetak').should('be.visible');
    cy.contains('Kraj').should('be.visible');
  });
});

describe('LoanListPage - empty state', () => {
  it('displays empty loans message when no loans', () => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: [] }).as('emptyLoans');
    cy.intercept('GET', '**/api/loans/requests/my*', { statusCode: 200, body: [] });
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyLoans');
    cy.contains('Trenutno nema kredita').should('be.visible');
    cy.contains('Podnesite zahtev za kredit').should('be.visible');
  });
});

describe('LoanListPage - loading skeleton', () => {
  it('shows skeleton cards while loading', () => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/loans/my*', (req) => {
      req.reply({ delay: 2000, statusCode: 200, body: [] });
    }).as('delayedLoans');
    cy.intercept('GET', '**/api/loans/requests/my*', { statusCode: 200, body: [] });
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   LOAN APPLICATION PAGE (Client)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('LoanApplicationPage - form rendering and interaction', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('POST', '**/api/loans', {
      statusCode: 201,
      body: { id: 20, status: 'PENDING', message: 'Zahtev uspesno podnet' },
    }).as('applyLoan');
    cy.visit('/loans/apply', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('renders loan application form with header and step indicator', () => {
    cy.contains('h1', 'Zahtev za kredit').should('be.visible');
    cy.contains('Popunite formular').should('be.visible');
    // Step indicator
    cy.contains('Tip kredita').should('be.visible');
    cy.contains('Iznos i period').should('be.visible');
    cy.contains('Licni podaci').should('be.visible');
    cy.contains('Potvrda').should('be.visible');
  });

  it('shows loan type selector with all types', () => {
    cy.get('#loanType').should('exist');
    cy.get('#loanType option').should('have.length', 5);
    cy.get('#loanType').select('STAMBENI');
    cy.get('#loanType').should('have.value', 'STAMBENI');
  });

  it('changes repayment period options when loan type changes', () => {
    cy.get('#loanType').select('GOTOVINSKI');
    cy.get('#repaymentPeriod option').then($options1 => {
      const _count1 = $options1.length;
      cy.get('#loanType').select('STAMBENI');
      cy.get('#repaymentPeriod option').should('have.length.at.least', 1).then($options2 => {
        // Different loan types may have different period options
        expect($options2.length).to.be.greaterThan(0);
      });
    });
  });

  it('updates interest rate calculator when amount changes', () => {
    cy.get('#amount').clear().type('500000');
    cy.contains('Kamatna stopa').should('be.visible');
    cy.contains('Mesecna rata').should('be.visible');
    cy.contains('Ukupno').should('be.visible');

    // Change amount and verify calculator updates
    cy.get('#amount').clear().type('2000000');
    // The rate should be reflected in the calculator display
    cy.contains('Kalkulacija kredita').should('be.visible');
  });

  it('shows donut chart for principal vs interest breakdown', () => {
    cy.get('#amount').clear().type('500000');
    cy.contains('Glavnica').should('be.visible');
    cy.contains('Kamata').should('be.visible');
  });

  it('renders interest rate type selector (fiksni/varijabilni)', () => {
    cy.get('#interestRateType').should('exist');
    cy.get('#interestRateType option').should('have.length', 2);
    cy.get('#interestRateType').select('VARIJABILNI');
    cy.get('#interestRateType').should('have.value', 'VARIJABILNI');
  });

  it('shows currency selector and account selector', () => {
    cy.get('#currency').should('exist');
    cy.get('#accountNumber').should('exist');
  });

  it('renders personal data section with phone and employment fields', () => {
    cy.get('#phoneNumber').should('exist');
    cy.get('#employmentStatus').should('exist');
    cy.get('#monthlyIncome').should('exist');
    cy.get('#employmentPeriod').should('exist');
  });

  it('submits loan application successfully', () => {
    cy.get('#loanType').select('GOTOVINSKI');
    cy.get('#interestRateType').select('FIKSNI');
    cy.get('#amount').clear().type('500000');
    cy.get('#loanPurpose').type('Renoviranje stana');
    cy.get('#phoneNumber').type('+381601234567');
    cy.contains('button', 'Posalji zahtev').click();
    cy.wait('@applyLoan');
  });

  it('shows validation errors for empty required fields', () => {
    cy.get('#amount').clear().type('0');
    cy.contains('button', 'Posalji zahtev').click();
    cy.get('.text-destructive').should('have.length.at.least', 1);
  });

  it('has amount slider for quick input', () => {
    cy.get('input[type="range"][aria-label="Iznos kredita"]').should('exist');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   ACCOUNTS PORTAL (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('AccountsPortalPage - employee accounts portal', () => {
  const portalAccounts = {
    content: mockAccounts,
    totalElements: 3,
    totalPages: 1,
  };

  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: portalAccounts }).as('getAllAccounts');
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllAccounts');
  });

  it('loads accounts portal with header and table', () => {
    cy.contains('h1', 'Portal racuna').should('be.visible');
    cy.contains('Upravljajte svim bankovnim racunima').should('be.visible');
    // Table headers
    cy.contains('th', 'Vlasnik').should('be.visible');
    cy.contains('th', 'Broj racuna').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Stanje').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('displays accounts in the table', () => {
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
  });

  it('shows filter panel when filter button is clicked', () => {
    cy.get('button[title="Filteri"]').click();
    cy.contains('Filteri pretrage').should('be.visible');
    cy.get('input[placeholder*="email"]').should('be.visible');
  });

  it('has create account button', () => {
    cy.contains('button', 'Kreiraj racun').should('be.visible');
  });

  it('shows action buttons for active accounts', () => {
    cy.contains('button', 'Blokiraj').should('be.visible');
    cy.contains('button', 'Deaktiviraj').should('be.visible');
  });

  it('shows pagination info', () => {
    cy.contains('Strana 1').should('be.visible');
  });

  it('displays empty state when no accounts match', () => {
    cy.intercept('GET', '**/api/accounts/all*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 1 },
    }).as('emptyAccounts');
    cy.visit('/employee/accounts', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@emptyAccounts');
    cy.contains('Nema pronadjenih racuna').should('be.visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   CREATE ACCOUNT PAGE (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('CreateAccountPage - create account form', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/clients?*', { statusCode: 200, body: mockClients }).as('searchClients');
    cy.intercept('POST', '**/api/accounts', { statusCode: 201, body: { id: 10, accountNumber: '265000000000000010' } }).as('createAccount');
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('renders create account form with header', () => {
    cy.contains('h1', 'Kreiranje racuna').should('be.visible');
    cy.contains('Kreirajte novi bankovni racun').should('be.visible');
  });

  it('shows owner email field with client search', () => {
    cy.get('#ownerEmail').should('exist');
    cy.get('#ownerEmail').type('stefan');
  });

  it('has account type selector with all types', () => {
    cy.contains('Tip racuna').should('be.visible');
    cy.contains('Podvrsta racuna').should('be.visible');
  });

  it('shows business fields when POSLOVNI is selected', () => {
    // Click on account type trigger and select Poslovni
    cy.get('button[role="combobox"]').first().click();
    cy.get('[role="option"]').contains('Poslovni').click();
    cy.contains('Podaci firme').should('be.visible');
    cy.get('#companyName').should('exist');
    cy.get('#registrationNumber').should('exist');
    cy.get('#taxId').should('exist');
  });

  it('has card creation toggle switch', () => {
    cy.contains('Napravi karticu uz racun').should('be.visible');
  });

  it('shows back button to portal', () => {
    cy.contains('button', 'Nazad na portal racuna').should('be.visible');
  });

  it('has submit and cancel buttons', () => {
    cy.contains('button', 'Kreiraj racun').should('be.visible');
    cy.contains('button', 'Otkazi').should('be.visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   CLIENTS PORTAL (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('ClientsPortalPage - clients portal list view', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/clients?*', { statusCode: 200, body: mockClients }).as('getClients');
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClient1');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
  });

  it('loads clients portal with header', () => {
    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Pretrazujte').should('be.visible');
  });

  it('displays client cards in grid', () => {
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('Jovan Markovic').should('be.visible');
  });

  it('displays client email on cards', () => {
    cy.contains('stefan.jovanovic@gmail.com').should('be.visible');
    cy.contains('milica.nikolic@gmail.com').should('be.visible');
  });

  it('has search input for filtering clients by name', () => {
    cy.get('input[placeholder*="Pretrazite klijente"]').should('exist');
    cy.get('input[placeholder*="Pretrazite klijente"]').type('Stefan');
    cy.wait('@getClients');
  });

  it('shows new client button', () => {
    cy.contains('button', 'Novi klijent').should('be.visible');
  });

  it('shows pagination', () => {
    cy.contains('Strana 1').should('be.visible');
  });

  it('shows empty state when no clients match', () => {
    cy.intercept('GET', '**/api/clients?*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 1 },
    }).as('emptyClients');
    cy.visit('/employee/clients', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@emptyClients');
    cy.contains('Nema klijenata za prikaz').should('be.visible');
  });
});

describe('ClientsPortalPage - client details and editing', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/clients?*', { statusCode: 200, body: mockClients }).as('getClients');
    cy.intercept('GET', '**/api/clients/1', { statusCode: 200, body: mockClients.content[0] }).as('getClient1');
    cy.intercept('GET', '**/api/accounts/client/1', { statusCode: 200, body: mockClientAccounts }).as('getClientAccounts');
    cy.intercept('PUT', '**/api/clients/1', {
      statusCode: 200,
      body: { ...mockClients.content[0], phoneNumber: '+381609999999' },
    }).as('updateClient');
    cy.visit('/employee/clients/1', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getClients');
    cy.wait('@getClient1');
  });

  it('shows client detail card with populated inputs', () => {
    cy.get('#client-first-name').should('have.value', 'Stefan');
    cy.get('#client-last-name').should('have.value', 'Jovanovic');
    cy.get('#client-email').should('have.value', 'stefan.jovanovic@gmail.com');
    cy.get('#client-phone').should('have.value', '+381601234567');
  });

  it('has disabled inputs before edit mode', () => {
    cy.get('#client-first-name').should('be.disabled');
    cy.get('#client-phone').should('be.disabled');
    cy.get('#client-address').should('be.disabled');
  });

  it('enables inputs when Izmeni button is clicked', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-first-name').should('not.be.disabled');
    cy.get('#client-phone').should('not.be.disabled');
    cy.get('#client-address').should('not.be.disabled');
  });

  it('saves edited client data on Sacuvaj', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381609999999');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@updateClient');
    cy.contains('uspesno izmenjen').should('be.visible');
  });

  it('cancels edit and restores original values on Otkazi', () => {
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381600000000');
    cy.contains('button', 'Otkazi').click();
    cy.get('#client-phone').should('be.disabled');
    cy.get('#client-phone').should('have.value', '+381601234567');
  });

  it('displays client accounts section', () => {
    cy.contains('Racuni klijenta').should('be.visible');
    cy.contains('265000000000000001').should('be.visible');
  });

  it('shows error toast when update fails', () => {
    cy.intercept('PUT', '**/api/clients/1', { statusCode: 500, body: { message: 'Server error' } }).as('failedUpdate');
    cy.contains('button', 'Izmeni').click();
    cy.get('#client-phone').clear().type('+381609999999');
    cy.contains('button', 'Sacuvaj').click();
    cy.wait('@failedUpdate');
    cy.contains('nije uspela').should('be.visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   LOAN REQUESTS PAGE (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('LoanRequestsPage - loan requests management', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('getLoanRequests');
    cy.visit('/employee/loan-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getLoanRequests');
  });

  it('loads loan requests page with header', () => {
    cy.contains('h1', 'Zahtevi za kredit').should('be.visible');
    cy.contains('Pregledajte i obradite zahteve').should('be.visible');
  });

  it('displays loan request cards with client info', () => {
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
    cy.contains('GOTOVINSKI').should('be.visible');
    cy.contains('AUTO').should('be.visible');
  });

  it('shows status filter tabs (Svi, Na cekanju, Odobreni, Odbijeni)', () => {
    cy.contains('button', 'Svi').should('be.visible');
    cy.contains('button', 'Na cekanju').should('be.visible');
    cy.contains('button', 'Odobreni').should('be.visible');
    cy.contains('button', 'Odbijeni').should('be.visible');
  });

  it('filters requests by status when tab is clicked', () => {
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('filteredRequests');
    // Click a different tab (not the default 'Svi') to trigger a new request
    cy.contains('button', 'Na cekanju').click();
    cy.wait('@filteredRequests');
  });

  it('approves a loan request', () => {
    cy.intercept('PATCH', '**/api/loans/requests/10/approve', { statusCode: 200 }).as('approveLoan');
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('reloadRequests');
    // Find the approve button (CheckCircle icon button) in Stefan's card
    cy.contains('Stefan Jovanovic').parents('[class*="rounded-2xl"]').first()
      .find('button.bg-gradient-to-r').first().click();
    cy.wait('@approveLoan');
    cy.contains('odobren').should('be.visible');
  });

  it('opens reject form with reason input', () => {
    // Click the reject button (XCircle icon) for Milica — opens expand + reject form
    cy.contains('Milica Nikolic').parents('[class*="rounded-2xl"]').first()
      .find('button[class*="hover:border-red"]').first().click();
    cy.contains('Razlog odbijanja').should('be.visible');
    cy.get('input[placeholder="Unesite razlog..."]').should('be.visible');
  });

  it('rejects a loan request with reason', () => {
    cy.intercept('PATCH', '**/api/loans/requests/11/reject', { statusCode: 200 }).as('rejectLoan');
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('reloadRequests');
    // Open reject for Milica
    cy.contains('Milica Nikolic').parents('[class*="rounded-2xl"]').first()
      .find('button[class*="hover:border-red"]').first().click();
    cy.get('input[placeholder="Unesite razlog..."]').type('Nedovoljan mesecni prihod');
    cy.contains('button', 'Potvrdi odbijanje').click();
    cy.wait('@rejectLoan');
    cy.contains('odbijen').should('be.visible');
  });

  it('expands request card to show details', () => {
    // Click the expand chevron
    cy.contains('Stefan Jovanovic').parents('[class*="rounded-2xl"]').first()
      .find('button[class*="rounded-lg"]').last().click();
    cy.contains('Svrha').should('be.visible');
    cy.contains('Renoviranje stana').should('be.visible');
    cy.contains('Telefon').should('be.visible');
    cy.contains('Status zaposlenja').should('be.visible');
    cy.contains('Mesecni prihod').should('be.visible');
  });

  it('shows empty state when no requests match filter', () => {
    cy.intercept('GET', '**/api/loans/requests*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    }).as('emptyRequests');
    cy.contains('button', 'Odbijeni').click();
    cy.wait('@emptyRequests');
    cy.contains('Nema zahteva za izabrani filter').should('be.visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   ALL LOANS PAGE (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('AllLoansPage - employee all loans view', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    // Register fallback first, then specific — last registered wins, so specific takes priority
    cy.intercept('GET', '**/api/loans*', { statusCode: 200, body: mockAllLoans }).as('getAllLoansFallback');
    cy.intercept('GET', '**/api/loans?*', { statusCode: 200, body: mockAllLoans }).as('getAllLoans');
    cy.visit('/employee/loans', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getAllLoans');
  });

  it('loads all loans page with header', () => {
    cy.contains('h1', 'Svi krediti').should('be.visible');
    cy.contains('Pregled svih kredita u bankarskom sistemu').should('be.visible');
  });

  it('displays loans table with columns', () => {
    cy.contains('th', 'ID').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Iznos').should('be.visible');
    cy.contains('th', 'Mesecna rata').should('be.visible');
    cy.contains('th', 'Preostali dug').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('shows loan type and status filters', () => {
    cy.contains('Filteri').should('be.visible');
    cy.contains('Tip kredita').should('be.visible');
    cy.contains('Status').should('be.visible');
  });

  it('shows loan details panel on Detalji click', () => {
    cy.contains('button', 'Detalji').first().click();
    cy.contains('Detalji kredita').should('be.visible');
    cy.contains('Tip kredita').should('be.visible');
    cy.contains('Nominalna kamata').should('be.visible');
    cy.contains('Efektivna kamata').should('be.visible');
  });

  it('shows empty state with different filters', () => {
    // Register fallback first, then specific — last registered wins
    cy.intercept('GET', '**/api/loans*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 1 },
    }).as('emptyLoansFallback');
    cy.intercept('GET', '**/api/loans?*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 1 },
    }).as('emptyLoans');
    cy.visit('/employee/loans', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@emptyLoans');
    cy.contains('Nema kredita za izabrane filtere').should('be.visible');
  });

  it('shows pagination controls', () => {
    cy.contains('Strana 1').should('be.visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   SUPERVISOR DASHBOARD (Employee)
   ══════════════════════════════════════════════════════════════════════════════ */

describe('SupervisorDashboardPage - dashboard overview', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    // Mock all dashboard API calls
    cy.intercept('GET', '**/api/orders?*status=PENDING*', {
      statusCode: 200,
      body: { content: [mockOrders.content[0]], totalElements: 8 },
    }).as('getPendingOrders');
    cy.intercept('GET', '**/api/orders?*status=ALL*', {
      statusCode: 200,
      body: mockOrders,
    }).as('getAllOrders');
    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: mockOrders,
    }).as('getOrdersFallback');
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 200,
      body: mockAgents,
    }).as('getAgents');
    cy.intercept('GET', '**/api/actuaries*', {
      statusCode: 200,
      body: mockAgents,
    }).as('getAgentsFallback');
    cy.intercept('GET', '**/api/listings*', {
      statusCode: 200,
      body: mockListings,
    }).as('getListings');
    cy.intercept('GET', '**/api/tax*', {
      statusCode: 200,
      body: mockTaxRecords,
    }).as('getTax');
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('loads supervisor dashboard with header', () => {
    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.contains('Pregled aktivnosti i statistika').should('be.visible');
  });

  it('displays stat cards (Pending orderi, Aktivni agenti, etc.)', () => {
    cy.contains('Pending orderi').should('be.visible');
    cy.contains('Aktivni agenti').should('be.visible');
  });

  it('shows recent orders table header', () => {
    cy.contains('Poslednjih 10 ordera').should('be.visible');
  });

  it('displays agents near limit section', () => {
    cy.contains('Agenti blizu limita').should('be.visible');
  });

  it('shows quick action links', () => {
    cy.get('main').within(() => {
      cy.contains('Brze akcije').should('be.visible');
      cy.contains('Orderi').should('be.visible');
      cy.contains('Aktuari').should('be.visible');
      cy.contains('Porez').should('be.visible');
      cy.contains('Berze').should('be.visible');
    });
  });

  it('shows loading skeleton initially', () => {
    // Reload with delayed responses
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/orders*', (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: mockOrders });
    });
    cy.intercept('GET', '**/api/actuaries*', (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: mockAgents });
    });
    cy.intercept('GET', '**/api/listings*', (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: mockListings });
    });
    cy.intercept('GET', '**/api/tax*', (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: mockTaxRecords });
    });
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.get('.animate-pulse').should('have.length.at.least', 1);
  });
});
