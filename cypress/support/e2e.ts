import './commands'

// Prevent Cypress from failing tests on uncaught React/app exceptions
// (e.g. failed API calls during render, lazy-load errors, etc.)
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Return false to prevent the error from failing the test
  return false;
});

// Global: intercept common API endpoints to prevent 403/400 noise
beforeEach(() => {
  // Only mock auth refresh - prevents redirect loops
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake' },
  });

  // Catch-all for common endpoints that pages may call during mount
  // These have low priority and will be overridden by test-specific intercepts
  cy.intercept('GET', '**/api/margin-accounts/**', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/portfolio/**', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/listings*', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/orders/**', { statusCode: 200, body: { content: [], totalElements: 0, totalPages: 0 } });
  cy.intercept('GET', '**/api/actuaries/**', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/tax*', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/exchanges', { statusCode: 200, body: [] });
});

// Global: fix "fake-access-token" that doesn't have JWT structure
// Replace it with a proper decodable fake JWT in sessionStorage
Cypress.on('window:before:load', (win) => {
  const token = win.sessionStorage.getItem('accessToken');
  if (token === 'fake-access-token' || token === 'fake') {
    // Detect role from user object if stored
    const userStr = win.sessionStorage.getItem('user');
    let role = 'CLIENT';
    let email = 'test@test.com';
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        role = user.role || 'CLIENT';
        email = user.email || 'test@test.com';
      } catch { /* ignore */ }
    }

    // Create properly decodable fake JWT
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = btoa(JSON.stringify({
      sub: email,
      role,
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    win.sessionStorage.setItem('accessToken', `${header}.${payload}.fakesig`);
  }
});
