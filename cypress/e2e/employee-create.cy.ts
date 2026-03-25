/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}

describe('Employee Create - validacija prazne forme', () => {

  beforeEach(() => {

    cy.visit('/admin/employees/new', {
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

    cy.contains('Kreiranje novog zaposlenog', { timeout: 10000 })
      .should('be.visible');

  });


  it('klik na kreiraj bez unosa prikazuje validacione greske', () => {

    cy.get('[data-cy="createBtn"]')
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });


    cy.get('#firstName').should('have.class', 'border-destructive');
    cy.get('#lastName').should('have.class', 'border-destructive');
    cy.get('#dateOfBirth').should('have.class', 'border-destructive');

    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .should('have.class', 'border-destructive');

    cy.get('#email').should('have.class', 'border-destructive');
    cy.get('#phoneNumber').should('have.class', 'border-destructive');
    cy.get('#address').should('have.class', 'border-destructive');

    cy.get('#username').should('have.class', 'border-destructive');
    cy.get('[data-cy="position-select"]').should('have.class', 'border-destructive');
    cy.get('[data-cy="department-select"]').should('have.class', 'border-destructive');

  });

});