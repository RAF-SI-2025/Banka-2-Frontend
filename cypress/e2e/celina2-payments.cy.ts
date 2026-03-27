/// <reference types="cypress" />
// Celina 2: Placanja (S9-S16) - Izvrsavanje placanja izmedju klijenata
import { setupClientSession } from '../support/commands';

const mockAccounts = [
  { id: 1, accountNumber: '265000000000000001', name: 'Tekuci RSD', accountType: 'CHECKING', currency: 'RSD', balance: 150000, availableBalance: 145000, status: 'ACTIVE' },
  { id: 2, accountNumber: '265000000000000002', name: 'Devizni EUR', accountType: 'FOREIGN', currency: 'EUR', balance: 1500, availableBalance: 1500, status: 'ACTIVE' },
];

const mockRecipients = [
  { id: 1, name: 'Petar Petrovic', accountNumber: '265000000000000099', address: 'Beograd', phoneNumber: '+381601111111' },
  { id: 2, name: 'Ana Markovic', accountNumber: '265000000000000088', address: 'Novi Sad', phoneNumber: '+381602222222' },
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

const mockPaymentHistory = {
  content: [
    { id: 1, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000099', recipientName: 'Petar Petrovic', amount: 5000, currency: 'RSD', paymentPurpose: 'Uplata za usluge', status: 'COMPLETED', createdAt: '2025-03-25T10:00:00' },
    { id: 2, fromAccountNumber: '265000000000000088', toAccountNumber: '265000000000000001', recipientName: 'Ana Markovic', amount: 15000, currency: 'RSD', paymentPurpose: 'Plata za mart', status: 'COMPLETED', createdAt: '2025-03-24T14:00:00' },
    { id: 3, fromAccountNumber: '265000000000000001', toAccountNumber: '265000000000000077', recipientName: 'Jovan Jovic', amount: 3000, currency: 'RSD', paymentPurpose: 'Vracanje duga', status: 'PENDING', createdAt: '2025-03-23T09:00:00' },
  ],
  totalElements: 3,
  totalPages: 1,
};

function setupPaymentIntercepts() {
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: mockRecipients }).as('getRecipients');
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
}

// ─── S9: Uspesno placanje drugom klijentu ───────────────────────────
describe('S9: Uspesno placanje drugom klijentu', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje formu za novo placanje', () => {
    cy.contains('Novi platni nalog').should('be.visible');
    cy.get('#fromAccount').should('exist');
    cy.get('#toAccount').should('exist');
    cy.get('#amount').should('exist');
  });

  it('uspesno kreira placanje sa validnim podacima', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000099');
    cy.get('#recipientName').clear().type('Petar Petrovic');
    cy.get('#amount').clear().type('5000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Test placanje');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@createPayment');
    cy.contains('Verifikacija transakcije').should('be.visible');
  });

  it('moze izabrati sacuvanog primaoca iz dropdown-a', () => {
    cy.get('#savedRecipient').select(mockRecipients[0].accountNumber);
    cy.get('#toAccount').should('have.value', mockRecipients[0].accountNumber);
  });
});

// ─── S10: Neuspesno placanje zbog nedovoljnih sredstava ─────────────
describe('S10: Neuspesno placanje zbog nedovoljnih sredstava', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', {
      statusCode: 400,
      body: { message: 'Nedovoljno sredstava na racunu' },
    }).as('failedPayment');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje poruku o nedovoljnim sredstvima', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000099');
    cy.get('#recipientName').clear().type('Petar Petrovic');
    cy.get('#amount').clear().type('999999');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Pokusaj');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@failedPayment');
    cy.contains('Nedovoljno sredstava').should('be.visible');
  });
});

// ─── S11: Neuspesno placanje zbog nepostojeceg racuna ───────────────
describe('S11: Neuspesno placanje zbog nepostojeceg racuna', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', {
      statusCode: 404,
      body: { message: 'Uneti racun ne postoji' },
    }).as('invalidAccountPayment');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje poruku o nepostojecem racunu', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('999999999999999999');
    cy.get('#recipientName').clear().type('Nepoznati');
    cy.get('#amount').clear().type('1000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Test');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@invalidAccountPayment');
    cy.contains('ne postoji').should('be.visible');
  });
});

// ─── S12: Placanje u razlicitim valutama uz konverziju ──────────────
describe('S12: Placanje u razlicitim valutama uz konverziju', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', {
      statusCode: 201,
      body: { ...mockPaymentResult, currency: 'EUR' },
    }).as('createFxPayment');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje valutu odabranog racuna', () => {
    cy.get('#fromAccount').select(mockAccounts[1].accountNumber);
    cy.contains('EUR').should('be.visible');
  });

  it('omogucava placanje sa deviznog racuna', () => {
    cy.get('#fromAccount').select(mockAccounts[1].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000099');
    cy.get('#recipientName').clear().type('Petar');
    cy.get('#amount').clear().type('100');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('FX placanje');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@createFxPayment');
  });
});

// ─── S13: Placanje uz verifikacioni kod ─────────────────────────────
describe('S13: Placanje uz verifikacioni kod', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
    cy.intercept('POST', '**/api/payments/verify', { statusCode: 200, body: { verified: true, message: 'OK' } }).as('verifyPayment');
    cy.intercept('POST', '**/api/payment-recipients', { statusCode: 201, body: { id: 99, name: 'Petar', accountNumber: '265000000000000099' } }).as('saveRecipient');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('otvara verifikacioni modal i uspesno verifikuje', () => {
    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000099');
    cy.get('#recipientName').clear().type('Petar Petrovic');
    cy.get('#amount').clear().type('5000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Verifikacija test');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@createPayment');
    cy.wait('@requestOtp');

    // Verifikacioni modal je otvoren
    cy.contains('Verifikacija transakcije').should('be.visible');
    cy.contains('Verifikacioni kod je poslat').should('be.visible');
    cy.get('#otp').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@verifyPayment');
    cy.contains('uspešno verifikovana').should('be.visible');
  });
});

// ─── S14: Otkazivanje transakcije nakon tri pogresna koda ───────────
describe('S14: Otkazivanje transakcije nakon tri pogresna koda', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('blokira transakciju nakon 3 pogresna pokusaja', () => {
    // Intercepti za pogresne kodove
    let attempts = 0;
    cy.intercept('POST', '**/api/payments/verify', (req) => {
      attempts++;
      if (attempts >= 3) {
        req.reply({ statusCode: 200, body: { verified: false, blocked: true, message: 'Maksimalan broj pokusaja dostignut.' } });
      } else {
        req.reply({ statusCode: 200, body: { verified: false, blocked: false, message: 'Kod nije validan.' } });
      }
    }).as('verifyPayment');

    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000099');
    cy.get('#recipientName').clear().type('Petar');
    cy.get('#amount').clear().type('5000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Test');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@createPayment');
    cy.wait('@requestOtp');

    // Pokusaj 1
    cy.get('#otp').type('111111');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@verifyPayment');
    cy.contains('Kod nije validan').should('be.visible');

    // Pokusaj 2
    cy.get('#otp').clear().type('222222');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@verifyPayment');

    // Pokusaj 3 - blokiranje
    cy.get('#otp').clear().type('333333');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@verifyPayment');
    cy.contains('Maksimalan broj').should('be.visible');
  });
});

// ─── S15: Dodavanje primaoca nakon uspesnog placanja ────────────────
describe('S15: Dodavanje primaoca nakon uspesnog placanja', () => {
  it('automatski cuva novog primaoca posle uspesne verifikacije', () => {
    setupPaymentIntercepts();
    cy.intercept('POST', '**/api/payments', { statusCode: 201, body: mockPaymentResult }).as('createPayment');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } }).as('requestOtp');
    cy.intercept('POST', '**/api/payments/verify', { statusCode: 200, body: { verified: true, message: 'OK' } }).as('verifyPayment');
    cy.intercept('POST', '**/api/payment-recipients', { statusCode: 201, body: { id: 99, name: 'Novi Primalac', accountNumber: '265000000000000055' } }).as('saveRecipient');
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockPaymentHistory }).as('paymentHistory');

    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select(mockAccounts[0].accountNumber);
    cy.get('#toAccount').clear().type('265000000000000055');
    cy.get('#recipientName').clear().type('Novi Primalac');
    cy.get('#amount').clear().type('2000');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').type('Novo placanje');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.wait('@createPayment');
    cy.wait('@requestOtp');

    cy.get('#otp').type('123456');
    cy.contains('button', 'Potvrdi').click();
    cy.wait('@verifyPayment');
    cy.wait('@saveRecipient');
  });
});

// ─── S16: Pregled istorije placanja ─────────────────────────────────
describe('S16: Pregled istorije placanja', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: mockAccounts }).as('getMyAccounts');
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: mockPaymentHistory }).as('getPayments');
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    cy.visit('/payments/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getPayments');
  });

  it('prikazuje listu svih izvrsenih placanja', () => {
    cy.contains('Petar Petrovic').should('be.visible');
    cy.contains('Ana Markovic').should('be.visible');
    cy.contains('Jovan Jovic').should('be.visible');
  });

  it('prikazuje statusne oznake za transakcije', () => {
    cy.contains('Zavrsena').should('exist');
  });

  it('prikazuje prazno stanje kad nema placanja', () => {
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } }).as('emptyPayments');
    cy.visit('/payments/history', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@emptyPayments');
    cy.contains('Nema').should('be.visible');
  });
});

// ─── Form validation ────────────────────────────────────────────────
describe('Validacija forme za novo placanje', () => {
  beforeEach(() => {
    setupPaymentIntercepts();
    cy.visit('/payments/new', { onBeforeLoad: (win) => setupClientSession(win) });
    cy.wait('@getMyAccounts');
  });

  it('prikazuje greske validacije za prazna polja', () => {
    cy.contains('button', 'Nastavi na verifikaciju').click();
    // Validation errors should appear
    cy.get('.text-destructive').should('exist');
  });
});
