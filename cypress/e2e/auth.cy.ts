/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


function base64UrlEncode(input: string) {
  return btoa(input)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(role: string, email = 'admin@test.com') {
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

describe('Auth flows', () => {
  it('login validacija prikazuje greske', () => {
    cy.visit('/login');

    cy.contains('Prijavi se').click();

    cy.get('#email').should('have.class', 'border-destructive');
    cy.get('#password').should('have.class', 'border-destructive');
  });

  it('login uspeh preusmerava na dashboard', () => {
    const accessToken = createJwt('ADMIN');

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        accessToken,
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
      },
    }).as('login');

    cy.visit('/login');

    cy.get('#email').type('admin@test.com');
    cy.get('#password').type('Admin12345');
    cy.contains('Prijavi se').click();

    cy.wait('@login');
    cy.url().should('include', '/dashboard');

    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('accessToken')).to.eq(accessToken);
      expect(win.sessionStorage.getItem('refreshToken')).to.eq('refresh-token');
    });
  });

  it('forgot password prikazuje success ekran', () => {
    cy.intercept('POST', '**/api/auth/password_reset/request', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('forgot');

    cy.visit('/forgot-password');

    cy.get('#email').type('user@test.com');
    cy.contains('Pošalji link za resetovanje').click();

    cy.wait('@forgot');
    cy.contains('Proverite vaš email').should('be.visible');
  });

  it('reset password zahteva token', () => {
    cy.visit('/reset-password');

    cy.contains('Nevažeći link za resetovanje lozinke').should('be.visible');
    cy.contains('Zatraži novi link').should('be.visible');
  });

  it('reset password uspeh prikazuje potvrdu', () => {
    cy.intercept('POST', '**/api/auth/password_reset/confirm', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('reset');

    cy.visit('/reset-password?token=test-token');

    cy.get('#newPassword').type('NovaLozinka12');
    cy.get('#confirmPassword').type('NovaLozinka12');
    cy.contains('Postavi novu lozinku').click();

    cy.wait('@reset');
    cy.contains('Lozinka uspešno promenjena!').should('be.visible');
  });

  it('activate account zahteva token', () => {
    cy.visit('/activate-account');

    cy.contains('Nevažeći link za aktivaciju').should('be.visible');
  });

  it('activate account uspeh prikazuje potvrdu', () => {
    cy.intercept('POST', '**/api/auth-employee/activate', {
      statusCode: 200,
      body: { message: 'OK' },
    }).as('activate');

    cy.visit('/activate-account?token=test-token');

    cy.get('#password').type('NovaLozinka12');
    cy.get('#confirmPassword').type('NovaLozinka12');
    cy.contains('Aktiviraj nalog').click();

    cy.wait('@activate');
    cy.contains('Nalog uspešno aktiviran!').should('be.visible');
  });

  it('admin route blokira non-admin korisnika', () => {
    cy.visit('/admin/employees', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
          'user',
          JSON.stringify({
            id: 2,
            email: 'user@test.com',
            username: 'user',
            firstName: 'User',
            lastName: 'Test',
            permissions: ['VIEW_STOCKS'],
          })
        );
      },
    });

    cy.url().should('include', '/403');
    cy.contains('Nemate dozvolu za pristup').should('be.visible');
  });

  it('admin korisnik vidi listu zaposlenih', () => {
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200,
      body: {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0,
      },
    }).as('employees');

    cy.visit('/admin/employees', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('accessToken', _fakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            email: 'admin@test.com',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            permissions: ['ADMIN'],
          })
        );
      },
    });

    cy.wait('@employees');
    cy.contains('Upravljanje zaposlenima').should('be.visible');
  });
});
