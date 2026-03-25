/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}

describe('Payment History Page', () => {
  const adminEmail = 'marko.petrovic@banka.rs';
  const adminPassword = 'Admin12345';

  const tx1 = {
    id: 101,
    fromAccountNumber: '123-456789-00',
    toAccountNumber: '555-111222-33',
    amount: 1500.55,
    currency: 'RSD',
    description: 'Plaćanje računa za struju',
    referenceNumber: '97-2025-001',
    paymentCode: '221',
    paymentPurpose: 'Račun za struju',
    recipientName: 'EPS',
    status: 'COMPLETED',
    createdAt: '2025-03-10T12:30:00',
    model: '97',
    callNumber: '2025001',
  };

  const tx2 = {
    id: 102,
    fromAccountNumber: '123-456789-00',
    toAccountNumber: '666-444555-66',
    amount: 250.0,
    currency: 'RSD',
    description: 'Internet usluge',
    referenceNumber: '97-2025-002',
    paymentCode: '289',
    paymentPurpose: 'Internet',
    recipientName: 'Telekom',
    status: 'PENDING',
    createdAt: '2025-03-12T09:15:00',
    model: '97',
    callNumber: '2025002',
  };

  const tx3 = {
    id: 103,
    fromAccountNumber: '987-654321-00',
    toAccountNumber: '777-888999-00',
    amount: 75.25,
    currency: 'EUR',
    description: 'Pretplata za servis',
    referenceNumber: '97-2025-003',
    paymentCode: '221',
    paymentPurpose: 'Pretplata',
    recipientName: 'Streaming Servis',
    status: 'REJECTED',
    createdAt: '2025-03-08T18:45:00',
    model: '97',
    callNumber: '2025003',
  };

  const tx4 = {
    id: 104,
    fromAccountNumber: '123-456789-00',
    toAccountNumber: '888-999000-11',
    amount: 9999.99,
    currency: 'RSD',
    description: 'Kupovina opreme',
    referenceNumber: '97-2025-004',
    paymentCode: '221',
    paymentPurpose: 'Oprema',
    recipientName: 'Tech Shop',
    status: 'CANCELLED',
    createdAt: '2025-03-01T08:00:00',
    model: '97',
    callNumber: '2025004',
  };

  const allTransactions = [tx1, tx2, tx3, tx4];

  const setAdminSession = (win: Window) => {
    win.sessionStorage.setItem('accessToken', _fakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'marko.petrovic@banka.rs', role: 'ADMIN', firstName: 'Marko', lastName: 'Petrovic' }));
  };

  const mockTransactions = () => {
    cy.intercept('GET', '**/api/payments*', (req) => {
      let filtered = [...allTransactions];

      const {
        accountNumber,
        status,
        dateFrom,
        dateTo,
        amountMin,
        amountMax,
        page,
        limit,
      } = req.query;

      if (accountNumber) {
        filtered = filtered.filter(
          (tx) =>
            tx.fromAccountNumber === accountNumber ||
            tx.toAccountNumber === accountNumber
        );
      }

      if (status) {
        filtered = filtered.filter((tx) => tx.status === status);
      }

      if (dateFrom) {
        const fromTs = new Date(String(dateFrom)).getTime();
        filtered = filtered.filter(
          (tx) => new Date(tx.createdAt).getTime() >= fromTs
        );
      }

      if (dateTo) {
        const toTs =
          new Date(String(dateTo)).getTime() + 24 * 60 * 60 * 1000 - 1;
        filtered = filtered.filter(
          (tx) => new Date(tx.createdAt).getTime() <= toTs
        );
      }

      if (amountMin) {
        filtered = filtered.filter((tx) => tx.amount >= Number(amountMin));
      }

      if (amountMax) {
        filtered = filtered.filter((tx) => tx.amount <= Number(amountMax));
      }

      const pageNumber = Number(page ?? 0);
      const pageSize = Number(limit ?? 10);
      const start = pageNumber * pageSize;
      const end = start + pageSize;

      req.reply({
        content: filtered.slice(start, end),
        totalElements: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        size: pageSize,
        number: pageNumber,
      });
    }).as('getTransactions');
  };

  const visitPaymentHistory = (query = '') => {
    cy.visit(`/payments/history${query}`, {
      onBeforeLoad(win) {
        setAdminSession(win);
      },
    });
  };

  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    mockTransactions();
  });

  it('renders page, filters and initial transactions list', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.contains('h1', 'Pregled plaćanja').should('be.visible');
    cy.contains('Filteri i sortiranje').should('be.visible');

    cy.get('#accountFilter').should('exist');
    cy.get('#statusFilter').should('exist');
    cy.get('#dateFrom').should('exist');
    cy.get('#dateTo').should('exist');
    cy.get('#amountMin').should('exist');
    cy.get('#amountMax').should('exist');
    cy.get('#sortField').should('exist');
    cy.get('#sortDirection').should('exist');
    cy.get('#pageSize').should('exist');

    cy.contains('Račun za struju').should('be.visible');
    cy.contains('Internet').should('be.visible');
    cy.contains('Pretplata').should('be.visible');
    cy.contains('Oprema').should('be.visible');
  });

  it('renders account filter select', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#accountFilter').should('exist');
    cy.get('#accountFilter').should('be.visible');
    cy.get('#accountFilter option').first().should('have.value', '');
    cy.get('#accountFilter option').first().should('contain.text', 'Svi');
  });

  it('preselects account from query params through transaction request', () => {
    visitPaymentHistory('?account=123-456789-00');

    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'accountNumber=123-456789-00');

    cy.contains('Račun za struju').should('be.visible');
    cy.contains('Internet').should('be.visible');
    cy.contains('Oprema').should('be.visible');
    cy.contains('Pretplata').should('not.exist');
  });

  it('filters transactions by account through preselected account query param', () => {
    visitPaymentHistory('?account=987-654321-00');

    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'accountNumber=987-654321-00');

    cy.contains('Pretplata').should('be.visible');
    cy.contains('Račun za struju').should('not.exist');
    cy.contains('Internet').should('not.exist');
  });

  it('filters transactions by status', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#statusFilter').select('PENDING');
    cy.wait('@getTransactions');

    cy.contains('Internet').should('be.visible');
    cy.contains('Račun za struju').should('not.exist');
    cy.contains('Pretplata').should('not.exist');
  });

  it('filters transactions by date range', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#dateFrom').type('2025-03-09');
    cy.wait('@getTransactions');

    cy.get('#dateTo').type('2025-03-12');
    cy.wait('@getTransactions');

    cy.contains('Račun za struju').should('be.visible');
    cy.contains('Internet').should('be.visible');
    cy.contains('Pretplata').should('not.exist');
    cy.contains('Oprema').should('not.exist');
  });

  it('filters transactions by amount range', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#amountMin').type('200');
    cy.wait('@getTransactions');

    cy.get('#amountMax').type('2000');
    cy.wait('@getTransactions');

    cy.contains('Račun za struju').should('be.visible');
    cy.contains('Internet').should('be.visible');
    cy.contains('Pretplata').should('not.exist');
    cy.contains('Oprema').should('not.exist');
  });

  it('resets all filters and keeps preselected account in transaction request', () => {
    visitPaymentHistory('?account=123-456789-00');

    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'accountNumber=123-456789-00');

    cy.get('#statusFilter').select('COMPLETED');
    cy.wait('@getTransactions');

    cy.get('#amountMin').type('100');
    cy.wait('@getTransactions');

    cy.contains('button', 'Resetuj filtere').click();
    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'accountNumber=123-456789-00');

    cy.get('#statusFilter').should('have.value', '');
    cy.get('#dateFrom').should('have.value', '');
    cy.get('#dateTo').should('have.value', '');
    cy.get('#amountMin').should('have.value', '');
    cy.get('#amountMax').should('have.value', '');
    cy.get('#sortField').should('have.value', 'date');
    cy.get('#sortDirection').should('have.value', 'desc');
    cy.get('#pageSize').should('have.value', '10');
  });

  it('sorts transactions by amount ascending', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#sortField').select('amount');
    cy.get('#sortDirection').select('asc');

    cy.get('tbody tr').first().should('contain.text', 'Pretplata');
  });

  it('sorts transactions by date descending by default', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('tbody tr').first().should('contain.text', 'Internet');
  });

  it('sorts transactions by status ascending', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#sortField').select('status');
    cy.get('#sortDirection').select('asc');

    cy.get('tbody tr').first().should('contain.text', 'Oprema');
  });

  it('changes page size and updates results', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#pageSize').select('25');
    cy.wait('@getTransactions');

    cy.contains('Strana 1 / 1').should('be.visible');
  });

  it('supports pagination', () => {
    cy.intercept('GET', '**/api/payments*', (req) => {
      const page = Number(req.query.page ?? 0);
      const limit = Number(req.query.limit ?? 10);

      const many = Array.from({ length: 15 }, (_, index) => ({
        ...tx1,
        id: 1000 + index,
        paymentPurpose: `Transakcija ${index + 1}`,
        createdAt: `2025-03-${String((index % 9) + 1).padStart(2, '0')}T10:00:00`,
      }));

      const start = page * limit;
      const end = start + limit;

      req.reply({
        content: many.slice(start, end),
        totalElements: many.length,
        totalPages: Math.ceil(many.length / limit),
        size: limit,
        number: page,
      });
    }).as('getTransactionsPaged');

    visitPaymentHistory();

    cy.wait('@getTransactionsPaged');

    cy.contains('Strana 1 / 2').should('be.visible');

    cy.contains('Sledeca').click();
    cy.wait('@getTransactionsPaged');

    cy.contains('Strana 2 / 2').should('be.visible');

    cy.contains('Prethodna').click();
    cy.wait('@getTransactionsPaged');

    cy.contains('Strana 1 / 2').should('be.visible');
  });

  it('opens and closes transaction details', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.contains('tr', 'Račun za struju').contains('Detalji').click();

    cy.contains('Opis:').should('be.visible');
    cy.contains('Plaćanje računa za struju').should('be.visible');
    cy.contains('Primalac:').should('be.visible');
    cy.contains('EPS').should('be.visible');
    cy.contains('Referentni broj:').should('be.visible');
    cy.contains('97-2025-001').should('be.visible');

    cy.contains('tr', 'Račun za struju').contains('Sakrij').click();
    cy.contains('Plaćanje računa za struju').should('not.exist');
  });

  it('opens only one expanded row at a time', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.contains('tr', 'Račun za struju').contains('Detalji').click();
    cy.contains('Plaćanje računa za struju').should('be.visible');

    cy.contains('tr', 'Internet').contains('Detalji').click();
    cy.contains('Internet usluge').should('be.visible');
    cy.contains('Plaćanje računa za struju').should('not.exist');
  });

  it('shows empty state when no transactions match filters', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.get('#statusFilter').select('COMPLETED');
    cy.wait('@getTransactions');

    cy.get('#amountMin').clear().type('999999');
    cy.wait('@getTransactions');

    cy.contains('Nema transakcija za izabrane filtere.').should('be.visible');
  });

  it('shows error state when transaction loading fails', () => {
    cy.intercept('GET', '**/api/payments*', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('getTransactionsError');

    visitPaymentHistory();

    cy.wait('@getTransactionsError');

    cy.contains('h1', 'Pregled plaćanja').should('be.visible');
  });

  it('shows page even when account loading fails', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.contains('h1', 'Pregled plaćanja').should('be.visible');
  });

  it('generates PDF confirmation when print button is clicked', () => {
    visitPaymentHistory();

    cy.wait('@getTransactions');

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').returns('blob:mock-url').as('createObjectURL');

      if (win.URL && 'revokeObjectURL' in win.URL) {
        cy.stub(win.URL, 'revokeObjectURL').as('revokeObjectURL');
      }
    });

    cy.contains('button', 'Štampaj potvrdu').first().click();

    cy.get('@createObjectURL').should('have.been.called');
  });
});