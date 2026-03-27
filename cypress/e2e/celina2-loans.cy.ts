/// <reference types="cypress" />
// Celina 7: Krediti (S33-S38) - Upravljanje kreditima i otplatom
import { setupClientSession, setupAdminSession } from '../support/commands';

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
];

const mockLoans = [
  {
    id: 1, loanNumber: 'KR-2025-001', loanType: 'GOTOVINSKI', amount: 500000, currency: 'RSD',
    monthlyPayment: 22500, remainingDebt: 450000, repaymentPeriod: 24,
    nominalRate: 6.25, effectiveRate: 6.50, status: 'ACTIVE' as const,
    startDate: '2025-01-15', endDate: '2027-01-15', accountNumber: '265000000000000001',
  },
  {
    id: 2, loanNumber: 'KR-2025-002', loanType: 'STAMBENI', amount: 3000000, currency: 'RSD',
    monthlyPayment: 45000, remainingDebt: 2900000, repaymentPeriod: 120,
    nominalRate: 5.0, effectiveRate: 5.25, status: 'PENDING' as const,
    startDate: '2025-03-01', endDate: '2035-03-01', accountNumber: '265000000000000001',
  },
];

const mockInstallments = [
  { id: 1, amount: 22500, currency: 'RSD', expectedDueDate: '2025-02-15', paid: true },
  { id: 2, amount: 22500, currency: 'RSD', expectedDueDate: '2025-03-15', paid: true },
  { id: 3, amount: 22500, currency: 'RSD', expectedDueDate: '2025-04-15', paid: false },
  { id: 4, amount: 22500, currency: 'RSD', expectedDueDate: '2025-05-15', paid: false },
];

const mockLoanRequests = {
  content: [
    { id: 10, clientEmail: 'stefan.jovanovic@gmail.com', clientName: 'Stefan Jovanovic', loanType: 'GOTOVINSKI', interestRateType: 'FIKSNI', amount: 500000, currency: 'RSD', loanPurpose: 'Renoviranje stana', repaymentPeriod: 24, status: 'PENDING' as const, createdAt: '2025-03-25T10:00:00', accountNumber: '265000000000000001', phoneNumber: '+381601234567', employmentStatus: 'stalno', monthlyIncome: 120000, permanentEmployment: true },
    { id: 11, clientEmail: 'milica.nikolic@gmail.com', clientName: 'Milica Nikolic', loanType: 'AUTO', interestRateType: 'VARIJABILNI', amount: 1000000, currency: 'RSD', loanPurpose: 'Kupovina automobila', repaymentPeriod: 60, status: 'PENDING' as const, createdAt: '2025-03-24T14:00:00', accountNumber: '265000000000000002', phoneNumber: '+381609876543', employmentStatus: 'privremeno', monthlyIncome: 80000, permanentEmployment: false },
  ],
  totalElements: 2,
  totalPages: 1,
};

function setupLoanIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: mockLoans }).as('getMyLoans');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
}

// ─── S33: Podnosenje zahteva za kredit ──────────────────────────────
describe('S33: Podnosenje zahteva za kredit', () => {
  beforeEach(() => {
    setupLoanIntercepts();
    cy.intercept('POST', '**/api/loans', {
      statusCode: 201,
      body: { id: 20, status: 'PENDING', message: 'Zahtev uspesno podnet' },
    }).as('applyLoan');
    cy.visit('/loans/apply', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje formu za zahtev za kredit', () => {
    cy.contains('Zahtev za kredit').should('be.visible');
    cy.get('#loanType').should('exist');
    cy.get('#interestRateType').should('exist');
    cy.get('#amount').should('exist');
    cy.get('#currency').should('exist');
    cy.get('#loanPurpose').should('exist');
    cy.get('#repaymentPeriod').should('exist');
  });

  it('prikazuje simulaciju mesecne rate', () => {
    cy.get('#amount').clear().type('500000');
    cy.contains('Mesecna rata').should('be.visible');
    cy.contains('Ukupno za vracanje').should('be.visible');
    cy.contains('Godisnja kamatna stopa').should('be.visible');
  });

  it('uspesno podnosi zahtev za kredit', () => {
    cy.get('#loanType').select('GOTOVINSKI');
    cy.get('#interestRateType').select('FIKSNI');
    cy.get('#amount').clear().type('500000');
    cy.get('#currency').select('RSD');
    cy.get('#loanPurpose').type('Renoviranje stana');
    cy.get('#phoneNumber').type('+381601234567');
    cy.contains('button', 'Posalji zahtev').click();
    cy.wait('@applyLoan');
    cy.contains('uspesno').should('be.visible');
  });

  it('prikazuje razlicite tipove kredita', () => {
    cy.get('#loanType option').should('have.length.at.least', 3);
    cy.get('#loanType').select('STAMBENI');
    cy.get('#loanType').select('AUTO');
    cy.get('#loanType').select('STUDENTSKI');
  });

  it('prikazuje razlicite periode otplate za razlicite tipove', () => {
    cy.get('#loanType').select('GOTOVINSKI');
    cy.get('#repaymentPeriod option').should('have.length.at.least', 1);
  });
});

// ─── S34: Pregled kredita klijenta ──────────────────────────────────
describe('S34: Pregled kredita klijenta', () => {
  beforeEach(() => {
    setupLoanIntercepts();
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: mockInstallments }).as('getInstallments');
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyLoans');
  });

  it('prikazuje listu svih kredita', () => {
    cy.contains('Moji krediti').should('be.visible');
    cy.contains('GOTOVINSKI kredit').should('be.visible');
    cy.contains('STAMBENI kredit').should('be.visible');
  });

  it('prikazuje informacije o kreditu', () => {
    cy.contains('500000.00').should('exist');
    cy.contains('22500.00').should('exist');
    cy.contains('450000.00').should('exist');
    cy.contains('24 meseci').should('exist');
  });

  it('prikazuje dugme za zahtev za kredit', () => {
    cy.contains('button', 'Zahtev za kredit').should('be.visible');
  });

  it('prikazuje detalje kredita sa ratama', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('Detalji kredita').should('be.visible');
    cy.contains('Rata').should('be.visible');
    cy.contains('Iznos').should('exist');
    cy.contains('Datum dospeca').should('be.visible');
    cy.contains('Placeno').should('be.visible');
  });

  it('prikazuje broj placenih rata', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.contains('Placeno rata: 2 / 4').should('be.visible');
  });

  it('prikazuje prazan state kad nema kredita', () => {
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: [] }).as('emptyLoans');
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyLoans');
    cy.contains('Trenutno nema kredita').should('be.visible');
  });
});

// ─── S35: Odobravanje kredita od strane zaposlenog ──────────────────
describe('S35: Odobravanje kredita od strane zaposlenog', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('getLoanRequests');
    cy.intercept('PATCH', '**/api/loans/requests/10/approve', { statusCode: 200 }).as('approveLoan');
    setupLoanIntercepts();
    cy.visit('/employee/loan-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getLoanRequests');
  });

  it('prikazuje zahteve za kredit', () => {
    cy.contains('Stefan Jovanovic').should('be.visible');
    cy.contains('Milica Nikolic').should('be.visible');
  });

  it('odobrava zahtev za kredit', () => {
    cy.contains('tr', 'Stefan').within(() => {
      cy.contains('button', 'Odobri').click();
    });
    cy.wait('@approveLoan');
    cy.contains('uspesno').should('be.visible');
  });
});

// ─── S36: Odbijanje zahteva za kredit ───────────────────────────────
describe('S36: Odbijanje zahteva za kredit', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/loans/requests*', { statusCode: 200, body: mockLoanRequests }).as('getLoanRequests');
    cy.intercept('PATCH', '**/api/loans/requests/11/reject', { statusCode: 200 }).as('rejectLoan');
    setupLoanIntercepts();
    cy.visit('/employee/loan-requests', { onBeforeLoad: (win) => setupAdminSession(win) });
    cy.wait('@getLoanRequests');
  });

  it('odbija zahtev za kredit sa razlogom', () => {
    cy.contains('tr', 'Milica').within(() => {
      cy.contains('button', 'Odbij').click();
    });
    // Expanded row shows rejection reason input
    cy.get('input[placeholder="Unesite razlog..."]').type('Nedovoljan mesecni prihod');
    cy.contains('button', 'Potvrdi odbijanje').click();
    cy.wait('@rejectLoan');
    cy.contains('odbijen').should('be.visible');
  });
});

// ─── S37/S38: Automatsko skidanje i kasnjenje rata (informativno) ───
describe('S37: Automatsko skidanje rate kredita - prikaz rata', () => {
  beforeEach(() => {
    setupLoanIntercepts();
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: mockInstallments }).as('getInstallments');
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyLoans');
  });

  it('prikazuje placene i neplacene rate', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    // Rata 1 i 2 su placene (Da), rata 3 i 4 nisu (Ne)
    cy.get('table tbody tr').eq(0).should('contain', 'Da');
    cy.get('table tbody tr').eq(1).should('contain', 'Da');
    cy.get('table tbody tr').eq(2).should('contain', 'Ne');
    cy.get('table tbody tr').eq(3).should('contain', 'Ne');
  });
});

describe('S38: Kasnjenje u otplati - status rata', () => {
  const lateInstallments = [
    { id: 1, amount: 22500, currency: 'RSD', expectedDueDate: '2025-02-15', paid: true, status: 'PAID' },
    { id: 2, amount: 22500, currency: 'RSD', expectedDueDate: '2025-03-15', paid: false, status: 'LATE' },
  ];

  beforeEach(() => {
    setupLoanIntercepts();
    cy.intercept('GET', '**/api/loans/1/installments', { statusCode: 200, body: lateInstallments }).as('getInstallments');
    cy.visit('/loans', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyLoans');
  });

  it('prikazuje neplacenu ratu', () => {
    cy.contains('button', 'Prikazi detalje').first().click();
    cy.wait('@getInstallments');
    cy.get('table tbody tr').eq(1).should('contain', 'Ne');
  });
});

// ─── Validacija forme zahteva za kredit ─────────────────────────────
describe('Validacija forme za kredit', () => {
  beforeEach(() => {
    setupLoanIntercepts();
    cy.visit('/loans/apply', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje gresku validacije za prazan iznos', () => {
    cy.get('#amount').clear().type('0');
    cy.contains('button', 'Posalji zahtev').click();
    cy.get('.text-destructive').should('exist');
  });
});
