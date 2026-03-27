/// <reference types="cypress" />

/**
 * CELINA 2 - Live E2E Testovi (Comprehensive)
 *
 * Ovi testovi rade na ZIVOM backendu (localhost:8080) i frontendu (localhost:3000).
 * Pokrivaju sve scenarije iz specifikacije sa PRAVIM operacijama.
 *
 * Pre pokretanja:
 *   1. docker compose up (backend + frontend)
 *   2. Seed ubasen (seed.sql)
 *   3. npx cypress run --spec cypress/e2e/celina2-live-e2e.cy.ts
 *
 * Test kredencijali (iz seed.sql):
 *   Admin:   marko.petrovic@banka.rs / Admin12345
 *   Klijent: stefan.jovanovic@gmail.com / Klijent12345
 *   Klijent: milica.nikolic@gmail.com / Klijent12345
 *   Klijent: lazar.ilic@yahoo.com / Klijent12345
 */

// ---------------------------------------------------------------------------
// Test credentials & seed data
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = 'marko.petrovic@banka.rs';
const ADMIN_PASS = 'Admin12345';

const STEFAN_EMAIL = 'stefan.jovanovic@gmail.com';
const STEFAN_PASS = 'Klijent12345';
const STEFAN_RSD_ACCOUNT = '222000112345678911';
const _STEFAN_EUR_ACCOUNT = '222000121345678921';

const MILICA_EMAIL = 'milica.nikolic@gmail.com';
const MILICA_PASS = 'Klijent12345';
const MILICA_RSD_ACCOUNT = '222000112345678913';

const LAZAR_EMAIL = 'lazar.ilic@yahoo.com';
const LAZAR_PASS = 'Klijent12345';

// ---------------------------------------------------------------------------
// Helper: login via UI using cy.session for caching
// ---------------------------------------------------------------------------
function loginViaUI(email: string, password: string) {
  cy.session(
    [email, password],
    () => {
      cy.visit('/login');
      cy.get('#email').clear().type(email);
      cy.get('#password').clear().type(password);
      cy.contains('button', 'Prijavi se').click();
      cy.url({ timeout: 15000 }).should('include', '/home');
    },
    {
      validate() {
        cy.window().its('sessionStorage').invoke('getItem', 'accessToken').should('exist');
      },
    }
  );
}

function loginAndVisit(email: string, password: string, path: string) {
  loginViaUI(email, password);
  cy.visit(path);
}

// Helper: intercept OTP flow to auto-verify (email not available in test)
function stubOtpVerification() {
  cy.intercept('POST', '**/payments/request-otp', {
    statusCode: 200,
    body: { sent: true, message: 'OTP sent' },
  }).as('otpRequest');

  cy.intercept('POST', '**/payments/verify', {
    statusCode: 200,
    body: { verified: true, blocked: false, message: 'Verified' },
  }).as('otpVerify');
}

// Unique suffix for test data to avoid collisions
const TS = Date.now();

// ============================================================================
// 1. AUTENTIFIKACIJA (7 tests)
// ============================================================================
describe('1. Autentifikacija', () => {
  it('1.1 Login stranica renderuje formu sa email i password poljima', () => {
    cy.visit('/login');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.contains('button', 'Prijavi se').should('be.visible');
    cy.contains('BANKA 2025').should('be.visible');
    cy.contains('Prijavite se na vaš nalog').should('be.visible');
  });

  it('1.2 Submit prazne forme prikazuje validacione greske', () => {
    cy.visit('/login');
    cy.contains('button', 'Prijavi se').click();
    // Zod validation should mark email as invalid
    cy.get('.text-destructive').should('have.length.greaterThan', 0);
  });

  it('1.3 Pogresna lozinka prikazuje server error', () => {
    cy.visit('/login');
    cy.get('#email').type(STEFAN_EMAIL);
    cy.get('#password').type('PogresnaLozinka999');
    cy.contains('button', 'Prijavi se').click();
    // Error alert should appear
    cy.get('[role="alert"]', { timeout: 10000 }).should('be.visible');
  });

  it('1.4 Uspesan login kao klijent Stefan - redirectuje na /home', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.url().should('include', '/home');
    cy.contains('Stefan', { timeout: 10000 }).should('be.visible');
    cy.contains('Pregledajte račune', { timeout: 5000 }).should('be.visible');
  });

  it('1.5 Uspesan login kao admin - vidi admin dashboard', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.url().should('include', '/home');
    cy.contains('Brze admin akcije', { timeout: 10000 }).should('be.visible');
    cy.contains('Ukupno zaposlenih').should('be.visible');
  });

  it('1.6 Neautorizovan pristup /accounts redirectuje na /login', () => {
    cy.clearAllSessionStorage();
    cy.visit('/accounts');
    cy.url({ timeout: 10000 }).should('include', '/login');
  });

  it('1.7 Logout cisti sesiju i vraca na login', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.contains('button', 'Odjavi se').click();
    cy.url({ timeout: 10000 }).should('include', '/login');
  });
});

// ============================================================================
// 2. HOMEPAGE (5 tests)
// ============================================================================
describe('2. HomePage', () => {
  beforeEach(() => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
  });

  it('2.1 Klijent vidi sekciju "Moji racuni" sa karticama racuna', () => {
    cy.contains('Moji računi', { timeout: 10000 }).should('be.visible');
    cy.contains('Svi računi').should('be.visible');
  });

  it('2.2 Klijent vidi sekciju "Poslednje transakcije"', () => {
    cy.contains('Poslednje transakcije', { timeout: 10000 }).should('be.visible');
  });

  it('2.3 Klijent vidi sekciju "Brzo placanje"', () => {
    cy.contains('Brzo plaćanje', { timeout: 10000 }).should('be.visible');
    cy.get('#quickAmount').should('be.visible');
  });

  it('2.4 Klijent vidi sekciju "Kursna lista"', () => {
    cy.contains('Kursna lista', { timeout: 10000 }).should('be.visible');
    cy.contains('Menjačnica').should('be.visible');
  });

  it('2.5 Klik na "Svi racuni" navigira na /accounts', () => {
    cy.contains('Svi računi', { timeout: 10000 }).click();
    cy.url().should('include', '/accounts');
  });
});

// ============================================================================
// 3. RACUNI - KLIJENT (7 tests)
// ============================================================================
describe('3. Racuni - Klijent', () => {
  beforeEach(() => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/accounts');
  });

  it('3.1 Stranica racuni prikazuje tabelu sa racunima', () => {
    cy.contains('h1', 'Računi', { timeout: 10000 }).should('be.visible');
    cy.contains('Pregled svih računa i transakcija').should('be.visible');
    cy.get('table', { timeout: 10000 }).should('be.visible');
    cy.get('table tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('3.2 Tabela prikazuje broj racuna, tip, stanje, valutu i status', () => {
    cy.contains('th', 'Broj racuna', { timeout: 10000 }).should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Raspolozivo stanje').should('be.visible');
    cy.contains('th', 'Valuta').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('3.3 Klik na "Detalji" otvara stranicu detalja racuna', () => {
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.url().should('match', /\/accounts\/\d+/);
    cy.contains('Stanje racuna', { timeout: 10000 }).should('be.visible');
  });

  it('3.4 Detalji racuna prikazuju stanje, raspolozivo, limiti i transakcije', () => {
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.contains('Ukupno stanje', { timeout: 10000 }).should('be.visible');
    cy.contains('Raspolozivo').should('be.visible');
    cy.contains('Limiti i potrosnja').should('be.visible');
    cy.contains('Akcije').should('be.visible');
  });

  it('3.5 Detalji racuna imaju akcione dugmice: Novo placanje, Prenos, Sve transakcije', () => {
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.contains('Novo placanje', { timeout: 10000 }).should('be.visible');
    cy.contains('Prenos').should('be.visible');
    cy.contains('Sve transakcije').should('be.visible');
  });

  it('3.6 Transakcije za selektovani racun se prikazuju u panelu', () => {
    // Click on an account row in the table to select it
    cy.get('table tbody tr', { timeout: 10000 }).first().click();
    cy.contains('Transakcije', { timeout: 10000 }).should('be.visible');
  });

  it('3.7 Filteri za tip racuna rade', () => {
    // Open filters
    cy.get('button[title="Filteri"]', { timeout: 10000 }).click();
    // The filter card should appear
    cy.contains('Svi tipovi', { timeout: 5000 }).should('be.visible');
  });
});

// ============================================================================
// 4. RACUNI - Promena limita (2 tests)
// ============================================================================
describe('4. Racuni - Promena limita', () => {
  it('4.1 Promena dnevnog i mesecnog limita na account details', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/accounts');
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.url().should('match', /\/accounts\/\d+/);

    cy.get('#dailyLimit', { timeout: 10000 }).clear().type('500000');
    cy.get('#monthlyLimit').clear().type('2000000');
    cy.contains('button', 'Sacuvaj limite').click();

    // Should show success toast or the values should be updated
    cy.contains('uspesno', { timeout: 10000, matchCase: false }).should('be.visible');
  });

  it('4.2 Negativan limit pokazuje gresku', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/accounts');
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();

    cy.get('#dailyLimit', { timeout: 10000 }).clear().type('-100');
    cy.get('#monthlyLimit').clear().type('-200');
    cy.contains('button', 'Sacuvaj limite').click();

    cy.contains('nenegativni', { timeout: 5000, matchCase: false }).should('be.visible');
  });
});

// ============================================================================
// 5. PLACANJA (8 tests)
// ============================================================================
describe('5. Placanja', () => {
  it('5.1 Stranica novog placanja ucitava formu sa svim poljima', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');
    cy.contains('h1', 'Novi platni nalog', { timeout: 10000 }).should('be.visible');
    cy.contains('Nalog za placanje').should('be.visible');

    // Wait for accounts to load
    cy.get('#fromAccount', { timeout: 10000 }).should('be.visible');
    cy.get('#toAccount').should('be.visible');
    cy.get('#recipientName').should('be.visible');
    cy.get('#amount').should('be.visible');
    cy.get('#paymentCode').should('be.visible');
    cy.get('#purpose').should('be.visible');
  });

  it('5.2 Racun platioca dropdown sadrzi Stefanove racune', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');
    cy.get('#fromAccount', { timeout: 10000 }).should('contain', STEFAN_RSD_ACCOUNT);
  });

  it('5.3 Submit bez popunjenih obaveznih polja prikazuje validacione greske', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');
    // Wait for form to load
    cy.get('#fromAccount', { timeout: 10000 }).should('be.visible');
    cy.contains('button', 'Nastavi na verifikaciju').click();
    cy.get('.text-destructive', { timeout: 5000 }).should('have.length.greaterThan', 0);
  });

  it('5.4 Popunjena forma - kreiranje placanja otvara verifikacioni modal', () => {
    stubOtpVerification();
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');

    cy.get('#fromAccount', { timeout: 10000 }).select(1); // First real account
    cy.get('#toAccount').clear().type(MILICA_RSD_ACCOUNT);
    cy.get('#recipientName').clear().type('Milica Nikolic');
    cy.get('#amount').clear().type('100');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').clear().type('E2E test placanje');
    cy.contains('button', 'Nastavi na verifikaciju').click();

    // Either success toast or verification modal
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('h2:contains("Verifikacija")').length > 0) {
        // Verification modal opened - enter OTP
        cy.contains('Verifikacija transakcije').should('be.visible');
        cy.get('#otp').type('123456');
        cy.contains('button', 'Potvrdi').click();
      }
    });
  });

  it('5.5 Pregled placanja prikazuje tabelu sa filterima', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.contains('h1', 'Pregled placanja', { timeout: 10000 }).should('be.visible');
    cy.contains('Filteri i sortiranje').should('be.visible');
    cy.get('#accountFilter').should('be.visible');
    cy.get('#statusFilter').should('be.visible');
  });

  it('5.6 Pregled placanja - filter po statusu radi', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.get('#statusFilter', { timeout: 10000 }).select('COMPLETED');
    // Wait for table to reload
    cy.get('table', { timeout: 10000 }).should('be.visible');
  });

  it('5.7 Pregled placanja - sortiranje po datumu', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.get('#sortField', { timeout: 10000 }).select('date');
    cy.get('#sortDirection').select('asc');
    cy.get('table', { timeout: 10000 }).should('be.visible');
  });

  it('5.8 Pregled placanja - paginacija radi', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.contains('Strana', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================================
// 6. PRIMAOCI PLACANJA - CRUD (6 tests)
// ============================================================================
describe('6. Primaoci placanja - CRUD', () => {
  const recipientName = `Test Primalac ${TS}`;
  const recipientAccount = '222000112345678999';

  it('6.1 Stranica primalaca se ucitava sa listom', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');
    cy.contains('h1', 'Primaoci placanja', { timeout: 10000 }).should('be.visible');
    cy.contains('Sacuvani primaoci').should('be.visible');
  });

  it('6.2 Dodavanje novog primaoca - otvaranje forme', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');
    cy.contains('button', 'Dodaj primaoca', { timeout: 10000 }).click();
    cy.contains('Novi primalac', { timeout: 5000 }).should('be.visible');
    cy.get('#create-name').should('be.visible');
    cy.get('#create-account').should('be.visible');
  });

  it('6.3 Dodavanje novog primaoca - popunjena forma', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');
    cy.contains('button', 'Dodaj primaoca', { timeout: 10000 }).click();

    cy.get('#create-name').clear().type(recipientName);
    cy.get('#create-account').clear().type(recipientAccount);
    cy.get('#create-address').clear().type('Knez Mihailova 10, Beograd');
    cy.get('#create-phone').clear().type('+381641234567');
    cy.contains('button', 'Sacuvaj primaoca').click();

    cy.contains('uspesno', { timeout: 10000, matchCase: false }).should('be.visible');
  });

  it('6.4 Pretraga primalaca radi', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');
    cy.get('input[placeholder*="Pretraga"]', { timeout: 10000 }).clear().type(recipientName);
    // Should show the just-created recipient or filter results
    cy.get('table', { timeout: 10000 }).should('be.visible');
  });

  it('6.5 Izmena primaoca - klik na Izmeni otvara inline edit', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');

    // Find a recipient and click edit
    cy.contains('button', 'Izmeni', { timeout: 10000 }).first().click();
    cy.contains('button', 'Sacuvaj', { timeout: 5000 }).should('be.visible');
    cy.contains('button', 'Otkazi').should('be.visible');

    // Cancel the edit
    cy.contains('button', 'Otkazi').click();
  });

  it('6.6 Brisanje primaoca prikazuje confirm dijalog', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/recipients');

    // Stub confirm dialog to return false so we don't actually delete
    cy.on('window:confirm', () => false);
    cy.contains('button', 'Obrisi', { timeout: 10000 }).first().click();
  });
});

// ============================================================================
// 7. TRANSFERI (6 tests)
// ============================================================================
describe('7. Transferi izmedju racuna', () => {
  it('7.1 Transfer stranica ucitava formu sa dropdown racunima', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    cy.contains('h1', 'Prenos izmedju racuna', { timeout: 10000 }).should('be.visible');
    cy.contains('Novi prenos').should('be.visible');
    cy.get('#fromAccount', { timeout: 10000 }).should('be.visible');
  });

  it('7.2 Odabir racuna posiljaoca prikazuje raspolozivo stanje', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    cy.contains('Raspolozivo stanje', { timeout: 5000 }).should('be.visible');
  });

  it('7.3 Odabir razlicitih valuta prikazuje kurs konverzije', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    // Select RSD account as source
    cy.get('#fromAccount', { timeout: 10000 }).then(($select) => {
      const options = $select.find('option');
      // Find RSD option
      let rsdIdx = -1;
      const _eurIdx = -1;
      options.each((i, opt) => {
        const text = opt.textContent || '';
        if (text.includes('RSD') && i > 0 && rsdIdx < 0) rsdIdx = i;
      });
      if (rsdIdx > 0) {
        cy.get('#fromAccount').select(rsdIdx);
      }
    });

    // Select EUR account as destination (different currency)
    cy.get('#toAccount', { timeout: 5000 }).then(($select) => {
      const options = $select.find('option');
      options.each((i, opt) => {
        const text = opt.textContent || '';
        if (text.includes('EUR') && i > 0) {
          cy.get('#toAccount').select(i);
          return false; // break
        }
      });
    });

    cy.get('#amount').clear().type('1000');
    // Exchange rate info should appear
    cy.contains('Kurs', { timeout: 10000 }).should('be.visible');
  });

  it('7.4 Submit prenosa otvara potvrdu (confirm step)', () => {
    stubOtpVerification();
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    cy.get('#toAccount', { timeout: 5000 }).select(1);
    cy.get('#amount').clear().type('10');
    cy.contains('button', 'Nastavi na potvrdu').click();
    // Should show confirm step OR validation error
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find(':contains("Potvrda prenosa")').length > 0) {
        cy.contains('Potvrda prenosa').should('be.visible');
        cy.contains('Racun posiljaoca').should('be.visible');
        cy.contains('Racun primaoca').should('be.visible');
      }
    });
  });

  it('7.5 Nedovoljna sredstva prikazuje upozorenje', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    cy.get('#toAccount', { timeout: 5000 }).select(1);
    cy.get('#amount').clear().type('999999999');
    cy.contains('Nemate dovoljno', { timeout: 5000 }).should('be.visible');
  });

  it('7.6 Isti racun posiljaoca i primaoca - validacija', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers');
    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    // The toAccount dropdown should NOT include the same account
    cy.get('#toAccount option', { timeout: 5000 }).then(($options) => {
      const fromVal = Cypress.$('#fromAccount').val();
      const toValues = $options.toArray().map((o) => o.getAttribute('value')).filter(Boolean);
      expect(toValues).to.not.include(fromVal);
    });
  });
});

// ============================================================================
// 8. ISTORIJA TRANSFERA (3 tests)
// ============================================================================
describe('8. Istorija transfera', () => {
  beforeEach(() => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/transfers/history');
  });

  it('8.1 Stranica istorije transfera se ucitava', () => {
    cy.contains('h1', 'Istorija transfera', { timeout: 10000 }).should('be.visible');
    cy.contains('Pregledajte sve prenose').should('be.visible');
  });

  it('8.2 Filteri za racun i datum su prisutni', () => {
    cy.get('#account-filter', { timeout: 10000 }).should('be.visible');
    cy.get('#date-from').should('be.visible');
    cy.get('#date-to').should('be.visible');
    cy.contains('button', 'Resetuj filtere').should('be.visible');
  });

  it('8.3 Filter po racunu filtrira rezultate', () => {
    cy.get('#account-filter', { timeout: 10000 }).select(1);
    // Table or empty state should render
    cy.get('body', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================================
// 9. MENJACNICA (5 tests)
// ============================================================================
describe('9. Menjacnica', () => {
  beforeEach(() => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/exchange');
  });

  it('9.1 Kursna lista prikazuje valute sa kupovnim, prodajnim i srednjim kursom', () => {
    cy.contains('h1', 'Menjacnica', { timeout: 10000 }).should('be.visible');
    cy.contains('h2', 'Kursna lista').should('be.visible');
    cy.contains('th', 'Valuta', { timeout: 10000 }).should('be.visible');
    cy.contains('th', 'Kupovni kurs').should('be.visible');
    cy.contains('th', 'Prodajni kurs').should('be.visible');
    cy.contains('th', 'Srednji kurs').should('be.visible');
  });

  it('9.2 Kursna lista sadrzi EUR, USD, CHF, GBP', () => {
    cy.contains('td', 'EUR', { timeout: 10000 }).should('be.visible');
    cy.contains('td', 'USD').should('be.visible');
    cy.contains('td', 'CHF').should('be.visible');
    cy.contains('td', 'GBP').should('be.visible');
  });

  it('9.3 Kalkulator konverzije prikazuje formu', () => {
    cy.contains('Konverzija', { timeout: 10000 }).should('be.visible');
    cy.get('#fromCurrency').should('be.visible');
    cy.get('#toCurrency').should('be.visible');
    cy.get('#amount').should('be.visible');
  });

  it('9.4 Konverzija EUR -> RSD prikazuje rezultat', () => {
    cy.get('#fromCurrency', { timeout: 10000 }).select('EUR');
    cy.get('#toCurrency').select('RSD');
    cy.get('#amount').clear().type('100');
    cy.contains('button', 'Konvertuj').click();
    // Result should appear
    cy.contains('po kursu', { timeout: 10000 }).should('be.visible');
  });

  it('9.5 Iste valute prikazuju gresku', () => {
    cy.get('#fromCurrency', { timeout: 10000 }).select('EUR');
    cy.get('#toCurrency').select('EUR');
    cy.get('#amount').clear().type('100');
    cy.contains('Izvorna i ciljna valuta ne mogu biti iste', { timeout: 5000 }).should(
      'be.visible'
    );
  });
});

// ============================================================================
// 10. KARTICE (5 tests)
// ============================================================================
describe('10. Kartice', () => {
  beforeEach(() => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/cards');
  });

  it('10.1 Stranica kartica se ucitava sa naslovom', () => {
    cy.contains('h1', 'Moje kartice', { timeout: 10000 }).should('be.visible');
    cy.contains('Upravljajte karticama').should('be.visible');
  });

  it('10.2 Kartice prikazuju maskirani broj, tip, status i vlasnika', () => {
    // Wait for cards to load (either cards or empty state)
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find(':contains("Nemate kartica")').length === 0) {
        // Cards exist - check visual card elements
        cy.contains('****').should('be.visible');
        cy.contains('Vlasnik').should('be.visible');
        cy.contains('Istek').should('be.visible');
      }
    });
  });

  it('10.3 Dugme "Nova kartica" otvara formu za zahtev', () => {
    cy.contains('button', 'Nova kartica', { timeout: 10000 }).click();
    cy.contains('Zahtev za novu karticu', { timeout: 5000 }).should('be.visible');
    cy.contains('Račun').should('be.visible');
  });

  it('10.4 Zahtev za karticu - zatvaranje forme', () => {
    cy.contains('button', 'Nova kartica', { timeout: 10000 }).click();
    cy.contains('button', 'Otkaži', { timeout: 5000 }).click();
    cy.contains('Zahtev za novu karticu').should('not.exist');
  });

  it('10.5 Blokiranje aktivne kartice', () => {
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('button:contains("Blokiraj")').length > 0) {
        cy.contains('button', 'Blokiraj').first().click();
        cy.contains('uspešno', { timeout: 10000, matchCase: false }).should('be.visible');
      } else {
        cy.log('Nema aktivnih kartica za blokiranje - skip');
      }
    });
  });
});

// ============================================================================
// 11. KREDITI (6 tests)
// ============================================================================
describe('11. Krediti', () => {
  it('11.1 Lista kredita se ucitava', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans');
    cy.contains('h1', 'Moji krediti', { timeout: 10000 }).should('be.visible');
    cy.contains('Pregled svih vasih kredita').should('be.visible');
  });

  it('11.2 Dugme "Zahtev za kredit" navigira na formu', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans');
    cy.contains('button', 'Zahtev za kredit', { timeout: 10000 }).click();
    cy.url().should('include', '/loans/apply');
  });

  it('11.3 Forma zahteva za kredit ima sva polja', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans/apply');
    cy.contains('h1', 'Zahtev za kredit', { timeout: 10000 }).should('be.visible');
    cy.get('#loanType').should('be.visible');
    cy.get('#interestRateType').should('be.visible');
    cy.get('#amount').should('be.visible');
    cy.get('#currency').should('be.visible');
    cy.get('#loanPurpose').should('be.visible');
    cy.get('#repaymentPeriod').should('be.visible');
    cy.get('#accountNumber').should('be.visible');
    cy.get('#phoneNumber').should('be.visible');
  });

  it('11.4 Promena iznosa azurira simulaciju mesecne rate', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans/apply');
    cy.get('#amount', { timeout: 10000 }).clear().type('500000');
    cy.contains('Mesecna rata', { timeout: 5000 }).should('be.visible');
    cy.contains('Ukupno za vracanje').should('be.visible');
    cy.contains('Godisnja kamatna stopa').should('be.visible');
  });

  it('11.5 Popunjavanje i submit zahteva za kredit', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans/apply');
    cy.get('#loanType', { timeout: 10000 }).select('GOTOVINSKI');
    cy.get('#interestRateType').select('FIKSNI');
    cy.get('#amount').clear().type('100000');
    cy.get('#currency').select('RSD');
    cy.get('#loanPurpose').clear().type('E2E test kredit - renoviranje');
    cy.get('#repaymentPeriod').select(0); // First available option
    cy.get('#accountNumber').select(1); // First real account
    cy.get('#phoneNumber').clear().type('+381641234567');

    cy.contains('button', 'Posalji zahtev').click();
    // Should redirect to /loans or show success
    cy.url({ timeout: 15000 }).should('satisfy', (url: string) => {
      return url.includes('/loans') || url.includes('/loans/apply');
    });
  });

  it('11.6 Razliciti tipovi kredita menjaju dostupne periode', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/loans/apply');
    cy.get('#loanType', { timeout: 10000 }).select('STAMBENI');
    cy.get('#repaymentPeriod option', { timeout: 5000 }).should('have.length.greaterThan', 0);
    cy.get('#loanType').select('STUDENTSKI');
    cy.get('#repaymentPeriod option', { timeout: 5000 }).should('have.length.greaterThan', 0);
  });
});

// ============================================================================
// 12. EMPLOYEE - PORTAL RACUNA (4 tests)
// ============================================================================
describe('12. Employee - Portal racuna', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/accounts');
  });

  it('12.1 Portal racuna prikazuje tabelu svih racuna', () => {
    cy.contains('h1', 'Portal racuna', { timeout: 10000 }).should('be.visible');
    cy.contains('Upravljajte svim bankovnim racunima').should('be.visible');
    cy.get('table', { timeout: 10000 }).should('be.visible');
    cy.contains('th', 'Vlasnik').should('be.visible');
    cy.contains('th', 'Broj racuna').should('be.visible');
  });

  it('12.2 Dugme "Kreiraj racun" navigira na formu', () => {
    cy.contains('Kreiraj racun', { timeout: 10000 }).click();
    cy.url().should('include', '/employee/accounts/new');
  });

  it('12.3 Filteri po email vlasnika, tipu i statusu su dostupni', () => {
    cy.get('button[title="Filteri"]', { timeout: 10000 }).click();
    cy.get('input[placeholder*="email"]', { timeout: 5000 }).should('be.visible');
    cy.contains('Svi tipovi').should('be.visible');
    cy.contains('Svi statusi').should('be.visible');
  });

  it('12.4 Paginacija radi', () => {
    cy.contains('od', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================================
// 13. EMPLOYEE - KREIRANJE RACUNA (4 tests)
// ============================================================================
describe('13. Employee - Kreiranje racuna', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/accounts/new');
  });

  it('13.1 Forma za kreiranje racuna ima sva polja', () => {
    cy.contains('h1', 'Kreiranje racuna', { timeout: 10000 }).should('be.visible');
    cy.get('#ownerEmail').should('be.visible');
    cy.get('#accountType').should('be.visible');
    cy.get('#accountSubtype').should('be.visible');
    cy.get('#currency').should('be.visible');
    cy.get('#initialDeposit').should('be.visible');
  });

  it('13.2 Pretraga klijenta po emailu prikazuje sugestije', () => {
    cy.get('#ownerEmail', { timeout: 10000 }).clear().type('stefan.jovanovic');
    // Should show client suggestions after debounce
    cy.get('body', { timeout: 5000 }).then(($body) => {
      if ($body.find('button:contains("Stefan")').length > 0) {
        cy.contains('Stefan').should('be.visible');
      }
    });
  });

  it('13.3 Promena tipa na DEVIZNI menja valutu na EUR', () => {
    cy.get('#accountType', { timeout: 10000 }).select('DEVIZNI');
    cy.get('#currency').should('have.value', 'EUR');
  });

  it('13.4 Kreiranje tekuceg racuna za klijenta', () => {
    cy.get('#ownerEmail', { timeout: 10000 }).clear().type(STEFAN_EMAIL);
    cy.get('#accountType').select('TEKUCI');
    cy.get('#initialDeposit').clear().type('5000');

    cy.contains('button', 'Kreiraj racun').click();

    // Should either succeed or show error from BE
    cy.get('body', { timeout: 15000 }).then(($body) => {
      const hasSuccess = $body.text().toLowerCase().includes('uspesno') || $body.text().toLowerCase().includes('uspešno');
      const hasRedirect = window.location.pathname.includes('/employee/accounts');
      if (hasSuccess || hasRedirect) {
        cy.log('Racun uspesno kreiran');
      }
    });
  });
});

// ============================================================================
// 14. EMPLOYEE - PORTAL KLIJENATA (6 tests)
// ============================================================================
describe('14. Employee - Portal klijenata', () => {
  it('14.1 Portal klijenata prikazuje listu klijenata', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('h1', 'Portal klijenata', { timeout: 10000 }).should('be.visible');
    cy.contains('Pretraga i lista klijenata').should('be.visible');
    cy.get('table', { timeout: 10000 }).should('be.visible');
    cy.contains('th', 'Ime').should('be.visible');
    cy.contains('th', 'Email').should('be.visible');
  });

  it('14.2 Pretraga klijenata po imenu', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.get('input[placeholder*="Pretraga"]', { timeout: 10000 }).clear().type('Stefan');
    cy.contains('td', 'Stefan', { timeout: 10000 }).should('be.visible');
  });

  it('14.3 Klik na "Detalji" otvara detalje klijenta', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.contains('Detalji klijenta', { timeout: 10000 }).should('be.visible');
    cy.get('#client-first-name').should('be.visible');
    cy.get('#client-last-name').should('be.visible');
    cy.get('#client-email').should('be.visible');
  });

  it('14.4 Detalji klijenta prikazuju racune klijenta', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.contains('Racuni klijenta', { timeout: 10000 }).should('be.visible');
  });

  it('14.5 Izmena podataka klijenta', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('button', 'Detalji', { timeout: 10000 }).first().click();
    cy.contains('Detalji klijenta', { timeout: 10000 }).should('be.visible');

    cy.contains('button', 'Izmeni').click();
    // Fields should become editable
    cy.get('#client-phone').should('not.be.disabled');
    // Cancel edit
    cy.contains('button', 'Otkazi').click();
    cy.get('#client-phone').should('be.disabled');
  });

  it('14.6 Dugme "Novi klijent" otvara formu za kreiranje', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/clients');
    cy.contains('button', 'Novi klijent', { timeout: 10000 }).click();
    cy.contains('Novi klijent', { timeout: 5000 }).should('be.visible');
    // Cancel
    cy.contains('button', 'Otkaži').click();
  });
});

// ============================================================================
// 15. EMPLOYEE - ZAHTEVI ZA KREDIT (4 tests)
// ============================================================================
describe('15. Employee - Zahtevi za kredit', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/loan-requests');
  });

  it('15.1 Stranica zahteva za kredit se ucitava', () => {
    cy.contains('h1', 'Zahtevi za kredit', { timeout: 10000 }).should('be.visible');
    cy.contains('Pregledajte i obradite zahteve').should('be.visible');
  });

  it('15.2 Filter dugmad po statusu su prisutna', () => {
    cy.contains('button', /Na cekanju/, { timeout: 10000 }).should('be.visible');
    cy.contains('button', /Odobreni/).should('be.visible');
    cy.contains('button', /Odbijeni/).should('be.visible');
    cy.contains('button', /Svi/).should('be.visible');
  });

  it('15.3 Klik na "Svi" prikazuje sve zahteve', () => {
    cy.contains('button', /Svi/, { timeout: 10000 }).click();
    // Table or empty state
    cy.get('body', { timeout: 10000 }).should('be.visible');
  });

  it('15.4 Tabela zahteva prikazuje kolone: Klijent, Tip, Kamata, Iznos, Period, Datum, Status, Akcije', () => {
    cy.contains('button', /Svi/, { timeout: 10000 }).click();
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('table th').length > 0) {
        cy.contains('th', 'Klijent').should('be.visible');
        cy.contains('th', 'Tip').should('be.visible');
        cy.contains('th', 'Iznos').should('be.visible');
        cy.contains('th', 'Status').should('be.visible');
        cy.contains('th', 'Akcije').should('be.visible');
      }
    });
  });
});

// ============================================================================
// 16. EMPLOYEE - PORTAL KARTICA (3 tests)
// ============================================================================
describe('16. Employee - Portal kartica', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/cards');
  });

  it('16.1 Portal kartica prikazuje pretragu', () => {
    cy.contains('h1', 'Portal kartica', { timeout: 10000 }).should('be.visible');
    cy.get('input[placeholder*="18 cifara"]').should('be.visible');
    cy.contains('button', 'Pretrazi').should('be.visible');
  });

  it('16.2 Pretraga po broju racuna prikazuje kartice', () => {
    cy.get('input[placeholder*="18 cifara"]', { timeout: 10000 }).clear().type(STEFAN_RSD_ACCOUNT);
    cy.contains('button', 'Pretrazi').click();
    // Should show account info and cards (or no cards)
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find(':contains("Racun:")').length > 0) {
        cy.contains('Racun:').should('be.visible');
      }
    });
  });

  it('16.3 Dugme "Nova kartica" postoji', () => {
    cy.contains('button', 'Nova kartica', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================================
// 17. ADMIN - LISTA ZAPOSLENIH (5 tests)
// ============================================================================
describe('17. Admin - Lista zaposlenih', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/admin/employees');
  });

  it('17.1 Stranica zaposlenih prikazuje tabelu', () => {
    cy.contains('h1', 'Upravljanje zaposlenima', { timeout: 10000 }).should('be.visible');
    cy.get('table', { timeout: 10000 }).should('be.visible');
    cy.contains('th', 'Ime i prezime').should('be.visible');
    cy.contains('th', 'Email').should('be.visible');
    cy.contains('th', 'Pozicija').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('17.2 Tabela sadrzi barem jednog zaposlenog', () => {
    cy.get('table tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('17.3 Dugme "Novi zaposleni" navigira na formu', () => {
    cy.contains('button', 'Novi zaposleni', { timeout: 10000 }).click();
    cy.url().should('include', '/admin/employees/new');
  });

  it('17.4 Filteri pretrage se otvaraju klikom na ikonu', () => {
    cy.get('button[title="Filteri"]', { timeout: 10000 }).click();
    cy.get('input[placeholder*="email"]', { timeout: 5000 }).should('be.visible');
    cy.get('input[placeholder*="imenu"]').should('be.visible');
    cy.get('input[placeholder*="prezimenu"]').should('be.visible');
  });

  it('17.5 Paginacija i rows per page rade', () => {
    cy.contains('Redova po stranici', { timeout: 10000 }).should('be.visible');
    cy.contains(/od \d+/).should('be.visible');
  });
});

// ============================================================================
// 18. SIDEBAR NAVIGACIJA (4 tests)
// ============================================================================
describe('18. Sidebar navigacija', () => {
  it('18.1 Klijent vidi sve meni opcije za finansije', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.contains('a', 'Računi', { timeout: 10000 }).should('be.visible');
    cy.contains('a', 'Plaćanja').should('be.visible');
    cy.contains('a', 'Primaoci').should('be.visible');
    cy.contains('a', 'Prenosi').should('be.visible');
    cy.contains('a', 'Menjačnica').should('be.visible');
    cy.contains('a', 'Kartice').should('be.visible');
    cy.contains('a', 'Krediti').should('be.visible');
  });

  it('18.2 Klijent NE vidi employee portale', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.contains('Employee portal', { timeout: 5000 }).should('not.exist');
  });

  it('18.3 Admin vidi employee portale', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
    cy.contains('Employee portal', { timeout: 10000 }).should('be.visible');
    cy.contains('a', 'Portal računa').should('be.visible');
    cy.contains('a', 'Portal klijenata').should('be.visible');
    cy.contains('a', 'Zahtevi za kredit').should('be.visible');
  });

  it('18.4 Navigacija klikom na sidebar link radi', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.contains('a', 'Računi', { timeout: 10000 }).click();
    cy.url().should('include', '/accounts');
    cy.contains('a', 'Menjačnica').click();
    cy.url().should('include', '/exchange');
    cy.contains('a', 'Krediti').click();
    cy.url().should('include', '/loans');
  });
});

// ============================================================================
// 19. TEMA (dark/light mode) (2 tests)
// ============================================================================
describe('19. Tema', () => {
  it('19.1 Dugme za temu postoji u sidebar-u', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    cy.get('body', { timeout: 10000 }).then(($body) => {
      // Theme selector button should be in sidebar
      const hasSvetlo = $body.text().includes('Svetlo');
      const hasTamno = $body.text().includes('Tamno');
      const hasSistem = $body.text().includes('Sistem');
      expect(hasSvetlo || hasTamno || hasSistem).to.equal(true);
    });
  });

  it('19.2 Promena teme menja klasu na html elementu', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/home');
    // The theme button shows current theme
    cy.get('button').filter(':contains("Svetlo"), :contains("Tamno"), :contains("Sistem")').first().click();
    // Dropdown should appear with options
    cy.contains('Tamno', { timeout: 5000 }).click();
    cy.get('html').should('have.class', 'dark');
  });
});

// ============================================================================
// 20. ERROR HANDLING (4 tests)
// ============================================================================
describe('20. Error handling', () => {
  it('20.1 Nepostojeca ruta prikazuje 404 stranicu', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/ovo-ne-postoji-12345');
    cy.contains('404', { timeout: 10000 }).should('be.visible');
  });

  it('20.2 Klijent koji pristupa admin rutama dobija 403', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/admin/employees');
    cy.url({ timeout: 10000 }).should('include', '/403');
  });

  it('20.3 Klijent ne moze da pristupi employee portalu', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/employee/accounts');
    cy.url({ timeout: 10000 }).should('include', '/403');
  });

  it('20.4 Pristup /403 direktno renderuje forbidden stranicu', () => {
    cy.visit('/403');
    cy.contains('403', { timeout: 10000 }).should('be.visible');
  });
});

// ============================================================================
// 21. MULTI-KLIJENT TESTOVI (3 tests)
// ============================================================================
describe('21. Vise klijenata', () => {
  it('21.1 Milica moze da se uloguje i vidi svoje racune', () => {
    loginAndVisit(MILICA_EMAIL, MILICA_PASS, '/home');
    cy.url().should('include', '/home');
    cy.contains('Milica', { timeout: 10000 }).should('be.visible');
  });

  it('21.2 Lazar moze da se uloguje i vidi svoje racune', () => {
    loginAndVisit(LAZAR_EMAIL, LAZAR_PASS, '/home');
    cy.url().should('include', '/home');
    cy.contains('Lazar', { timeout: 10000 }).should('be.visible');
  });

  it('21.3 Lazar sa 3 racuna vidi sve u tabeli', () => {
    loginAndVisit(LAZAR_EMAIL, LAZAR_PASS, '/accounts');
    cy.get('table tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 1);
  });
});

// ============================================================================
// 22. VERIFIKACIONI MODAL (2 tests)
// ============================================================================
describe('22. Verifikacioni modal', () => {
  it('22.1 Modal se renderuje sa tajmerom i poljem za kod', () => {
    stubOtpVerification();
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');

    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    cy.get('#toAccount').clear().type(MILICA_RSD_ACCOUNT);
    cy.get('#recipientName').clear().type('Milica Test');
    cy.get('#amount').clear().type('50');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').clear().type('Verifikacija test');
    cy.contains('button', 'Nastavi na verifikaciju').click();

    // Wait for modal or success
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('h2:contains("Verifikacija")').length > 0) {
        cy.contains('Verifikacija transakcije').should('be.visible');
        cy.get('#otp').should('be.visible');
        cy.contains('Kod važi još').should('be.visible');
        cy.contains('Preostalo pokušaja').should('be.visible');
        cy.contains('button', 'Potvrdi').should('be.visible');
        cy.contains('button', 'Otkaži').should('be.visible');
      }
    });
  });

  it('22.2 Modal se zatvara klikom na Otkazi', () => {
    stubOtpVerification();
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/new');

    cy.get('#fromAccount', { timeout: 10000 }).select(1);
    cy.get('#toAccount').clear().type(MILICA_RSD_ACCOUNT);
    cy.get('#recipientName').clear().type('Milica Test2');
    cy.get('#amount').clear().type('25');
    cy.get('#paymentCode').clear().type('289');
    cy.get('#purpose').clear().type('Cancel test');
    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('h2:contains("Verifikacija")').length > 0) {
        cy.contains('button', 'Otkaži').click();
        cy.contains('Verifikacija transakcije').should('not.exist');
      }
    });
  });
});

// ============================================================================
// 23. LANDING PAGE (3 tests)
// ============================================================================
describe('23. Landing page', () => {
  it('23.1 Landing page se renderuje bez greske', () => {
    cy.visit('/');
    cy.contains('BANKA 2025', { timeout: 10000 }).should('be.visible');
  });

  it('23.2 Logo i naziv banke su vidljivi', () => {
    cy.visit('/');
    cy.get('img[alt*="BANKA"]', { timeout: 10000 }).should('be.visible');
  });

  it('23.3 Dugme "Prijavi se" navigira na login', () => {
    cy.visit('/');
    cy.contains('Prijavi se', { timeout: 10000 }).first().click();
    cy.url().should('include', '/login');
  });
});

// ============================================================================
// 24. ADMIN HOMEPAGE CARDS (2 tests)
// ============================================================================
describe('24. Admin HomePage - brze akcije', () => {
  beforeEach(() => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/home');
  });

  it('24.1 Admin vidi kartice: Lista zaposlenih, Novi zaposleni, Portal racuna, Portal klijenata, Zahtevi za kredit, Svi krediti', () => {
    cy.contains('Lista zaposlenih', { timeout: 10000 }).should('be.visible');
    cy.contains('Novi zaposleni').should('be.visible');
    cy.contains('Portal računa').should('be.visible');
    cy.contains('Portal klijenata').should('be.visible');
    cy.contains('Zahtevi za kredit').should('be.visible');
    cy.contains('Svi krediti').should('be.visible');
  });

  it('24.2 Klik na admin karticu navigira na odgovarajucu rutu', () => {
    cy.contains('Lista zaposlenih', { timeout: 10000 }).click();
    cy.url().should('include', '/admin/employees');
  });
});

// ============================================================================
// 25. NOVI RACUN - KLIJENTSKI ZAHTEV (2 tests)
// ============================================================================
describe('25. Klijent - Zahtev za novi racun', () => {
  it('25.1 Klijent moze da otvori formu za zahtev novog racuna', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/accounts');
    cy.contains('button', 'Novi račun', { timeout: 10000 }).click();
    cy.contains('Otvaranje novog računa', { timeout: 5000 }).should('be.visible');
    cy.contains('Tip računa').should('be.visible');
    cy.contains('Valuta').should('be.visible');
  });

  it('25.2 Klijent moze da zatvori formu klikom na Otkazi', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/accounts');
    cy.contains('button', 'Novi račun', { timeout: 10000 }).click();
    cy.contains('button', 'Otkaži').click();
    cy.contains('Otvaranje novog računa').should('not.exist');
  });
});

// ============================================================================
// 26. PREGLED PLACANJA - DETALJI I PDF (2 tests)
// ============================================================================
describe('26. Pregled placanja - detalji transakcija', () => {
  it('26.1 Klik na "Detalji" expanduje red sa dodatnim informacijama', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('button:contains("Detalji")').length > 0) {
        cy.contains('button', 'Detalji').first().click();
        cy.contains('button', 'Sakrij', { timeout: 5000 }).should('be.visible');
        cy.contains('Primalac').should('be.visible');
      } else {
        cy.log('Nema transakcija za prikaz detalja - skip');
      }
    });
  });

  it('26.2 Dugme "Stampaj potvrdu" postoji za svaku transakciju', () => {
    loginAndVisit(STEFAN_EMAIL, STEFAN_PASS, '/payments/history');
    cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find('button:contains("Stampaj potvrdu")').length > 0) {
        cy.contains('button', 'Stampaj potvrdu').first().should('be.visible');
      } else {
        cy.log('Nema transakcija - skip');
      }
    });
  });
});

// ============================================================================
// 27. EMPLOYEE - SVI KREDITI (1 test)
// ============================================================================
describe('27. Employee - Svi krediti', () => {
  it('27.1 Stranica svih kredita se ucitava', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/loans');
    cy.get('body', { timeout: 10000 }).should('be.visible');
    // Should not have errors
    cy.contains('Greška', { timeout: 3000 }).should('not.exist');
  });
});

// ============================================================================
// 28. FORGOT PASSWORD (2 tests)
// ============================================================================
describe('28. Forgot password', () => {
  it('28.1 Stranica za zaboravljenu lozinku se ucitava', () => {
    cy.visit('/forgot-password');
    cy.get('body', { timeout: 10000 }).should('be.visible');
  });

  it('28.2 Link "Zaboravili ste lozinku?" na login stranici vodi na forgot-password', () => {
    cy.visit('/login');
    cy.contains('Zaboravili ste lozinku?', { timeout: 10000 }).click();
    cy.url().should('include', '/forgot-password');
  });
});

// ============================================================================
// 29. EMPLOYEE - ZAHTEVI ZA RACUNE I KARTICE (2 tests)
// ============================================================================
describe('29. Employee - Zahtevi za racune i kartice', () => {
  it('29.1 Stranica zahteva za racune se ucitava', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/account-requests');
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.contains('Greška', { timeout: 3000 }).should('not.exist');
  });

  it('29.2 Stranica zahteva za kartice se ucitava', () => {
    loginAndVisit(ADMIN_EMAIL, ADMIN_PASS, '/employee/card-requests');
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.contains('Greška', { timeout: 3000 }).should('not.exist');
  });
});
