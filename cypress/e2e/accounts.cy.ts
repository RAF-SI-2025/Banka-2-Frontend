/// <reference types="cypress" />

const MOCK_ACCOUNTS = [
  {
    id: 1, accountNumber: '265000000000000112', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 500000, availableBalance: 485230.5,
    reservedBalance: 14769.5, dailyLimit: 200000, monthlyLimit: 1000000,
    dailySpending: 0, monthlySpending: 15000, maintenanceFee: 250,
    currency: 'RSD', ownerName: 'Stefan Jovanovic', createdAt: '2025-01-15',
  },
  {
    id: 2, accountNumber: '265000000000000229', name: 'Devizni racun - EUR',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 13000, availableBalance: 12500.0,
    reservedBalance: 500, dailyLimit: 50000, monthlyLimit: 200000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 3,
    currency: 'EUR', ownerName: 'Stefan Jovanovic', createdAt: '2025-02-01',
  },
  {
    id: 3, accountNumber: '265000000000000336', name: 'Poslovni racun - RSD',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 2800000, availableBalance: 2750000.0,
    reservedBalance: 50000, dailyLimit: 5000000, monthlyLimit: 20000000,
    dailySpending: 0, monthlySpending: 100000, maintenanceFee: 1500,
    currency: 'RSD', ownerName: 'Milica Nikolic', createdAt: '2025-01-20',
  },
  {
    id: 4, accountNumber: '265000000000000443', name: 'Tekuci racun - EUR',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 3500, availableBalance: 3200.75,
    reservedBalance: 299.25, dailyLimit: 10000, monthlyLimit: 50000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 2,
    currency: 'EUR', ownerName: 'Stefan Jovanovic', createdAt: '2025-03-01',
  },
  {
    id: 5, accountNumber: '265000000000000550', name: 'Devizni racun - RSD',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 1150000, availableBalance: 1100000.0,
    reservedBalance: 50000, dailyLimit: 500000, monthlyLimit: 2000000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 500,
    currency: 'RSD', ownerName: 'Lazar Petrovic', createdAt: '2025-01-25',
  },
  {
    id: 6, accountNumber: '265000000000000667', name: 'Poslovni racun - EUR',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 55000, availableBalance: 54000.0,
    reservedBalance: 1000, dailyLimit: 100000, monthlyLimit: 500000,
    dailySpending: 0, monthlySpending: 5000, maintenanceFee: 10,
    currency: 'EUR', ownerName: 'Milica Nikolic', createdAt: '2025-02-10',
  },
  {
    id: 7, accountNumber: '265000000000000774', name: 'Tekuci racun - USD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 9000, availableBalance: 8750.25,
    reservedBalance: 249.75, dailyLimit: 15000, monthlyLimit: 60000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 3,
    currency: 'USD', ownerName: 'Ana Markovic', createdAt: '2025-02-15',
  },
  {
    id: 8, accountNumber: '265000000000000881', name: 'Devizni racun - EUR',
    accountType: 'DEVIZNI', status: 'ACTIVE', balance: 26000, availableBalance: 25000.0,
    reservedBalance: 1000, dailyLimit: 50000, monthlyLimit: 200000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 5,
    currency: 'EUR', ownerName: 'Ana Markovic', createdAt: '2025-03-01',
  },
  {
    id: 9, accountNumber: '265000000000000998', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'ACTIVE', balance: 75000, availableBalance: 72300.0,
    reservedBalance: 2700, dailyLimit: 100000, monthlyLimit: 500000,
    dailySpending: 0, monthlySpending: 10000, maintenanceFee: 250,
    currency: 'RSD', ownerName: 'Lazar Petrovic', createdAt: '2025-01-30',
  },
  {
    id: 10, accountNumber: '265000000000001008', name: 'Poslovni racun - USD',
    accountType: 'POSLOVNI', status: 'ACTIVE', balance: 125000, availableBalance: 120000.0,
    reservedBalance: 5000, dailyLimit: 200000, monthlyLimit: 1000000,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 15,
    currency: 'USD', ownerName: 'Milica Nikolic', createdAt: '2025-02-20',
  },
  {
    id: 11, accountNumber: '265000000000001115', name: 'Tekuci racun - RSD',
    accountType: 'TEKUCI', status: 'INACTIVE', balance: 0, availableBalance: 0,
    reservedBalance: 0, dailyLimit: 0, monthlyLimit: 0,
    dailySpending: 0, monthlySpending: 0, maintenanceFee: 0,
    currency: 'RSD', ownerName: 'Nemanja Savic', createdAt: '2024-06-01',
  },
];

// Transakcije za auto-selektovani racun (265000000000000336 - Poslovni, najvisi balans)
const MOCK_TRANSACTIONS = {
  content: [
    {
      id: 1, fromAccountNumber: '265000000000000336', toAccountNumber: '265000000000000229',
      amount: 15000, currency: 'RSD', description: 'Uplata', referenceNumber: 'REF001',
      paymentCode: '289', paymentPurpose: 'Placanje racuna za struju',
      recipientName: 'EPS Distribucija', status: 'COMPLETED', createdAt: '2025-03-10',
    },
    {
      id: 2, fromAccountNumber: '265000000000000112', toAccountNumber: '265000000000000336',
      amount: 50000, currency: 'RSD', description: 'Prenos', referenceNumber: 'REF002',
      paymentCode: '289', paymentPurpose: 'Prenos sredstava',
      recipientName: 'Milica Nikolic', status: 'COMPLETED', createdAt: '2025-03-09',
    },
    {
      id: 3, fromAccountNumber: '265000000000000336', toAccountNumber: '265000000000000443',
      amount: 8500, currency: 'RSD', description: 'Placanje', referenceNumber: 'REF003',
      paymentCode: '221', paymentPurpose: 'Kupovina online',
      recipientName: 'Web Shop doo', status: 'PENDING', createdAt: '2025-03-11',
    },
    {
      id: 4, fromAccountNumber: '265000000000000336', toAccountNumber: '265000000000000550',
      amount: 3000, currency: 'RSD', description: 'Placanje', referenceNumber: 'REF004',
      paymentCode: '289', paymentPurpose: 'Pretplata na uslugu',
      recipientName: 'Telekom Srbija', status: 'REJECTED', createdAt: '2025-03-08',
    },
  ],
  totalElements: 4,
  totalPages: 1,
  size: 10,
  number: 0,
};

const EMPTY_TRANSACTIONS = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 10,
  number: 0,
};

function setupClientSession(win: Cypress.AUTWindow) {
  win.sessionStorage.setItem('accessToken', 'fake-access-token');
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 2,
      email: 'user@test.com',
      username: 'user',
      firstName: 'Stefan',
      lastName: 'Jovanovic',
      permissions: ['VIEW_STOCKS'],
    })
  );
}

function interceptAccountsApi() {
  cy.intercept('GET', '**/accounts/my', {
    statusCode: 200,
    body: MOCK_ACCOUNTS,
  }).as('getAccounts');
}

function interceptTransactionsApi(response = MOCK_TRANSACTIONS) {
  cy.intercept('GET', '**/transactions*', {
    statusCode: 200,
    body: response,
  }).as('getTransactions');
}

describe('Accounts - Lista racuna', () => {
  beforeEach(() => {
    interceptAccountsApi();
    interceptTransactionsApi();

    cy.visit('/accounts', {
      onBeforeLoad(win) {
        setupClientSession(win);
      },
    });

    cy.contains('Racuni', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje naslov stranice', () => {
    cy.contains('h1', 'Racuni').should('be.visible');
  });

  it('prikazuje tabelu sa racunima', () => {
    cy.get('table').first().should('be.visible');
    cy.contains('th', 'Broj racuna').should('be.visible');
    cy.contains('th', 'Naziv').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Raspolozivo stanje').should('be.visible');
    cy.contains('th', 'Valuta').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
  });

  it('prikazuje racune u tabeli', () => {
    cy.get('table').first().find('tbody tr').should('have.length.greaterThan', 0);
    cy.contains('265-').should('be.visible');
  });

  it('prikazuje badge za tip racuna', () => {
    cy.contains('Tekuci').should('be.visible');
    cy.contains('Devizni').should('be.visible');
    cy.contains('Poslovni').should('be.visible');
  });

  it('prikazuje badge za status racuna', () => {
    cy.contains('Aktivan').should('be.visible');
  });

  it('prikazuje paginaciju', () => {
    cy.contains('Redova po stranici:').should('be.visible');
    cy.contains('od').should('be.visible');
  });

  it('racuni su sortirani po stanju opadajuce', () => {
    cy.get('table').first().find('tbody tr').then(($rows) => {
      const balances: number[] = [];
      $rows.each((_, row) => {
        const cells = Cypress.$(row).find('td');
        const balanceText = cells.eq(3).text().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        const balance = parseFloat(balanceText);
        if (!isNaN(balance)) {
          balances.push(balance);
        }
      });
      for (let i = 1; i < balances.length; i++) {
        expect(balances[i]).to.be.at.most(balances[i - 1]);
      }
    });
  });

  describe('Selekcija racuna', () => {
    it('prvi racun je automatski selektovan', () => {
      cy.get('table').first().find('tbody tr').first().should('have.attr', 'data-selected', 'true');
    });

    it('klik na drugi racun menja selekciju', () => {
      cy.get('table').first().find('tbody tr').eq(1).click();
      cy.get('table').first().find('tbody tr').eq(1).should('have.attr', 'data-selected', 'true');
      cy.get('table').first().find('tbody tr').first().should('not.have.attr', 'data-selected');
    });

    it('dupli klik preusmerava na detalje racuna', () => {
      cy.get('table').first().find('tbody tr').first().dblclick();
      cy.url().should('include', '/accounts/');
    });
  });

  describe('Filter po tipu', () => {
    beforeEach(() => {
      cy.get('button[title="Filteri"]').first().click();
    });

    it('prikazuje filter sekciju', () => {
      cy.contains('Svi tipovi').should('be.visible');
    });

    it('filtrira po tekucem tipu', () => {
      cy.contains('[role="combobox"]', 'Svi tipovi').click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.get('table').first().find('tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Tekuci');
        });
      });
    });

    it('filtrira po deviznom tipu', () => {
      cy.contains('[role="combobox"]', 'Svi tipovi').click();
      cy.get('[role="option"]').contains('Devizni').click();

      cy.get('table').first().find('tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Devizni');
        });
      });
    });

    it('filtrira po poslovnom tipu', () => {
      cy.contains('[role="combobox"]', 'Svi tipovi').click();
      cy.get('[role="option"]').contains('Poslovni').click();

      cy.get('table').first().find('tbody tr', { timeout: 10000 }).should(($rows) => {
        expect($rows.length).to.be.greaterThan(0);
        $rows.each((_, row) => {
          expect(Cypress.$(row).text()).to.include('Poslovni');
        });
      });
    });

    it('prikazuje sve tipove kada se izabere Svi tipovi', () => {
      cy.contains('[role="combobox"]', 'Svi tipovi').click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.contains('[role="combobox"]', 'Tekuci').click();
      cy.get('[role="option"]').contains('Svi tipovi').click();

      cy.get('table').first().find('tbody tr').should('have.length.greaterThan', 3);
    });
  });

  describe('Paginacija', () => {
    it('menja broj redova po stranici', () => {
      cy.contains('Redova po stranici:')
        .first()
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('table').first().find('tbody tr').should('have.length.at.most', 5);
    });

    it('navigira na sledecu stranicu', () => {
      cy.contains('Redova po stranici:')
        .first()
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('table').first().parent().parent().find('button:has(svg.lucide-chevron-right)').click();
      cy.get('table').first().parent().parent().contains('6–').should('be.visible');
    });
  });

  describe('Formatiranje podataka', () => {
    it('stanje je formatirano u sr-RS formatu', () => {
      cy.get('table').first().find('tbody tr').first().find('td').eq(3).invoke('text').should('match', /\d{1,3}(\.\d{3})*(,\d{2})/);
    });

    it('broj racuna ima ispravan format (265-...)', () => {
      cy.get('table').first().find('tbody tr').each(($row) => {
        cy.wrap($row).find('td').first().invoke('text').should('match', /^265-/);
      });
    });

    it('svaki racun ima prikazanu valutu', () => {
      cy.get('table').first().find('tbody tr').each(($row) => {
        cy.wrap($row).find('td').eq(4).invoke('text').should('match', /^(RSD|EUR|USD)$/);
      });
    });
  });

  describe('Loading i prazno stanje', () => {
    it('prikazuje spinner dok se ucitavaju podaci', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 200,
        body: MOCK_ACCOUNTS,
        delay: 1000,
      }).as('getAccountsSlow');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });
      cy.get('.animate-spin').should('exist');
    });

    it('prikazuje poruku greske kada API vrati gresku', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 500,
        body: { message: 'Internal Server Error' },
      }).as('getAccountsError');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Greska pri ucitavanju racuna', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje poruku kada nema racuna', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 200,
        body: [],
      }).as('getAccountsEmpty');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Nema pronadjenih racuna', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Paginacija - napredni testovi', () => {
    it('navigira na prethodnu stranicu', () => {
      cy.contains('Redova po stranici:')
        .first()
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('table').first().parent().parent().find('button:has(svg.lucide-chevron-right)').click();
      cy.get('table').first().parent().parent().contains('6–').should('be.visible');

      cy.get('table').first().parent().parent().find('button:has(svg.lucide-chevron-left)').click();
      cy.get('table').first().parent().parent().contains('1–').should('be.visible');
    });

    it('dugme za prethodnu stranicu je onemoguceno na prvoj stranici', () => {
      cy.get('table').first().parent().parent().find('button:has(svg.lucide-chevron-left)').should('be.disabled');
    });

    it('prikazuje tacan opseg zapisa (npr. 1-10 od 11)', () => {
      cy.get('table').first().parent().parent().find('.text-muted-foreground').contains(/\d+–\d+ od \d+/).should('be.visible');
    });

    it('resetuje na prvu stranicu kada se promeni filter', () => {
      cy.contains('Redova po stranici:')
        .first()
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').contains('5').click();

      cy.get('table').first().parent().parent().find('button:has(svg.lucide-chevron-right)').click();
      cy.get('table').first().parent().parent().contains('6–').should('be.visible');

      cy.get('button[title="Filteri"]').first().click();
      cy.contains('[role="combobox"]', 'Svi tipovi').click();
      cy.get('[role="option"]').contains('Tekuci').click();

      cy.get('table').first().parent().parent().find('.text-muted-foreground').contains(/1–/).should('be.visible');
    });
  });

  describe('Navigacija', () => {
    it('dupli klik na red preusmerava na detalje racuna', () => {
      cy.get('table').first().find('tbody tr').first().dblclick();
      cy.url().should('include', '/accounts/');
    });

    it('Racuni link je vidljiv u navbaru', () => {
      cy.get('header').contains('Računi').should('be.visible');
    });

    it('klik na Racuni u navbaru ostaje na listi racuna', () => {
      cy.get('header').contains('Računi').click();
      cy.url().should('include', '/accounts');
      cy.contains('h1', 'Racuni').should('be.visible');
    });

    it('redovi tabele imaju kursor pointer', () => {
      cy.get('table').first().find('tbody tr').first().should('have.class', 'cursor-pointer');
    });
  });
});

describe('Accounts - Transakcije za selektovani racun', () => {
  beforeEach(() => {
    interceptAccountsApi();
    interceptTransactionsApi();

    cy.visit('/accounts', {
      onBeforeLoad(win) {
        setupClientSession(win);
      },
    });

    cy.contains('Racuni', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje panel sa transakcijama', () => {
    cy.contains('Transakcije').should('be.visible');
  });

  it('prikazuje naziv selektovanog racuna u naslovu panela', () => {
    cy.contains('Transakcije').parent().should('contain.text', '265-');
  });

  it('prikazuje tabelu transakcija', () => {
    cy.get('table').eq(1).should('be.visible');
    cy.get('table').eq(1).find('th').should('contain.text', 'Datum');
    cy.get('table').eq(1).find('th').should('contain.text', 'Svrha');
    cy.get('table').eq(1).find('th').should('contain.text', 'Iznos');
    cy.get('table').eq(1).find('th').should('contain.text', 'Status');
  });

  it('prikazuje transakcije u tabeli', () => {
    cy.get('table').eq(1).find('tbody tr').should('have.length', 4);
  });

  it('prikazuje status badge za transakciju', () => {
    cy.get('table').eq(1).within(() => {
      cy.contains('Zavrsena').should('exist');
      cy.contains('Na cekanju').should('exist');
      cy.contains('Odbijena').should('exist');
    });
  });

  it('prikazuje svrhu placanja', () => {
    cy.get('table').eq(1).within(() => {
      cy.contains('Placanje racuna za struju').should('exist');
    });
  });

  it('oznacava odlazne transakcije crvenom bojom', () => {
    cy.get('table').eq(1).find('tbody tr').first().within(() => {
      cy.get('.text-destructive').should('exist');
    });
  });

  it('oznacava dolazne transakcije zelenom bojom', () => {
    cy.get('table').eq(1).find('tbody tr').eq(1).within(() => {
      cy.get('.text-green-600').should('exist');
    });
  });

  it('menja transakcije kada se selektuje drugi racun', () => {
    const otherTransactions = {
      content: [
        {
          id: 10, fromAccountNumber: '265000000000000229', toAccountNumber: '265000000000000112',
          amount: 500, currency: 'EUR', description: 'Uplata EUR', referenceNumber: 'REF010',
          paymentCode: '289', paymentPurpose: 'Devizni prenos',
          recipientName: 'Stefan Jovanovic', status: 'COMPLETED', createdAt: '2025-03-12',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
    };

    cy.intercept('GET', '**/transactions*', {
      statusCode: 200,
      body: otherTransactions,
    }).as('getTransactionsOther');

    cy.get('table').first().find('tbody tr').eq(1).click();

    cy.wait('@getTransactionsOther');
    cy.get('table').eq(1).find('tbody tr').should('have.length', 1);
    cy.get('table').eq(1).contains('Devizni prenos').should('exist');
  });

  describe('Filteri transakcija', () => {
    beforeEach(() => {
      cy.get('button[title="Filteri transakcija"]').click();
    });

    it('prikazuje filter sekciju sa statusom i datumima', () => {
      cy.contains('Status').should('be.visible');
      cy.contains('Datum od').should('be.visible');
      cy.contains('Datum do').should('be.visible');
    });

    it('prikazuje dugme za resetovanje filtera', () => {
      cy.contains('Resetuj').should('be.visible');
    });

    it('filtrira po statusu', () => {
      const filteredTransactions = {
        content: [MOCK_TRANSACTIONS.content[2]],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
      };

      cy.intercept('GET', '**/transactions*status=PENDING*', {
        statusCode: 200,
        body: filteredTransactions,
      }).as('getFilteredTransactions');

      // Click the status select (second combobox in filter area - first is account type)
      cy.contains('Svi statusi').click();
      cy.get('[role="option"]').contains('Na cekanju').click();

      cy.wait('@getFilteredTransactions');
      cy.get('table').eq(1).find('tbody tr').should('have.length', 1);
    });

    it('resetuje filtere klikom na Resetuj', () => {
      cy.contains('Svi statusi').click();
      cy.get('[role="option"]').contains('Na cekanju').click();

      cy.contains('Resetuj').click();
      // After reset, it should re-fetch all transactions
      cy.get('table').eq(1).find('tbody tr').should('have.length', 4);
    });
  });

  describe('Prazno stanje transakcija', () => {
    it('prikazuje poruku kada nema transakcija', () => {
      interceptTransactionsApi(EMPTY_TRANSACTIONS);

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Nema transakcija za ovaj racun', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje link za uklanjanje filtera kada nema rezultata sa filterima', () => {
      interceptAccountsApi();

      cy.intercept('GET', '**/transactions*', {
        statusCode: 200,
        body: EMPTY_TRANSACTIONS,
      }).as('getEmptyTransactions');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Nema transakcija za ovaj racun', { timeout: 10000 }).should('be.visible');
      // Open filters and set one to trigger the "remove filters" link
      cy.get('button[title="Filteri transakcija"]').click();
      cy.contains('Svi statusi').click();
      cy.get('[role="option"]').contains('Na cekanju').click();

      cy.contains('Ukloni filtere').should('be.visible');
    });
  });

  describe('Greska pri ucitavanju transakcija', () => {
    it('prikazuje poruku greske', () => {
      interceptAccountsApi();
      cy.intercept('GET', '**/transactions*', {
        statusCode: 500,
        body: { message: 'Internal Server Error' },
      }).as('getTransactionsError');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Greska pri ucitavanju transakcija', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Bez transakcijskog panela kada nema racuna', () => {
    it('ne prikazuje panel transakcija kada nema racuna', () => {
      cy.intercept('GET', '**/accounts/my', {
        statusCode: 200,
        body: [],
      }).as('getAccountsEmpty');

      cy.visit('/accounts', {
        onBeforeLoad(win) {
          setupClientSession(win);
        },
      });

      cy.contains('Nema pronadjenih racuna', { timeout: 10000 }).should('be.visible');
      cy.contains('Transakcije').should('not.exist');
    });
  });
});
