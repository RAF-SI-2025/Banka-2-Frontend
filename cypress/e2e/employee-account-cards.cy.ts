/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


const MOCK_ACCOUNT = {
  id: 5, accountNumber: '265000000000000550', name: 'Devizni račun - RSD',
  accountType: 'DEVIZNI', status: 'ACTIVE', balance: 1150000, availableBalance: 1100000.0,
  reservedBalance: 50000, dailyLimit: 500000, monthlyLimit: 2000000,
  dailySpending: 0, monthlySpending: 0, maintenanceFee: 500,
  currency: 'RSD', ownerName: 'Lazar Petrovic', createdAt: '2025-01-25',
};

const MOCK_CARDS = [
  {
    id: 1, cardNumber: '4111111111111234', cardType: 'VISA',
    accountNumber: '265000000000000550', holderName: 'Lazar Petrovic',
    expirationDate: '2027-06-30', status: 'ACTIVE', limit: 100000,
    createdAt: '2025-01-25',
  },
  {
    id: 2, cardNumber: '5500000000005678', cardType: 'MASTERCARD',
    accountNumber: '265000000000000550', holderName: 'Lazar Petrovic',
    expirationDate: '2026-12-31', status: 'BLOCKED', limit: 50000,
    createdAt: '2025-02-10',
  },
  {
    id: 3, cardNumber: '9891000000009012', cardType: 'DINACARD',
    accountNumber: '265000000000000550', holderName: 'Lazar Petrovic',
    expirationDate: '2025-06-30', status: 'DEACTIVATED', limit: 0,
    createdAt: '2024-06-01',
  },
];

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

describe('Employee Account Cards Portal', () => {
  describe('Pristup sa pretragom', () => {
    beforeEach(() => {
      cy.visit('/employee/cards', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.contains('Portal kartica', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje naslov stranice', () => {
      cy.contains('h1', 'Portal kartica').should('be.visible');
    });

    it('prikazuje dugme za nazad', () => {
      cy.contains('Nazad na portal racuna').should('be.visible');
    });

    it('prikazuje polje za pretragu', () => {
      cy.get('input[placeholder*="broj racuna"]').should('be.visible');
    });

    it('prikazuje dugme za pretragu', () => {
      cy.contains('button', 'Pretrazi').should('be.visible');
    });

    it('prikazuje dugme za novu karticu', () => {
      cy.contains('button', 'Nova kartica').should('be.visible');
    });

    it('prikazuje poruku kada nema pretrazenog racuna', () => {
      cy.contains('Pretrazite racun da biste videli kartice').should('be.visible');
    });
  });

  describe('Pristup sa rute /employee/accounts/:id/cards', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/accounts/5', {
        statusCode: 200,
        body: MOCK_ACCOUNT,
      }).as('getAccount');

      cy.intercept('GET', '**/api/accounts/number/265000000000000550', {
        statusCode: 200,
        body: MOCK_ACCOUNT,
      }).as('getAccountByNumber');

      cy.intercept('GET', '**/api/cards/account/265000000000000550', {
        statusCode: 200,
        body: MOCK_CARDS,
      }).as('getCards');

      cy.visit('/employee/accounts/5/cards', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.contains('Portal kartica', { timeout: 10000 }).should('be.visible');
      cy.wait('@getAccount');
    });

    it('popunjava broj racuna iz rute', () => {
      cy.get('input[placeholder*="broj racuna"]').should('have.value', '265000000000000550');
    });

    it('prikazuje informacije o racunu', () => {
      cy.contains('Lazar Petrovic').should('be.visible');
    });

    it('prikazuje tabelu kartica', () => {
      cy.get('table').should('be.visible');
      cy.contains('th', 'Broj kartice').should('be.visible');
      cy.contains('th', 'Tip').should('be.visible');
      cy.contains('th', 'Limit').should('be.visible');
      cy.contains('th', 'Status').should('be.visible');
      cy.contains('th', 'Akcije').should('be.visible');
    });

    it('prikazuje kartice u tabeli', () => {
      cy.get('table tbody tr').should('have.length', 3);
    });

    it('prikazuje maskirani broj kartice', () => {
      cy.contains('**** **** **** 1234').should('be.visible');
    });

    it('prikazuje badge za tip kartice', () => {
      cy.get('table').within(() => {
        cy.contains('Visa').should('exist');
        cy.contains('Mastercard').should('exist');
        cy.contains('DinaCard').should('exist');
      });
    });

    it('prikazuje badge za status kartice', () => {
      cy.get('table').within(() => {
        cy.contains('Aktivna').should('exist');
        cy.contains('Blokirana').should('exist');
        cy.contains('Deaktivirana').should('exist');
      });
    });

    describe('Akcije nad karticama', () => {
      it('prikazuje dugme za blokiranje aktivne kartice', () => {
        cy.get('table tbody tr').first().within(() => {
          cy.get('button[title="Blokiraj"]').should('exist');
        });
      });

      it('prikazuje dugme za deblokiranje blokirane kartice', () => {
        cy.get('table tbody tr').eq(1).within(() => {
          cy.get('button[title="Deblokiraj"]').should('exist');
        });
      });

      it('ne prikazuje dugme za deaktiviranje deaktivirane kartice', () => {
        cy.get('table tbody tr').eq(2).within(() => {
          cy.get('button[title="Deaktiviraj"]').should('not.exist');
        });
      });

      it('poziva API za blokiranje kartice', () => {
        cy.intercept('PATCH', '**/api/cards/1/block', {
          statusCode: 200,
          body: {},
        }).as('blockCard');

        cy.get('table tbody tr').first().within(() => {
          cy.get('button[title="Blokiraj"]').click();
        });

        cy.wait('@blockCard');
      });
    });

    describe('Kreiranje kartice', () => {
      beforeEach(() => {
        cy.contains('button', 'Nova kartica').click();
      });

      it('prikazuje formu za kreiranje', () => {
        cy.contains('Tip kartice').should('be.visible');
        cy.contains('button', 'Kreiraj karticu').should('be.visible');
        cy.contains('button', 'Otkazi').should('be.visible');
      });

      it('prikazuje select za tip kartice', () => {
        cy.contains('Izaberite tip').should('be.visible');
      });

      it('sakriva formu klikom na Otkazi', () => {
        cy.contains('button', 'Otkazi').click();
        cy.contains('Tip kartice').should('not.exist');
      });

      it('poziva API za kreiranje kartice', () => {
        cy.intercept('POST', '**/api/cards', {
          statusCode: 200,
          body: { id: 10, cardNumber: '4111111111119999', cardType: 'VISA', status: 'ACTIVE' },
        }).as('createCard');

        cy.intercept('POST', '**/api/cards/10/request-verification', {
          statusCode: 200,
          body: {},
        }).as('verifyCard');

        cy.contains('Izaberite tip').click();
        cy.get('[role="option"]').contains('Visa').click();
        cy.contains('button', 'Kreiraj karticu').click();

        cy.wait('@createCard');
      });
    });
  });

  describe('Prazno stanje i greske', () => {
    it('prikazuje poruku kada nema kartica', () => {
      cy.intercept('GET', '**/api/accounts/5', {
        statusCode: 200,
        body: MOCK_ACCOUNT,
      }).as('getAccount');

      cy.intercept('GET', '**/api/accounts/number/265000000000000550', {
        statusCode: 200,
        body: MOCK_ACCOUNT,
      }).as('getAccountByNumber');

      cy.intercept('GET', '**/api/cards/account/265000000000000550', {
        statusCode: 200,
        body: [],
      }).as('getCardsEmpty');

      cy.visit('/employee/accounts/5/cards', {
        onBeforeLoad(win) { setupEmployeeSession(win); },
      });

      cy.contains('Nema kartica za ovaj racun', { timeout: 10000 }).should('be.visible');
    });
  });
});
