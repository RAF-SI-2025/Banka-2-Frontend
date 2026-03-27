/// <reference types="cypress" />
function b64url(s: string) {
  return btoa(s).split('=').join('').split('+').join('-').split('/').join('_');
}
function makeFakeJwt(role: string, email: string) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ sub: email, role, active: true, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }));
  return h + '.' + p + '.fakesig';
}

describe('Employee Clients Portal Page', () => {
  const _adminEmail = 'marko.petrovic@banka.rs';
  const _adminPassword = 'Admin12345';

  const client1 = {
    id: 1,
    firstName: 'Marko',
    lastName: 'Marković',
    email: 'marko@test.com',
    phoneNumber: '060111111',
    address: 'Bulevar kralja Aleksandra 1',
    dateOfBirth: '1995-05-10',
    gender: 'M',
    jmbg: '1234567890123',
  };

  const client2 = {
    id: 2,
    firstName: 'Ana',
    lastName: 'Anić',
    email: 'ana@test.com',
    phoneNumber: '060222222',
    address: 'Nemanjina 2',
    dateOfBirth: '1997-07-20',
    gender: 'F',
    jmbg: '9876543210987',
  };

  const client3 = {
    id: 3,
    firstName: 'Petar',
    lastName: 'Petrović',
    email: 'petar@test.com',
    phoneNumber: '060333333',
    address: 'Cara Dušana 3',
    dateOfBirth: '1993-03-15',
    gender: 'M',
    jmbg: '1112223334445',
  };

  const pagedClientsPage1 = {
    content: [client1, client2],
    totalElements: 3,
    totalPages: 2,
    size: 10,
    number: 0,
  };

  const pagedClientsPage2 = {
    content: [client3],
    totalElements: 3,
    totalPages: 2,
    size: 10,
    number: 1,
  };

  const emptyClientsPage = {
    content: [],
    totalElements: 0,
    totalPages: 1,
    size: 10,
    number: 0,
  };

  const accountsForClient1 = {
    content: [
      {
        id: 101,
        accountNumber: '123-456789-00',
        ownerName: 'Marko Marković',
        accountType: 'TEKUCI',
        currency: 'RSD',
        balance: 1500.55,
        availableBalance: 1500.55,
        reservedBalance: 0,
        dailyLimit: 100000,
        monthlyLimit: 500000,
        dailySpending: 0,
        monthlySpending: 0,
        maintenanceFee: 0,
        status: 'ACTIVE',
        createdAt: '2025-01-01',
      },
      {
        id: 102,
        accountNumber: '555-666777-88',
        ownerName: 'Marko Marković',
        accountType: 'POSLOVNI',
        currency: 'EUR',
        balance: 2500,
        availableBalance: 2500,
        reservedBalance: 0,
        dailyLimit: 100000,
        monthlyLimit: 500000,
        dailySpending: 0,
        monthlySpending: 0,
        maintenanceFee: 0,
        status: 'ACTIVE',
        createdAt: '2025-01-01',
      },
    ],
    totalElements: 2,
    totalPages: 1,
    size: 20,
    number: 0,
  };

  const noAccounts = {
    content: [],
    totalElements: 0,
    totalPages: 1,
    size: 20,
    number: 0,
  };

  const setAdminSession = (win: Window) => {
    win.sessionStorage.setItem('accessToken', makeFakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'marko.petrovic@banka.rs', role: 'ADMIN', firstName: 'Marko', lastName: 'Petrovic' }));
  };

  const mockClientsList = () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/clients',
      },
      (req) => {
        const { firstName, lastName, email, page, limit } = req.query;

        if (page === '1' && limit === '10') {
          req.reply(pagedClientsPage2);
          return;
        }

        if (firstName === 'Ana' || lastName === 'Ana' || email === 'Ana') {
          req.reply({
            content: [client2],
            totalElements: 1,
            totalPages: 1,
            size: 10,
            number: 0,
          });
          return;
        }

        if (firstName === 'zzz' || lastName === 'zzz' || email === 'zzz') {
          req.reply(emptyClientsPage);
          return;
        }

        req.reply(pagedClientsPage1);
      }
    ).as('getClients');
  };

  const mockClientDetails = () => {
    cy.intercept({ method: 'GET', pathname: '/api/clients/1' }, client1).as('getClient1');
    cy.intercept({ method: 'GET', pathname: '/api/clients/2' }, client2).as('getClient2');
    cy.intercept({ method: 'GET', pathname: '/api/clients/3' }, client3).as('getClient3');
  };

  const mockAccounts = () => {
    cy.intercept({ method: 'GET', pathname: '/api/accounts/client/1' }, accountsForClient1.content).as('getAccountsMarko');
    cy.intercept({ method: 'GET', pathname: '/api/accounts/client/2' }, noAccounts.content).as('getAccountsAna');
    cy.intercept({ method: 'GET', pathname: '/api/accounts/client/3' }, noAccounts.content).as('getAccountsPetar');
  };

  const mockClientUpdate = () => {
    cy.intercept({ method: 'PUT', pathname: '/api/clients/1' }, (req) => {
      req.reply({
        ...client1,
        ...req.body,
      });
    }).as('updateClient1');
  };

  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake' } });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    mockClientsList();
    mockClientDetails();
    mockAccounts();
    mockClientUpdate();
  });

  it('renders clients list page successfully', () => {
    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClients');

    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Pretraga i lista klijenata').should('be.visible');
    cy.get('input[placeholder="Pretraga po imenu, prezimenu ili email-u"]').should('be.visible');

    cy.contains('Marko').should('be.visible');
    cy.contains('Marković').should('be.visible');
    cy.contains('marko@test.com').should('be.visible');
    cy.contains('060111111').should('be.visible');

    cy.contains('Ana').should('be.visible');
    cy.contains('Anić').should('be.visible');
    cy.contains('ana@test.com').should('be.visible');

    cy.contains('Strana 1 / 2').should('be.visible');
    cy.contains('Prethodna').should('be.disabled');
    cy.contains('Sledeca').should('not.be.disabled');
  });

  it('renders empty state when no clients are returned', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/clients',
      },
      emptyClientsPage
    ).as('getClientsEmpty');

    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClientsEmpty');

    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Nema klijenata za prikaz').should('be.visible');
    cy.contains('Strana 1 / 1').should('be.visible');
  });

  it('supports search by first name', () => {
    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClients');

    cy.get('input[placeholder="Pretraga po imenu, prezimenu ili email-u"]').type('Ana');
    cy.wait('@getClients');

    cy.contains('Ana').should('be.visible');
    cy.contains('Anić').should('be.visible');
    cy.get('table').contains('Marko').should('not.exist');
  });

  it('shows empty state when search returns no results', () => {
    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClients');

    cy.get('input[placeholder="Pretraga po imenu, prezimenu ili email-u"]').type('zzz');
    cy.wait('@getClients');

    cy.contains('Nema klijenata za prikaz').should('be.visible');
  });

  it('supports pagination between pages', () => {
    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClients');

    cy.contains('Sledeca').click();
    cy.wait('@getClients');

    cy.contains('Petar').should('be.visible');
    cy.contains('Petrović').should('be.visible');
    cy.contains('Strana 2 / 2').should('be.visible');

    cy.contains('Prethodna').should('not.be.disabled');
    cy.contains('Sledeca').should('be.disabled');

    cy.contains('Prethodna').click();
    cy.wait('@getClients');

    cy.contains('Marko').should('be.visible');
    cy.contains('Strana 1 / 2').should('be.visible');
  });

  it('opens client details from the list and updates route', () => {
    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClients');

    cy.contains('tr', 'Marko').contains('Detalji').click();

    cy.url().should('include', '/employee/clients/1');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Detalji klijenta').should('be.visible');
    cy.get('#client-first-name').should('have.value', 'Marko');
    cy.get('#client-last-name').should('have.value', 'Marković');
    cy.get('#client-email').should('have.value', 'marko@test.com');
    cy.get('#client-phone').should('have.value', '060111111');
    cy.get('#client-address').should('have.value', 'Bulevar kralja Aleksandra 1');
    cy.get('#client-date-of-birth').should('have.value', '1995-05-10');
    cy.get('#client-gender').should('have.value', 'M');
  });

  it('loads details directly through /employee/clients/:id route', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Detalji klijenta').should('be.visible');
    cy.get('#client-first-name').should('have.value', 'Marko');
    cy.get('#client-email').should('have.value', 'marko@test.com');
  });

  it('loads client accounts in details section', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Racuni klijenta').should('be.visible');
    cy.contains('123-456789-00').should('be.visible');
    cy.contains('TEKUCI').should('be.visible');
    cy.contains('RSD').should('be.visible');
    cy.contains('1500.55').should('be.visible');
    cy.contains('ACTIVE').should('be.visible');

    cy.contains('555-666777-88').should('be.visible');
    cy.contains('POSLOVNI').should('be.visible');
    cy.contains('EUR').should('be.visible');
  });

  it('shows no accounts message when client has no accounts', () => {
    cy.visit('/employee/clients/2', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient2');
    cy.wait('@getAccountsAna');

    cy.contains('Racuni klijenta').should('be.visible');
    cy.contains('Nema racuna za ovog klijenta').should('be.visible');
  });

  it('enters edit mode and enables form fields', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Izmeni').click();

    cy.get('#client-first-name').should('not.be.disabled');
    cy.get('#client-last-name').should('not.be.disabled');
    cy.get('#client-email').should('not.be.disabled');
    cy.get('#client-phone').should('not.be.disabled');
    cy.get('#client-address').should('not.be.disabled');
    cy.get('#client-date-of-birth').should('not.be.disabled');
    cy.get('#client-gender').should('not.be.disabled');

    cy.contains('Sacuvaj').should('be.visible');
    cy.contains('Otkazi').should('be.visible');
  });

  it('cancel edit restores original values', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Izmeni').click();

    cy.get('#client-first-name').clear().type('Privremeno ime');
    cy.get('#client-phone').clear().type('060888888');
    cy.get('#client-address').clear().type('Privremena adresa');

    cy.contains('Otkazi').click();

    cy.get('#client-first-name').should('have.value', 'Marko');
    cy.get('#client-phone').should('have.value', '060111111');
    cy.get('#client-address').should('have.value', 'Bulevar kralja Aleksandra 1');
  });

  it('saves edited client data successfully', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Izmeni').click();

    cy.get('#client-first-name').clear().type('Marko Updated');
    cy.get('#client-phone').clear().type('060999999');
    cy.get('#client-address').clear().type('Nova adresa 99');

    cy.contains('Sacuvaj').click();

    cy.wait('@updateClient1')
      .its('request.body')
      .should((body) => {
        expect(body.firstName).to.equal('Marko Updated');
        expect(body.lastName).to.equal('Marković');
        expect(body.email).to.equal('marko@test.com');
        expect(body.phoneNumber).to.equal('060999999');
        expect(body.address).to.equal('Nova adresa 99');
        expect(body.dateOfBirth).to.equal('1995-05-10');
        expect(body.gender).to.equal('M');
      });

    cy.get('#client-first-name').should('have.value', 'Marko Updated');
    cy.get('#client-phone').should('have.value', '060999999');
    cy.get('#client-address').should('have.value', 'Nova adresa 99');
  });

  it('returns to clients list when closing details', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Zatvori detalje').click();

    cy.url().should('include', '/employee/clients');
    cy.url().should('not.include', '/employee/clients/1');
    cy.contains('Detalji klijenta').should('not.exist');
  });

  it('navigates to regular account details page', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('tr', '123-456789-00').contains('Otvori').click();
    cy.url().should('include', '/accounts/101');
    cy.url().should('not.include', '/business');
  });

  it('navigates to business account details page', () => {
    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('tr', '555-666777-88').contains('Otvori').click();
    cy.url().should('include', '/accounts/102/business');
  });

  it('handles invalid client id route gracefully', () => {
    cy.visit('/employee/clients/abc', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Detalji klijenta').should('not.exist');
  });

  it('handles getAll error state gracefully', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/clients',
      },
      {
        statusCode: 500,
        body: { message: 'Internal server error' },
      }
    ).as('getClientsError');

    cy.visit('/employee/clients', { onBeforeLoad(win) { setAdminSession(win); } });
    cy.wait('@getClientsError');

    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Nema klijenata za prikaz').should('be.visible');
  });

  it('handles getById error state gracefully', () => {
    cy.intercept(
      { method: 'GET', pathname: '/api/clients/1' },
      {
        statusCode: 404,
        body: { message: 'Client not found' },
      }
    ).as('getClient1NotFound');

    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1NotFound');

    cy.contains('h1', 'Portal klijenata').should('be.visible');
    cy.contains('Detalji klijenta').should('not.exist');
  });

  it('handles update error state gracefully', () => {
    cy.intercept(
      { method: 'PUT', pathname: '/api/clients/1' },
      {
        statusCode: 500,
        body: { message: 'Update failed' },
      }
    ).as('updateClient1Error');

    cy.visit('/employee/clients/1', { onBeforeLoad(win) { setAdminSession(win); } });

    cy.wait('@getClients');
    cy.wait('@getClient1');
    cy.wait('@getAccountsMarko');

    cy.contains('Izmeni').click();

    cy.get('#client-first-name').clear().type('Neuspešna izmena');
    cy.contains('Sacuvaj').click();

    cy.wait('@updateClient1Error');

    cy.get('#client-first-name').should('have.value', 'Neuspešna izmena');
    cy.contains('Otkazi').should('be.visible');
  });
});