/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


const MOCK_ACCOUNTS_PAGE = {
  content: [
    {
      id: 1, accountNumber: '265000000000000112', name: 'Tekući račun - RSD',
      accountType: 'TEKUCI', status: 'ACTIVE', balance: 500000, availableBalance: 485230.5,
      reservedBalance: 14769.5, dailyLimit: 200000, monthlyLimit: 1000000,
      dailySpending: 0, monthlySpending: 15000, maintenanceFee: 250,
      currency: 'RSD', ownerName: 'Stefan Jovanovic', createdAt: '2025-01-15',
    },
    {
      id: 2, accountNumber: '265000000000000229', name: 'Devizni račun - EUR',
      accountType: 'DEVIZNI', status: 'ACTIVE', balance: 13000, availableBalance: 12500.0,
      reservedBalance: 500, dailyLimit: 50000, monthlyLimit: 200000,
      dailySpending: 0, monthlySpending: 0, maintenanceFee: 3,
      currency: 'EUR', ownerName: 'Stefan Jovanovic', createdAt: '2025-02-01',
    },
    {
      id: 3, accountNumber: '265000000000000336', name: 'Poslovni račun - RSD',
      accountType: 'POSLOVNI', status: 'BLOCKED', balance: 2800000, availableBalance: 2750000.0,
      reservedBalance: 50000, dailyLimit: 5000000, monthlyLimit: 20000000,
      dailySpending: 0, monthlySpending: 100000, maintenanceFee: 1500,
      currency: 'RSD', ownerName: 'Milica Nikolic', createdAt: '2025-01-20',
    },
    {
      id: 4, accountNumber: '265000000000000443', name: 'Tekući račun - EUR',
      accountType: 'TEKUCI', status: 'INACTIVE', balance: 0, availableBalance: 0,
      reservedBalance: 0, dailyLimit: 0, monthlyLimit: 0,
      dailySpending: 0, monthlySpending: 0, maintenanceFee: 0,
      currency: 'EUR', ownerName: 'Ana Markovic', createdAt: '2025-03-01',
    },
  ],
  totalElements: 4,
  totalPages: 1,
  size: 10,
  number: 0,
};

function setupEmployeeSession(win: Cypress.AUTWindow) {
  win.sessionStorage.setItem('accessToken', _fakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 1, email: 'admin@test.com', username: 'admin',
      firstName: 'Admin', lastName: 'User',
      permissions: ['ADMIN'],
    })
  );
}

function interceptAccountsApi(response = MOCK_ACCOUNTS_PAGE) {
  cy.intercept('GET', '**/api/accounts*', {
    statusCode: 200,
    body: response,
  }).as('getAccounts');
}

describe('Employee Accounts Portal', () => {
  beforeEach(() => {
    interceptAccountsApi();

    cy.visit('/employee/accounts', {
      onBeforeLoad(win) { setupEmployeeSession(win); },
    });

    cy.contains('Portal racuna', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje naslov stranice', () => {
    cy.contains('h1', 'Portal racuna').should('be.visible');
  });

  it('prikazuje dugme za kreiranje racuna', () => {
    cy.contains('button', 'Kreiraj racun').should('be.visible');
  });

  it('prikazuje tabelu sa racunima', () => {
    cy.get('table').should('be.visible');
    cy.contains('th', 'Vlasnik').should('be.visible');
    cy.contains('th', 'Broj računa').should('be.visible');
    cy.contains('th', 'Tip').should('be.visible');
    cy.contains('th', 'Stanje').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
    cy.contains('th', 'Akcije').should('be.visible');
  });

  it('prikazuje racune u tabeli', () => {
    cy.get('table tbody tr').should('have.length', 4);
  });

  it('prikazuje ime vlasnika', () => {
    cy.get('table').within(() => {
      cy.contains('Stefan Jovanovic').should('exist');
      cy.contains('Milica Nikolic').should('exist');
      cy.contains('Ana Markovic').should('exist');
    });
  });

  it('prikazuje formatiran broj racuna', () => {
    cy.contains('265-').should('be.visible');
  });

  it('prikazuje badge za tip racuna', () => {
    cy.get('table').within(() => {
      cy.contains('Tekuci').should('exist');
      cy.contains('Devizni').should('exist');
      cy.contains('Poslovni').should('exist');
    });
  });

  it('prikazuje badge za status', () => {
    cy.get('table').within(() => {
      cy.contains('Aktivan').should('exist');
      cy.contains('Blokiran').should('exist');
      cy.contains('Neaktivan').should('exist');
    });
  });

  it('prikazuje stanje formatirano u sr-RS formatu', () => {
    cy.get('table tbody tr').first().find('td').eq(3).invoke('text')
      .should('match', /\d{1,3}(\.\d{3})*(,\d{2})/);
  });

  describe('Akcije po racunu', () => {
    it('prikazuje dugme Blokiraj za aktivan racun', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.contains('button', 'Blokiraj').should('exist');
      });
    });

    it('prikazuje dugme Aktiviraj za blokiran racun', () => {
      cy.get('table tbody tr').eq(2).within(() => {
        cy.contains('button', 'Aktiviraj').should('exist');
      });
    });

    it('ne prikazuje dugme Deaktiviraj za neaktivan racun', () => {
      cy.get('table tbody tr').eq(3).within(() => {
        cy.contains('button', 'Deaktiviraj').should('not.exist');
      });
    });

    it('prikazuje dugme za kartice', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('button[title="Kartice"]').should('exist');
      });
    });

    it('prikazuje dugme Detalji', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.contains('button', 'Detalji').should('exist');
      });
    });

    it('poziva API za promenu statusa', () => {
      cy.intercept('PATCH', '**/api/accounts/1/status*', {
        statusCode: 200,
        body: {},
      }).as('changeStatus');

      cy.get('table tbody tr').first().within(() => {
        cy.contains('button', 'Blokiraj').click();
      });

      cy.wait('@changeStatus');
    });
  });

  describe('Filteri', () => {
    beforeEach(() => {
      cy.get('button[title="Filteri"]').click();
    });

    it('prikazuje filter sekciju', () => {
      cy.contains('Email vlasnika').should('be.visible');
      cy.contains('Tip racuna').should('be.visible');
      cy.contains('Status').should('be.visible');
    });

    it('prikazuje input za email pretrazivanje', () => {
      cy.get('input[placeholder="Pretrazi po emailu..."]').should('be.visible');
    });

    it('prikazuje select za tip racuna', () => {
      cy.contains('Svi tipovi').should('be.visible');
    });

    it('prikazuje select za status', () => {
      cy.contains('Svi statusi').should('be.visible');
    });
  });

  describe('Paginacija', () => {
    it('prikazuje informaciju o broju rezultata', () => {
      cy.contains(/\d+–\d+ od \d+/).should('be.visible');
    });

    it('prikazuje informaciju o stranici', () => {
      cy.contains(/Strana \d+ \/ \d+/).should('be.visible');
    });

    it('dugme za prethodnu stranicu je onemoguceno na prvoj stranici', () => {
      cy.get('button:has(svg.lucide-chevron-left)').should('be.disabled');
    });
  });

  describe('Loading i greske', () => {
    it('prikazuje spinner dok se ucitavaju podaci', () => {
      cy.intercept('GET', '**/api/accounts*', {
        statusCode: 200,
        body: MOCK_ACCOUNTS_PAGE,
        delay: 1000,
      }).as('getAccountsSlow');

      cy.visit('/employee/accounts', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.get('.animate-spin').should('exist');
    });

    it('prikazuje poruku greske kada API vrati gresku', () => {
      cy.intercept('GET', '**/api/accounts*', {
        statusCode: 500,
        body: { message: 'Internal Server Error' },
      }).as('getAccountsError');

      cy.visit('/employee/accounts', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.contains('Greska pri ucitavanju racuna', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje poruku kada nema racuna', () => {
      cy.intercept('GET', '**/api/accounts*', {
        statusCode: 200,
        body: { content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 },
      }).as('getAccountsEmpty');

      cy.visit('/employee/accounts', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.contains('Nema pronadjenih racuna', { timeout: 10000 }).should('be.visible');
    });
  });
});
