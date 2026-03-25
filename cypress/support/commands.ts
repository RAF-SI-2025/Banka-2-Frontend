/// <reference types="cypress" />

function base64UrlEncode(input: string) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createFakeJwt(role: string, email: string) {
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
  return `${header}.${payload}.fake-signature`;
}

function injectSession(win: Window, role: string, email: string, firstName: string, lastName: string) {
  const token = createFakeJwt(role, email);
  win.sessionStorage.setItem('accessToken', token);
  win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
  win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email, role, firstName, lastName }));
}

Cypress.Commands.add('loginAsAdmin', () => {
  cy.window().then((win) => {
    injectSession(win, 'ADMIN', 'marko.petrovic@banka.rs', 'Marko', 'Petrovic');
  });
});

Cypress.Commands.add('loginAsClient', () => {
  cy.window().then((win) => {
    injectSession(win, 'CLIENT', 'stefan.jovanovic@gmail.com', 'Stefan', 'Jovanovic');
  });
});

Cypress.Commands.add('mockCommonEndpoints', () => {
  cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake-access-token' } });
  cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/payment-recipients', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchange-rates', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
  cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/cards', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/transfers*', { statusCode: 200, body: [] });
});

// Helper za onBeforeLoad
export function setupAdminSession(win: Window) {
  injectSession(win, 'ADMIN', 'marko.petrovic@banka.rs', 'Marko', 'Petrovic');
}

export function setupClientSession(win: Window) {
  injectSession(win, 'CLIENT', 'stefan.jovanovic@gmail.com', 'Stefan', 'Jovanovic');
}

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
      loginAsClient(): Chainable<void>;
      mockCommonEndpoints(): Chainable<void>;
    }
  }
}
