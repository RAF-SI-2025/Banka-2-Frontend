import './commands'

// Prevent Cypress from failing tests on uncaught React/app exceptions
// (e.g. failed API calls during render, lazy-load errors, etc.)
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Return false to prevent the error from failing the test
  return false;
});

// Global: intercept auth refresh + fallback /api/** to prevent redirect loops
beforeEach(() => {
  // Auth refresh fallback — bez ovog, fake JWT-i bi failovali po api.ts interceptor-u
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({ sub: 'test@test.rs', role: 'CLIENT', active: true, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: `${header}.${payload}.fakesig`, refreshToken: 'fake-refresh-token' },
  });

  // Detekcija "live" testova — ako URL fajla sadrzi `-live.cy`, NE intercept-uj
  // sve pozive jer ti testovi traze pravu komunikaciju sa BE-om. Mock testovi
  // (`-mock.cy`, `arbitro-mock.cy`) dobijaju globalni `/api/**` fallback koji
  // sprecava 401 → /login redirect-e za nemock-ovane secondary calls.
  const specPath = (Cypress.spec && Cypress.spec.relative) || '';
  const isMockSpec = specPath.includes('-mock.cy');

  if (isMockSpec) {
    // Fallback: bilo koji nemock-ovani GET ka /api/** vraca 200 + []
    // (most APIs return arrays or pageable). Specific intercepts u
    // beforeEach/it imaju veci prioritet (LIFO match).
    cy.intercept({ method: 'GET', url: '**/api/**' }, { statusCode: 200, body: [] });

    // Pageable endpoint-i (orders, payments, employees) ocekuju paginirani
    // omotac. Stavljamo kao GET intercept koji se sam prebacuje preko gornjeg
    // za URL-e koji ocigledno traze pageable shape.
    cy.intercept(
      { method: 'GET', url: /\/api\/(orders|payments|loans|transfers|employees|listings|exchange-rates|funds|otc|tax)(\?|$|\/)/ },
      (req) => {
        // Ako put zavrsava na ID (npr. /api/funds/1), vraca {} jer je single-resource
        const lastSegment = req.url.split('?')[0].split('/').pop() || '';
        if (/^\d+$/.test(lastSegment)) {
          req.reply({ statusCode: 200, body: {} });
        } else {
          req.reply({
            statusCode: 200,
            body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
          });
        }
      },
    );

    // POST/PUT/PATCH/DELETE fallback-i — ne pucaju nego vracaju 200 sa empty body.
    cy.intercept({ method: 'POST', url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept({ method: 'PUT', url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept({ method: 'PATCH', url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept({ method: 'DELETE', url: '**/api/**' }, { statusCode: 204 });
  }
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
