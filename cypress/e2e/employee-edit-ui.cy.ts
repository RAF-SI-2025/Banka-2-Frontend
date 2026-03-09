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

    cy.visit('/');

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