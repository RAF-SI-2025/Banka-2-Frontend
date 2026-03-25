/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}


describe('Dashboard - Prikaz kartice i statistike', () => {
    describe('Admin korisnik', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/employees*', {
                statusCode: 200,
                body: {
                    content: [],
                    totalElements: 0,
                    totalPages: 0,
                    size: 10,
                    number: 0,
                },
            }).as('getEmployees');

            cy.visit('/home', {
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

            // Čekaj da se stranica učita
            cy.contains('Dobrodošli, Admin!', { timeout: 10000 }).should('be.visible');
        });

        it('prikazuje welcome sekciju sa imenom korisnika', () => {
            cy.contains('h1', 'Dobrodošli, Admin!').should('be.visible');
            cy.contains('p', 'Banka 2025 — Interni portal').should('be.visible');
        });

        it('prikazuje statistiku zaposlenih', () => {
            // Proveravam da sve tri statisticke kartice postoje
            cy.contains('Ukupno zaposlenih').should('be.visible');
            cy.contains('Aktivnih zaposlenih').should('be.visible');
            cy.contains('Neaktivnih zaposlenih').should('be.visible');
        });

        it('prikazuje admin akcije kartice', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').should('be.visible');
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').should('be.visible');
        });

        it('prikazuje brze akcije naslov', () => {
            cy.contains('Brze akcije').should('be.visible');
        });

        it('preusmera na stranicu zaposlenih pri kliku', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').click();
            cy.url().should('include', '/admin/employees');
        });

        it('preusmera na stranicu kreiranja pri kliku', () => {
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').click();
            cy.url().should('include', '/admin/employees/new');
        });
    });

    describe('Obični korisnik', () => {
        beforeEach(() => {
            cy.visit('/home', {
                onBeforeLoad(win) {
                    win.sessionStorage.setItem('accessToken', _fakeJwt('CLIENT', 'test@test.com'));
                    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
                    win.sessionStorage.setItem(
                        'user',
                        JSON.stringify({
                            id: 2,
                            email: 'user@test.com',
                            username: 'user',
                            firstName: 'John',
                            lastName: 'Doe',
                            permissions: ['VIEW_STOCKS'],
                        })
                    );
                },
            });

            cy.contains('Dobrodošli, John!', { timeout: 10000 }).should('be.visible');
        });

        it('prikazuje welcome sekciju sa imenima korisnika', () => {
            cy.contains('h1', 'Dobrodošli, John!').should('be.visible');
        });

        it('ne prikazuje statistiku zaposlenih', () => {
            cy.contains('Ukupno zaposlenih').should('not.exist');
            cy.contains('Aktivnih zaposlenih').should('not.exist');
            cy.contains('Neaktivnih zaposlenih').should('not.exist');
        });

        it('ne prikazuje admin kartice', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').should('not.exist');
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').should('not.exist');
        });
    });
});
