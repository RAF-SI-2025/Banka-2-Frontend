const mockEmployee = {
  id: 1,
  firstName: 'Petar',
  lastName: 'Petrović',
  username: 'petar90',
  email: 'petar@banka.com',
  position: 'Software Developer',
  phoneNumber: '+381 60 1234567',
  isActive: true,
  permissions: ['ADMIN'],
  jmbg: '1234567890123',
  address: 'Beograd, Srbija',
  dateOfBirth: '1990-05-15',
  gender: 'M',
  department: 'IT',
  role: 'EMPLOYEE',
};

describe('Employee Edit - Select dropdown-ovi (FE-05)', () => {
  beforeEach(() => {
    // Mock API za employee podatke
    cy.intercept('GET', '**/api/employees/1', {
      statusCode: 200,
      body: mockEmployee,
    }).as('getEmployee');

    // Login sa test korisnikom
    cy.visit('/login');
    cy.get('input#email').type('test@test.test');
    cy.get('input#password').type('test');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');

    // Idi na edit stranicu
    cy.visit('/admin/employees/1');
    cy.wait('@getEmployee');
  });

  it('prikazuje Select dropdown za Pol umesto text input-a', () => {
    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .should('exist');
  });

  it('Pol dropdown ima opcije M, F, O', () => {
    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .click();

    cy.contains('[role="option"]', 'Muški').should('be.visible');
    cy.contains('[role="option"]', 'Ženski').should('be.visible');
    cy.contains('[role="option"]', 'Ostalo').should('be.visible');
  });

  it('prikazuje Select dropdown za Poziciju', () => {
    cy.contains('label', 'Pozicija')
      .parent()
      .find('button[role="combobox"]')
      .should('exist');
  });

  it('Pozicija dropdown ima sve opcije', () => {
    cy.contains('label', 'Pozicija')
      .parent()
      .find('button[role="combobox"]')
      .click();

    cy.contains('[role="option"]', 'Software Developer').should('be.visible');
    cy.contains('[role="option"]', 'Project Manager').should('be.visible');
    cy.contains('[role="option"]', 'Team Lead').should('be.visible');
    cy.contains('[role="option"]', 'QA Engineer').should('be.visible');
    cy.contains('[role="option"]', 'Supervisor').should('be.visible');
  });

  it('prikazuje Select dropdown za Odeljenje', () => {
    cy.contains('label', 'Odeljenje')
      .parent()
      .find('button[role="combobox"]')
      .should('exist');
  });

  it('Odeljenje dropdown ima sve opcije', () => {
    cy.contains('label', 'Odeljenje')
      .parent()
      .find('button[role="combobox"]')
      .click();

    cy.contains('[role="option"]', 'IT').should('be.visible');
    cy.contains('[role="option"]', 'Finance').should('be.visible');
    cy.contains('[role="option"]', 'HR').should('be.visible');
    cy.contains('[role="option"]', 'Marketing').should('be.visible');
    cy.contains('[role="option"]', 'Operations').should('be.visible');
    cy.contains('[role="option"]', 'Legal').should('be.visible');
    cy.contains('[role="option"]', 'Risk Management').should('be.visible');
  });

  it('dropdown-ovi prikazuju ucitane vrednosti zaposlenog', () => {
    // Mock employee ima gender: 'M', position: 'Software Developer', department: 'IT'
    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .should('contain', 'Muški');

    cy.contains('label', 'Pozicija')
      .parent()
      .find('button[role="combobox"]')
      .should('contain', 'Software Developer');

    cy.contains('label', 'Odeljenje')
      .parent()
      .find('button[role="combobox"]')
      .should('contain', 'IT');
  });

  it('moze se izabrati vrednost iz Pol dropdown-a', () => {
    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .click();

    cy.contains('[role="option"]', 'Ženski').click();

    cy.contains('label', 'Pol')
      .parent()
      .find('button[role="combobox"]')
      .should('contain', 'Ženski');
  });
});
