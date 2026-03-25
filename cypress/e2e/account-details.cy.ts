/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


const MOCK_ACCOUNT = {
  id: 1, accountNumber: '265000000000000112', name: 'Tekući račun - RSD',
  accountType: 'TEKUCI', accountSubtype: 'STANDARDNI', status: 'ACTIVE',
  balance: 500000, availableBalance: 485230.5, reservedBalance: 14769.5,
  dailyLimit: 200000, monthlyLimit: 1000000, dailySpending: 45000,
  monthlySpending: 150000, maintenanceFee: 250, currency: 'RSD',
  ownerName: 'Stefan Jovanovic', createdAt: '2025-01-15',
};

const MOCK_BUSINESS_ACCOUNT = {
  ...MOCK_ACCOUNT,
  id: 3, accountNumber: '265000000000000336', name: 'Poslovni račun - RSD',
  accountType: 'POSLOVNI', accountSubtype: 'DOO', balance: 2800000,
  availableBalance: 2750000, reservedBalance: 50000,
  dailyLimit: 5000000, monthlyLimit: 20000000, dailySpending: 100000,
  monthlySpending: 500000, maintenanceFee: 1500,
  ownerName: 'Milica Nikolic',
  firm: {
    id: 1, companyName: 'TechStart DOO', registrationNumber: '20123456',
    taxId: '101234567', activityCode: '62.01',
  },
};

const MOCK_TRANSACTIONS = {
  content: [
    {
      id: 1, fromAccountNumber: '265000000000000112', toAccountNumber: '265000000000000229',
      amount: 15000, currency: 'RSD', description: 'Uplata', referenceNumber: 'REF001',
      paymentCode: '289', paymentPurpose: 'Placanje racuna za struju',
      recipientName: 'EPS Distribucija', status: 'COMPLETED', createdAt: '2025-03-10',
    },
    {
      id: 2, fromAccountNumber: '265000000000000336', toAccountNumber: '265000000000000112',
      amount: 50000, currency: 'RSD', description: 'Prenos', referenceNumber: 'REF002',
      paymentCode: '289', paymentPurpose: 'Prenos sredstava',
      recipientName: 'Milica Nikolic', status: 'PENDING', createdAt: '2025-03-09',
    },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 10,
  number: 0,
};

const EMPTY_TRANSACTIONS = {
  content: [], totalElements: 0, totalPages: 0, size: 10, number: 0,
};

function setupClientSession(win: Cypress.AUTWindow) {
  win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({
      id: 2, email: 'user@test.com', username: 'user',
      firstName: 'Stefan', lastName: 'Jovanovic', permissions: ['VIEW_STOCKS'],
    })
  );
}

describe('AccountDetailsPage - Licni racun', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/1', {
      statusCode: 200,
      body: MOCK_ACCOUNT,
    }).as('getAccount');

    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: MOCK_TRANSACTIONS,
    }).as('getTransactions');

    cy.visit('/accounts/1', {
      onBeforeLoad(win) { setupClientSession(win); },
    });

    cy.contains('Tekući račun - RSD', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje naziv racuna kao naslov', () => {
    cy.contains('h1', 'Tekući račun - RSD').should('be.visible');
  });

  it('prikazuje badge za status i tip', () => {
    cy.contains('Aktivan').should('be.visible');
    cy.contains('Tekuci').should('be.visible');
  });

  it('prikazuje formatiran broj racuna', () => {
    cy.contains('265-').should('be.visible');
  });

  it('prikazuje dugme za nazad', () => {
    cy.contains('Nazad na racune').should('be.visible');
  });

  describe('Stanje racuna', () => {
    it('prikazuje karticu sa stanjem', () => {
      cy.contains('Stanje racuna').should('be.visible');
    });

    it('prikazuje ukupno stanje', () => {
      cy.contains('Ukupno stanje').should('be.visible');
    });

    it('prikazuje raspolozivo stanje', () => {
      cy.contains('Raspolozivo').should('be.visible');
    });

    it('prikazuje rezervisano stanje', () => {
      cy.contains('Rezervisano').should('be.visible');
    });

    it('prikazuje odrzavanje', () => {
      cy.contains('Odrzavanje').should('be.visible');
    });
  });

  describe('Limiti i potrosnja', () => {
    it('prikazuje karticu sa limitima', () => {
      cy.contains('Limiti i potrosnja').should('be.visible');
    });

    it('prikazuje dnevnu potrosnju', () => {
      cy.contains('Dnevna potrosnja').should('be.visible');
    });

    it('prikazuje mesecnu potrosnju', () => {
      cy.contains('Mesecna potrosnja').should('be.visible');
    });

    it('prikazuje progress barove', () => {
      cy.get('[role="progressbar"]').should('have.length', 2);
    });

    it('prikazuje input za dnevni limit', () => {
      cy.get('#dailyLimit').should('be.visible').and('have.value', '200000');
    });

    it('prikazuje input za mesecni limit', () => {
      cy.get('#monthlyLimit').should('be.visible').and('have.value', '1000000');
    });

    it('prikazuje dugme za cuvanje limita', () => {
      cy.contains('button', 'Sacuvaj limite').should('be.visible');
    });

    it('poziva API za promenu limita', () => {
      cy.intercept('PATCH', '**/api/accounts/1/limit', {
        statusCode: 200,
        body: {},
      }).as('changeLimits');

      cy.get('#dailyLimit').clear().type('300000');
      cy.contains('button', 'Sacuvaj limite').click();
      cy.wait('@changeLimits');
    });
  });

  describe('Akcije', () => {
    it('prikazuje input za promenu naziva', () => {
      cy.get('input[placeholder="Novi naziv racuna"]').should('be.visible');
    });

    it('prikazuje dugme za promenu naziva', () => {
      cy.contains('button', 'Promeni naziv').should('be.visible');
    });

    it('poziva API za promenu naziva', () => {
      cy.intercept('PATCH', '**/api/accounts/1/name', {
        statusCode: 200,
        body: { ...MOCK_ACCOUNT, name: 'Moj glavni racun' },
      }).as('rename');

      cy.get('input[placeholder="Novi naziv racuna"]').clear().type('Moj glavni racun');
      cy.contains('button', 'Promeni naziv').click();
      cy.wait('@rename');
    });

    it('prikazuje dugme za novo placanje', () => {
      cy.contains('button', 'Novo placanje').should('be.visible');
    });

    it('prikazuje dugme za prenos', () => {
      cy.contains('button', 'Prenos').should('be.visible');
    });

    it('prikazuje dugme za sve transakcije', () => {
      cy.contains('button', 'Sve transakcije').should('be.visible');
    });
  });

  describe('Poslednje transakcije', () => {
    it('prikazuje karticu sa transakcijama', () => {
      cy.contains('Poslednje transakcije').should('be.visible');
    });

    it('prikazuje tabelu transakcija', () => {
      cy.get('table').should('be.visible');
      cy.contains('th', 'Datum').should('be.visible');
      cy.contains('th', 'Svrha').should('be.visible');
      cy.contains('th', 'Iznos').should('be.visible');
      cy.contains('th', 'Status').should('be.visible');
    });

    it('prikazuje transakcije u tabeli', () => {
      cy.get('table tbody tr').should('have.length', 2);
    });

    it('prikazuje odlaznu transakciju crvenom bojom', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('.text-destructive').should('exist');
      });
    });

    it('prikazuje dolaznu transakciju zelenom bojom', () => {
      cy.get('table tbody tr').eq(1).within(() => {
        cy.get('.text-green-600').should('exist');
      });
    });

    it('prikazuje status badge', () => {
      cy.get('table').within(() => {
        cy.contains('Zavrsena').should('exist');
        cy.contains('Na cekanju').should('exist');
      });
    });

    it('prikazuje poruku kada nema transakcija', () => {
      cy.intercept('GET', '**/api/payments*', {
        statusCode: 200,
        body: EMPTY_TRANSACTIONS,
      }).as('getEmptyTransactions');

      cy.visit('/accounts/1', {
        onBeforeLoad(win) { setupClientSession(win); },
      });

      cy.contains('Nema transakcija za ovaj racun', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Loading i greske', () => {
    it('prikazuje spinner dok se ucitavaju podaci', () => {
      cy.intercept('GET', '**/api/accounts/1', {
        statusCode: 200,
        body: MOCK_ACCOUNT,
        delay: 1000,
      }).as('getAccountSlow');

      cy.visit('/accounts/1', {
        onBeforeLoad(win) { setupClientSession(win); },
      });

      cy.get('.animate-spin').should('exist');
    });

    it('prikazuje poruku kada racun nije pronadjen', () => {
      cy.intercept('GET', '**/api/accounts/999', {
        statusCode: 404,
        body: { message: 'Not Found' },
      }).as('getAccountNotFound');

      cy.visit('/accounts/999', {
        onBeforeLoad(win) { setupClientSession(win); },
      });

      cy.contains('Racun nije pronadjen', { timeout: 10000 }).should('be.visible');
    });
  });
});

describe('BusinessAccountDetailsPage - Poslovni račun', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/3', {
      statusCode: 200,
      body: MOCK_BUSINESS_ACCOUNT,
    }).as('getBusinessAccount');

    cy.intercept('GET', '**/api/accounts/3/business', {
      statusCode: 200,
      body: MOCK_BUSINESS_ACCOUNT,
    }).as('getBusinessDetails');

    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: MOCK_TRANSACTIONS,
    }).as('getTransactions');

    cy.visit('/accounts/3/business', {
      onBeforeLoad(win) { setupClientSession(win); },
    });

    cy.contains('Poslovni račun - RSD', { timeout: 10000 }).should('be.visible');
  });

  it('prikazuje naziv racuna', () => {
    cy.contains('h1', 'Poslovni račun - RSD').should('be.visible');
  });

  it('prikazuje badge za status i tip', () => {
    cy.contains('Aktivan').should('be.visible');
    cy.contains('Poslovni').should('be.visible');
  });

  describe('Informacije o firmi', () => {
    it('prikazuje karticu sa informacijama o firmi', () => {
      cy.contains('Informacije o firmi').should('be.visible');
    });

    it('prikazuje naziv firme', () => {
      cy.contains('Naziv firme').should('be.visible');
      cy.contains('TechStart DOO').should('be.visible');
    });

    it('prikazuje maticni broj', () => {
      cy.contains('Maticni broj').should('be.visible');
      cy.contains('20123456').should('be.visible');
    });

    it('prikazuje PIB', () => {
      cy.contains('PIB').should('be.visible');
      cy.contains('101234567').should('be.visible');
    });

    it('prikazuje sifru delatnosti', () => {
      cy.contains('Sifra delatnosti').should('be.visible');
      cy.contains('62.01').should('be.visible');
    });
  });

  describe('Stanje racuna', () => {
    it('prikazuje karticu sa stanjem', () => {
      cy.contains('Stanje racuna').should('be.visible');
    });

    it('prikazuje ukupno stanje', () => {
      cy.contains('Ukupno stanje').should('be.visible');
    });
  });

  describe('Limiti i potrosnja', () => {
    it('prikazuje karticu sa limitima', () => {
      cy.contains('Limiti i potrosnja').should('be.visible');
    });

    it('prikazuje progress barove', () => {
      cy.get('[role="progressbar"]').should('have.length', 2);
    });

    it('prikazuje dugme za cuvanje limita', () => {
      cy.contains('button', 'Sacuvaj limite').should('be.visible');
    });
  });

  describe('Akcije', () => {
    it('prikazuje input za promenu naziva', () => {
      cy.get('input[placeholder="Novi naziv racuna"]').should('be.visible');
    });

    it('prikazuje dugmad za placanje i prenos', () => {
      cy.contains('button', 'Novo placanje').should('be.visible');
      cy.contains('button', 'Prenos').should('be.visible');
      cy.contains('button', 'Sve transakcije').should('be.visible');
    });
  });

  describe('Poslednje transakcije', () => {
    it('prikazuje karticu sa transakcijama', () => {
      cy.contains('Poslednje transakcije').should('be.visible');
    });

    it('prikazuje tabelu transakcija', () => {
      cy.get('table tbody tr').should('have.length', 2);
    });
  });
});
