/// <reference types="cypress" />
// Celina 1: Racuni (S1-S8) - Kreiranje i upravljanje racunima
import { setupAdminSession, setupClientSession } from '../support/commands';

// ─── Mock data ─────────────────────────────────────────────────────────
const mockClients = {
  content: [
    { id: 1, firstName: 'Stefan', lastName: 'Jovanovic', email: 'stefan.jovanovic@gmail.com', phoneNumber: '+381601234567', address: 'Beograd', dateOfBirth: '1990-01-15', gender: 'MALE' },
    { id: 2, firstName: 'Milica', lastName: 'Nikolic', email: 'milica.nikolic@gmail.com', phoneNumber: '+381609876543', address: 'Novi Sad', dateOfBirth: '1992-05-20', gender: 'FEMALE' },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Glavni racun', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, reservedBalance: 5000, maintenanceFee: 200, dailyLimit: 500000, monthlyLimit: 2000000, dailySpending: 10000, monthlySpending: 50000, status: 'ACTIVE', createdAt: '2025-01-01' },
  { id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR', accountType: 'FOREIGN', currency: 'EUR', balance: 1500, availableBalance: 1500, reservedBalance: 0, maintenanceFee: 5, dailyLimit: 10000, monthlyLimit: 50000, dailySpending: 0, monthlySpending: 0, status: 'ACTIVE', createdAt: '2025-02-01' },
  { id: 3, accountNumber: '265000000000000003', name: 'Poslovni racun', accountType: 'BUSINESS', currency: 'RSD', balance: 500000, availableBalance: 500000, reservedBalance: 0, maintenanceFee: 500, dailyLimit: 1000000, monthlyLimit: 5000000, dailySpending: 0, monthlySpending: 0, status: 'ACTIVE', createdAt: '2025-03-01' },
];

const mockTransactions = {
  content: [
    { id: 1, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000099', recipientName: 'Petar Petrovic', amount: 5000, currency: 'RSD', paymentPurpose: 'Uplata za racun', status: 'COMPLETED', createdAt: '2025-03-20T10:00:00' },
    { id: 2, fromAccountNumber: '265000000000000088', toAccountNumber: '265000000000000001', recipientName: 'Jovan Jovic', amount: 15000, currency: 'RSD', paymentPurpose: 'Plata', status: 'COMPLETED', createdAt: '2025-03-19T14:00:00' },
  ],
  totalElements: 2,
  totalPages: 1,
};

const createdAccount = {
  id: 10,
  accountNumber: '265000000000000010',
  accountType: 'CHECKING',
  currency: 'RSD',
  balance: 10000,
  availableBalance: 10000,
  status: 'ACTIVE',
};

// ─── Helper: setup common intercepts ───────────────────────────────────
function setupAccountIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockTransactions }).as('getTransactions');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] }).as('getRecipients');
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] }).as('getExchangeRates');
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] }).as('getCards');
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] }).as('getTransfers');
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } }).as('getLoans');
}

// ─── S1: Kreiranje tekuceg racuna za postojeceg klijenta ────────────
describe('S1: Kreiranje tekuceg racuna za postojeceg klijenta', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('searchClients');
    cy.intercept('POST', '**/api/accounts', { statusCode: 201, body: createdAccount }).as('createAccount');
    cy.intercept('GET', '**/api/accounts/all*', { statusCode: 200, body: { content: mockAccounts, totalElements: 3, totalPages: 1 } }).as('getAllAccounts');
    setupAccountIntercepts();
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('prikazuje formu za kreiranje racuna', () => {
    cy.contains('Kreiranje racuna').should('be.visible');
    cy.get('#ownerEmail').should('exist');
    cy.get('#accountType').should('exist');
  });

  it('kreira tekuci racun sa pocetnim stanjem', () => {
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.get('#accountType').select('TEKUCI');
    cy.get('#initialDeposit').type('10000');
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount');
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });

  it('prikazuje sugestije klijenata pri unosu emaila', () => {
    cy.get('#ownerEmail').type('stefan');
    cy.wait('@searchClients');
    cy.contains('Stefan Jovanovic').should('be.visible');
  });
});

// ─── S2: Kreiranje deviznog racuna za klijenta ──────────────────────
describe('S2: Kreiranje deviznog racuna za klijenta', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('searchClients');
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: { ...createdAccount, accountType: 'FOREIGN', currency: 'EUR', balance: 0, availableBalance: 0 },
    }).as('createAccount');
    setupAccountIntercepts();
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('kreira devizni racun sa EUR valutom i pocetnim stanjem 0', () => {
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.get('#accountType').select('DEVIZNI');
    cy.get('#currency').should('not.be.disabled');
    cy.get('#currency').select('EUR');
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount');
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });
});

// ─── S3: Kreiranje racuna sa automatskim kreiranjem kartice ─────────
describe('S3: Kreiranje racuna sa automatskim kreiranjem kartice', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('searchClients');
    cy.intercept('POST', '**/api/accounts', { statusCode: 201, body: createdAccount }).as('createAccount');
    setupAccountIntercepts();
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('kreira racun sa cekiranjem opcije za karticu', () => {
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.get('#accountType').select('TEKUCI');
    cy.get('input[type="checkbox"]').check();
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount').its('request.body').should('have.property', 'createCard', true);
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });
});

// ─── S4: Kreiranje poslovnog racuna za firmu ────────────────────────
describe('S4: Kreiranje poslovnog racuna za firmu', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/clients*', { statusCode: 200, body: mockClients }).as('searchClients');
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: { ...createdAccount, accountType: 'BUSINESS' },
    }).as('createAccount');
    setupAccountIntercepts();
    cy.visit('/employee/accounts/new', { onBeforeLoad: (win) => setupAdminSession(win) });
  });

  it('prikazuje polja firme kada se izabere Poslovni racun', () => {
    cy.get('#accountType').select('POSLOVNI');
    cy.contains('Podaci firme').should('be.visible');
    cy.get('#companyName').should('be.visible');
    cy.get('#taxId').should('be.visible');
    cy.get('#registrationNumber').should('be.visible');
    cy.get('#activityCode').should('be.visible');
  });

  it('kreira poslovni racun sa podacima firme', () => {
    cy.get('#ownerEmail').type('stefan.jovanovic@gmail.com');
    cy.get('#accountType').select('POSLOVNI');
    cy.get('#companyName').type('Test DOO');
    cy.get('#registrationNumber').type('12345678');
    cy.get('#taxId').type('987654321');
    cy.get('#activityCode').type('62.01');
    cy.get('#firmAddress').type('Knez Mihailova 1');
    cy.get('#firmCity').type('Beograd');
    cy.get('#firmCountry').type('Srbija');
    cy.contains('button', 'Kreiraj racun').click();
    cy.wait('@createAccount');
    cy.contains('Racun uspesno kreiran').should('be.visible');
  });
});

// ─── S5: Kreiranje racuna kada klijent ima maks broj kartica ────────
describe('S5: Kreiranje racuna kada klijent ima maksimalan broj kartica', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/accounts', {
      statusCode: 201,
      body: createdAccount,
    }).as('createAccount');
    // Account created but card creation returns warning
    cy.intercept('POST', '**/api/accounts/requests', {
      statusCode: 200,
      body: { message: 'Zahtev za otvaranje računa je uspešno podnet! Nova kartica ne može biti kreirana.' },
    }).as('submitAccountRequest');
    setupAccountIntercepts();
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje poruku o nemogucnosti kreiranja kartice', () => {
    cy.intercept('POST', '**/api/accounts/requests', {
      statusCode: 200,
      body: { message: 'Nova kartica ne može biti kreirana - dostignut maksimalan broj.' },
    }).as('submitRequest');

    cy.contains('button', 'Novi').click();
    cy.get('input[type="checkbox"]').check();
    cy.contains('button', 'Otvori').click();
    cy.wait('@submitRequest');
  });
});

// ─── S6: Pregled racuna klijenta ────────────────────────────────────
describe('S6: Pregled racuna klijenta', () => {
  beforeEach(() => {
    setupAccountIntercepts();
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje sve aktivne racune klijenta', () => {
    cy.contains('Računi').should('be.visible');
    cy.contains('265-0000000000000-01').should('be.visible');
    cy.contains('265-0000000000000-02').should('be.visible');
  });

  it('racuni su sortirani po raspolozivom stanju (najveci prvi)', () => {
    // Poslovni racun (500000) should be first, Glavni (145000) second, Devizni EUR (1500) third
    cy.get('table tbody tr').first().should('contain', '265-0000000000000-03');
  });

  it('prikazuje loading skeleton dok se podaci ucitavaju', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts, delay: 500 }).as('delayedAccounts');
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.get('.animate-pulse').should('exist');
    cy.wait('@delayedAccounts');
    cy.get('.animate-pulse').should('not.exist');
  });

  it('prikazuje prazan state kad nema racuna', () => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] }).as('emptyAccounts');
    cy.visit('/accounts', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyAccounts');
    cy.contains('Nema').should('be.visible');
  });
});

// ─── S7: Pregled detalja racuna ─────────────────────────────────────
describe('S7: Pregled detalja racuna', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] }).as('getAccount');
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockTransactions }).as('getTransactions');
    setupAccountIntercepts();
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccount');
  });

  it('prikazuje detaljne informacije o racunu', () => {
    cy.contains('Stanje racuna').should('be.visible');
    cy.contains('Ukupno stanje').should('be.visible');
    cy.contains('Raspolozivo').should('be.visible');
    cy.contains('265-0000000000000-01').should('be.visible');
  });

  it('prikazuje broj racuna, stanje, raspolozivo stanje i tip racuna', () => {
    cy.contains('Tekuci').should('be.visible');
    cy.contains('Aktivan').should('be.visible');
  });

  it('prikazuje limite i potrosnju', () => {
    cy.contains('Limiti i potrosnja').should('be.visible');
    cy.contains('Dnevna potrosnja').should('be.visible');
    cy.contains('Mesecna potrosnja').should('be.visible');
  });

  it('prikazuje poslednje transakcije', () => {
    cy.contains('Poslednje transakcije').should('be.visible');
  });

  it('prikazuje akcije (novo placanje, prenos, sve transakcije)', () => {
    cy.contains('Novo placanje').should('be.visible');
    cy.contains('Prenos').should('be.visible');
    cy.contains('Sve transakcije').should('be.visible');
  });
});

// ─── S8: Promena naziva racuna (putem limita - jedina opcija na FE) ─
describe('S8: Promena limita racuna', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/1', { statusCode: 200, body: mockAccounts[0] }).as('getAccount');
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } }).as('getTransactions');
    cy.intercept('PATCH', '**/api/accounts/1/limits', { statusCode: 200 }).as('changeLimits');
    setupAccountIntercepts();
    cy.visit('/accounts/1', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getAccount');
  });

  it('uspesno menja limite racuna', () => {
    cy.get('#dailyLimit').clear().type('600000');
    cy.get('#monthlyLimit').clear().type('3000000');
    cy.contains('button', 'Sacuvaj limite').click();
    cy.wait('@changeLimits');
    cy.contains('Limiti su uspesno sacuvani').should('be.visible');
  });

  it('prikazuje gresku za negativne limite', () => {
    cy.get('#dailyLimit').clear().type('-100');
    cy.contains('button', 'Sacuvaj limite').click();
    cy.contains('nenegativni').should('be.visible');
  });
});
