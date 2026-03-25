
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}
describe('Employee Edit - UI poboljšanja', () => {
  it('edit stranica učitava podatke zaposlenog', () => {
    cy.intercept('GET', '**/api/employees/1', {
      statusCode: 200,
      body: {
        id: 1,
        firstName: 'Elena',
        lastName: 'Kalajdzic',
        username: 'elena',
        email: 'elena@test.com',
        position: 'Software Developer',
        phoneNumber: '+381601234567',
        isActive: true,
        jmbg: '1234567890123',
        address: 'Bulevar oslobođenja 1, Novi Sad',
        dateOfBirth: '2002-12-05',
        gender: 'F',
        department: 'IT',
        role: 'ADMIN',
        permissions: ['ADMIN'],
      },
    }).as('getEmployee');

    cy.visit('/', {
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

    cy.window().then((win) => {
      win.history.pushState({}, '', '/admin/employees/1');
      win.dispatchEvent(new PopStateEvent('popstate'));
    });

    cy.wait('@getEmployee');

    cy.get('[data-testid="employee-edit-form"]').should('exist');
    cy.contains('Izmeni zaposlenog: Elena Kalajdzic').should('be.visible');

    cy.contains('Lični podaci').should('be.visible');
    cy.contains('Kontakt').should('be.visible');
    cy.contains('Posao').should('be.visible');
    cy.contains('Permisije').should('be.visible');

    cy.get('input#firstName').should('have.value', 'Elena');
    cy.get('input#lastName').should('have.value', 'Kalajdzic');
    cy.get('input#email').should('have.value', 'elena@test.com');
    cy.get('input#username').should('have.value', 'elena');
  });
});