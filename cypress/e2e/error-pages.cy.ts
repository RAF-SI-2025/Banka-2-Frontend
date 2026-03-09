function goToRoute(path: string) {
  cy.visit('/');

  cy.window().then((win) => {
    win.history.pushState({}, '', path);
    win.dispatchEvent(new PopStateEvent('popstate'));
  });
}

describe('FE-23 Error stranice', () => {
  it('404 stranica se prikazuje za nepostojeci URL', () => {
    goToRoute('/random-url-koji-ne-postoji');

    cy.contains('404').should('be.visible');
    cy.contains('Stranica nije pronađena').should('be.visible');
    cy.contains('Proverite da li ste ispravno uneli adresu').should('be.visible');
    cy.contains('Možda je stranica premeštena ili obrisana').should('be.visible');
  });

  it('dugme "Nazad na početnu" radi na 404 stranici', () => {
    goToRoute('/nepostojeca-stranica');

    cy.contains('Nazad na početnu').should('be.visible').click();
    cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
  });

  it('dugme "Prijavi se" radi na 404 stranici', () => {
    goToRoute('/404-test');

    cy.contains('Prijavi se').should('be.visible').click();
    cy.url().should('include', '/login');
  });

  it('ruta /403 prikazuje Forbidden stranicu', () => {
    goToRoute('/403');

    cy.contains('403').should('be.visible');
    cy.contains('Nemate dozvolu za pristup').should('be.visible');
    cy.contains('Nemate potrebne permisije za ovu stranicu').should('be.visible');
  });

  it('dugme "Nazad na početnu" radi na 403 stranici', () => {
    goToRoute('/403');

    cy.contains('Nazad na početnu').click();
    cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
  });

  it('ruta /500 prikazuje Server Error stranicu', () => {
    goToRoute('/500');

    cy.contains('500').should('be.visible');
    cy.contains('Došlo je do greške na serveru').should('be.visible');
    cy.contains('Pokušajte ponovo za par minuta').should('be.visible');
  });

  it('dugme "Nazad na početnu" radi na 500 stranici', () => {
    goToRoute('/500');

    cy.contains('Nazad na početnu').click();
    cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
  });

  it('dugme "Pokušaj ponovo" postoji na 500 stranici', () => {
    goToRoute('/500');

    cy.contains('Pokušaj ponovo').should('be.visible');
  });

  it('bilo koji nepostojeci URL vodi na 404 stranicu', () => {
    goToRoute('/nesto-totalno-random-123456');

    cy.contains('404').should('be.visible');
  });
});