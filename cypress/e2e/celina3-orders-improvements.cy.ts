/// <reference types="cypress" />

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJwt(role: 'ADMIN' | 'CLIENT', email: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  );

  return `${header}.${payload}.signature`;
}

describe('Celina 3 - My Orders improvements', () => {
  const clientEmail = 'milica.nikolic@gmail.com';

  type TestOrder = {
    id: number;
    listingId: number;
    userName: string;
    userRole: string;
    listingTicker: string;
    listingName: string;
    listingType: 'STOCK' | 'FUTURES' | 'FOREX';
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    quantity: number;
    contractSize: number;
    pricePerUnit: number;
    limitValue?: number;
    stopValue?: number;
    direction: 'BUY' | 'SELL';
    status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'DONE';
    approvedBy: string;
    isDone: boolean;
    remainingPortions: number;
    afterHours: boolean;
    allOrNone: boolean;
    margin: boolean;
    approximatePrice: number;
    createdAt: string;
    lastModification: string;
  };

  const buildOrder = (overrides: Partial<TestOrder> = {}): TestOrder => ({
    id: 1000,
    listingId: 5000,
    userName: 'Milica Nikolic',
    userRole: 'CLIENT',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 10,
    contractSize: 1,
    pricePerUnit: 190,
    direction: 'BUY',
    status: 'PENDING',
    approvedBy: '',
    isDone: false,
    remainingPortions: 10,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 1900,
    createdAt: '2026-03-28T10:00:00Z',
    lastModification: '2026-03-28T10:00:00Z',
    ...overrides,
  });

  const paginateOrders = (orders: TestOrder[], page: number, size: number) => {
    const start = page * size;
    const end = start + size;

    return {
      content: orders.slice(start, end),
      totalElements: orders.length,
      totalPages: Math.max(1, Math.ceil(orders.length / size)),
      number: page,
      size,
    };
  };

  const seedClientSession = (win: Window) => {
    const user = {
      id: 100,
      email: clientEmail,
      username: 'milica.nikolic',
      firstName: 'Milica',
      lastName: 'Nikolic',
      role: 'CLIENT',
      permissions: [],
    };

    win.sessionStorage.setItem('accessToken', createJwt('CLIENT', clientEmail));
    win.sessionStorage.setItem('refreshToken', 'test-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify(user));
  };

  const mockCurrentUser = () => {
    const body = {
      id: 100,
      email: clientEmail,
      firstName: 'Milica',
      lastName: 'Nikolic',
      role: 'CLIENT',
      permissions: [],
    };

    cy.intercept('GET', '**/auth/me**', { statusCode: 200, body }).as('authMe');
    cy.intercept('GET', '**/users/me**', { statusCode: 200, body }).as('usersMe');
    cy.intercept('GET', '**/user/me**', { statusCode: 200, body }).as('userMe');
    cy.intercept('GET', '**/current-user**', { statusCode: 200, body }).as('currentUser');
  };

  const visitMyOrdersPage = (useClock = false) => {
    mockCurrentUser();

    // Intercept common endpoints that layout/sidebar may call
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
    cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });

    if (useClock) {
      cy.clock(new Date('2026-03-28T10:00:00Z').getTime(), ['setInterval', 'clearInterval']);
    }

    cy.visit('/orders/my', {
      onBeforeLoad: (win) => seedClientSession(win),
      failOnStatusCode: false,
    });

    cy.contains('h1', 'Moji nalozi', { timeout: 15000 }).should('be.visible');
    cy.get('main').contains('Pregled naloga').should('be.visible');
  };

  const getOrderRow = (label: string) => cy.contains('tbody tr', label);

  it('prikazuje progress bar samo za izvrsene APPROVED i DONE ordere sa tacnim procentima i stilovima', () => {
    const orders = [
      buildOrder({
        id: 1101,
        listingTicker: 'IBM',
        listingName: 'International Business Machines',
        quantity: 100,
        remainingPortions: 55,
        status: 'APPROVED',
        approvedBy: 'Supervisor Elena',
        approximatePrice: 14500,
        createdAt: '2026-03-28T12:00:00Z',
      }),
      buildOrder({
        id: 1102,
        listingTicker: 'TSLA',
        listingName: 'Tesla Inc.',
        quantity: 12,
        remainingPortions: 0,
        status: 'DONE',
        approvedBy: 'Supervisor Elena',
        isDone: true,
        approximatePrice: 2640,
        createdAt: '2026-03-28T11:00:00Z',
      }),
      buildOrder({
        id: 1103,
        listingTicker: 'ORCL',
        listingName: 'Oracle Corp.',
        quantity: 40,
        remainingPortions: 40,
        status: 'APPROVED',
        approvedBy: 'Supervisor Elena',
        approximatePrice: 4800,
        createdAt: '2026-03-28T10:00:00Z',
      }),
      buildOrder({
        id: 1104,
        listingTicker: 'SAP',
        listingName: 'SAP SE',
        quantity: 15,
        remainingPortions: 15,
        status: 'PENDING',
        approximatePrice: 1800,
        createdAt: '2026-03-28T09:00:00Z',
      }),
      buildOrder({
        id: 1105,
        listingTicker: 'EUR/USD',
        listingName: 'Euro / US Dollar',
        listingType: 'FOREX',
        quantity: 20,
        remainingPortions: 20,
        status: 'DECLINED',
        direction: 'SELL',
        approximatePrice: 2200,
        createdAt: '2026-03-28T08:00:00Z',
      }),
    ];

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);

      req.reply({
        statusCode: 200,
        body: paginateOrders(orders, page, size),
      });
    }).as('getMyOrders');

    visitMyOrdersPage(true);

    cy.wait('@getMyOrders')
      .its('request.query')
      .should((query) => {
        expect(query.page).to.equal('0');
        expect(query.size).to.equal('10');
      });

    // APPROVED + DONE orders show progress bars (IBM=APPROVED, TSLA=DONE, ORCL=APPROVED)
    cy.get('[role="progressbar"]').should('have.length.at.least', 2);

    getOrderRow('International Business Machines').within(() => {
      cy.contains('Odobren').should('be.visible');
      cy.contains('Izvrseno: 45/100 (45%)').should('be.visible');
      cy.get('[role="progressbar"]').should('exist');
      cy.contains('button', 'Otkazi').should('be.visible');
    });

    getOrderRow('Tesla Inc.').within(() => {
      cy.contains('Zavrsen').should('be.visible');
      cy.contains('Izvrseno: 12/12 (100%)').should('be.visible');
      cy.get('[role="progressbar"]').should('exist');
      cy.contains('button', 'Otkazi').should('not.exist');
    });

    getOrderRow('Oracle Corp.').within(() => {
      cy.contains('Odobren').should('be.visible');
      // APPROVED with 0% execution still shows progress bar
      cy.get('[role="progressbar"]').should('exist');
      cy.contains('Izvrseno: 0/40 (0%)').should('be.visible');
      cy.contains('button', 'Otkazi').should('be.visible');
    });

    getOrderRow('SAP SE').within(() => {
      cy.contains('Na cekanju').should('be.visible');
      cy.get('[role="progressbar"]').should('not.exist');
      cy.contains('button', 'Otkazi').should('be.visible');
    });

    getOrderRow('Euro / US Dollar').within(() => {
      cy.contains('Odbijen').should('be.visible');
      cy.get('[role="progressbar"]').should('not.exist');
      cy.contains('button', 'Otkazi').should('not.exist');
    });
  });

  it('zahteva potvrdu pre otkazivanja, salje PATCH decline i osvezava listu bez duplog submit-a', () => {
    const activeOrder = buildOrder({
      id: 1201,
      listingTicker: 'NFLX',
      listingName: 'Netflix Inc.',
      quantity: 10,
      remainingPortions: 7,
      status: 'APPROVED',
      approvedBy: 'Supervisor One',
      approximatePrice: 4200,
      createdAt: '2026-03-28T12:30:00Z',
      lastModification: '2026-03-28T12:31:00Z',
    });
    const secondaryOrder = buildOrder({
      id: 1202,
      listingTicker: 'AMZN',
      listingName: 'Amazon.com Inc.',
      status: 'PENDING',
      quantity: 3,
      remainingPortions: 3,
      approximatePrice: 900,
      createdAt: '2026-03-28T11:45:00Z',
    });
    const declinedOrder = {
      ...activeOrder,
      status: 'DECLINED' as const,
      approvedBy: '',
      isDone: false,
      lastModification: '2026-03-28T12:35:00Z',
    };

    let ordersState = [activeOrder, secondaryOrder];
    let ordersRequestCount = 0;
    let declineCallCount = 0;

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      ordersRequestCount += 1;
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);

      req.reply({
        statusCode: 200,
        body: paginateOrders(ordersState, page, size),
      });
    }).as('getMyOrders');

    cy.intercept('PATCH', '**/orders/1201/decline', (req) => {
      declineCallCount += 1;
      ordersState = [declinedOrder, secondaryOrder];

      req.reply({
        delay: 250,
        statusCode: 200,
        body: declinedOrder,
      });
    }).as('cancelOrder');

    visitMyOrdersPage();
    cy.wait('@getMyOrders');

    getOrderRow('Netflix Inc.').within(() => {
      cy.contains('Izvrseno: 3/10 (30%)').should('be.visible');
      cy.contains('button', 'Otkazi').click({ force: true });
    });

    cy.contains('Otkazi nalog').should('be.visible');
    cy.contains('Da li ste sigurni da zelite da otkazete nalog').should('be.visible');
    cy.contains('#1201 (NFLX · Netflix Inc.)').should('be.visible');

    cy.then(() => {
      expect(declineCallCount).to.equal(0);
    });

    cy.contains('button', 'Odustani').click({ force: true });
    cy.contains('Otkazi nalog').should('not.exist');

    getOrderRow('Netflix Inc.').within(() => {
      cy.contains('button', 'Otkazi').click({ force: true });
    });

    cy.contains('Otkazi nalog').should('be.visible');
    cy.contains('button', 'Potvrdi otkazivanje').click({ force: true });
    cy.contains('button', 'Obrada...').should('be.disabled');

    cy.wait('@cancelOrder').then((interception) => {
      expect(interception.request.method).to.equal('PATCH');
      expect(interception.request.url).to.match(/\/orders\/1201\/decline$/);
    });

    cy.contains('Order je otkazan').should('be.visible');
    cy.contains('Otkazi nalog').should('not.exist');

    cy.then(() => {
      expect(declineCallCount).to.equal(1);
      expect(ordersRequestCount).to.be.greaterThan(1);
    });

    getOrderRow('Netflix Inc.').within(() => {
      cy.contains('Odbijen').should('be.visible');
      cy.contains('button', 'Otkazi').should('not.exist');
      cy.get('[role="progressbar"]').should('not.exist');
      cy.contains('Izvrseno:').should('not.exist');
    });
  });

  it('prikazuje gresku na neuspesno otkazivanje i ne refresha listu dok korisnik ne odustane', () => {
    const pendingOrder = buildOrder({
      id: 1301,
      listingTicker: 'META',
      listingName: 'Meta Platforms',
      status: 'PENDING',
      quantity: 8,
      remainingPortions: 8,
      approximatePrice: 2560,
      createdAt: '2026-03-28T14:00:00Z',
    });

    let ordersRequestCount = 0;

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      ordersRequestCount += 1;
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);

      req.reply({
        statusCode: 200,
        body: paginateOrders([pendingOrder], page, size),
      });
    }).as('getMyOrders');

    cy.intercept('PATCH', '**/orders/1301/decline', (req) => {
      req.reply({
        delay: 250,
        statusCode: 500,
        body: { message: 'Internal Server Error' },
      });
    }).as('cancelOrderFail');

    visitMyOrdersPage();
    cy.wait('@getMyOrders');

    let baselineOrderRequests = 0;

    cy.then(() => {
      baselineOrderRequests = ordersRequestCount;
    });

    getOrderRow('Meta Platforms').within(() => {
      cy.contains('button', 'Otkazi').click({ force: true });
    });

    cy.contains('Otkazi nalog').should('be.visible');
    cy.contains('button', 'Potvrdi otkazivanje').click({ force: true });
    cy.contains('button', 'Obrada...').should('be.disabled');

    cy.wait('@cancelOrderFail').then((interception) => {
      expect(interception.request.method).to.equal('PATCH');
      expect(interception.request.url).to.match(/\/orders\/1301\/decline$/);
    });

    cy.contains('Otkazi nalog').should('be.visible');
    cy.contains('button', 'Potvrdi otkazivanje').should('be.enabled');

    cy.then(() => {
      expect(ordersRequestCount).to.equal(baselineOrderRequests);
    });

    getOrderRow('Meta Platforms').within(() => {
      cy.contains('Na cekanju').should('be.visible');
      cy.contains('button', 'Otkazi').should('be.visible');
    });

    cy.contains('button', 'Odustani').click({ force: true });
    cy.contains('Otkazi nalog').should('not.exist');
  });

  it('polluje APPROVED ordere na 5 sekundi i zaustavlja polling kada order postane DONE, uz sinhronizaciju otvorenih detalja', () => {
    const executingOrder = buildOrder({
      id: 1401,
      listingTicker: 'AMD',
      listingName: 'Advanced Micro Devices',
      quantity: 10,
      remainingPortions: 6,
      status: 'APPROVED',
      approvedBy: 'Supervisor Poll',
      approximatePrice: 1800,
      createdAt: '2026-03-28T15:00:00Z',
      lastModification: '2026-03-28T15:01:00Z',
    });
    const completedOrder = {
      ...executingOrder,
      status: 'DONE' as const,
      remainingPortions: 0,
      approvedBy: 'Supervisor Poll',
      isDone: true,
      lastModification: '2026-03-28T15:06:00Z',
    };
    const expectedUpdatedTimestamp = new Date(completedOrder.lastModification).toLocaleString(
      'sr-RS'
    );

    let currentOrders = [executingOrder];
    let ordersRequestCount = 0;

    cy.intercept('GET', '**/api/orders/my*', (req) => {
      ordersRequestCount += 1;
      const page = Number(req.query.page ?? 0);
      const size = Number(req.query.size ?? 10);

      req.reply({
        statusCode: 200,
        body: paginateOrders(currentOrders, page, size),
      });
    }).as('getMyOrdersPolling');

    visitMyOrdersPage(true);
    cy.wait('@getMyOrdersPolling');

    getOrderRow('Advanced Micro Devices').within(() => {
      cy.contains('Odobren').should('be.visible');
      cy.contains('Izvrseno: 4/10 (40%)').should('be.visible');
      cy.contains('button', 'Otkazi').should('be.visible');
      cy.contains('button', 'Detalji').click({ force: true });
    });

    cy.contains('Detalji naloga').should('be.visible');
    cy.contains('AMD · Advanced Micro Devices').should('be.visible');
    cy.contains('span', 'Status').parent().should('contain.text', 'Odobren');
    cy.contains('span', 'Preostalo').parent().should('contain.text', '6');

    cy.then(() => {
      currentOrders = [completedOrder];
    });

    cy.tick(5000);
    cy.wait('@getMyOrdersPolling');

    getOrderRow('Advanced Micro Devices').within(() => {
      cy.contains('Zavrsen').should('be.visible');
      cy.contains('Izvrseno: 10/10 (100%)').should('be.visible');
      cy.get('button').should('have.length', 1).and('contain.text', 'Detalji');
    });

    cy.contains('span', 'Status').parent().should('contain.text', 'Zavrsen');
    cy.contains('span', 'Preostalo').parent().should('contain.text', '0');
    cy.contains('span', 'Poslednja izmena')
      .parent()
      .should('contain.text', expectedUpdatedTimestamp);

    let callsAfterCompletion = 0;

    cy.then(() => {
      callsAfterCompletion = ordersRequestCount;
    });

    cy.tick(15000);

    cy.then(() => {
      expect(ordersRequestCount).to.equal(callsAfterCompletion);
    });
  });
});
