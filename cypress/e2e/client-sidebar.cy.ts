/// <reference types="cypress" />

describe('FE2-18c - Client sidebar navigation', () => {
  const setClientSession = (win: Window) => {
    win.sessionStorage.setItem('accessToken', 'fake-access-token');
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        email: 'client@test.com',
        firstName: 'Test',
        lastName: 'Client',
        permissions: ['CLIENT'],
      })
    );
  };

  beforeEach(() => {
    cy.intercept('GET', '**/accounts/my', { statusCode: 200, body: [] }).as('accountsMy');
    cy.intercept('GET', '**/transactions*', { statusCode: 200, body: [] }).as('transactions');
    cy.intercept('GET', '**/recipients', { statusCode: 200, body: [] }).as('recipients');
    cy.intercept('GET', '**/exchange-rates', { statusCode: 200, body: [] }).as('exchangeRates');
    cy.intercept('POST', '**/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token' },
    }).as('refresh');

    cy.visit('/home', {
      onBeforeLoad(win) {
        setClientSession(win);
      },
    });
  });

  it('prikazuje sidebar sa svim klijentskim linkovima', () => {
    cy.contains('Moje finansije').should('be.visible');

    cy.get('aside a[href="/home"]').should('be.visible');
    cy.get('aside a[href="/accounts"]').should('be.visible');
    cy.get('aside a[href="/payments/new"]').should('be.visible');
    cy.get('aside a[href="/payments/recipients"]').should('be.visible');
    cy.get('aside a[href="/transfers"]').should('be.visible');
    cy.get('aside a[href="/payments/history"]').should('be.visible');
    cy.get('aside a[href="/exchange"]').should('be.visible');
    cy.get('aside a[href="/cards"]').should('be.visible');
    cy.get('aside a[href="/loans"]').should('be.visible');
  });

  it('highlightuje aktivan link u sidebaru', () => {
    cy.get('aside a[href="/home"]')
      .invoke('attr', 'class')
      .should('include', 'bg-primary/10');
  });

  it('navigira na Menjačnica klikom iz sidebara', () => {
    cy.get('aside a[href="/exchange"]').click();
    cy.location('pathname').should('eq', '/exchange');
  });

  it('navigira na Računi klikom iz sidebara', () => {
    cy.get('aside a[href="/accounts"]').click();
    cy.location('pathname').should('eq', '/accounts');
  });

  it('prikazuje sidebar sekcije za klijenta', () => {
    cy.contains('aside', 'Početna').should('be.visible');
    cy.contains('aside', 'Moje finansije').should('be.visible');
    cy.contains('aside', 'Računi').should('be.visible');
    cy.contains('aside', 'Plaćanja').should('be.visible');
    cy.contains('aside', 'Krediti').should('be.visible');
    cy.contains('aside', 'Employee portal').should('not.exist');
  });
});
