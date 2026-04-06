/// <reference types="cypress" />
// E2E tests for routes that previously had NO E2E coverage:
//   - Error pages (403, 404, 500)
//   - Business Account Details (/accounts/:id/business)
//   - Transfer History (/transfers/history)  [extended coverage beyond celina2-transfers-exchange]
//   - Landing Page (/)
//   - Supervisor Dashboard (/employee/dashboard)

import { setupAdminSession, setupClientSession } from '../support/commands';

// ─── Mock Data ─────────────────────────────────────────────────────────

const mockAccounts = [
  {
    id: 10,
    accountNumber: '265000000000000010',
    name: 'Poslovni RSD',
    ownerName: 'Stefan Jovanovic',
    accountType: 'BUSINESS',
    currency: 'RSD',
    balance: 2500000,
    availableBalance: 2300000,
    reservedBalance: 200000,
    maintenanceFee: 500,
    dailyLimit: 1000000,
    monthlyLimit: 5000000,
    dailySpending: 350000,
    monthlySpending: 1200000,
    status: 'ACTIVE',
    createdAt: '2025-06-01',
    company: {
      companyName: 'TechSerbia d.o.o.',
      registrationNumber: '12345678',
      taxId: '987654321',
      activityCode: '6201',
      address: 'Bulevar Mihajla Pupina 10, Beograd',
    },
  },
  {
    id: 11,
    accountNumber: '265000000000000011',
    name: 'Tekuci RSD',
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
];

const mockBusinessAccountDetail = {
  ...mockAccounts[0],
  firm: mockAccounts[0].company,
};

const mockTransactions = {
  content: [
    {
      id: 1,
      fromAccountNumber: '265000000000000010',
      toAccountNumber: '265000000000000099',
      recipientName: 'Dobavljac A',
      amount: 120000,
      currency: 'RSD',
      paymentPurpose: 'Faktura br. 2026-001',
      paymentCode: '289',
      status: 'COMPLETED',
      createdAt: '2026-03-28T10:00:00',
    },
    {
      id: 2,
      fromAccountNumber: '265000000000000088',
      toAccountNumber: '265000000000000010',
      recipientName: 'Klijent B',
      amount: 450000,
      currency: 'RSD',
      paymentPurpose: 'Uplata za usluge',
      paymentCode: '220',
      status: 'COMPLETED',
      createdAt: '2026-03-27T14:00:00',
    },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockTransferHistory = [
  {
    id: 101,
    fromAccountNumber: '265000000000000010',
    toAccountNumber: '265000000000000011',
    amount: 50000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'COMPLETED',
    createdAt: '2026-03-28T12:00:00',
  },
  {
    id: 102,
    fromAccountNumber: '265000000000000011',
    toAccountNumber: '265000000000000010',
    amount: 25000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'COMPLETED',
    createdAt: '2026-03-27T09:00:00',
  },
  {
    id: 103,
    fromAccountNumber: '265000000000000010',
    toAccountNumber: '265000000000000012',
    amount: 100000,
    fromCurrency: 'RSD',
    toCurrency: 'EUR',
    convertedAmount: 850,
    exchangeRate: 0.0085,
    commission: 500,
    status: 'PENDING',
    createdAt: '2026-03-26T15:30:00',
  },
  {
    id: 104,
    fromAccountNumber: '265000000000000011',
    toAccountNumber: '265000000000000010',
    amount: 10000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'REJECTED',
    createdAt: '2026-03-25T08:00:00',
  },
];

const mockOrders = {
  content: [
    {
      id: 1,
      listingTicker: 'AAPL',
      direction: 'BUY',
      quantity: 10,
      status: 'PENDING',
      createdAt: '2026-03-28T10:00:00',
    },
    {
      id: 2,
      listingTicker: 'MSFT',
      direction: 'SELL',
      quantity: 5,
      status: 'DONE',
      createdAt: '2026-03-27T14:30:00',
    },
    {
      id: 3,
      listingTicker: 'GOOG',
      direction: 'BUY',
      quantity: 3,
      status: 'APPROVED',
      createdAt: '2026-03-26T09:15:00',
    },
  ],
  totalElements: 3,
  totalPages: 1,
};

const mockPendingOrders = {
  content: [mockOrders.content[0]],
  totalElements: 1,
  totalPages: 1,
};

const mockAgents = [
  {
    id: 1,
    employeeName: 'Agent Petrovic',
    dailyLimit: 500000,
    usedLimit: 450000,
  },
  {
    id: 2,
    employeeName: 'Agent Jovanovic',
    dailyLimit: 300000,
    usedLimit: 100000,
  },
];

const mockListings = {
  content: [
    { id: 1, ticker: 'AAPL', name: 'Apple Inc', volume: 1500000, price: 150 },
    { id: 2, ticker: 'MSFT', name: 'Microsoft', volume: 800000, price: 300 },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockTaxRecords = [
  { id: 1, userId: 1, name: 'Korisnik 1', taxOwed: 50000, taxPaid: 30000 },
  { id: 2, userId: 2, name: 'Korisnik 2', taxOwed: 20000, taxPaid: 20000 },
];

// ─── Shared Intercept Setup ───────────────────────────────────────────

function setupCommonIntercepts() {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake-access-token' },
  });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
}

// ═══════════════════════════════════════════════════════════════════════
//  ERROR PAGES
// ═══════════════════════════════════════════════════════════════════════

describe('Error Pages', () => {
  it('shows 403 Forbidden page with correct content', () => {
    cy.visit('/403');

    cy.contains('403').should('be.visible');
    cy.contains('Nemate dozvolu za pristup').should('be.visible');
    cy.contains('Nemate potrebna prava da pristupite ovoj stranici').should('be.visible');
    cy.contains('Nemate potrebne permisije za ovu stranicu').should('be.visible');
    cy.contains('Kontaktirajte administratora').should('be.visible');
    cy.contains('button', 'Nazad na početnu').should('be.visible');
  });

  it('403 page "Nazad na pocetnu" button navigates to /', () => {
    cy.visit('/403');

    cy.contains('button', 'Nazad na početnu').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('shows 404 Not Found page for nonexistent route', () => {
    cy.visit('/some-nonexistent-route-that-does-not-exist');

    cy.contains('404').should('be.visible');
    cy.contains('Stranica nije pronađena').should('be.visible');
    cy.contains('Stranica koju pokušavate da otvorite ne postoji ili je premeštena').should(
      'be.visible'
    );
    cy.contains('Proverite da li ste ispravno uneli adresu').should('be.visible');
    cy.contains('button', 'Nazad na početnu').should('be.visible');
    cy.contains('button', 'Prijavi se').should('be.visible');
  });

  it('404 page "Prijavi se" button navigates to /login', () => {
    cy.visit('/definitely-not-a-page');

    cy.contains('button', 'Prijavi se').click();
    cy.url().should('include', '/login');
  });

  it('404 page "Nazad na pocetnu" button navigates to /', () => {
    cy.visit('/definitely-not-a-page');

    cy.contains('button', 'Nazad na početnu').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('shows 500 Server Error page with correct content', () => {
    cy.visit('/500');

    cy.contains('500').should('be.visible');
    cy.contains('Došlo je do greške na serveru').should('be.visible');
    cy.contains('Trenutno nismo u mogućnosti da obradimo vaš zahtev').should('be.visible');
    cy.contains('Pokušajte ponovo za par minuta').should('be.visible');
    cy.contains('Ako se problem ponavlja, kontaktirajte podršku').should('be.visible');
    cy.contains('button', 'Pokušaj ponovo').should('be.visible');
    cy.contains('button', 'Nazad na početnu').should('be.visible');
  });

  it('500 page "Nazad na pocetnu" button navigates to /', () => {
    cy.visit('/500');

    cy.contains('button', 'Nazad na početnu').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  BUSINESS ACCOUNT DETAILS
// ═══════════════════════════════════════════════════════════════════════

describe('Business Account Details Page', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    });
    cy.intercept('GET', '**/api/accounts/10', {
      statusCode: 200,
      body: mockBusinessAccountDetail,
    }).as('getBusinessAccount');
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: mockTransactions,
    }).as('getTransactions');
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  });

  it('renders company info card with all firm details', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Informacije o firmi').should('be.visible');
    cy.contains('TechSerbia d.o.o.').should('be.visible');
    cy.contains('12345678').should('be.visible');
    cy.contains('987654321').should('be.visible');
    cy.contains('6201').should('be.visible');
    cy.contains('Bulevar Mihajla Pupina 10, Beograd').should('be.visible');
  });

  it('displays firm info labels (Naziv firme, Maticni broj, PIB, Sifra delatnosti)', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Naziv firme').should('be.visible');
    cy.contains('Maticni broj').should('be.visible');
    cy.contains('PIB').should('be.visible');
    cy.contains('Sifra delatnosti').should('be.visible');
    cy.contains('Adresa').should('be.visible');
  });

  it('shows hero section with account name, status, and Poslovni badge', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Poslovni RSD').should('be.visible');
    cy.contains('Aktivan').should('be.visible');
    cy.contains('Poslovni').should('be.visible');
    // Formatted account number
    cy.contains('265-0000000000000-10').should('be.visible');
  });

  it('displays balance details (Ukupno stanje, Raspolozivo, Rezervisano, Odrzavanje)', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Stanje racuna').should('be.visible');
    cy.contains('Ukupno stanje').should('be.visible');
    cy.contains('Raspolozivo').should('exist');
    cy.contains('Rezervisano').should('be.visible');
    cy.contains('Odrzavanje').should('be.visible');
  });

  it('shows limits and spending progress bars', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Limiti i potrosnja').should('be.visible');
    cy.contains('Dnevna potrosnja').should('be.visible');
    cy.contains('Mesecna potrosnja').should('be.visible');
    // Limit input fields exist
    cy.get('#dailyLimit').should('exist');
    cy.get('#monthlyLimit').should('exist');
    cy.contains('button', 'Sacuvaj limite').should('be.visible');
  });

  it('can save new limits', () => {
    cy.intercept('PATCH', '**/api/accounts/10/limits', {
      statusCode: 200,
      body: {},
    }).as('saveLimits');

    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.get('#dailyLimit').clear().type('2000000');
    cy.get('#monthlyLimit').clear().type('8000000');
    cy.contains('button', 'Sacuvaj limite').click();
    cy.wait('@saveLimits');
    cy.contains('Limiti su uspesno sacuvani').should('be.visible');
  });

  it('shows action buttons (Novo placanje, Prenos, Sve transakcije)', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Akcije').should('be.visible');
    cy.contains('button', 'Novo placanje').should('be.visible');
    cy.contains('button', 'Prenos').should('be.visible');
    cy.contains('button', 'Sve transakcije').should('be.visible');
  });

  it('shows recent transactions table', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');
    cy.wait('@getTransactions');

    cy.contains('Poslednje transakcije').should('be.visible');
    cy.contains('Dobavljac A').should('be.visible');
    cy.contains('Klijent B').should('be.visible');
  });

  it('shows empty transaction state when no transactions', () => {
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    }).as('emptyTx');

    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');
    cy.wait('@emptyTx');

    cy.contains('Nema transakcija za ovaj racun').should('be.visible');
  });

  it('shows not found state for invalid account ID', () => {
    cy.intercept('GET', '**/api/accounts/999', {
      statusCode: 404,
      body: { message: 'Not found' },
    }).as('notFound');

    cy.visit('/accounts/999/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@notFound');

    cy.contains('Racun nije pronadjen').should('be.visible');
  });

  it('has back button that links to accounts list', () => {
    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.contains('Nazad na racune').should('be.visible');
  });

  it('can rename the account via inline input', () => {
    cy.intercept('PATCH', '**/api/accounts/10/name', {
      statusCode: 200,
      body: { ...mockBusinessAccountDetail, name: 'Novi poslovni naziv' },
    }).as('renameSave');

    cy.visit('/accounts/10/business', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getBusinessAccount');

    cy.get('input[placeholder="Novi naziv racuna"]').clear().type('Novi poslovni naziv');
    cy.contains('button', 'Promeni naziv').click();
    cy.wait('@renameSave');
    cy.contains('Naziv racuna je uspesno promenjen').should('be.visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  TRANSFER HISTORY (extended coverage)
// ═══════════════════════════════════════════════════════════════════════

describe('Transfer History - Extended Coverage', () => {
  beforeEach(() => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: mockAccounts,
    }).as('getMyAccounts');
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: mockTransferHistory,
    }).as('getTransfers');
  });

  it('displays transfers sorted by date (most recent first)', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    // The first row should be transfer 101 (March 28) which is most recent
    cy.get('tbody tr').first().within(() => {
      cy.contains('265000000000000010').should('exist');
      cy.contains('265000000000000011').should('exist');
    });

    // The last row should be transfer 104 (March 25)
    cy.get('tbody tr').last().within(() => {
      cy.contains('REJECTED').should('exist');
    });
  });

  it('shows FX details for cross-currency transfers', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    // Transfer 103 has exchange rate and commission
    cy.contains('0.0085').should('be.visible');
    cy.contains('500.00').should('be.visible');
  });

  it('filters by date range', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    // Set date range filter
    cy.get('#date-from').type('2026-03-27');
    cy.get('#date-to').type('2026-03-28');

    // Wait for re-fetch with params
    cy.wait('@getTransfers');
  });

  it('filters by account using the dropdown', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    // Account filter should be populated
    cy.get('#account-filter').should('exist');
    cy.get('#account-filter option').should('have.length.greaterThan', 1);

    // Select a specific account
    cy.get('#account-filter').select(mockAccounts[0].accountNumber);
    cy.wait('@getTransfers');
    cy.get('#account-filter').should('have.value', mockAccounts[0].accountNumber);
  });

  it('shows all status badges (COMPLETED, PENDING, REJECTED)', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    cy.contains('COMPLETED').should('be.visible');
    cy.contains('PENDING').should('be.visible');
    cy.contains('REJECTED').should('be.visible');
  });

  it('shows pagination controls', () => {
    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
    cy.wait('@getTransfers');

    cy.contains('Strana 1').should('be.visible');
    cy.contains('button', 'Prethodna').should('be.visible');
    cy.contains('button', 'Sledeca').should('be.visible');
  });

  it('shows loading skeleton while data loads', () => {
    cy.intercept('GET', '**/api/transfers*', {
      statusCode: 200,
      body: mockTransferHistory,
      delay: 500,
    }).as('slowTransfers');

    cy.visit('/transfers/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@slowTransfers');
    cy.get('.animate-pulse').should('not.exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════

describe('Landing Page', () => {
  beforeEach(() => {
    // Intercept backend status check to avoid real network calls
    cy.intercept('HEAD', '**/v3/api-docs', { statusCode: 200 }).as('backendCheck');
  });

  it('renders hero section with heading and subheading', () => {
    cy.visit('/');

    cy.contains('Moderno bankarstvo').should('be.visible');
    cy.contains('na dohvat ruke').should('be.visible');
    cy.contains('Platforma za upravljanje bankarskim poslovanjem').should('be.visible');
  });

  it('displays BANKA 2025 branding in navbar', () => {
    cy.visit('/');

    cy.contains('BANKA 2025').should('be.visible');
    cy.contains('TIM 2').should('be.visible');
    cy.get('img[alt="BANKA 2025 • TIM 2"]').should('be.visible');
  });

  it('renders all 6 feature cards', () => {
    cy.visit('/');

    // Scroll to features section to trigger IntersectionObserver
    cy.get('#features').scrollIntoView();

    const featureTitles = [
      'Upravljanje zaposlenima',
      'Sigurna autentifikacija',
      'Bankarsko poslovanje',
      'Trgovina hartijama',
      'Sistem permisija',
      'Više valuta',
    ];

    featureTitles.forEach((title) => {
      cy.contains(title).should('exist');
    });
  });

  it('renders features section header', () => {
    cy.visit('/');

    cy.get('#features').scrollIntoView();
    cy.contains('Mogućnosti').should('be.visible');
    cy.contains('Sve što vam je potrebno').should('be.visible');
  });

  it('hero "Prijavi se" button navigates to /login', () => {
    cy.visit('/');

    // There are multiple "Prijavi se" buttons; use the hero one (first in the CTA area)
    cy.get('section').first().within(() => {
      cy.contains('button', 'Prijavi se').click();
    });
    cy.url().should('include', '/login');
  });

  it('navbar "Prijavi se" button navigates to /login', () => {
    cy.visit('/');

    cy.get('nav').within(() => {
      cy.contains('button', 'Prijavi se').click();
    });
    cy.url().should('include', '/login');
  });

  it('"Saznaj vise" button scrolls to features section', () => {
    cy.visit('/');

    cy.contains('button', 'Saznaj više').click();
    // After clicking, the features section should be in the viewport
    cy.get('#features').should('be.visible');
  });

  it('renders CTA section with "Prijavi se na portal" button', () => {
    cy.visit('/');

    cy.get('#features').scrollIntoView();
    // Scroll further to CTA
    cy.contains('Spremni da počnete?').scrollIntoView();
    cy.contains('Spremni da počnete?').should('be.visible');
    cy.contains('button', 'Prijavi se na portal').should('be.visible');
  });

  it('CTA "Prijavi se na portal" button navigates to /login', () => {
    cy.visit('/');

    cy.contains('Spremni da počnete?').scrollIntoView();
    cy.contains('button', 'Prijavi se na portal').click();
    cy.url().should('include', '/login');
  });

  it('theme toggle button cycles through themes', () => {
    cy.visit('/');

    // The theme toggle is in the navbar
    cy.get('nav').within(() => {
      // Click theme toggle - it should cycle light -> dark -> system -> light
      cy.get('button[title*="Tema"]').as('themeBtn');

      // First state: check the button has a title
      cy.get('@themeBtn').should('have.attr', 'title').and('match', /Tema/);

      // Click to change theme
      cy.get('@themeBtn').click();
      cy.get('@themeBtn').should('have.attr', 'title').and('match', /Tema/);

      // Click again
      cy.get('@themeBtn').click();
      cy.get('@themeBtn').should('have.attr', 'title').and('match', /Tema/);
    });
  });

  it('shows backend status indicator', () => {
    cy.visit('/');

    // Wait for the backend check
    cy.wait('@backendCheck');
    cy.contains('Server aktivan').should('be.visible');
  });

  it('shows "Server nedostupan" when backend is down', () => {
    cy.intercept('HEAD', '**/v3/api-docs', { statusCode: 500 }).as('backendDown');

    cy.visit('/');
    cy.wait('@backendDown');
    cy.contains('Server nedostupan').should('be.visible');
  });

  it('renders footer with branding', () => {
    cy.visit('/');

    cy.get('footer').scrollIntoView();
    cy.get('footer').within(() => {
      cy.contains('BANKA 2025').should('be.visible');
      cy.contains('Softversko inženjerstvo').should('be.visible');
    });
  });

  it('displays currency ticker bar', () => {
    cy.visit('/');

    const currencies = ['RSD', 'EUR', 'USD', 'CHF', 'GBP', 'JPY', 'CAD', 'AUD'];
    currencies.forEach((code) => {
      cy.contains(code).should('exist');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  SUPERVISOR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

describe('Supervisor Dashboard Page', () => {
  function setupDashboardIntercepts() {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });

    // Dashboard-specific endpoints
    cy.intercept('GET', '**/api/orders*status=PENDING*', {
      statusCode: 200,
      body: mockPendingOrders,
    }).as('getPendingOrders');
    cy.intercept('GET', '**/api/orders*status=ALL*', {
      statusCode: 200,
      body: mockOrders,
    }).as('getAllOrders');
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 200,
      body: mockAgents,
    }).as('getAgents');
    cy.intercept('GET', '**/api/listings*', {
      statusCode: 200,
      body: mockListings,
    }).as('getListings');
    cy.intercept('GET', '**/api/tax*', {
      statusCode: 200,
      body: mockTaxRecords,
    }).as('getTax');
  }

  it('renders dashboard header with title', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.contains('Pregled aktivnosti i statistika sistema').should('be.visible');
  });

  it('displays 4 KPI stat cards after loading', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    // Wait for all data to load
    cy.wait('@getPendingOrders');
    cy.wait('@getAgents');

    cy.contains('Pending orderi').should('be.visible');
    cy.contains('Aktivni agenti').should('be.visible');
    cy.contains('Današnji volume').should('be.visible');
    cy.contains('Neplaćen porez').should('be.visible');
  });

  it('shows correct pending orders count', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getPendingOrders');
    // pendingOrders = totalElements = 1
    cy.contains('Pending orderi').parent().parent().contains('1').should('be.visible');
  });

  it('shows correct active agents count', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAgents');
    // 2 agents
    cy.contains('Aktivni agenti').parent().parent().contains('2').should('be.visible');
  });

  it('shows recent orders table', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAllOrders');

    cy.contains('Poslednjih 10 ordera').should('be.visible');
    cy.contains('AAPL').should('be.visible');
    cy.contains('MSFT').should('be.visible');
    cy.contains('GOOG').should('be.visible');
  });

  it('shows order direction badges (BUY / SELL)', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAllOrders');

    cy.contains('BUY').should('be.visible');
    cy.contains('SELL').should('be.visible');
  });

  it('shows order status badges (PENDING, DONE, APPROVED)', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAllOrders');

    cy.contains('PENDING').should('be.visible');
    cy.contains('DONE').should('be.visible');
    cy.contains('APPROVED').should('be.visible');
  });

  it('shows agents near limit section', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAgents');

    cy.contains('Agenti blizu limita').should('be.visible');
    // Agent Petrovic is at 90% (450000/500000), should appear
    cy.contains('Agent Petrovic').should('be.visible');
    cy.contains('90%').should('be.visible');
    // Agent Jovanovic is at 33% (100000/300000), should NOT appear (below 80%)
    cy.contains('Agent Jovanovic').should('not.exist');
  });

  it('shows quick action links', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.contains('Brze akcije').should('be.visible');
    cy.contains('Orderi').should('be.visible');
    cy.contains('Aktuari').should('be.visible');
    cy.contains('Porez').should('be.visible');
    cy.contains('Berze').should('be.visible');
  });

  it('shows loading skeletons while data loads', () => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });

    // Delay all dashboard endpoints
    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: mockOrders,
      delay: 1000,
    }).as('slowOrders');
    cy.intercept('GET', '**/api/actuaries/agents*', {
      statusCode: 200,
      body: mockAgents,
      delay: 1000,
    }).as('slowAgents');
    cy.intercept('GET', '**/api/listings*', {
      statusCode: 200,
      body: mockListings,
      delay: 1000,
    }).as('slowListings');
    cy.intercept('GET', '**/api/tax*', {
      statusCode: 200,
      body: mockTaxRecords,
      delay: 1000,
    }).as('slowTax');

    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    // Skeleton should be visible while loading
    cy.get('.animate-pulse').should('exist');
  });

  it('shows empty orders state when no orders exist', () => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/orders*status=PENDING*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/orders*status=ALL*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/actuaries/agents*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/listings*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/tax*', { statusCode: 200, body: [] });

    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.contains('Nema ordera').should('be.visible');
    cy.contains('Nema agenata blizu limita').should('be.visible');
  });

  it('navigates to orders page via "Svi orderi" link', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAllOrders');

    cy.contains('Svi orderi').click();
    cy.url().should('include', '/employee/orders');
  });

  it('navigates to agents page via "Svi agenti" link', () => {
    setupDashboardIntercepts();
    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    cy.wait('@getAgents');

    cy.contains('Svi agenti').click();
    cy.url().should('include', '/employee/actuaries');
  });

  it('shows fallback dash values when API calls fail', () => {
    setupCommonIntercepts();
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { content: [], totalElements: 0, totalPages: 0 },
    });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });

    // All dashboard endpoints fail
    cy.intercept('GET', '**/api/orders*', { statusCode: 500, body: {} });
    cy.intercept('GET', '**/api/actuaries/agents*', { statusCode: 500, body: {} });
    cy.intercept('GET', '**/api/listings*', { statusCode: 500, body: {} });
    cy.intercept('GET', '**/api/tax*', { statusCode: 500, body: {} });

    cy.visit('/employee/dashboard', { onBeforeLoad: (win) => setupAdminSession(win) });

    // KPI cards should show "-" as fallback
    cy.contains('Pending orderi').parent().parent().contains('-').should('be.visible');
    cy.contains('Aktivni agenti').parent().parent().contains('-').should('be.visible');
  });
});
